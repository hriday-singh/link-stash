"""Hugging Face asset extractor supporting models, datasets, and spaces."""

import os
import re
from datetime import UTC, datetime
from typing import Any, Literal, cast

import httpx
from pydantic import BaseModel, Field

from stash.errors import Invalid
from stash.extract.fetch import fetch_page_text
from stash.store.models import Mention, SourceDoc

HF_URL_RE = re.compile(
    r"^https?://(?:www\.)?huggingface\.co/(?:(datasets|spaces)/)?([^/?#\s]+)/([^/?#\s]+)",
    re.IGNORECASE,
)

GITHUB_LINK_RE = re.compile(r"https?://(?:www\.)?github\.com/([a-zA-Z0-9_.\-]+/[a-zA-Z0-9_.\-]+)")
HF_LINK_RE = re.compile(
    r"https?://(?:www\.)?huggingface\.co/(?:(models|datasets|spaces)/)?([a-zA-Z0-9_.\-]+/[a-zA-Z0-9_.\-]+)"
)

HfType = Literal["model", "dataset", "space"]


class HfRecord(BaseModel):
    """Normalized structured data extracted from Hugging Face."""

    hf_type: HfType
    org: str
    name: str
    repo_id: str
    canonical_key: str
    url: str
    pipeline_tag: str | None = None
    parameters_total: int | None = None
    has_gguf: bool = False
    gguf_files: list[str] = Field(default_factory=list)
    gated: bool = False
    license: str | None = None
    downloads: int = 0
    likes: int = 0
    last_modified: str | None = None
    tags: list[str] = Field(default_factory=list)
    description: str | None = None
    base_model: str | None = None
    backend: Literal["hub_api", "scrape"]
    mentions: list[Mention] = Field(default_factory=list[Mention])


def parse_hf_url(url: str) -> tuple[HfType, str, str]:
    """Parse a Hugging Face URL into (hf_type, org, name)."""
    clean = url.strip()
    match = HF_URL_RE.match(clean)
    if not match:
        raise Invalid(f"Invalid Hugging Face URL: {url}", {"url": url})

    prefix, org, name = match.group(1), match.group(2), match.group(3)
    if prefix:
        hf_type: HfType = "dataset" if prefix.lower() == "datasets" else "space"
    else:
        hf_type = "model"

    # Strip subpaths like /tree/main, etc.
    if name.endswith(".git"):
        name = name[:-4]
    return hf_type, org, name


def normalize_hf_key(hf_type: HfType, org: str, name: str) -> str:
    """Returns canonical identity key: hf:<model|dataset|space>:<org>/<name>."""
    return f"hf:{hf_type}:{org.lower()}/{name.lower()}"


def _extract_mentions_from_text(text: str) -> list[Mention]:
    """Find GitHub and Hugging Face links mentioned in documentation or card."""
    mentions: list[Mention] = []
    seen: set[str] = set()

    for m in GITHUB_LINK_RE.finditer(text):
        repo_slug = m.group(1).rstrip("/")
        if repo_slug.endswith(".git"):
            repo_slug = repo_slug[:-4]
        if repo_slug.lower() not in seen:
            seen.add(repo_slug.lower())
            mentions.append(
                Mention(
                    kind="repo",
                    name=repo_slug,
                    url=f"https://github.com/{repo_slug}",
                    at=None,
                )
            )

    for m in HF_LINK_RE.finditer(text):
        target_type = m.group(1) or "model"
        target_slug = m.group(2).rstrip("/")
        if target_slug.lower() not in seen:
            seen.add(target_slug.lower())
            mentions.append(
                Mention(
                    kind=target_type if target_type in ("dataset", "space") else "model",
                    name=target_slug,
                    url=f"https://huggingface.co/{target_slug}",
                    at=None,
                )
            )
    return mentions


extract_mentions_from_text = _extract_mentions_from_text


def extract_hf_api(
    hf_type: HfType,
    org: str,
    name: str,
    *,
    token: str | None = None,
    client: Any = None,
) -> HfRecord:
    """Extract using huggingface_hub API."""
    from huggingface_hub import HfApi

    repo_id = f"{org}/{name}"
    api = client if client is not None else HfApi(token=token or os.environ.get("HF_TOKEN"))

    has_gguf = False
    gguf_files: list[str] = []
    pipeline_tag: str | None = None
    params_total: int | None = None
    gated = False
    license_str: str | None = None
    downloads = 0
    likes = 0
    last_mod: str | None = None
    tags: list[str] = []
    base_model: str | None = None

    if hf_type == "model":
        info = api.model_info(repo_id, files_metadata=True)
        pipeline_tag = getattr(info, "pipeline_tag", None)
        gated = bool(getattr(info, "gated", False))
        downloads = getattr(info, "downloads", 0) or 0
        likes = getattr(info, "likes", 0) or 0
        if getattr(info, "last_modified", None):
            last_mod = str(info.last_modified)
        tags = getattr(info, "tags", []) or []

        # Check safetensors parameters
        safetensors = getattr(info, "safetensors", None)
        if safetensors and hasattr(safetensors, "parameters"):
            params_dict = getattr(safetensors, "parameters", {})
            if isinstance(params_dict, dict) and "total" in params_dict:
                total_val: object = cast(dict[object, object], params_dict)["total"]
                params_total = int(str(total_val))

        # Check siblings for GGUF
        siblings = getattr(info, "siblings", []) or []
        for s in siblings:
            rfilename = getattr(s, "rfilename", "")
            if rfilename.lower().endswith(".gguf"):
                has_gguf = True
                gguf_files.append(rfilename)

        card_data = getattr(info, "card_data", None)
        if card_data:
            if hasattr(card_data, "license") and card_data.license:
                license_str = str(card_data.license)
            if hasattr(card_data, "base_model") and card_data.base_model:
                base_model = str(card_data.base_model)
    elif hf_type == "dataset":
        info = api.dataset_info(repo_id, files_metadata=True)
        gated = bool(getattr(info, "gated", False))
        downloads = getattr(info, "downloads", 0) or 0
        likes = getattr(info, "likes", 0) or 0
        if getattr(info, "last_modified", None):
            last_mod = str(info.last_modified)
        tags = getattr(info, "tags", []) or []
    else:  # space
        info = api.space_info(repo_id)
        likes = getattr(info, "likes", 0) or 0
        if getattr(info, "last_modified", None):
            last_mod = str(info.last_modified)
        tags = getattr(info, "tags", []) or []

    canonical_key = normalize_hf_key(hf_type, org, name)
    url = (
        f"https://huggingface.co/{repo_id}"
        if hf_type == "model"
        else f"https://huggingface.co/{hf_type}s/{repo_id}"
    )

    return HfRecord(
        hf_type=hf_type,
        org=org,
        name=name,
        repo_id=repo_id,
        canonical_key=canonical_key,
        url=url,
        pipeline_tag=pipeline_tag,
        parameters_total=params_total,
        has_gguf=has_gguf,
        gguf_files=gguf_files,
        gated=gated,
        license=license_str,
        downloads=downloads,
        likes=likes,
        last_modified=last_mod,
        tags=tags,
        base_model=base_model,
        backend="hub_api",
        mentions=_extract_mentions_from_text(" ".join(tags)),
    )


def extract_hf_scrape(
    hf_type: HfType,
    org: str,
    name: str,
    *,
    client: httpx.Client | None = None,
) -> HfRecord:
    """Fallback scrape backend for Hugging Face using Scrapling."""
    repo_id = f"{org}/{name}"
    url = (
        f"https://huggingface.co/{repo_id}"
        if hf_type == "model"
        else f"https://huggingface.co/{hf_type}s/{repo_id}"
    )
    status, text = fetch_page_text(url, client=client)
    if status >= 400:
        raise Invalid(
            f"Failed to fetch Hugging Face page ({status}): {url}",
            {"url": url, "status": status},
        )

    # Basic extraction from page text
    has_gguf = ".gguf" in text.lower() or "gguf" in text.lower()
    gated = "access request" in text.lower() or "gated" in text.lower()

    canonical_key = normalize_hf_key(hf_type, org, name)
    mentions = _extract_mentions_from_text(text)

    return HfRecord(
        hf_type=hf_type,
        org=org,
        name=name,
        repo_id=repo_id,
        canonical_key=canonical_key,
        url=url,
        has_gguf=has_gguf,
        gated=gated,
        backend="scrape",
        mentions=mentions,
    )


def extract_hf(
    url: str,
    *,
    token: str | None = None,
    client: Any = None,
    http_client: httpx.Client | None = None,
) -> tuple[SourceDoc, HfRecord]:
    """High-level extractor dispatching API first, falling back to scrape."""
    hf_type, org, name = parse_hf_url(url)
    rec: HfRecord
    try:
        rec = extract_hf_api(hf_type, org, name, token=token, client=client)
    except Exception:
        rec = extract_hf_scrape(hf_type, org, name, client=http_client)

    summary = f"Hugging Face {rec.hf_type}: {rec.repo_id}"
    if rec.pipeline_tag:
        summary += f" ({rec.pipeline_tag})"
    if rec.parameters_total:
        summary += f", {rec.parameters_total / 1e9:.1f}B params"

    source_doc = SourceDoc(
        key=rec.canonical_key,
        platform="huggingface",
        creator=rec.org,
        url=rec.url,
        stage="fetched",
        fetched_at=datetime.now(UTC),
        caption=rec.description,
        summary=summary,
        mentions=rec.mentions,
    )
    return source_doc, rec
