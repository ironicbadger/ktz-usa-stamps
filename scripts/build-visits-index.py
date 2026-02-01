#!/usr/bin/env python3
"""Build data/visits.json from per-park visit files."""
from __future__ import annotations

import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
VISITS_DIR = BASE_DIR / "site" / "visits"
OUTPUT_PATH = BASE_DIR / "site" / "data" / "visits.json"


def has_content(visit: dict) -> bool:
    if visit.get("visited"):
        return True
    if visit.get("visit_date"):
        return True
    if visit.get("visit_note"):
        return True
    if visit.get("rating"):
        return True
    if visit.get("review"):
        return True
    if visit.get("notes"):
        return True
    if visit.get("highlights"):
        return True
    if visit.get("facts"):
        return True
    if visit.get("stamps"):
        return True
    if visit.get("photos"):
        return True
    if visit.get("nps_url"):
        return True
    if visit.get("hero_image"):
        return True
    return False


def main() -> None:
    visits = []
    if not VISITS_DIR.exists():
        OUTPUT_PATH.write_text(json.dumps({"visits": []}, indent=2) + "\n")
        print("No visits directory found; wrote empty visits.json")
        return

    for path in sorted(VISITS_DIR.glob("*.json")):
        visit = json.loads(path.read_text(encoding="utf-8"))
        if not visit.get("unit_code"):
            continue
        if has_content(visit):
            visits.append(visit)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps({"visits": visits}, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(visits)} visits to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
