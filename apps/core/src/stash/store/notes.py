"""Notes section manipulation in markdown card bodies."""

import re

from stash.errors import Invalid

HEADING_REGEX = re.compile(r"^\*\*([A-Za-z0-9 _-]+)\.\*\*\s*$")
NOTES_HEADER = "**Notes.**"
ORIGIN_HEADER = "**Origin.**"


def check_notes(notes: str) -> None:
    """Rejects notes containing markdown section headings like '**Heading.**'."""
    for line in notes.splitlines():
        if HEADING_REGEX.match(line.strip()):
            raise Invalid(
                f"Notes cannot contain reserved markdown section headings: {line.strip()}",
                {"line": line.strip()},
            )


def split_notes(body: str) -> tuple[str, str]:
    """Splits body into (body_without_notes, notes).

    Section headings start with `**Word.**` on their own line.
    """
    lines = body.splitlines()
    notes_start = -1
    notes_end = -1

    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == NOTES_HEADER:
            notes_start = i
            break

    if notes_start == -1:
        return body, ""

    # Find next section heading or end of lines
    for i in range(notes_start + 1, len(lines)):
        stripped = lines[i].strip()
        if HEADING_REGEX.match(stripped):
            notes_end = i
            break

    if notes_end == -1:
        notes_lines = lines[notes_start + 1 :]
        remaining_lines = lines[:notes_start]
    else:
        notes_lines = lines[notes_start + 1 : notes_end]
        remaining_lines = lines[:notes_start] + lines[notes_end:]

    notes = "\n".join(notes_lines).strip()
    body_no_notes = "\n".join(remaining_lines).strip()

    return body_no_notes, notes


def replace_notes(body: str, notes: str) -> str:
    """Replaces or removes the **Notes.** section in a card body."""
    clean_notes = notes.strip()
    if clean_notes:
        check_notes(clean_notes)

    body_no_notes, _ = split_notes(body)
    if not clean_notes:
        return body_no_notes

    formatted_notes = f"{NOTES_HEADER}\n{clean_notes}"

    # Try inserting before **Origin.**
    lines = body_no_notes.splitlines()
    origin_idx = -1
    for i, line in enumerate(lines):
        if line.strip() == ORIGIN_HEADER:
            origin_idx = i
            break

    if origin_idx != -1:
        before = "\n".join(lines[:origin_idx]).strip()
        after = "\n".join(lines[origin_idx:]).strip()
        if before:
            return f"{before}\n\n{formatted_notes}\n\n{after}"
        return f"{formatted_notes}\n\n{after}"

    # Append to end
    if body_no_notes:
        return f"{body_no_notes}\n\n{formatted_notes}"
    return formatted_notes
