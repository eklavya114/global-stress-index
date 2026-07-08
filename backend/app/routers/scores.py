import logging
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, BackgroundTasks, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db, AsyncSessionLocal
from ..models import PulseScore, Country, PulseScoreSchema, CountryWithScore, GlobalStats
from ..scrapers.acled import ACLEDScraper
from ..scrapers.gdelt import GDELTScraper
from ..scrapers.worldbank import WorldBankScraper
from ..scrapers.fao import FAOScraper
from ..scrapers.unhcr import UNHCRScraper
from ..scoring.engine import compute_all_scores

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/scores/latest", response_model=list[CountryWithScore])
async def get_latest_scores(db: AsyncSession = Depends(get_db)):
    """Get most recent pulse score for every country — used by the map."""
    # Two simple queries then merge in Python — avoids complex subquery join issues
    countries_result = await db.execute(select(Country))
    countries = {c.iso3: c for c in countries_result.scalars().all()}

    # Get the single latest score per country (most recent date)
    scores_result = await db.execute(
        select(PulseScore).order_by(desc(PulseScore.score_date))
    )
    seen: set[str] = set()
    latest_scores: dict[str, PulseScore] = {}
    for s in scores_result.scalars().all():
        if s.country_iso3 not in seen:
            latest_scores[s.country_iso3] = s
            seen.add(s.country_iso3)

    out = []
    for iso3, s in latest_scores.items():
        c = countries.get(iso3)
        out.append(
            CountryWithScore(
                iso3=iso3,
                iso2=c.iso2 if c else "",
                name=c.name if c else iso3,
                region=c.region if c else None,
                lat=c.lat if c else None,
                lon=c.lon if c else None,
                pulse_score=s.pulse_score,
                conflict_score=s.conflict_score,
                food_score=s.food_score,
                economic_score=s.economic_score,
                data_quality=s.data_quality,
                score_date=s.score_date,
            )
        )
    return out


@router.get("/scores/{iso3}", response_model=list[PulseScoreSchema])
async def get_country_scores(
    iso3: str,
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Get pulse score history for one country."""
    since = date.today() - timedelta(days=days)
    result = await db.execute(
        select(PulseScore)
        .where(PulseScore.country_iso3 == iso3.upper(), PulseScore.score_date >= since)
        .order_by(desc(PulseScore.score_date))
    )
    return result.scalars().all()


@router.get("/stats", response_model=GlobalStats)
async def get_global_stats(db: AsyncSession = Depends(get_db)):
    """Global summary statistics."""
    from ..models import Country

    total_countries = (await db.execute(select(func.count(Country.id)))).scalar_one()

    # Latest scores only
    subq = (
        select(PulseScore.country_iso3, func.max(PulseScore.score_date).label("md"))
        .group_by(PulseScore.country_iso3)
        .subquery()
    )
    scores_q = await db.execute(
        select(PulseScore)
        .join(subq, (PulseScore.country_iso3 == subq.c.country_iso3) & (PulseScore.score_date == subq.c.md))
    )
    scores = scores_q.scalars().all()
    scored = [s for s in scores if s.pulse_score is not None]

    if not scored:
        return GlobalStats(total_countries=total_countries, countries_scored=0, avg_pulse_score=0.0)

    avg = round(sum(s.pulse_score for s in scored) / len(scored), 2)
    highest = max(scored, key=lambda s: s.pulse_score)
    lowest = min(scored, key=lambda s: s.pulse_score)
    last_updated = max(s.computed_at for s in scored if s.computed_at)

    async def to_cws(s: PulseScore) -> CountryWithScore:
        c = (await db.execute(select(Country).where(Country.iso3 == s.country_iso3))).scalar_one_or_none()
        return CountryWithScore(
            iso3=s.country_iso3,
            iso2=c.iso2 if c else "",
            name=c.name if c else s.country_iso3,
            region=c.region if c else None,
            lat=c.lat if c else None,
            lon=c.lon if c else None,
            pulse_score=s.pulse_score,
            conflict_score=s.conflict_score,
            food_score=s.food_score,
            economic_score=s.economic_score,
            data_quality=s.data_quality,
            score_date=s.score_date,
        )

    return GlobalStats(
        total_countries=total_countries,
        countries_scored=len(scored),
        avg_pulse_score=avg,
        highest_stress=await to_cws(highest),
        lowest_stress=await to_cws(lowest),
        last_updated=last_updated,
    )


async def _run_all_scrapers_and_score() -> None:
    async with AsyncSessionLocal() as db:
        for ScraperClass in [ACLEDScraper, GDELTScraper, WorldBankScraper, FAOScraper, UNHCRScraper]:
            try:
                await ScraperClass().run(db)
            except Exception as exc:
                logger.error(f"Scraper {ScraperClass.name} error: {exc}")
        await compute_all_scores(db)


@router.post("/scrapers/run", status_code=202)
async def run_scrapers(background: BackgroundTasks):
    """Trigger all scrapers and recompute scores (async)."""
    background.add_task(_run_all_scrapers_and_score)
    return {"message": "Scraper run queued"}


@router.post("/scores/refresh", status_code=202)
async def refresh_scores(background: BackgroundTasks):
    """Recompute scores from existing raw data (no re-fetch)."""
    async def _refresh():
        async with AsyncSessionLocal() as db:
            await compute_all_scores(db)
    background.add_task(_refresh)
    return {"message": "Score refresh queued"}
