import pytest

from stash.errors import Invalid
from stash.store.notes import check_notes, replace_notes, split_notes


def test_split_notes_when_present() -> None:
    body = (
        "This is the summary paragraph.\n\n"
        "**Notes.**\n"
        "My personal review of this tool.\n"
        "Second line of notes.\n\n"
        "**Origin.**\n"
        "Added 2026-10-06 from reel."
    )
    body_no_notes, notes = split_notes(body)
    assert notes == "My personal review of this tool.\nSecond line of notes."
    assert "**Notes.**" not in body_no_notes
    assert "This is the summary paragraph." in body_no_notes
    assert "**Origin.**\nAdded 2026-10-06 from reel." in body_no_notes


def test_split_notes_when_absent() -> None:
    body = (
        "This is the summary paragraph.\n\n"
        "**Origin.**\n"
        "Added 2026-10-06 from reel."
    )
    body_no_notes, notes = split_notes(body)
    assert notes == ""
    assert body_no_notes.strip() == body.strip()


def test_split_notes_at_end_of_body() -> None:
    body = (
        "Summary text.\n\n"
        "**Notes.**\n"
        "Just some trailing notes."
    )
    body_no_notes, notes = split_notes(body)
    assert notes == "Just some trailing notes."
    assert body_no_notes.strip() == "Summary text."


def test_replace_notes_existing() -> None:
    body = (
        "Summary paragraph.\n\n"
        "**Notes.**\n"
        "Old notes here.\n\n"
        "**Origin.**\n"
        "Added from web."
    )
    new_body = replace_notes(body, "New updated notes.")
    _, notes = split_notes(new_body)
    assert notes == "New updated notes."
    assert "**Origin.**" in new_body
    assert "Summary paragraph." in new_body


def test_replace_notes_insert_before_origin() -> None:
    body = (
        "Summary paragraph.\n\n"
        "**Origin.**\n"
        "Added from web."
    )
    new_body = replace_notes(body, "Fresh notes added.")
    _, notes = split_notes(new_body)
    assert notes == "Fresh notes added."
    assert new_body.index("**Notes.**") < new_body.index("**Origin.**")


def test_replace_notes_insert_at_end_when_no_origin() -> None:
    body = "Summary paragraph."
    new_body = replace_notes(body, "Fresh notes appended.")
    _, notes = split_notes(new_body)
    assert notes == "Fresh notes appended."
    assert "Summary paragraph." in new_body


def test_replace_notes_remove_when_empty() -> None:
    body = (
        "Summary paragraph.\n\n"
        "**Notes.**\n"
        "Old notes here.\n\n"
        "**Origin.**\n"
        "Added from web."
    )
    new_body = replace_notes(body, "   ")
    _, notes = split_notes(new_body)
    assert notes == ""
    assert "**Notes.**" not in new_body
    assert "Summary paragraph." in new_body
    assert "**Origin.**" in new_body


def test_check_notes_valid() -> None:
    check_notes("Simple note with bullet points:\n- Point 1\n- Point 2\n**bold word** inline.")


def test_check_notes_rejects_heading_injection() -> None:
    with pytest.raises(Invalid) as exc_info:
        check_notes("Some normal text\n**Origin.**\nMalicious injection")
    assert "reserved markdown section heading" in str(exc_info.value)

    with pytest.raises(Invalid):
        check_notes("**Notes.**\nAttempting nested notes")

    with pytest.raises(Invalid):
        check_notes("**Custom.**\nInvalid section header")
