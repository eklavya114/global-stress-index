#!/usr/bin/env python3
"""
Downloads the Natural Earth 110m countries GeoJSON into frontend/public/.
Run from the project root: python scripts/download_geodata.py

Source: Natural Earth Data (public domain)
https://github.com/nvkelso/natural-earth-vector
"""
import json
import sys
import urllib.request
from pathlib import Path

URL = (
    "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
)
OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "countries.geojson"


def download():
    print(f"Downloading world GeoJSON from Natural Earth…")
    OUT.parent.mkdir(parents=True, exist_ok=True)

    with urllib.request.urlopen(URL, timeout=60) as resp:
        data = json.load(resp)

    # Verify it looks right
    features = data.get("features", [])
    if not features:
        print("ERROR: No features found in downloaded GeoJSON!", file=sys.stderr)
        sys.exit(1)

    # Normalize property names so WorldMap always gets ISO_A3 and NAME
    sample = features[0].get("properties", {})
    key_iso3 = "ISO_A3"
    key_name = "NAME"
    if "ISO_A3" not in sample:
        # geo-countries dataset uses "ISO3166-1-Alpha-3"
        candidates_iso3 = ["ISO3166-1-Alpha-3", "iso_a3", "ISO3"]
        candidates_name = ["name", "ADMIN", "admin"]
        for k in candidates_iso3:
            if k in sample:
                key_iso3 = k
                break
        for k in candidates_name:
            if k in sample:
                key_name = k
                break
        print(f"Remapping: {key_iso3} -> ISO_A3, {key_name} -> NAME")
        for feature in features:
            props = feature.get("properties", {})
            if key_iso3 != "ISO_A3" and key_iso3 in props:
                props["ISO_A3"] = props[key_iso3]
            if key_name != "NAME" and key_name in props:
                props["NAME"] = props[key_name]

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"))

    size_kb = OUT.stat().st_size // 1024
    print(f"Saved {len(features)} country features to {OUT} ({size_kb} KB)")


if __name__ == "__main__":
    download()
