"""Unit tests for the `stash check --live` probe."""

from collections.abc import Callable
from unittest.mock import patch

import httpx

from stash.errors import Invalid
from stash.extract.github import GithubRecord
from stash.services.health import probe


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler), follow_redirects=True)


def test_status_codes_map_to_health() -> None:
    cases = {404: "dead", 410: "dead", 403: "blocked", 429: "blocked", 500: "error", 200: "live"}
    for code, expected in cases.items():
        client = _client(lambda req, code=code: httpx.Response(code, text="ok"))
        assert probe("https://tool.example", client=client).status == expected, code


def test_dns_failure_is_dead() -> None:
    def boom(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("getaddrinfo failed", request=req)

    assert probe("https://nope.invalid", client=_client(boom)).status == "dead"


def test_parked_domain_is_dead() -> None:
    client = _client(lambda req: httpx.Response(200, text="<h1>This domain is for sale</h1>"))
    health = probe("https://oldtool.example", client=client)
    assert health.status == "dead"
    assert "parked_domain" in health.flags


def test_redirect_flags() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.host == "bit.ly":
            return httpx.Response(301, headers={"Location": "https://linktr.ee/creator"})
        if req.url.host == "old.example":
            return httpx.Response(301, headers={"Location": "https://new.example/"})
        return httpx.Response(200, text="hi")

    hub = probe("https://bit.ly/abc", client=_client(handler))
    assert set(hub.flags) == {"shortener", "link_hub"}
    assert hub.final_url == "https://linktr.ee/creator"
    moved = probe("https://old.example", client=_client(handler))
    assert moved.flags == ["redirected_domain"]


def _record(**kw: object) -> GithubRecord:
    base: dict[str, object] = {
        "owner": "o", "repo": "r", "canonical_key": "github:o/r",
        "url": "https://github.com/o/r", "backend": "api", "license": "MIT",
        "pushed_at": "2026-09-01T00:00:00Z",
    }  # fmt: skip
    return GithubRecord.model_validate(base | kw)


def test_github_flags() -> None:
    rec = _record(archived=True, license=None, pushed_at="2020-01-01T00:00:00Z",
                  canonical_key="github:new/r")  # fmt: skip
    with patch("stash.extract.github.extract_github", return_value=(None, rec)):
        health = probe("https://github.com/o/r")
    assert health.status == "live"
    assert set(health.flags) == {"archived", "no_license", "stale", "renamed"}

    with patch("stash.extract.github.extract_github", return_value=(None, _record())):
        assert probe("https://github.com/o/r").flags == []


def test_github_missing_repo_is_dead() -> None:
    err = Invalid("Failed to fetch GitHub page (404)", {"status": 404})
    with patch("stash.extract.github.extract_github", side_effect=err):
        assert probe("https://github.com/ekzhang/openjev").status == "dead"
