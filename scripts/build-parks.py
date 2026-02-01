#!/usr/bin/env python3
"""Build the parks.json list from the NPS centroids service."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

BASE = (
    "https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/"
    "NPS_Land_Resources_Division_Boundary_and_Tract_Data_Service/"
    "FeatureServer/0/query"
)

REGION_MAP = {
    "AK": "Alaska",
    "IM": "Intermountain",
    "MW": "Midwest",
    "NC": "National Capital",
    "NE": "Northeast",
    "PW": "Pacific West",
    "SE": "Southeast",
}

OUTPUT_PATH = Path(__file__).resolve().parents[1] / "site" / "data" / "parks.json"


def fetch_count() -> int:
    url = f"{BASE}?where=1%3D1&returnCountOnly=true&f=json"
    with urllib.request.urlopen(url) as response:
        payload = json.load(response)
    return int(payload["count"])


def fetch_page(offset: int, limit: int) -> list[dict]:
    params = {
        "where": "1=1",
        "outFields": "UNIT_CODE,UNIT_NAME,STATE,REGION,UNIT_TYPE",
        "returnGeometry": "true",
        "outSR": "4326",
        "resultOffset": str(offset),
        "resultRecordCount": str(limit),
        "f": "json",
    }
    url = BASE + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url) as response:
        payload = json.load(response)
    return payload.get("features", [])


def normalize_states(raw: str) -> list[str]:
    if not raw:
        return []
    return [chunk.strip() for chunk in raw.replace(";", ",").split(",") if chunk.strip()]


def build_parks() -> dict:
    count = fetch_count()
    page_size = 200
    features: list[dict] = []

    for offset in range(0, count, page_size):
        features.extend(fetch_page(offset, page_size))

    parks = []
    for feature in features:
        attrs = feature.get("attributes", {})
        geom = feature.get("geometry") or {}

        unit_code = (attrs.get("UNIT_CODE") or "").strip()
        name = (attrs.get("UNIT_NAME") or "").strip()
        unit_type = (attrs.get("UNIT_TYPE") or "").strip() or "Other Designation"
        region_code = (attrs.get("REGION") or "").strip()
        region = REGION_MAP.get(region_code, region_code or "Unknown")
        states = normalize_states((attrs.get("STATE") or "").strip())

        parks.append(
            {
                "id": unit_code.lower(),
                "unit_code": unit_code,
                "name": name,
                "type": unit_type,
                "states": states,
                "region": region,
                "lat": geom.get("y"),
                "lng": geom.get("x"),
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
            }
        )

    parks.sort(key=lambda item: item["name"])
    return {"parks": parks}


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = build_parks()
    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(payload['parks'])} parks to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
