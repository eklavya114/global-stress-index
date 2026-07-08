"""
GDELT 2.0 scraper — downloads the latest 15-minute event CSV and aggregates
conflict-related events per country. No API key required.
"""
import io
import logging
import zipfile
from collections import defaultdict
from datetime import date

import httpx
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from ..utils.country_codes import fips_to_iso3
from .base import BaseScraper

logger = logging.getLogger(__name__)

LAST_UPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"

# GDELT CAMEO root codes for conflict/violence events (first 2 digits of EventCode)
CONFLICT_ROOT_CODES = {14, 15, 17, 18, 19, 20}

# Column indices in GDELT 2.0 export CSV (tab-separated, no header)
COL_DATE = 1           # SQLDATE YYYYMMDD
COL_ACTOR1_CC = 7      # Actor1CountryCode (FIPS)
COL_ACTOR2_CC = 17     # Actor2CountryCode (FIPS)
COL_EVENT_CODE = 26    # EventCode (CAMEO)
COL_GOLDSTEIN = 30     # GoldsteinScale (-10 to +10)
COL_MENTIONS = 31      # NumMentions
COL_AVG_TONE = 34      # AvgTone (index 34 in GDELT 2.0 schema)


class GDELTScraper(BaseScraper):
    name = "gdelt"

    async def fetch(self, db: AsyncSession) -> int:
        csv_url = await self._get_latest_csv_url()
        if not csv_url:
            return 0

        raw_bytes = await self._download(csv_url)
        if not raw_bytes:
            return 0

        df = self._parse_events(raw_bytes, csv_url)
        if df is None or df.empty:
            return 0

        return await self._store(db, df)

    async def _get_latest_csv_url(self) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(LAST_UPDATE_URL)
                resp.raise_for_status()
            for line in resp.text.strip().splitlines():
                parts = line.split()
                if len(parts) >= 3 and "export.CSV.zip" in parts[2]:
                    return parts[2]
        except Exception as exc:
            logger.error(f"GDELT: failed to get last update URL: {exc}")
        return None

    async def _download(self, url: str) -> bytes | None:
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.content
        except Exception as exc:
            logger.error(f"GDELT: failed to download {url}: {exc}")
            return None

    def _parse_events(self, raw: bytes, url: str) -> pd.DataFrame | None:
        try:
            if url.endswith(".zip"):
                with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                    name = zf.namelist()[0]
                    raw = zf.read(name)

            df = pd.read_csv(
                io.BytesIO(raw),
                sep="\t",
                header=None,
                usecols=[COL_DATE, COL_ACTOR1_CC, COL_ACTOR2_CC, COL_EVENT_CODE, COL_GOLDSTEIN, COL_MENTIONS, COL_AVG_TONE],
                dtype={COL_EVENT_CODE: str, COL_ACTOR1_CC: str, COL_ACTOR2_CC: str},
                on_bad_lines="skip",
            )
            df.columns = ["date", "actor1_cc", "actor2_cc", "event_code", "goldstein", "mentions", "avg_tone"]
            return df
        except Exception as exc:
            logger.error(f"GDELT: parse error: {exc}")
            return None

    async def _store(self, db: AsyncSession, df: pd.DataFrame) -> int:
        # Filter for conflict events
        df["root_code"] = pd.to_numeric(df["event_code"].str[:2], errors="coerce")
        conflict = df[df["root_code"].isin(CONFLICT_ROOT_CODES)].copy()

        # Collect countries from both actor columns
        events_by_country: dict[str, list[dict]] = defaultdict(list)
        for col in ["actor1_cc", "actor2_cc"]:
            for _, row in conflict.iterrows():
                fips = str(row[col]).strip().upper()
                if fips and fips != "NAN" and len(fips) == 2:
                    iso3 = fips_to_iso3(fips)
                    if iso3:
                        events_by_country[iso3].append(
                            {"goldstein": row["goldstein"], "avg_tone": row["avg_tone"], "mentions": row["mentions"]}
                        )

        today = date.today()
        saved = 0
        for iso3, evts in events_by_country.items():
            event_count = len(evts)
            avg_goldstein = sum(e["goldstein"] for e in evts if pd.notna(e["goldstein"])) / max(event_count, 1)
            avg_tone = sum(e["avg_tone"] for e in evts if pd.notna(e["avg_tone"])) / max(event_count, 1)

            await self.upsert_metric(db, iso3, "gdelt_conflict_events", float(event_count), today)
            await self.upsert_metric(db, iso3, "gdelt_goldstein", float(avg_goldstein), today)
            await self.upsert_metric(db, iso3, "gdelt_avg_tone", float(avg_tone), today)
            saved += 3

        return saved
