"""
ACLED (Armed Conflict Location & Event Data) scraper.
Requires free API key from https://developer.acleddata.com/
Falls back gracefully when not configured.
"""
import logging
from datetime import date, timedelta
from collections import defaultdict
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from .base import BaseScraper
from ..config import settings

logger = logging.getLogger(__name__)

ACLED_URL = "https://api.acleddata.com/acled/read"
# CAMEO-equivalent ACLED event types indicating conflict
CONFLICT_TYPES = {
    "Battles",
    "Violence against civilians",
    "Explosions/Remote violence",
}


class ACLEDScraper(BaseScraper):
    name = "acled"

    async def fetch(self, db: AsyncSession) -> int:
        if not settings.acled_configured:
            logger.warning("ACLED not configured — skipping (add ACLED_API_KEY + ACLED_EMAIL to .env)")
            return 0

        since = (date.today() - timedelta(days=30)).strftime("%Y-%m-%d")
        today = date.today().strftime("%Y-%m-%d")

        params = {
            "key": settings.acled_api_key,
            "email": settings.acled_email,
            "event_date": f"{since}|{today}",
            "event_date_where": "BETWEEN",
            "limit": 5000,
            "fields": "iso3|event_date|event_type|fatalities",
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(ACLED_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        events = data.get("data", [])
        if not events:
            return 0

        # Aggregate per country
        counts: dict[str, int] = defaultdict(int)
        fatalities: dict[str, float] = defaultdict(float)

        for evt in events:
            iso3 = evt.get("iso3", "").upper()
            if not iso3 or len(iso3) != 3:
                continue
            if evt.get("event_type") in CONFLICT_TYPES:
                counts[iso3] += 1
                fatalities[iso3] += float(evt.get("fatalities") or 0)

        saved = 0
        today_date = date.today()
        for iso3, count in counts.items():
            await self.upsert_metric(db, iso3, "conflict_events_30d", float(count), today_date)
            await self.upsert_metric(db, iso3, "conflict_fatalities_30d", fatalities[iso3], today_date)
            saved += 2

        return saved
