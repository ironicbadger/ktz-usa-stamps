#!/usr/bin/env python3
"""Seed per-park visit files from parks.json without overwriting existing visits."""
from __future__ import annotations

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
PARKS_PATH = BASE_DIR / "site" / "data" / "parks.json"
VISITS_DIR = BASE_DIR / "site" / "visits"


def main() -> None:
    data = json.loads(PARKS_PATH.read_text(encoding="utf-8"))
    parks = data.get("parks", [])
    VISITS_DIR.mkdir(parents=True, exist_ok=True)

    created = 0
    for park in parks:
        unit_code = (park.get("unit_code") or "").strip()
        if not unit_code:
            continue
        filename = f"{unit_code.lower()}.json"
        path = VISITS_DIR / filename
        if path.exists():
            continue

        visit = {
            "unit_code": unit_code,
            "park_name": park.get("name", ""),
            "visited": False,
            "visit_date": "",
            "visit_note": "",
            "rating": None,
            "review": "",
            "notes": "",
            "highlights": [],
            "facts": [],
            "stamps": [],
            "photos": [],
            "nps_url": "",
        }
        path.write_text(json.dumps(visit, indent=2, ensure_ascii=False) + "\n")
        created += 1

    print(f"Seeded {created} visit files in {VISITS_DIR}")


if __name__ == "__main__":
    main()
