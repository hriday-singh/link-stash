"""Unit tests for Hugging Face extractor."""

from unittest.mock import MagicMock

import httpx
import pytest

from stash.errors import Invalid
from stash.extract.hf import (
    extract_hf,
    extract_hf_api,
    extract_hf_scrape,
    normalize_hf_key,
    parse_hf_url,
)


def test_parse_hf_url() -> None:
    assert parse_hf_url("https://huggingface.co/meta-llama/Llama-3-8B") == (
        "model",
        "meta-llama",
        "Llama-3-8B",
    )
    assert parse_hf_url("https://huggingface.co/datasets/common-voice/cv-11") == (
        "dataset",
        "common-voice",
        "cv-11",
    )
    assert parse_hf_url("https://huggingface.co/spaces/gradio/hello-world") == (
        "space",
        "gradio",
        "hello-world",
    )

    with pytest.raises(Invalid):
        parse_hf_url("https://github.com/owner/repo")


def test_normalize_hf_key() -> None:
    assert normalize_hf_key("model", "Meta-Llama", "Llama-3-8B") == "hf:model:meta-llama/llama-3-8b"
    assert normalize_hf_key("dataset", "org", "data") == "hf:dataset:org/data"
    assert normalize_hf_key("space", "org", "app") == "hf:space:org/app"


def test_extract_hf_api_mock() -> None:
    mock_api = MagicMock()
    mock_info = MagicMock()
    mock_info.pipeline_tag = "text-generation"
    mock_info.gated = False
    mock_info.downloads = 120000
    mock_info.likes = 450
    mock_info.last_modified = "2026-09-01T00:00:00Z"
    mock_info.tags = ["safetensors", "llama", "en"]

    # Mock safetensors
    mock_safetensors = MagicMock()
    mock_safetensors.parameters = {"total": 8030000000}
    mock_info.safetensors = mock_safetensors

    # Mock siblings with GGUF
    s1 = MagicMock()
    s1.rfilename = "model-q4_k_m.gguf"
    mock_info.siblings = [s1]

    card_data = MagicMock()
    card_data.license = "llama3"
    card_data.base_model = "meta-llama/Llama-3-8B-Base"
    mock_info.card_data = card_data

    mock_api.model_info.return_value = mock_info

    rec = extract_hf_api("model", "meta-llama", "Llama-3-8B", client=mock_api)
    assert rec.canonical_key == "hf:model:meta-llama/llama-3-8b"
    assert rec.pipeline_tag == "text-generation"
    assert rec.has_gguf is True
    assert rec.gguf_files == ["model-q4_k_m.gguf"]
    assert rec.parameters_total == 8030000000
    assert rec.license == "llama3"
    assert rec.base_model == "meta-llama/Llama-3-8B-Base"


def test_extract_hf_scrape_mock() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            text="GGUF quantized weights available. Mentioning https://github.com/ggerganov/llama.cpp",
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    rec = extract_hf_scrape("model", "TheBloke", "Llama-2-GGUF", client=client)

    assert rec.has_gguf is True
    assert len(rec.mentions) == 1
    assert rec.mentions[0].name == "ggerganov/llama.cpp"


def test_extract_hf_high_level() -> None:
    mock_api = MagicMock()
    mock_info = MagicMock()
    mock_info.pipeline_tag = "image-to-text"
    mock_info.gated = True
    mock_info.downloads = 500
    mock_info.likes = 12
    mock_info.last_modified = None
    mock_info.tags = []
    mock_info.safetensors = None
    mock_info.siblings = []
    mock_info.card_data = None
    mock_api.model_info.return_value = mock_info

    source_doc, rec = extract_hf("https://huggingface.co/org/model", client=mock_api)
    assert source_doc.platform == "huggingface"
    assert source_doc.key == "hf:model:org/model"
    assert rec.gated is True
