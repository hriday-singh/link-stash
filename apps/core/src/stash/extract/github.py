"""GitHub repo extractor supporting both API (token) and scrape backends."""

import contextlib
import os
import re
import subprocess
from datetime import UTC, datetime
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from stash.errors import Invalid
from stash.extract.fetch import fetch_page_text
from stash.store.models import Mention, SourceDoc

GITHUB_URL_RE = re.compile(
    r"^https?://(?:www\.)?github\.com/([^/?#\s]+)/([^/?#\s]+)",
    re.IGNORECASE,
)


class GithubRecord(BaseModel):
    """Normalized structured data extracted from a GitHub repository."""

    owner: str
    repo: str
    canonical_key: str
    url: str
    description: str | None = None
    stars: int = 0
    pushed_at: str | None = None
    license: str | None = None
    archived: bool = False
    topics: list[str] = Field(default_factory=list)
    language: str | None = None
    has_skill: bool = False
    has_plugin: bool = False
    has_mcp: bool = False
    backend: Literal["api", "scrape"]
    readme: str | None = None
    mentions: list[Mention] = Field(default_factory=list[Mention])


def parse_github_url(url: str) -> tuple[str, str]:
    """Extract (owner, repo) from a GitHub repository URL.

    Strips .git, tree/blob subpaths, query parameters, and fragments.
    """
    clean = url.strip()
    match = GITHUB_URL_RE.match(clean)
    if not match:
        raise Invalid(f"Invalid GitHub repository URL: {url}", {"url": url})
    owner = match.group(1)
    repo = match.group(2)
    if repo.endswith(".git"):
        repo = repo[:-4]
    return owner, repo


def normalize_github_key(owner: str, repo: str) -> str:
    """Returns canonical identity key: github:<owner>/<repo> in lowercase."""
    return f"github:{owner.lower()}/{repo.lower()}"


def resolve_github_token() -> str | None:
    """Resolve GitHub token from environment or gh CLI."""
    token = os.environ.get("GITHUB_TOKEN")
    if token and token.strip():
        return token.strip()
    try:
        proc = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            check=False,
            timeout=5,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except FileNotFoundError, subprocess.TimeoutExpired, OSError:
        pass
    return None


def extract_mentions_from_text(text: str) -> list[Mention]:
    """Find mentioned GitHub repos and Hugging Face models in markdown text."""
    mentions: list[Mention] = []
    seen: set[str] = set()

    # Outbound GitHub repos
    for m in re.finditer(r"https?://github\.com/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+)", text):
        o, r = m.group(1), m.group(2)
        if r.endswith(".git"):
            r = r[:-4]
        key = f"github:{o.lower()}/{r.lower()}"
        if key not in seen:
            seen.add(key)
            mentions.append(
                Mention(
                    kind="repo",
                    name=f"{o}/{r}",
                    url=f"https://github.com/{o}/{r}",
                )
            )

    # Outbound Hugging Face models / datasets
    for m in re.finditer(r"https?://huggingface\.co/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+)", text):
        o, r = m.group(1), m.group(2)
        if o in ("datasets", "spaces", "models", "docs", "blog", "api"):
            continue
        key = f"hf:model:{o.lower()}/{r.lower()}"
        if key not in seen:
            seen.add(key)
            mentions.append(
                Mention(
                    kind="model",
                    name=f"{o}/{r}",
                    url=f"https://huggingface.co/{o}/{r}",
                )
            )

    return mentions


def extract_github_api(
    owner: str,
    repo: str,
    token: str,
    client: httpx.Client,
) -> GithubRecord:
    """Extract repository metadata using GitHub REST API."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "stash-core",
    }

    # 1. Main repo metadata
    repo_url = f"https://api.github.com/repos/{owner}/{repo}"
    resp = client.get(repo_url, headers=headers)
    resp.raise_for_status()
    data: dict[str, Any] = resp.json()

    # Detect canonical owner/repo in case of redirects/renames
    full_name: str = data.get("full_name", f"{owner}/{repo}")
    if "/" in full_name:
        canonical_owner, canonical_repo = full_name.split("/", 1)
    else:
        canonical_owner, canonical_repo = owner, repo

    canonical_key = normalize_github_key(canonical_owner, canonical_repo)
    stars = int(data.get("stargazers_count", 0))
    description: str | None = data.get("description")
    archived = bool(data.get("archived", False))
    topics: list[str] = [str(t) for t in data.get("topics", [])]
    language: str | None = data.get("language")
    pushed_at: str | None = data.get("pushed_at")

    license_val: str | None = None
    if isinstance(data.get("license"), dict):
        license_dict: dict[str, Any] = data["license"]
        license_val = license_dict.get("spdx_id") or license_dict.get("name")

    # 2. Check recursive tree for skills, plugins, MCP servers
    has_skill = False
    has_plugin = False
    has_mcp = False

    tree_url = f"https://api.github.com/repos/{canonical_owner}/{canonical_repo}/git/trees/HEAD?recursive=1"
    try:
        tree_resp = client.get(tree_url, headers=headers)
        if tree_resp.status_code == 200:
            tree_data = tree_resp.json()
            items = tree_data.get("tree", [])
            for item in items:
                path: str = item.get("path", "")
                lower = path.lower()
                if path == "SKILL.md" or path.endswith("/SKILL.md"):
                    has_skill = True
                if (
                    lower == ".claude-plugin/plugin.json"
                    or lower.endswith("/plugin.json")
                    or lower == ".gemini/plugin.json"
                ):
                    has_plugin = True
                if (
                    lower in ("mcp.json", ".mcp.json")
                    or lower.endswith("/mcp.json")
                    or "mcp_server" in lower
                    or lower.startswith("mcp/")
                ):
                    has_mcp = True
    except httpx.HTTPError:
        pass

    # 3. Readme
    readme_text: str | None = None
    readme_url = f"https://api.github.com/repos/{canonical_owner}/{canonical_repo}/readme"
    try:
        readme_headers = {**headers, "Accept": "application/vnd.github.raw+json"}
        readme_resp = client.get(readme_url, headers=readme_headers)
        if readme_resp.status_code == 200:
            readme_text = readme_resp.text
    except httpx.HTTPError:
        pass

    mentions = extract_mentions_from_text(readme_text or "")
    # Exclude self repo from mentions
    mentions = [
        m
        for m in mentions
        if m.name.lower() != f"{canonical_owner.lower()}/{canonical_repo.lower()}"
    ]

    return GithubRecord(
        owner=canonical_owner,
        repo=canonical_repo,
        canonical_key=canonical_key,
        url=f"https://github.com/{canonical_owner}/{canonical_repo}",
        description=description,
        stars=stars,
        pushed_at=pushed_at,
        license=license_val,
        archived=archived,
        topics=topics,
        language=language,
        has_skill=has_skill,
        has_plugin=has_plugin,
        has_mcp=has_mcp,
        backend="api",
        readme=readme_text,
        mentions=mentions,
    )


def extract_github_scrape(
    owner: str,
    repo: str,
    client: httpx.Client | None = None,
) -> GithubRecord:
    """Extract repository metadata via HTML scraping and raw content probes."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    page_url = f"https://github.com/{owner}/{repo}"
    if client is not None:
        resp = client.get(page_url, headers=headers, follow_redirects=True)
        resp.raise_for_status()
        html = resp.text
        final_url_str = str(resp.url)
    else:
        status, html = fetch_page_text(page_url, headers=headers)
        if status >= 400:
            raise Invalid(
                f"Failed to fetch GitHub page ({status}): {page_url}",
                {"url": page_url, "status": status},
            )
        final_url_str = page_url

    # Resolve canonical owner/repo from final redirected URL or og:url
    final_path = urlparse(final_url_str).path.strip("/")
    path_parts = final_path.split("/")
    if len(path_parts) >= 2 and path_parts[0] and path_parts[1]:
        canonical_owner, canonical_repo = path_parts[0], path_parts[1]
    else:
        og_match = re.search(
            r'<meta\s+property="og:url"\s+content="https?://github\.com/([^/]+)/([^"/]+)', html
        )
        if og_match:
            canonical_owner, canonical_repo = og_match.group(1), og_match.group(2)
        else:
            canonical_owner, canonical_repo = owner, repo

    canonical_key = normalize_github_key(canonical_owner, canonical_repo)

    # Stars counter extraction
    stars = 0
    star_match = re.search(r'id="repo-stars-counter-star"[^>]*title="([\d,]+)"', html)
    if not star_match:
        star_match = re.search(r'href="/[^/]+/[^/]+/stargazers"[^>]*title="([\d,]+)"', html)
    if not star_match:
        star_match = re.search(r'<span[^>]*class="[^"]*Counter[^"]*"[^>]*title="([\d,]+)"', html)
    if star_match:
        stars_str = star_match.group(1).replace(",", "")
        with contextlib.suppress(ValueError):
            stars = int(stars_str)

    # Description extraction
    description: str | None = None
    desc_match = re.search(r'<p\s+class="f4[^"]*">\s*(.*?)\s*</p>', html, re.DOTALL)
    if desc_match:
        description = re.sub(r"<[^>]+>", "", desc_match.group(1)).strip() or None
    if not description:
        og_desc = re.search(r'<meta\s+property="og:description"\s+content="(.*?)"', html)
        if og_desc:
            description = og_desc.group(1).strip() or None

    # Topics extraction
    topics: list[str] = []
    for topic_m in re.finditer(r'class="topic-tag[^"]*"[^>]*>\s*([a-zA-Z0-9_.-]+)\s*<', html):
        t = topic_m.group(1).strip()
        if t and t not in topics:
            topics.append(t)

    # License extraction
    license_val: str | None = None
    lic_match = re.search(
        r'<a\s+href="[^"]*/LICENSE[^"]*"[^>]*>\s*(?:<svg[^>]*>.*?</svg>)?\s*([a-zA-Z0-9_.\s-]+?)\s*</a>',
        html,
        re.DOTALL,
    )
    if lic_match:
        license_val = lic_match.group(1).strip()
    elif "octicon-law" in html:
        lic_fallback = re.search(
            r"octicon-law.*?</span>\s*([a-zA-Z0-9_.\s-]+?)\s*<", html, re.DOTALL
        )
        if lic_fallback:
            license_val = lic_fallback.group(1).strip()

    # Archived banner
    archived = "flash-warn" in html and "archived" in html.lower()

    # Probing raw.githubusercontent.com for files
    def _probe_raw(path: str) -> tuple[int, str]:
        if client is not None:
            r = client.get(f"{raw_base}/{path}")
            return r.status_code, r.text
        return fetch_page_text(f"{raw_base}/{path}")

    raw_base = f"https://raw.githubusercontent.com/{canonical_owner}/{canonical_repo}/HEAD"
    readme_text: str | None = None
    for r_name in ("README.md", "readme.md", "README"):
        try:
            status, r_text = _probe_raw(r_name)
            if status == 200:
                readme_text = r_text
                break
        except Exception:
            pass

    # Probe skills, plugin, mcp
    has_skill = False
    try:
        status, _ = _probe_raw("SKILL.md")
        if status == 200:
            has_skill = True
    except Exception:
        pass

    has_plugin = False
    try:
        status, _ = _probe_raw(".claude-plugin/plugin.json")
        if status == 200:
            has_plugin = True
    except Exception:
        pass

    has_mcp = False
    try:
        status, _ = _probe_raw("mcp.json")
        if status == 200:
            has_mcp = True
    except Exception:
        pass

    mentions = extract_mentions_from_text(readme_text or "")
    mentions = [
        m
        for m in mentions
        if m.name.lower() != f"{canonical_owner.lower()}/{canonical_repo.lower()}"
    ]

    return GithubRecord(
        owner=canonical_owner,
        repo=canonical_repo,
        canonical_key=canonical_key,
        url=f"https://github.com/{canonical_owner}/{canonical_repo}",
        description=description,
        stars=stars,
        pushed_at=None,
        license=license_val,
        archived=archived,
        topics=topics,
        language=None,
        has_skill=has_skill,
        has_plugin=has_plugin,
        has_mcp=has_mcp,
        backend="scrape",
        readme=readme_text,
        mentions=mentions,
    )


def extract_github(
    url: str,
    *,
    client: httpx.Client | None = None,
    token: str | None = None,
) -> tuple[SourceDoc, GithubRecord]:
    """High-level GitHub repository extractor.

    Attempts API backend first if token is available, falling back to scrape backend.
    """
    owner, repo = parse_github_url(url)
    resolved_token = token if token is not None else resolve_github_token()

    own_client = client is None
    http = client or httpx.Client(timeout=30.0, follow_redirects=True)

    record: GithubRecord | None = None
    try:
        if resolved_token:
            try:
                record = extract_github_api(owner, repo, resolved_token, http)
            except httpx.HTTPStatusError as e:
                # Fall back to scrape backend on auth failures or 403 rate limits
                if e.response.status_code in (401, 403):
                    record = extract_github_scrape(owner, repo, http)
                else:
                    raise
            except httpx.HTTPError:
                record = extract_github_scrape(owner, repo, http)
        else:
            record = extract_github_scrape(owner, repo, http)
    finally:
        if own_client:
            http.close()

    source_doc = SourceDoc(
        key=record.canonical_key,
        platform="github",
        creator=record.owner,
        url=record.url,
        stage="fetched",
        fetched_at=datetime.now(UTC),
        caption=record.description,
        summary=record.description,
        transcript=None,
        on_screen_text=[],
        mentions=record.mentions,
        cta=None,
        video=None,
        thumb=None,
    )

    return source_doc, record
