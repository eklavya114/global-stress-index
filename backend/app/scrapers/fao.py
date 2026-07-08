"""
FAO FAOSTAT scraper — fetches the global Food Price Index.
No API key required.
"""
import logging
from datetime import date

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.country_codes import get_all_iso3
from .base import BaseScraper

logger = logging.getLogger(__name__)

# FAO Food Price Index — world-level monthly data
# Item 23015 = Food Price Index (General), Area 4 = World
FAO_FPI_URL = (
    "https://fenixservices.fao.org/faostat/api/v1/en/data/FPIN"
    "?area=4&element=3&item=23015&year_gte=2023&year_lte=2025"
    "&output_type=json&show_codes=true&show_flags=false&show_notes=false&show_label=true"
)

# FAO food security data per country — undernourishment prevalence
FAO_FS_URL = (
    "https://fenixservices.fao.org/faostat/api/v1/en/data/FS"
    "?element=21001&item=210011&year_gte=2022&year_lte=2024"
    "&output_type=json&show_codes=true&show_flags=false"
)


class FAOScraper(BaseScraper):
    name = "fao"

    async def fetch(self, db: AsyncSession) -> int:
        saved = 0
        today = date.today()

        # 1. Fetch global Food Price Index (one value for all countries)
        fpi_value = await self._fetch_global_fpi()
        if fpi_value is not None:
            for iso3 in get_all_iso3():
                await self.upsert_metric(db, iso3, "food_price_index", fpi_value, today)
                saved += 1

        # 2. Fetch per-country undernourishment (FAO uses FAO area codes, we map what we can)
        country_fs = await self._fetch_food_security()
        for iso3, value in country_fs.items():
            await self.upsert_metric(db, iso3, "fao_undernourishment", value, today)
            saved += 1

        return saved

    async def _fetch_global_fpi(self) -> float | None:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                resp = await client.get(FAO_FPI_URL)
                resp.raise_for_status()
                data = resp.json()
            records = data.get("data", [])
            if records:
                # Sort by year descending, take latest
                records_sorted = sorted(records, key=lambda r: r.get("Year", 0), reverse=True)
                return float(records_sorted[0]["Value"])
        except Exception as exc:
            logger.warning(f"FAO FPI fetch failed: {exc}")
        return None

    async def _fetch_food_security(self) -> dict[str, float]:
        """Returns {iso3: undernourishment_pct} for countries with data."""
        # FAO uses its own area codes. We store what we can match.
        # The FS dataset has ISO2 in "Area Code (ISO2)" field
        results: dict[str, float] = {}
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(FAO_FS_URL)
                resp.raise_for_status()
                data = resp.json()
            from ..utils.country_codes import iso2_to_iso3
            records = data.get("data", [])
            # Group by country, take most recent year
            by_country: dict[str, tuple[int, float]] = {}
            for rec in records:
                iso2 = rec.get("Area Code (ISO2)", "")
                year = int(rec.get("Year", 0))
                val = rec.get("Value")
                if iso2 and val is not None:
                    if iso2 not in by_country or year > by_country[iso2][0]:
                        by_country[iso2] = (year, float(val))
            for iso2, (_, val) in by_country.items():
                iso3 = iso2_to_iso3(iso2)
                if iso3:
                    results[iso3] = val
        except Exception as exc:
            logger.warning(f"FAO food security fetch failed: {exc}")
        return results
