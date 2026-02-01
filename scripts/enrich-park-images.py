#!/usr/bin/env python3
"""Enrich parks.json with hero images from the NPS API.

Usage:
  NPS_API_KEY=YOUR_KEY python3 scripts/enrich-park-images.py

This script updates parks.json in-place by adding:
  hero_image: { url, caption, credit, alt }
  nps_url (if provided by the API)
"""
from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

API_BASE = "https://developer.nps.gov/api/v1/parks"
PARKS_PATH = Path(__file__).resolve().parents[1] / "site" / "data" / "parks.json"


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def fetch_parks(codes: list[str], api_key: str) -> list[dict]:
    params = {
        "parkCode": ",".join(codes),
        "fields": "images",
        "limit": str(max(len(codes), 1)),
    }
    url = API_BASE + "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url)
    request.add_header("X-Api-Key", api_key)
    with urllib.request.urlopen(request) as response:
        payload = json.load(response)
    return payload.get("data", [])


def main() -> None:
    api_key = os.environ.get("NPS_API_KEY")
    if not api_key:
        raise SystemExit("Missing NPS_API_KEY environment variable.")

    data = json.loads(PARKS_PATH.read_text(encoding="utf-8"))
    parks = data.get("parks", [])

    code_to_index = {}
    codes = []
    for idx, park in enumerate(parks):
        code = (park.get("unit_code") or "").strip().lower()
        if not code:
            continue
        if code not in code_to_index:
            code_to_index[code] = idx
            codes.append(code)

    for batch in chunked(codes, 10):
        for park in fetch_parks(batch, api_key):
            code = (park.get("parkCode") or "").strip().lower()
            if code not in code_to_index:
                continue
            images = park.get("images") or []
            if not images:
                continue
            hero = images[0]
            target = parks[code_to_index[code]]
            target["hero_image"] = {
                "url": hero.get("url"),
                "caption": hero.get("caption"),
                "credit": hero.get("credit"),
                "alt": hero.get("altText"),
            }
            if park.get("url"):
                target["nps_url"] = park.get("url")
        time.sleep(0.2)

    PARKS_PATH.write_text(json.dumps({"parks": parks}, indent=2, ensure_ascii=False) + "\n")
    print(f"Updated {len(parks)} parks in {PARKS_PATH}")


if __name__ == "__main__":
    main()
