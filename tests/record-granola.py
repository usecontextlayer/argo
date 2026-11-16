"""Refresh: python3 tests/record-granola.py LIST_RESULT.json MEETING_RESULT.json

Inputs are authorized, successful Composio GRANOLA_MCP_LIST_MEETINGS and
GRANOLA_MCP_GET_MEETINGS captures. The detail must describe the first list entry,
with an available transcript and empty private notes. Only normalized XML is saved;
all private attributes and text are replaced while element structure is retained.
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

roots = [ET.fromstring("<root>" + json.loads(Path(path).read_text())["data"]["data"] + "</root>") for path in sys.argv[1:]]
assert len(roots) == 2
meetings = roots[0].findall(".//meeting")
detail = roots[1].find(".//meeting")
assert len(meetings) == 12
assert detail.attrib["id"] == meetings[0].attrib["id"]
assert detail.find("transcript").attrib["available"] == "true"
assert detail.find("private_notes").attrib == {"status": "empty"}
assert not (detail.find("private_notes").text or "").strip()
ids = {meeting.attrib["id"]: f"meeting-{index + 1}" for index, meeting in enumerate(meetings)}

for name, root in zip(("list", "meeting"), roots):
    for element in root.iter():
        for key, value in list(element.attrib.items()):
            if key == "id":
                element.set(key, ids[value])
            elif key == "title":
                element.set(key, 'Planning & review "café"')
            elif key in ("date", "from", "to", "start", "end"):
                element.set(key, "2026-11-16")
            elif key in ("meeting_at", "created_at", "updated_at"):
                element.set(key, "2026-11-16T14:30:00+00:00")
            elif key == "url":
                element.set(key, "https://example.test/meeting")
            elif key in ("available", "status", "has_more", "total_count", "remaining_count", "count", "captured_by_me", "listed_as_participant", "is_workspace_visible", "end_inclusive", "time_range"):
                pass
            elif key == "timezone":
                element.set(key, "UTC")
            elif key == "connected_user_email":
                element.set(key, "reader@example.test")
            elif key == "workspace_name":
                element.set(key, "Test workspace")
            else:
                raise AssertionError(f"Unrecognized attribute: {key}")
        if element.tail and element.tail.strip():
            element.tail = "\nRecorded provider advisory.\n"
        if element.text and element.text.strip():
            element.text = {
                "connected_user_email": "reader@example.test",
                "known_participants": "Ada & Lin <team@example.test>",
                "summary": "## Plan & decisions\n\nKeep <draft> and café notes.",
                "transcript": "Available on request.",
                "requested_range": "Meetings in the requested range.",
            }[element.tag]
    output = "\n".join(ET.tostring(child, encoding="unicode") for child in root)
    Path(__file__).with_name("fixtures").joinpath(f"granola-{name}.xml").write_text(output + "\n")
