"""
UNHCR Population Statistics API scraper.
Fetches displacement/refugee data by country. No API key required.
"""
import logging
from collections import defaultdict
from datetime import date

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.country_codes import iso3_to_iso2, COUNTRIES
from .base import BaseScraper

logger = logging.getLogger(__name__)

UNHCR_URL = "https://api.unhcr.org/population/v1/population/"

# Build population lookup {iso3: population_millions}
_POPULATION = {r[0]: r[7] * 1_000_000 for r in COUNTRIES if r[7] > 0}


class UNHCRScraper(BaseScraper):
    name = "unhcr"

    async def fetch(self, db: AsyncSession) -> int:
        current_year = date.today().year
        # Try current year; fall back to previous year if no data yet
        for year in [current_year, current_year - 1]:
            data = await self._fetch_population(year)
            if data:
                return await self._store(db, data)
        return 0

    async def _fetch_population(self, year: int) -> list[dict]:
        try:
            params = {"limit": 1000, "page": 1, "year": year}
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(UNHCR_URL, params=params)
                resp.raise_for_status()
                payload = resp.json()
            return payload.get("items", [])
        except Exception as exc:
            logger.warning(f"UNHCR fetch for {year} failed: {exc}")
            return []

    async def _store(self, db: AsyncSession, records: list[dict]) -> int:
        # Sum displaced persons by country of origin (coo_iso)
        displaced: dict[str, float] = defaultdict(float)
        for rec in records:
            coo = rec.get("coo_iso", "")
            if coo and len(coo) == 3:
                total = 0.0
                for field in ["refugees_under_unhcrs_mandate", "asylum_seekers", "idps_of_concern_to_unhcr"]:
                    v = rec.get(field)
                    if v:
                        try:
                            total += float(v)
                        except (ValueError, TypeError):
                            pass
                displaced[coo.upper()] += total

        today = date.today()
        saved = 0
        for iso3, total_displaced in displaced.items():
            pop = _POPULATION.get(iso3, 1_000_000)
            displacement_rate = min(total_displaced / pop, 1.0)
            await self.upsert_metric(db, iso3, "displaced_persons", total_displaced, today)
            await self.upsert_metric(db, iso3, "displacement_rate", displacement_rate, today)
            saved += 2

        return saved
