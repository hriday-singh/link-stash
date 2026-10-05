"""Unit tests for unified extractor dispatch and 1-level follow-through."""

from pathlib import Path
from typing import Any

import pytest

from stash.extract.github import GithubRecord
from stash.extract.hf import HfRecord
from stash.services.extract import extract_urls
from stash.store.models import Mention, SourceDoc


def test_extract_urls_multi_source(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    # Mock extract_github
    gh_sdoc = SourceDoc(
        key="github:org/repo",
        platform="github",
        creator="org",
        url="https://github.com/org/repo",
        stage="fetched",
        mentions=[
            Mention(kind="model", name="org/model", url="https://huggingface.co/org/model"),
        ],
    )
    gh_rec = GithubRecord(
        owner="org",
        repo="repo",
        canonical_key="github:org/repo",
        url="https://github.com/org/repo",
        backend="api",
    )

    def mock_extract_github(url: str, client: Any = None) -> tuple[SourceDoc, GithubRecord]:
        return gh_sdoc, gh_rec

    monkeypatch.setattr("stash.extract.github.extract_github", mock_extract_github)

    # Mock extract_hf
    hf_sdoc = SourceDoc(
        key="hf:model:org/model",
        platform="huggingface",
        creator="org",
        url="https://huggingface.co/org/model",
        stage="fetched",
        mentions=[],
    )
    hf_rec = HfRecord(
        hf_type="model",
        org="org",
        name="model",
        repo_id="org/model",
        canonical_key="hf:model:org/model",
        url="https://huggingface.co/org/model",
        backend="hub_api",
    )

    def mock_extract_hf(url: str, http_client: Any = None) -> tuple[SourceDoc, HfRecord]:
        return hf_sdoc, hf_rec

    monkeypatch.setattr("stash.extract.hf.extract_hf", mock_extract_hf)

    docs = extract_urls(home, ["https://github.com/org/repo"], follow_depth=1)

    assert len(docs) == 2
    keys = {d.key for d in docs}
    assert "github:org/repo" in keys
    assert "hf:model:org/model" in keys
