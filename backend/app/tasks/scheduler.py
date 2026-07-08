import asyncio
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from ..config import settings

logger = logging.getLogger(__name__)
_scheduler: BackgroundScheduler | None = None


def _run_scrapers_sync():
    """Called by APScheduler in a background thread."""
    from ..database import AsyncSessionLocal
    from ..scrapers.acled import ACLEDScraper
    from ..scrapers.gdelt import GDELTScraper
    from ..scrapers.worldbank import WorldBankScraper
    from ..scrapers.fao import FAOScraper
    from ..scrapers.unhcr import UNHCRScraper
    from ..scoring.engine import compute_all_scores

    async def _async():
        async with AsyncSessionLocal() as db:
            for ScraperClass in [ACLEDScraper, GDELTScraper, WorldBankScraper, FAOScraper, UNHCRScraper]:
                try:
                    await ScraperClass().run(db)
                except Exception as exc:
                    logger.error(f"Scheduled scraper {ScraperClass.name}: {exc}")
            await compute_all_scores(db)

    asyncio.run(_async())


def start_scheduler():
    global _scheduler
    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _run_scrapers_sync,
        "interval",
        hours=settings.scraper_interval_hours,
        id="scraper_refresh",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(f"Scheduler started — scraping every {settings.scraper_interval_hours}h")


def shutdown_scheduler():
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
