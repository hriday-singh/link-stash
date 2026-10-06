from datetime import date
from pathlib import Path

import pytest
from starlette.testclient import TestClient

from stash.config import Config
from stash.server.app import create_app
from stash.services.pending import add_pending
from stash.store.cards import save_card
from stash.store.models import Card, PendingItem, SourceDoc
from stash.store.sources import write_source


@pytest.fixture
def test_env(tmp_path: Path) -> tuple[Config, TestClient]:
    home = tmp_path / "stash"
    home.mkdir()

    cfg = Config(home=home, port=8765)

    # 1. Seed sources
    source_dir = home / "library" / "sources" / "ig-test1"
    source_dir.mkdir(parents=True)
    video_file = source_dir / "video.mp4"
    video_file.write_bytes(b"fake mp4 video bytes for range test 1234567890")
    thumb_file = source_dir / "thumb.jpg"
    thumb_file.write_bytes(b"fake jpeg thumb bytes")

    source_doc = SourceDoc(
        key="ig:test1",
        platform="instagram",
        creator="testcreator",
        url="https://instagram.com/reel/test1",
        stage="triaged",
        video=Path("library/sources/ig-test1/video.mp4"),
        thumb=Path("library/sources/ig-test1/thumb.jpg"),
    )
    write_source(home, source_doc)

    # 2. Seed cards
    c1 = Card(
        schema=1,
        key="gh:repo1",
        title="Tool One",
        category="repos-tools",
        kind="tool",
        tags=["python", "cli"],
        added=date(2026, 10, 6),
        sources=["ig:test1"],
    )
    b1 = (
        "Summary of Tool One.\n\n"
        "**Notes.**\n"
        "Initial thoughts on tool one.\n\n"
        "**Origin.**\n"
        "Added from reel."
    )
    save_card(home, c1, b1, slug="tool-one")

    c2 = Card(
        schema=1,
        key="hf:model1",
        title="Model Two",
        category="models",
        kind="model",
        tags=["llm", "gguf"],
        added=date(2026, 10, 5),
    )
    b2 = "Summary of Model Two with link to [[tool-one]]."
    save_card(home, c2, b2, slug="model-two")

    # 3. Seed pending
    add_pending(
        home,
        PendingItem(
            id="p1",
            kind="cta",
            source_key="ig:test1",
            instruction="Comment REPO",
            status="open",
            added=date(2026, 10, 6),
        ),
    )

    app = create_app(cfg, dev=True)
    client = TestClient(app, base_url="http://127.0.0.1")
    return cfg, client


def test_security_host_and_origin(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    # 1. Evil host header
    resp = client.get("/api/meta", headers={"host": "attacker.com"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"

    # 2. Evil origin header
    resp = client.get("/api/meta", headers={"origin": "http://evil-site.com"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"

    # 3. Valid host and origin
    resp = client.get("/api/meta", headers={"origin": "http://localhost:5173"})
    assert resp.status_code == 200


def test_unknown_api_endpoint(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env
    resp = client.get("/api/nonexistent/route")
    assert resp.status_code == 404
    data = resp.json()
    assert data["error"]["code"] == "not_found"


def test_list_cards_and_pagination(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    # Limit = 1 pagination test
    resp = client.get("/api/cards?limit=1")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    first_slug = data["items"][0]["slug"]
    next_cursor = data["next_cursor"]
    assert next_cursor is not None

    # Fetch second page
    resp2 = client.get(f"/api/cards?limit=1&cursor={next_cursor}")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert len(data2["items"]) == 1
    second_slug = data2["items"][0]["slug"]
    assert first_slug != second_slug

    # Filter by category
    resp_cat = client.get("/api/cards?category=models")
    assert resp_cat.status_code == 200
    assert len(resp_cat.json()["items"]) == 1
    assert resp_cat.json()["items"][0]["slug"] == "model-two"

    # Filter by tag
    resp_tag = client.get("/api/cards?tag=cli")
    assert resp_tag.status_code == 200
    assert len(resp_tag.json()["items"]) == 1
    assert resp_tag.json()["items"][0]["slug"] == "tool-one"


def test_card_detail_and_edit_lifecycle(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    # 1. Get card detail
    resp = client.get("/api/cards/tool-one")
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["slug"] == "tool-one"
    assert detail["notes"] == "Initial thoughts on tool one."
    assert "Summary of Tool One." in detail["body"]
    assert "**Notes.**" not in detail["body"]
    base_hash = detail["hash"]

    # 2. Conflict on stale hash
    resp_conflict = client.put(
        "/api/cards/tool-one",
        json={"base_hash": "wrong-stale-hash", "notes": "New notes"},
    )
    assert resp_conflict.status_code == 409
    assert resp_conflict.json()["error"]["code"] == "conflict"

    # 3. Successful update of notes
    resp_update = client.put(
        "/api/cards/tool-one",
        json={"base_hash": base_hash, "notes": "Updated notes via API."},
    )
    assert resp_update.status_code == 200
    updated = resp_update.json()
    assert updated["notes"] == "Updated notes via API."
    new_hash = updated["hash"]
    assert new_hash != base_hash

    # 4. Move category
    resp_move = client.put(
        "/api/cards/tool-one",
        json={"base_hash": new_hash, "category": "models"},
    )
    assert resp_move.status_code == 200
    moved = resp_move.json()
    assert moved["card"]["category"] == "models"

    # Verify old file is gone and GET still works
    resp_get_moved = client.get("/api/cards/tool-one")
    assert resp_get_moved.status_code == 200
    assert resp_get_moved.json()["card"]["category"] == "models"


def test_card_reject(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    # Reject card
    resp = client.request(
        "DELETE",
        "/api/cards/model-two",
        json={"reason": "Not relevant to my projects"},
    )
    assert resp.status_code == 200
    assert resp.json()["key"] == "hf:model1"

    # Card is now 404
    resp_get = client.get("/api/cards/model-two")
    assert resp_get.status_code == 404

    # Listed in rejects
    resp_rejects = client.get("/api/rejects")
    assert resp_rejects.status_code == 200
    reject_keys = [r["key"] for r in resp_rejects.json()]
    assert "hf:model1" in reject_keys


def test_sources_and_media_range(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    # List sources
    resp = client.get("/api/sources")
    assert resp.status_code == 200
    sources = resp.json()["items"]
    assert len(sources) >= 1
    assert sources[0]["id"] == "ig:test1"
    assert client.get("/api/sources?platform=other").json()["items"] == []

    # Get source detail
    resp_detail = client.get("/api/sources/ig:test1")
    assert resp_detail.status_code == 200
    assert len(resp_detail.json()["cards"]) >= 1

    # Media stream full
    resp_media = client.get("/api/sources/ig:test1/video")
    assert resp_media.status_code == 200
    assert resp_media.content == b"fake mp4 video bytes for range test 1234567890"

    # Media range request (bytes=0-10)
    resp_range = client.get("/api/sources/ig:test1/video", headers={"Range": "bytes=0-10"})
    assert resp_range.status_code == 206
    assert resp_range.headers.get("content-range") is not None
    assert resp_range.content == b"fake mp4 vi"

    # Thumb request
    resp_thumb = client.get("/api/sources/ig:test1/thumb")
    assert resp_thumb.status_code == 200
    assert resp_thumb.content == b"fake jpeg thumb bytes"


def test_media_path_traversal_blocked(test_env: tuple[Config, TestClient]) -> None:
    cfg, client = test_env

    # Create source pointing outside library/sources/
    evil_source = SourceDoc(
        key="evil:source",
        platform="web",
        creator=None,
        url="https://example.com",
        stage="triaged",
        video=Path("../../outside.mp4"),
    )
    write_source(cfg.home, evil_source)

    resp = client.get("/api/sources/evil:source/video")
    assert resp.status_code == 404


def test_pending_lifecycle(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    resp = client.get("/api/pending")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) == 1
    assert items[0]["id"] == "p1"
    assert items[0]["status"] == "open"

    # Resolve with invalid URL
    resp_inv = client.post("/api/pending/p1/resolve", json={"url": "not-a-valid-url"})
    assert resp_inv.status_code == 422

    # Resolve with valid URL
    resp_res = client.post("/api/pending/p1/resolve", json={"url": "https://github.com/org/repo"})
    assert resp_res.status_code == 200
    assert resp_res.json()["status"] == "ready"
    assert resp_res.json()["url"] == "https://github.com/org/repo"


def test_pending_delete_and_recheck(
    test_env: tuple[Config, TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    _, client = test_env
    calls: list[list[str]] = []

    def fake_extract(home: object, urls: list[str]) -> list[dict[str, str]]:
        calls.append(urls)
        return [{"key": "ig:test1", "status": "fetched"}]

    monkeypatch.setattr("stash.server.routes.state.extract", fake_extract)
    resp = client.post("/api/pending/p1/recheck")
    assert resp.status_code == 200
    assert resp.json()["status"] == "fetched"
    assert calls == [["https://www.instagram.com/reel/test1/"]]

    assert client.post("/api/pending/nope/recheck").status_code == 404

    assert client.delete("/api/pending/p1").status_code == 200
    assert client.get("/api/pending").json() == []


def test_inventory_add_and_list(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    resp_add = client.post("/api/inventory", json={"text": "[tool] ripgrep"})
    assert resp_add.status_code == 200
    assert resp_add.json()["name"] == "ripgrep"

    resp_list = client.get("/api/inventory")
    assert resp_list.status_code == 200
    names = [i["name"] for i in resp_list.json()]
    assert "ripgrep" in names


def test_metadata_and_colors(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    resp = client.get("/api/meta")
    assert resp.status_code == 200
    meta = resp.json()
    assert meta["counts"]["cards"] >= 2
    assert meta["version"] == "0.1.0"
    categories = {c["name"]: c["color"] for c in meta["categories"]}
    assert categories["models"] == "cat-models"
    assert categories["repos-tools"] == "cat-repos-tools"


def test_search_and_special_input(test_env: tuple[Config, TestClient]) -> None:
    _, client = test_env

    # 1. Normal match
    resp = client.get("/api/search?q=Tool")
    assert resp.status_code == 200
    hits = resp.json()
    assert len(hits) >= 1
    assert hits[0]["slug"] == "tool-one"
    # Verify snippet markers \x02 / \x03
    assert "\x02" in hits[0]["snippet"] or "Tool" in hits[0]["snippet"]

    # 2. Weird input with boolean operators, quotes, brackets
    weird_q = 'Tool AND (python OR "cli")*'
    resp_weird = client.get(f"/api/search?q={weird_q}")
    assert resp_weird.status_code == 200


def test_graph_and_links(test_env: tuple[Config, TestClient]) -> None:
    cfg, client = test_env

    # Card links
    resp_links = client.get("/api/cards/tool-one/links")
    assert resp_links.status_code == 200
    links = resp_links.json()
    assert len(links["mentioned_by"]) >= 1
    assert links["mentioned_by"][0]["id"] == "ig:test1"

    # Global graph: verify card, source, and creator nodes exist
    resp_graph = client.get("/api/graph")
    assert resp_graph.status_code == 200
    graph = resp_graph.json()
    node_ids = {n["id"] for n in graph["nodes"]}
    assert "tool-one" in node_ids
    assert "ig:test1" in node_ids
    assert "creator:testcreator" in node_ids

    # Verify edge types
    edge_types = {e["type"] for e in graph["edges"]}
    assert "source" in edge_types

    # Local graph centered on tool-one
    resp_local = client.get("/api/graph?center=tool-one&depth=1")
    assert resp_local.status_code == 200
    local_graph = resp_local.json()
    local_ids = {n["id"] for n in local_graph["nodes"]}
    assert "tool-one" in local_ids
    assert "ig:test1" in local_ids

    # Isolated card with no connections: returns exactly 1 node and 0 edges
    lone_card = Card(
        schema=1,
        key="gh:isolated",
        title="Isolated Card",
        category="repos-tools",
        kind="tool",
        tags=[],
        added=date(2026, 10, 6),
        sources=[],
    )
    save_card(cfg.home, lone_card, "Lone body", slug="isolated-card")

    resp_lone = client.get("/api/graph?center=isolated-card&depth=1")
    assert resp_lone.status_code == 200
    lone_data = resp_lone.json()
    assert len(lone_data["nodes"]) == 1
    assert lone_data["nodes"][0]["id"] == "isolated-card"
    assert len(lone_data["edges"]) == 0


def test_list_cards_bucket_filter(test_env: tuple[Config, TestClient]) -> None:
    cfg, client = test_env
    card = Card(
        schema=1,
        key="url:robu.in",
        title="Robu",
        category="electronics",
        kind="link",
        added=date(2026, 10, 6),
        bucket="later",
    )
    save_card(cfg.home, card, "# Robu", "robu")

    items = client.get("/api/cards?bucket=later").json()["items"]
    assert [i["slug"] for i in items] == ["robu"]
    assert items[0]["bucket"] == "later"
    assert client.get("/api/cards?bucket=bogus").status_code == 422
