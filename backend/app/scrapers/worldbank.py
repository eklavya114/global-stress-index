"""
World Bank API scraper — no API key required.
Fetches GDP growth, inflation, unemployment, undernourishment, and food production index.
"""
import asyncio
import logging
from datetime import date

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.country_codes import COUNTRIES, iso3_to_iso2
from .base import BaseScraper

logger = logging.getLogger(__name__)

WB_BASE = "https://api.worldbank.org/v2/country/{iso2}/indicator/{indicator}?format=json&mrv=3"

INDICATORS = {
    "gdp_growth":       "NY.GDP.MKTP.KD.ZG",
    "inflation":        "FP.CPI.TOTL.ZG",
    "unemployment":     "SL.UEM.TOTL.ZS",
    "undernourishment": "SN.ITK.DEFC.ZS",
    "food_prod_index":  "AG.PRD.FOOD.XD",
}

# Only fetch for the most populous countries to stay within rate limits
# World Bank API is generous but we throttle to be respectful
TARGET_COUNTRIES = [r[0] for r in COUNTRIES if r[7] >= 2]  # population >= 2M


class WorldBankScraper(BaseScraper):
    name = "worldbank"

    async def fetch(self, db: AsyncSession) -> int:
        saved = 0
        today = date.today()

        # Batch requests with a semaphore to avoid hammering the API
        semaphore = asyncio.Semaphore(10)

        async def fetch_country(iso3: str) -> list[tuple[str, float | None]]:
            iso2 = iso3_to_iso2(iso3)
            if not iso2:
                return []
            results = []
            async with semaphore:
                for metric_name, indicator_code in INDICATORS.items():
                    try:
                        url = WB_BASE.format(iso2=iso2, indicator=indicator_code)
                        async with httpx.AsyncClient(timeout=15) as client:
                            resp = await client.get(url)
                            resp.raise_for_status()
                            payload = resp.json()

                        if len(payload) >= 2 and payload[1]:
                            # Find most recent non-null value
                            for entry in payload[1]:
                                if entry.get("value") is not None:
                                    results.append((metric_name, float(entry["value"])))
                                    break
                            else:
                                results.append((metric_name, None))
                    except Exception as exc:
                        logger.debug(f"WorldBank {iso3}/{metric_name}: {exc}")
                        results.append((metric_name, None))
                await asyncio.sleep(0.05)
            return results

        tasks = [fetch_country(iso3) for iso3 in TARGET_COUNTRIES]
        all_results = await asyncio.gather(*tasks, return_exceptions=True)

        for iso3, results in zip(TARGET_COUNTRIES, all_results):
            if isinstance(results, Exception):
                continue
            for metric_name, value in results:
                await self.upsert_metric(db, iso3, metric_name, value, today)
                saved += 1

        return saved
