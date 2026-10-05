"""Unit tests for triage queue and Instagram export import service."""

import json
from pathlib import Path

from stash.services.queue import (
    import_ig_export,
    list_queue,
    next_queue,
    parse_ig_export,
    pop_queue,
)
from stash.services.rejects import add_reject
from stash.store.models import SourceDoc
from stash.store.sources import write_source


def test_parse_ig_export(tmp_path: Path) -> None:
    export_file = tmp_path / "saved_posts.json"
    data = {
        "saved_saved_media": [
            {
                "title": "",
                "string_map_data": {
                    "Saved on": {
                        "href": "https://www.instagram.com/reel/C11111/?igsh=xyz",
                        "value": "Oct 1, 2026",
                    }
                },
            },
            {
                "title": "",
                "string_map_data": {
                    "Saved on": {
                        "href": "https://www.instagram.com/p/C22222/",
                        "value": "Oct 2, 2026",
                    }
                },
            },
            {
                # Duplicate C11111 with different parameters
                "href": "https://www.instagram.com/reel/C11111/",
            },
            {
                # Non-post link
                "href": "https://www.instagram.com/direct/t/12345",
            },
        ]
    }
    export_file.write_text(json.dumps(data), encoding="utf-8")

    urls = parse_ig_export(export_file)
    assert len(urls) == 2
    assert "https://www.instagram.com/reel/C11111/" in urls
    assert "https://www.instagram.com/p/C22222/" in urls


def test_import_ig_export_and_pop_queue(tmp_path: Path) -> None:
    home = tmp_path / "stash"
    home.mkdir()

    # Pre-populate: C11111 is already in sources
    source = SourceDoc(
        key="ig:C11111",
        platform="instagram",
        creator="tech",
        url="https://www.instagram.com/reel/C11111/",
        stage="fetched",
    )
    write_source(home, source)

    # Pre-populate: C22222 is in rejects
    add_reject(home, "ig:C22222", "Irrelevant video")

    # Export has C11111 (in sources), C22222 (in rejects), C33333 (new), C44444 (new)
    export_file = tmp_path / "saved_posts.json"
    data = [
        {"href": "https://www.instagram.com/reel/C11111/"},
        {"href": "https://www.instagram.com/reel/C22222/"},
        {"href": "https://www.instagram.com/reel/C33333/"},
        {"href": "https://www.instagram.com/reel/C44444/"},
    ]
    export_file.write_text(json.dumps(data), encoding="utf-8")

    count = import_ig_export(home, export_file)
    assert count == 2

    # Queue should contain C33333 and C44444
    queued = list_queue(home)
    assert len(queued) == 2
    assert "https://www.instagram.com/reel/C33333/" in queued
    assert "https://www.instagram.com/reel/C44444/" in queued

    # Re-importing same export adds 0 items
    assert import_ig_export(home, export_file) == 0

    # Pop 1 item
    popped = pop_queue(home, n=1)
    assert len(popped) == 1
    assert popped[0] == "https://www.instagram.com/reel/C33333/"

    # Queue now only has C44444
    remaining = list_queue(home)
    assert len(remaining) == 1
    assert remaining[0] == "https://www.instagram.com/reel/C44444/"

    # Pop remaining
    popped2 = next_queue(home, n=5)
    assert len(popped2) == 1
    assert popped2[0] == "https://www.instagram.com/reel/C44444/"
    assert len(list_queue(home)) == 0
