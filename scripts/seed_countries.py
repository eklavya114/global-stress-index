#!/usr/bin/env python3
"""
Seed the countries table from the embedded COUNTRIES list.
Run from the project root: python scripts/seed_countries.py
"""
import asyncio
import sys
from pathlib import Path

# Allow importing from backend/app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database import init_db, AsyncSessionLocal
from app.models import Country
from app.utils.country_codes import COUNTRIES
from sqlalchemy import select


async def main():
    await init_db()
    async with AsyncSessionLocal() as db:
        inserted = 0
        for iso3, iso2, fips, name, region, lat, lon, pop_m in COUNTRIES:
            existing = await db.execute(select(Country).where(Country.iso3 == iso3))
            if existing.scalar_one_or_none():
                continue
            db.add(Country(
                iso3=iso3,
                iso2=iso2,
                name=name,
                region=region,
                lat=lat,
                lon=lon,
                population=int(pop_m * 1_000_000),
            ))
            inserted += 1
        await db.commit()
        print(f"Inserted {inserted} countries.")


if __name__ == "__main__":
    asyncio.run(main())
