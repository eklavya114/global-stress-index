import logging
from abc import ABC, abstractmethod
from datetime import datetime, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select
from ..models import RawMetric, ScraperRun

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    name: str = "base"

    async def run(self, db: AsyncSession) -> int:
        run = ScraperRun(scraper_name=self.name, started_at=datetime.utcnow(), status="running")
        db.add(run)
        await db.commit()
        await db.refresh(run)

        try:
            records = await self.fetch(db)
            run.status = "success"
            run.records_fetched = records
            run.completed_at = datetime.utcnow()
            await db.commit()
            logger.info(f"{self.name}: fetched {records} records")
            return records
        except Exception as exc:
            run.status = "failed"
            run.error_message = str(exc)
            run.completed_at = datetime.utcnow()
            await db.commit()
            logger.error(f"{self.name} failed: {exc}")
            return 0

    @abstractmethod
    async def fetch(self, db: AsyncSession) -> int:
        """Fetch data and upsert into raw_metrics. Returns record count."""
        ...

    async def upsert_metric(
        self,
        db: AsyncSession,
        country_iso3: str,
        metric_name: str,
        metric_value: float | None,
        metric_date: date | None = None,
    ) -> None:
        existing = await db.execute(
            select(RawMetric).where(
                RawMetric.country_iso3 == country_iso3,
                RawMetric.source == self.name,
                RawMetric.metric_name == metric_name,
                RawMetric.metric_date == (metric_date or date.today()),
            )
        )
        row = existing.scalar_one_or_none()
        if row:
            row.metric_value = metric_value
            row.fetched_at = datetime.utcnow()
        else:
            db.add(
                RawMetric(
                    country_iso3=country_iso3,
                    source=self.name,
                    metric_name=metric_name,
                    metric_value=metric_value,
                    metric_date=metric_date or date.today(),
                )
            )
        await db.commit()
