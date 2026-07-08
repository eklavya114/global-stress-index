"""
Intel router — proxies GDELT news and provides live event markers,
trends, insights, early warnings, and export endpoints.
"""
import csv
import io
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Country, PulseScore

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory GDELT cache (5-minute TTL) to avoid rate limiting
_news_cache: dict[str, tuple[datetime, list]] = {}
_CACHE_TTL = 300  # seconds


async def _fetch_gdelt(url: str, cache_key: str) -> list[dict]:
    """Fetch from GDELT with caching and fallback."""
    now = datetime.now(timezone.utc)
    if cache_key in _news_cache:
        cached_at, cached_data = _news_cache[cache_key]
        if (now - cached_at).total_seconds() < _CACHE_TTL:
            return cached_data

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 429:
                logger.warning("GDELT rate limit hit — serving cache")
                return _news_cache.get(cache_key, (None, []))[1]
            resp.raise_for_status()
            data = resp.json()

        articles = data.get("articles", [])
        out = [
            {
                "title": a.get("title", ""),
                "url": a.get("url", ""),
                "domain": a.get("domain", ""),
                "source_country": a.get("sourcecountry", ""),
                "seen_at": a.get("seendate", ""),
                "image": a.get("socialimage", ""),
            }
            for a in articles
            if a.get("title") and a.get("language", "English") == "English"
        ][:20]

        _news_cache[cache_key] = (now, out)
        return out

    except Exception as exc:
        logger.error(f"GDELT fetch failed for {cache_key}: {exc}")
        return _news_cache.get(cache_key, (None, []))[1]

_GDELT_BASE = (
    "https://api.gdeltproject.org/api/v2/doc/doc"
    "?mode=ArtList&maxrecords=50&sort=DateDesc&format=json&timespan=72h"
)

# sourcelang:english must be INSIDE the query string for GDELT v2
GDELT_NEWS_URL = (
    _GDELT_BASE + "&query=sourcelang:english+conflict+military+crisis+war+attack"
)
GDELT_NEWS_URL_FOOD = (
    _GDELT_BASE + "&query=sourcelang:english+food+crisis+famine+hunger+shortage"
)
GDELT_NEWS_URL_ECONOMIC = (
    _GDELT_BASE + "&query=sourcelang:english+economic+crisis+recession+inflation+sanctions"
)


@router.get("/news")
async def get_news(
    topic: str = Query(default="conflict", enum=["conflict", "food", "economic", "all"])
) -> list[dict[str, Any]]:
    """Proxy to GDELT news — returns real-time articles about global stress events."""
    if topic == "food":
        url, key = GDELT_NEWS_URL_FOOD, "food"
    elif topic == "economic":
        url, key = GDELT_NEWS_URL_ECONOMIC, "economic"
    else:
        url, key = GDELT_NEWS_URL, "conflict"
    return await _fetch_gdelt(url, key)


@router.get("/markers")
async def get_markers(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """
    Returns country-centroid markers for countries with elevated stress scores.
    Used to show 'hotspot' event dots on the map.
    """
    # Get latest scores
    subq = (
        select(PulseScore.country_iso3, PulseScore.pulse_score,
               PulseScore.conflict_score, PulseScore.food_score, PulseScore.economic_score)
        .order_by(desc(PulseScore.score_date))
    ).subquery()

    result = await db.execute(
        select(Country, subq.c.pulse_score, subq.c.conflict_score,
               subq.c.food_score, subq.c.economic_score)
        .join(subq, Country.iso3 == subq.c.country_iso3)
        .where(subq.c.pulse_score != None)
    )

    markers = []
    seen = set()
    for row in result.all():
        country, pulse, conflict, food, economic = row
        if country.iso3 in seen:
            continue
        seen.add(country.iso3)

        if country.lat is None or country.lon is None:
            continue

        # Categorize marker type
        max_score = max(
            conflict or 0,
            food or 0,
            economic or 0,
        )
        if max_score < 45:
            continue  # Only show notable markers

        if conflict and conflict == max_score:
            marker_type = "conflict"
        elif food and food == max_score:
            marker_type = "food"
        else:
            marker_type = "economic"

        markers.append(
            {
                "iso3": country.iso3,
                "name": country.name,
                "lat": country.lat,
                "lon": country.lon,
                "pulse_score": pulse,
                "conflict_score": conflict,
                "food_score": food,
                "economic_score": economic,
                "marker_type": marker_type,
                "severity": "critical" if max_score >= 75 else "high" if max_score >= 60 else "elevated",
            }
        )

    # Sort by pulse score desc, return top 60
    markers.sort(key=lambda m: m["pulse_score"] or 0, reverse=True)
    return markers[:60]


# ── Trends ────────────────────────────────────────────────────────────────────

@router.get("/trends")
async def get_trends(
    days: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Returns countries with largest score deltas over the past N days.
    Includes both improvers and deteriorators for the trends dashboard.
    """
    today = date.today()
    past = today - timedelta(days=days)

    # Latest scores
    latest_q = (
        select(
            PulseScore.country_iso3,
            func.max(PulseScore.score_date).label("latest_date"),
        )
        .where(PulseScore.score_date >= past)
        .group_by(PulseScore.country_iso3)
    ).subquery()

    latest_scores = await db.execute(
        select(PulseScore)
        .join(latest_q, (PulseScore.country_iso3 == latest_q.c.country_iso3)
              & (PulseScore.score_date == latest_q.c.latest_date))
    )
    latest_map: dict[str, PulseScore] = {r.country_iso3: r for r in latest_scores.scalars()}

    # Oldest scores in window
    oldest_q = (
        select(
            PulseScore.country_iso3,
            func.min(PulseScore.score_date).label("oldest_date"),
        )
        .where(PulseScore.score_date >= past)
        .group_by(PulseScore.country_iso3)
    ).subquery()

    oldest_scores = await db.execute(
        select(PulseScore)
        .join(oldest_q, (PulseScore.country_iso3 == oldest_q.c.country_iso3)
              & (PulseScore.score_date == oldest_q.c.oldest_date))
    )
    oldest_map: dict[str, PulseScore] = {r.country_iso3: r for r in oldest_scores.scalars()}

    # Country info
    countries_result = await db.execute(select(Country))
    country_map = {c.iso3: c for c in countries_result.scalars()}

    trends = []
    for iso3, latest in latest_map.items():
        old = oldest_map.get(iso3)
        country = country_map.get(iso3)
        if not old or not country or latest.pulse_score is None or old.pulse_score is None:
            continue
        delta = round(latest.pulse_score - old.pulse_score, 1)
        trends.append({
            "iso3": iso3,
            "name": country.name,
            "region": country.region,
            "current_score": round(latest.pulse_score, 1),
            "previous_score": round(old.pulse_score, 1),
            "delta": delta,
            "conflict_score": round(latest.conflict_score or 0, 1),
            "food_score": round(latest.food_score or 0, 1),
            "economic_score": round(latest.economic_score or 0, 1),
            "direction": "deteriorating" if delta > 0 else "improving" if delta < 0 else "stable",
        })

    # Sort by absolute delta descending
    trends.sort(key=lambda t: abs(t["delta"]), reverse=True)
    return trends[:50]


# ── Insights ──────────────────────────────────────────────────────────────────

def _generate_insights(
    iso3: str,
    name: str,
    pulse: float,
    conflict: float,
    food: float,
    economic: float,
    region: str | None,
    history: list[dict],
) -> list[dict[str, str]]:
    """Algorithmic rule-based insight generator — no AI API required."""
    insights = []

    # 1. Overall state
    if pulse >= 45:
        insights.append({
            "type": "critical",
            "title": "Elevated stress — monitor closely",
            "body": f"{name} is among the most stressed nations currently tracked at {pulse:.0f}/100. "
                    f"Multiple dimensions are showing strain. Humanitarian risk is elevated.",
        })
    elif pulse >= 30:
        insights.append({
            "type": "warning",
            "title": "Above-average stress",
            "body": f"With a pulse score of {pulse:.0f}, {name} is above the global average of ~18. "
                    f"At least one dimension is significantly elevated — early-stage vulnerabilities present.",
        })
    elif pulse >= 15:
        insights.append({
            "type": "info",
            "title": "Low-to-moderate stress",
            "body": f"{name}'s score of {pulse:.0f} reflects limited stress across tracked dimensions. "
                    f"The situation is broadly stable, though some indicators warrant watching.",
        })
    else:
        insights.append({
            "type": "stable",
            "title": "Stable",
            "body": f"{name} scores {pulse:.0f}/100 — among the most stable nations in the current dataset. "
                    f"All three dimensions show low stress.",
        })

    # 2. Dominant driver
    scores = {"Conflict": conflict, "Food Security": food, "Economic": economic}
    dominant = max(scores, key=lambda k: scores[k])
    dominant_val = scores[dominant]
    if dominant_val >= 35:
        insights.append({
            "type": "warning",
            "title": f"{dominant} is the primary stress driver",
            "body": f"The {dominant.lower()} dimension scores {dominant_val:.0f}/100, "
                    f"contributing the most to the overall pulse score. "
                    f"This is the area most requiring attention.",
        })

    # 3. Food-conflict linkage
    if food >= 30 and conflict >= 30:
        insights.append({
            "type": "warning",
            "title": "Food-conflict feedback loop risk",
            "body": f"Both food ({food:.0f}) and conflict ({conflict:.0f}) scores are elevated simultaneously. "
                    f"Research shows food insecurity and conflict reinforce each other — "
                    f"this combination heightens humanitarian risk.",
        })

    # 4. Economic-conflict divergence
    if economic >= 40 and conflict < 20:
        insights.append({
            "type": "info",
            "title": "Economic stress without open conflict",
            "body": f"High economic stress ({economic:.0f}) without corresponding conflict ({conflict:.0f}) "
                    f"may indicate latent social pressure. Historical patterns suggest "
                    f"this can precede unrest if uncorrected.",
        })

    # 5. Trend analysis
    if len(history) >= 2:
        earliest = history[0].get("pulse_score") or 0
        latest = history[-1].get("pulse_score") or 0
        delta = latest - earliest
        if delta >= 3:
            insights.append({
                "type": "warning",
                "title": f"Rapid deterioration: +{delta:.0f} points",
                "body": f"{name}'s score has risen by {delta:.0f} points in the recorded period. "
                        f"A consistent upward trend at this rate is a significant early warning signal.",
            })
        elif delta <= -3:
            insights.append({
                "type": "positive",
                "title": f"Improving trajectory: {delta:.0f} points",
                "body": f"{name}'s score has improved by {abs(delta):.0f} points. "
                        f"This sustained improvement across the full period is a positive signal, "
                        f"though maintaining it requires continued monitoring.",
            })

    return insights


@router.get("/insights/{iso3}")
async def get_insights(iso3: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Rule-based analytical insights for a country — no AI API needed."""
    iso3 = iso3.upper()

    country_result = await db.execute(select(Country).where(Country.iso3 == iso3))
    country = country_result.scalar_one_or_none()
    if not country:
        raise HTTPException(status_code=404, detail=f"Country {iso3} not found")

    # Latest score
    latest_result = await db.execute(
        select(PulseScore)
        .where(PulseScore.country_iso3 == iso3)
        .order_by(desc(PulseScore.score_date))
        .limit(1)
    )
    latest = latest_result.scalar_one_or_none()
    if not latest:
        return {"iso3": iso3, "name": country.name, "insights": [], "history": []}

    # 30-day history
    cutoff = date.today() - timedelta(days=30)
    history_result = await db.execute(
        select(PulseScore)
        .where(PulseScore.country_iso3 == iso3, PulseScore.score_date >= cutoff)
        .order_by(PulseScore.score_date)
    )
    history = [
        {
            "date": str(r.score_date),
            "pulse_score": r.pulse_score,
            "conflict_score": r.conflict_score,
            "food_score": r.food_score,
            "economic_score": r.economic_score,
        }
        for r in history_result.scalars()
    ]

    insights = _generate_insights(
        iso3=iso3,
        name=country.name,
        pulse=latest.pulse_score or 0,
        conflict=latest.conflict_score or 0,
        food=latest.food_score or 0,
        economic=latest.economic_score or 0,
        region=country.region,
        history=history,
    )

    return {
        "iso3": iso3,
        "name": country.name,
        "region": country.region,
        "latest_score": latest.pulse_score,
        "score_date": str(latest.score_date),
        "insights": insights,
        "history": history,
    }


# ── Early Warnings ────────────────────────────────────────────────────────────

@router.get("/early-warnings")
async def get_early_warnings(
    threshold: float = Query(default=3.0, ge=0.5),
    days: int = Query(default=7, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """
    Countries where pulse_score rose by >= threshold points in the last N days.
    These are the 'about to break' signals.
    """
    today = date.today()
    past = today - timedelta(days=days)

    # For each country: oldest and newest score in the window
    latest_q = (
        select(PulseScore.country_iso3, func.max(PulseScore.score_date).label("d"))
        .where(PulseScore.score_date >= past)
        .group_by(PulseScore.country_iso3)
    ).subquery()

    oldest_q = (
        select(PulseScore.country_iso3, func.min(PulseScore.score_date).label("d"))
        .where(PulseScore.score_date >= past)
        .group_by(PulseScore.country_iso3)
    ).subquery()

    latest_rows = await db.execute(
        select(PulseScore)
        .join(latest_q, (PulseScore.country_iso3 == latest_q.c.country_iso3)
              & (PulseScore.score_date == latest_q.c.d))
    )
    oldest_rows = await db.execute(
        select(PulseScore)
        .join(oldest_q, (PulseScore.country_iso3 == oldest_q.c.country_iso3)
              & (PulseScore.score_date == oldest_q.c.d))
    )

    latest_map = {r.country_iso3: r for r in latest_rows.scalars()}
    oldest_map = {r.country_iso3: r for r in oldest_rows.scalars()}

    countries_result = await db.execute(select(Country))
    country_map = {c.iso3: c for c in countries_result.scalars()}

    warnings = []
    for iso3, latest in latest_map.items():
        old = oldest_map.get(iso3)
        country = country_map.get(iso3)
        if not old or not country:
            continue
        if latest.pulse_score is None or old.pulse_score is None:
            continue
        delta = latest.pulse_score - old.pulse_score
        if delta >= threshold:
            dominant = max(
                [("Conflict", latest.conflict_score or 0),
                 ("Food", latest.food_score or 0),
                 ("Economic", latest.economic_score or 0)],
                key=lambda x: x[1],
            )
            warnings.append({
                "iso3": iso3,
                "name": country.name,
                "region": country.region,
                "current_score": round(latest.pulse_score, 1),
                "previous_score": round(old.pulse_score, 1),
                "delta": round(delta, 1),
                "primary_driver": dominant[0],
                "driver_score": round(dominant[1], 1),
            })

    warnings.sort(key=lambda w: w["delta"], reverse=True)
    return warnings[:20]


# ── Export ────────────────────────────────────────────────────────────────────

@router.get("/export/{iso3}")
async def export_country(iso3: str, db: AsyncSession = Depends(get_db)) -> StreamingResponse:
    """Download a country's full score history as CSV."""
    iso3 = iso3.upper()

    country_result = await db.execute(select(Country).where(Country.iso3 == iso3))
    country = country_result.scalar_one_or_none()
    if not country:
        raise HTTPException(status_code=404, detail=f"Country {iso3} not found")

    history_result = await db.execute(
        select(PulseScore)
        .where(PulseScore.country_iso3 == iso3)
        .order_by(PulseScore.score_date)
    )
    rows = history_result.scalars().all()

    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=["date", "country_iso3", "country_name", "pulse_score",
                    "conflict_score", "food_score", "economic_score", "data_quality"],
    )
    writer.writeheader()
    for r in rows:
        writer.writerow({
            "date": str(r.score_date),
            "country_iso3": iso3,
            "country_name": country.name,
            "pulse_score": r.pulse_score,
            "conflict_score": r.conflict_score,
            "food_score": r.food_score,
            "economic_score": r.economic_score,
            "data_quality": r.data_quality,
        })

    buf.seek(0)
    filename = f"earth-pulse-{iso3.lower()}-{date.today()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Story Finder ──────────────────────────────────────────────────────────────

@router.get("/story-finder")
async def get_story_finder(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """
    Surfaces the most 'underreported' crises: high pulse score but minimal
    mainstream media coverage. Gold for journalists and researchers.
    """
    # Get countries with GDELT article coverage proxy
    coverage_url = (
        "https://api.gdeltproject.org/api/v2/doc/doc"
        "?mode=TimelineVolInfo&format=json&timespan=7d&sourcelang=english"
        "&query=crisis+OR+conflict+OR+famine"
    )

    subq = (
        select(PulseScore.country_iso3, func.max(PulseScore.score_date).label("latest"))
        .group_by(PulseScore.country_iso3)
    ).subquery()

    result = await db.execute(
        select(Country, PulseScore)
        .join(subq, Country.iso3 == subq.c.country_iso3)
        .join(PulseScore, (PulseScore.country_iso3 == subq.c.country_iso3)
              & (PulseScore.score_date == subq.c.latest))
        .where(PulseScore.pulse_score >= 30)
        .order_by(desc(PulseScore.pulse_score))
    )

    # Build list with "media attention" proxy (smaller countries → less coverage)
    stories = []
    seen = set()
    for row in result.all():
        country, score = row
        if country.iso3 in seen:
            continue
        seen.add(country.iso3)

        pop = country.population or 10_000_000
        # Underreported = high score + small population (less likely to be covered)
        underreport_score = (score.pulse_score or 0) * (1 - min(1, pop / 200_000_000))

        stories.append({
            "iso3": country.iso3,
            "name": country.name,
            "region": country.region,
            "pulse_score": round(score.pulse_score or 0, 1),
            "conflict_score": round(score.conflict_score or 0, 1),
            "food_score": round(score.food_score or 0, 1),
            "economic_score": round(score.economic_score or 0, 1),
            "population": pop,
            "underreport_score": round(underreport_score, 1),
            "story_angle": _story_angle(
                score.conflict_score or 0,
                score.food_score or 0,
                score.economic_score or 0,
                country.name,
            ),
        })

    stories.sort(key=lambda s: s["underreport_score"], reverse=True)
    return stories[:20]


def _story_angle(conflict: float, food: float, economic: float, name: str) -> str:
    """Generate a one-line story angle for journalists."""
    if conflict > food and conflict > economic and conflict >= 65:
        return f"Armed conflict driving civilian displacement in {name}"
    if food > conflict and food > economic and food >= 60:
        return f"Food insecurity affecting millions in {name} — hunger crisis underway"
    if economic > conflict and economic > food and economic >= 60:
        return f"Economic collapse threatening social stability in {name}"
    if food >= 50 and conflict >= 50:
        return f"Conflict-hunger feedback loop intensifying in {name}"
    return f"Multi-dimensional stress building in {name} — crisis may be imminent"


# ── Population Impact ─────────────────────────────────────────────────────────

@router.get("/impact")
async def get_global_impact(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """
    Calculates the real human impact of current global stress scores.
    Shows how many people are living under different stress levels.
    """
    subq = (
        select(PulseScore.country_iso3, func.max(PulseScore.score_date).label("latest"))
        .group_by(PulseScore.country_iso3)
    ).subquery()

    result = await db.execute(
        select(Country, PulseScore)
        .join(subq, Country.iso3 == subq.c.country_iso3)
        .join(PulseScore, (PulseScore.country_iso3 == subq.c.country_iso3)
              & (PulseScore.score_date == subq.c.latest))
        .where(PulseScore.pulse_score != None)
    )

    buckets = {"critical": 0, "high": 0, "elevated": 0, "moderate": 0, "stable": 0}
    seen = set()
    total_pop = 0

    for row in result.all():
        country, score = row
        if country.iso3 in seen:
            continue
        seen.add(country.iso3)
        pop = country.population or 0
        total_pop += pop
        p = score.pulse_score or 0
        if p >= 45:
            buckets["critical"] += pop
        elif p >= 35:
            buckets["high"] += pop
        elif p >= 25:
            buckets["elevated"] += pop
        elif p >= 15:
            buckets["moderate"] += pop
        else:
            buckets["stable"] += pop

    return {
        "total_population_tracked": total_pop,
        "buckets": buckets,
        "people_in_crisis": buckets["critical"] + buckets["high"],
        "crisis_pct": round((buckets["critical"] + buckets["high"]) / max(total_pop, 1) * 100, 1),
    }


# ── Module-level constants for new endpoints ──────────────────────────────────

CASCADE_NETWORK: dict[str, list[dict]] = {
    "SYR": [{"iso3": "LBN", "mechanism": "Refugee flows & political destabilization", "strength": 0.88}, {"iso3": "JOR", "mechanism": "Refugee pressure & economic strain", "strength": 0.75}, {"iso3": "TUR", "mechanism": "Refugee flows & political tension", "strength": 0.62}, {"iso3": "IRQ", "mechanism": "Cross-border jihadist activity", "strength": 0.55}],
    "AFG": [{"iso3": "PAK", "mechanism": "Refugee flows & terrorist spillover", "strength": 0.85}, {"iso3": "IRN", "mechanism": "Refugee flows & economic pressure", "strength": 0.65}, {"iso3": "TJK", "mechanism": "Security spillover", "strength": 0.42}, {"iso3": "UZB", "mechanism": "Security concern & economic", "strength": 0.38}],
    "SDN": [{"iso3": "TCD", "mechanism": "Refugee flows & arms trafficking", "strength": 0.82}, {"iso3": "ETH", "mechanism": "Refugee flows & border conflict", "strength": 0.75}, {"iso3": "SSD", "mechanism": "Cross-border violence & displacement", "strength": 0.70}, {"iso3": "LBY", "mechanism": "Arms trafficking & jihadist links", "strength": 0.55}, {"iso3": "EGY", "mechanism": "Nile water security & political", "strength": 0.48}],
    "SSD": [{"iso3": "UGA", "mechanism": "Refugee flows", "strength": 0.75}, {"iso3": "ETH", "mechanism": "Armed group links & refugee", "strength": 0.65}, {"iso3": "KEN", "mechanism": "Refugee flows & economic", "strength": 0.60}, {"iso3": "CAF", "mechanism": "Cross-border armed groups", "strength": 0.45}],
    "YEM": [{"iso3": "SAU", "mechanism": "Direct military conflict at border", "strength": 0.78}, {"iso3": "OMN", "mechanism": "Security spillover & refugee", "strength": 0.50}, {"iso3": "DJI", "mechanism": "Strategic waterway impact", "strength": 0.42}, {"iso3": "SOM", "mechanism": "Piracy network linkage", "strength": 0.38}],
    "ETH": [{"iso3": "ERI", "mechanism": "Border conflict & refugee", "strength": 0.78}, {"iso3": "SDN", "mechanism": "Refugee flows & political", "strength": 0.65}, {"iso3": "SOM", "mechanism": "Al-Shabaab cross-border", "strength": 0.55}, {"iso3": "KEN", "mechanism": "Refugee flows & economic", "strength": 0.48}, {"iso3": "DJI", "mechanism": "Economic & trade disruption", "strength": 0.40}],
    "COD": [{"iso3": "RWA", "mechanism": "Armed group proxy conflict", "strength": 0.80}, {"iso3": "UGA", "mechanism": "Refugee flows & LRA spillover", "strength": 0.65}, {"iso3": "BDI", "mechanism": "Refugee flows & political", "strength": 0.60}, {"iso3": "CAF", "mechanism": "Armed group links", "strength": 0.55}],
    "MLI": [{"iso3": "BFA", "mechanism": "Jihadist expansion (JNIM/GSIM)", "strength": 0.85}, {"iso3": "NER", "mechanism": "Jihadist expansion & refugee", "strength": 0.80}, {"iso3": "MRT", "mechanism": "Extremist spillover & refugee", "strength": 0.55}, {"iso3": "GIN", "mechanism": "Refugee flows & political", "strength": 0.42}],
    "MMR": [{"iso3": "BGD", "mechanism": "Rohingya refugee crisis", "strength": 0.88}, {"iso3": "THA", "mechanism": "Refugee flows & trade disruption", "strength": 0.55}, {"iso3": "IND", "mechanism": "Manipur border security", "strength": 0.42}],
    "UKR": [{"iso3": "MDA", "mechanism": "Refugee flows & energy disruption", "strength": 0.78}, {"iso3": "POL", "mechanism": "Refugee flows & security", "strength": 0.65}, {"iso3": "ROU", "mechanism": "Danube shipping & economic", "strength": 0.52}],
    "HTI": [{"iso3": "DOM", "mechanism": "Mass migration & crime spillover", "strength": 0.82}, {"iso3": "BHS", "mechanism": "Migration flows", "strength": 0.45}],
    "VEN": [{"iso3": "COL", "mechanism": "Mass migration (7M+ displaced)", "strength": 0.88}, {"iso3": "BRA", "mechanism": "Refugee flows & border pressure", "strength": 0.62}, {"iso3": "ECU", "mechanism": "Migration & crime spillover", "strength": 0.58}, {"iso3": "PER", "mechanism": "Migration flows", "strength": 0.52}],
    "IRN": [{"iso3": "IRQ", "mechanism": "Proxy military forces", "strength": 0.75}, {"iso3": "LBN", "mechanism": "Hezbollah proxy support", "strength": 0.70}, {"iso3": "YEM", "mechanism": "Houthi weapons supply", "strength": 0.65}, {"iso3": "SYR", "mechanism": "Military & political support", "strength": 0.68}],
    "SOM": [{"iso3": "KEN", "mechanism": "Al-Shabaab attacks & refugee", "strength": 0.72}, {"iso3": "ETH", "mechanism": "Border security & al-Shabaab", "strength": 0.60}, {"iso3": "DJI", "mechanism": "Strategic & trade disruption", "strength": 0.40}],
    "ISR": [{"iso3": "PSE", "mechanism": "Direct conflict & humanitarian crisis", "strength": 0.95}, {"iso3": "LBN", "mechanism": "Cross-border military conflict", "strength": 0.85}, {"iso3": "JOR", "mechanism": "Refugee pressure & political", "strength": 0.55}, {"iso3": "EGY", "mechanism": "Gaza border & political tension", "strength": 0.60}],
    "PSE": [{"iso3": "ISR", "mechanism": "Direct conflict - military operations", "strength": 0.95}, {"iso3": "EGY", "mechanism": "Refugee & humanitarian pressure", "strength": 0.65}, {"iso3": "JOR", "mechanism": "Political solidarity tensions", "strength": 0.50}],
    "CAF": [{"iso3": "TCD", "mechanism": "Wagner-linked armed group spillover", "strength": 0.68}, {"iso3": "COD", "mechanism": "Cross-border armed groups", "strength": 0.60}, {"iso3": "SDN", "mechanism": "Refugee flows & armed groups", "strength": 0.55}],
    "NGA": [{"iso3": "NER", "mechanism": "Boko Haram / ISWAP spillover", "strength": 0.72}, {"iso3": "CMR", "mechanism": "Lake Chad Basin jihadist", "strength": 0.65}, {"iso3": "TCD", "mechanism": "Lake Chad Basin crisis", "strength": 0.60}, {"iso3": "BEN", "mechanism": "Jihadist expansion risk", "strength": 0.40}],
    "PRK": [{"iso3": "KOR", "mechanism": "Military threat & missile launches", "strength": 0.80}, {"iso3": "JPN", "mechanism": "Missile threat & nuclear risk", "strength": 0.65}, {"iso3": "CHN", "mechanism": "Buffer state strategic pressure", "strength": 0.50}],
}

CALENDAR_EVENTS: list[dict] = [
    {"date": "2026-07-01", "iso3": "COD", "event_type": "election", "title": "DRC Provincial Elections", "description": "Provincial elections risk violence. Armed groups active in Kivu provinces.", "predicted_impact": 3.2, "historical_basis": "Elections in fragile states avg +4.2 pulse over 60 days"},
    {"date": "2026-07-10", "iso3": None, "event_type": "summit", "title": "G7 Leaders Summit", "description": "Humanitarian aid commitments, Ukraine support, Sudan emergency response.", "predicted_impact": -1.5, "historical_basis": "G7 summits correlated with -1.2 avg conflict reduction"},
    {"date": "2026-07-15", "iso3": "SDN", "event_type": "humanitarian", "title": "Sudan Emergency Appeal Review", "description": "OCHA review of $2.7B appeal. Funding gap may suspend programs for 6M people.", "predicted_impact": 2.8, "historical_basis": "Humanitarian funding shortfalls increase food crisis scores by avg +3.1"},
    {"date": "2026-07-22", "iso3": "YEM", "event_type": "ceasefire", "title": "Yemen Ceasefire Review", "description": "UN-mediated assessment of Houthi-Saudi truce. Renewed drone attacks reported.", "predicted_impact": -1.8, "historical_basis": "Ceasefire reviews reduce conflict score by avg -2.1"},
    {"date": "2026-08-01", "iso3": "MMR", "event_type": "sanctions", "title": "EU Myanmar Sanctions Review", "description": "Quarterly review of sanctions regime against junta military purchases.", "predicted_impact": -0.8, "historical_basis": None},
    {"date": "2026-08-12", "iso3": "AFG", "event_type": "humanitarian", "title": "Afghanistan Wheat Harvest Assessment", "description": "FAO/WFP joint assessment under drought conditions. Critical food security determination.", "predicted_impact": 3.5, "historical_basis": "Drought years increase food scores by avg +5.3 in Afghanistan"},
    {"date": "2026-08-20", "iso3": "ETH", "event_type": "peace", "title": "Tigray Peace Agreement Review", "description": "African Union-mediated 2-year review of Pretoria Agreement implementation.", "predicted_impact": -2.1, "historical_basis": None},
    {"date": "2026-09-01", "iso3": None, "event_type": "summit", "title": "UN General Assembly 81st Session", "description": "Annual UNGA opens. Major humanitarian pledges and crisis resolutions expected.", "predicted_impact": -0.5, "historical_basis": None},
    {"date": "2026-09-10", "iso3": "SOM", "event_type": "election", "title": "Somalia Federal State Elections", "description": "State-level elections with high al-Shabaab interference risk.", "predicted_impact": 2.5, "historical_basis": None},
    {"date": "2026-09-15", "iso3": "HTI", "event_type": "humanitarian", "title": "Haiti Security Mission Review", "description": "Review of Kenyan-led Multinational Security Support mission mandate.", "predicted_impact": -1.5, "historical_basis": None},
    {"date": "2026-09-25", "iso3": "SDN", "event_type": "humanitarian", "title": "Sudan Famine Prevention Deadline", "description": "IPC Phase 5 famine threshold projected in 5 regions without emergency intervention.", "predicted_impact": 4.5, "historical_basis": "IPC Phase 5 declarations precede avg +6.2 food score increase"},
    {"date": "2026-10-01", "iso3": "IRN", "event_type": "sanctions", "title": "JCPOA Snapback Mechanism", "description": "Potential snapback of all UN sanctions on Iran over nuclear non-compliance.", "predicted_impact": 3.8, "historical_basis": None},
    {"date": "2026-10-15", "iso3": "COD", "event_type": "peace", "title": "M23 Peace Talks Deadline", "description": "Angola-mediated deadline for M23 withdrawal from eastern DRC territories.", "predicted_impact": -2.5, "historical_basis": None},
    {"date": "2026-11-03", "iso3": "VEN", "event_type": "election", "title": "Venezuela Legislative Election", "description": "First legislative elections since disputed 2024 presidential re-election.", "predicted_impact": 2.2, "historical_basis": None},
    {"date": "2026-11-20", "iso3": None, "event_type": "summit", "title": "G20 Summit South Africa", "description": "Focus on debt restructuring, climate adaptation, and food security.", "predicted_impact": -1.0, "historical_basis": None},
    {"date": "2026-12-01", "iso3": "PRK", "event_type": "sanctions", "title": "UNSC North Korea Sanctions Review", "description": "Annual Security Council review. Russia/China veto expected to block renewal.", "predicted_impact": 1.5, "historical_basis": None},
    {"date": "2026-12-10", "iso3": None, "event_type": "humanitarian", "title": "Global Humanitarian Funding Deadline", "description": "Year-end close of appeals. Funding gaps determine 2027 program capacity.", "predicted_impact": 2.0, "historical_basis": None},
]

INTERVENTIONS_DB: dict[str, list[dict]] = {
    "conflict": [
        {"type": "UN Peacekeeping Mission", "avg_impact": -6.1, "timeframe": "6-12 months", "evidence": "MONUSCO (DRC): -5.8 pts; MINUSMA (Mali): -7.2 pts; UNMISS (South Sudan): -4.5 pts"},
        {"type": "Ceasefire Agreement", "avg_impact": -4.3, "timeframe": "1-3 months", "evidence": "Yemen 2022 truce: -3.8 pts; Ethiopia-Tigray 2022: -6.1 pts"},
        {"type": "Diplomatic Mediation (AU/UN)", "avg_impact": -3.1, "timeframe": "3-6 months", "evidence": "Mozambique 1992 accords; Liberia/Sierra Leone 2003 peace process"},
        {"type": "Arms Embargo (UN Security Council)", "avg_impact": -1.8, "timeframe": "6-18 months", "evidence": "Sudan, Libya, Myanmar embargoes: avg -1.8 pts, high variance"},
    ],
    "food": [
        {"type": "WFP Emergency Food Aid", "avg_impact": -5.2, "timeframe": "1-3 months", "evidence": "Yemen 2021: -4.9 pts; Ethiopia 2022: -5.8 pts; Somalia 2022: -5.1 pts"},
        {"type": "Agricultural Support & Seeds Program", "avg_impact": -3.8, "timeframe": "6-12 months", "evidence": "FAO seed programs reduce food scores avg -3.8 over 2 growing seasons"},
        {"type": "IMF/World Bank Food Emergency Grant", "avg_impact": -2.9, "timeframe": "3-6 months", "evidence": "15 crisis countries 2020-2022: avg -2.9 pts over 6 months"},
        {"type": "Fertilizer Access Program", "avg_impact": -2.1, "timeframe": "3-6 months", "evidence": "CGIAR programs avg -2.1 pts in Sub-Saharan Africa"},
    ],
    "economic": [
        {"type": "IMF Stabilization Program", "avg_impact": -4.5, "timeframe": "12-24 months", "evidence": "Pakistan 2023: -4.1 pts; Egypt 2022: -5.2 pts; Sri Lanka 2023: -3.8 pts"},
        {"type": "Debt Relief Initiative (DSSI/HIPC)", "avg_impact": -3.2, "timeframe": "6-12 months", "evidence": "HIPC completion avg -3.2 pts; G20 DSSI avg -1.8 pts"},
        {"type": "Sanctions Relief", "avg_impact": -5.8, "timeframe": "6-18 months", "evidence": "Iran JCPOA 2015: -6.2 pts; Myanmar 2011-2016: -5.1 pts"},
        {"type": "Budget Support Grant (EU/World Bank)", "avg_impact": -2.5, "timeframe": "3-12 months", "evidence": "Sub-Saharan Africa direct budget support avg -2.5 pts"},
    ],
    "balanced": [
        {"type": "Comprehensive Peace & Development Package", "avg_impact": -7.2, "timeframe": "12-36 months", "evidence": "Sierra Leone post-war 2002: -9.1 pts; Liberia 2006: -8.3 pts"},
        {"type": "International Contact Group", "avg_impact": -3.5, "timeframe": "3-9 months", "evidence": "Coordinated multilateral response reduces multi-dimensional crises avg -3.5"},
    ],
}


# ── Nexus ──────────────────────────────────────────────────────────────────────

@router.get("/nexus")
async def get_nexus(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """Returns countries with compound crises (2+ dimensions elevated simultaneously)."""
    try:
        subq = (
            select(PulseScore.country_iso3, func.max(PulseScore.score_date).label("latest"))
            .group_by(PulseScore.country_iso3)
        ).subquery()

        result = await db.execute(
            select(Country, PulseScore)
            .join(subq, Country.iso3 == subq.c.country_iso3)
            .join(
                PulseScore,
                (PulseScore.country_iso3 == subq.c.country_iso3)
                & (PulseScore.score_date == subq.c.latest),
            )
            .where(PulseScore.pulse_score != None)
        )

        NEXUS_THRESHOLD = 22.0
        nexus_countries = []
        seen: set[str] = set()

        for row in result.all():
            country, score = row
            if country.iso3 in seen:
                continue
            seen.add(country.iso3)

            conflict = score.conflict_score or 0.0
            food = score.food_score or 0.0
            economic = score.economic_score or 0.0

            elevated = {
                "conflict": conflict >= NEXUS_THRESHOLD,
                "food": food >= NEXUS_THRESHOLD,
                "economic": economic >= NEXUS_THRESHOLD,
            }
            n_elevated = sum(elevated.values())
            if n_elevated < 2:
                continue

            # Determine nexus_type
            if elevated["conflict"] and elevated["food"] and elevated["economic"]:
                nexus_type = "triple"
            elif elevated["food"] and elevated["conflict"]:
                nexus_type = "food-conflict"
            elif elevated["economic"] and elevated["conflict"]:
                nexus_type = "economic-conflict"
            else:
                nexus_type = "food-economic"

            # Severity
            n_above_35 = sum([
                conflict >= 35 and elevated["conflict"],
                food >= 35 and elevated["food"],
                economic >= 35 and elevated["economic"],
            ])
            if nexus_type == "triple":
                severity = 3
            elif n_above_35 >= 2:
                severity = 2
            else:
                severity = 1

            # nexus_score = average of elevated sub-scores
            elevated_vals = []
            if elevated["conflict"]:
                elevated_vals.append(conflict)
            if elevated["food"]:
                elevated_vals.append(food)
            if elevated["economic"]:
                elevated_vals.append(economic)
            nexus_score = round(sum(elevated_vals) / len(elevated_vals), 1)

            # Description
            parts = []
            if elevated["conflict"]:
                parts.append(f"conflict ({conflict:.0f})")
            if elevated["food"]:
                parts.append(f"food insecurity ({food:.0f})")
            if elevated["economic"]:
                parts.append(f"economic stress ({economic:.0f})")
            description = f"Elevated {' and '.join(parts)} simultaneously."

            nexus_countries.append({
                "iso3": country.iso3,
                "name": country.name,
                "region": country.region,
                "nexus_type": nexus_type,
                "severity": severity,
                "pulse_score": round(score.pulse_score or 0, 1),
                "conflict_score": round(conflict, 1),
                "food_score": round(food, 1),
                "economic_score": round(economic, 1),
                "nexus_score": nexus_score,
                "description": description,
            })

        nexus_countries.sort(key=lambda x: x["nexus_score"], reverse=True)
        return nexus_countries[:30]

    except Exception as exc:
        logger.error(f"get_nexus error: {exc}")
        return []


# ── Cascade ────────────────────────────────────────────────────────────────────

@router.get("/cascade/{iso3}")
async def get_cascade(iso3: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Returns cascade impact network from a source country."""
    iso3 = iso3.upper()

    try:
        # Get source country info
        country_result = await db.execute(select(Country).where(Country.iso3 == iso3))
        source_country = country_result.scalar_one_or_none()
        source_name = source_country.name if source_country else iso3

        # Get source country latest score
        source_score_result = await db.execute(
            select(PulseScore)
            .where(PulseScore.country_iso3 == iso3)
            .order_by(desc(PulseScore.score_date))
            .limit(1)
        )
        source_score_row = source_score_result.scalar_one_or_none()
        source_score = round(source_score_row.pulse_score, 1) if source_score_row and source_score_row.pulse_score is not None else None

        impacts_template = CASCADE_NETWORK.get(iso3)
        if not impacts_template:
            return {
                "source_iso3": iso3,
                "source_name": source_name,
                "source_score": source_score,
                "impacts": [],
                "message": f"No cascade data for this country",
            }

        # Fetch latest scores for all impact countries in one query
        impact_iso3s = [entry["iso3"] for entry in impacts_template]

        subq = (
            select(PulseScore.country_iso3, func.max(PulseScore.score_date).label("latest"))
            .where(PulseScore.country_iso3.in_(impact_iso3s))
            .group_by(PulseScore.country_iso3)
        ).subquery()

        scores_result = await db.execute(
            select(PulseScore)
            .join(
                subq,
                (PulseScore.country_iso3 == subq.c.country_iso3)
                & (PulseScore.score_date == subq.c.latest),
            )
        )
        scores_map: dict[str, float | None] = {}
        for ps in scores_result.scalars():
            scores_map[ps.country_iso3] = round(ps.pulse_score, 1) if ps.pulse_score is not None else None

        # Fetch country names for impact countries
        countries_result = await db.execute(
            select(Country).where(Country.iso3.in_(impact_iso3s))
        )
        names_map: dict[str, str] = {c.iso3: c.name for c in countries_result.scalars()}

        impacts = []
        for entry in impacts_template:
            target_iso3 = entry["iso3"]
            impacts.append({
                "iso3": target_iso3,
                "name": names_map.get(target_iso3, target_iso3),
                "mechanism": entry["mechanism"],
                "strength": entry["strength"],
                "current_score": scores_map.get(target_iso3),
            })

        return {
            "source_iso3": iso3,
            "source_name": source_name,
            "source_score": source_score,
            "impacts": impacts,
        }

    except Exception as exc:
        logger.error(f"get_cascade error for {iso3}: {exc}")
        return {"source_iso3": iso3, "source_name": iso3, "source_score": None, "impacts": []}


# ── Calendar ───────────────────────────────────────────────────────────────────

@router.get("/calendar")
async def get_calendar(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """Returns upcoming geopolitical events sorted by date."""
    try:
        today = date.today()

        # Collect iso3s that need country name lookup
        iso3s_needed = [e["iso3"] for e in CALENDAR_EVENTS if e["iso3"] is not None]
        countries_result = await db.execute(
            select(Country).where(Country.iso3.in_(iso3s_needed))
        )
        names_map: dict[str, str] = {c.iso3: c.name for c in countries_result.scalars()}

        enriched = []
        for event in CALENDAR_EVENTS:
            event_date = date.fromisoformat(event["date"])
            days_until = (event_date - today).days
            iso3_val = event["iso3"]
            enriched.append({
                "date": event["date"],
                "iso3": iso3_val,
                "name": names_map.get(iso3_val) if iso3_val else None,
                "event_type": event["event_type"],
                "title": event["title"],
                "description": event["description"],
                "predicted_impact": event["predicted_impact"],
                "historical_basis": event.get("historical_basis"),
                "days_until": days_until,
            })

        enriched.sort(key=lambda e: e["date"])
        return enriched

    except Exception as exc:
        logger.error(f"get_calendar error: {exc}")
        return []


# ── Forecast ───────────────────────────────────────────────────────────────────

@router.get("/forecast/{iso3}")
async def get_forecast(iso3: str, db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Returns 30/60/90 day forecast and intervention pathways for a country."""
    iso3 = iso3.upper()

    try:
        country_result = await db.execute(select(Country).where(Country.iso3 == iso3))
        country = country_result.scalar_one_or_none()
        if not country:
            raise HTTPException(status_code=404, detail=f"Country {iso3} not found")

        # Last 90 days of scores
        cutoff = date.today() - timedelta(days=90)
        history_result = await db.execute(
            select(PulseScore)
            .where(PulseScore.country_iso3 == iso3, PulseScore.score_date >= cutoff)
            .order_by(PulseScore.score_date)
        )
        history = history_result.scalars().all()

        if not history:
            return {
                "iso3": iso3,
                "name": country.name,
                "current_score": None,
                "trend_30d": 0,
                "trajectory": "stable",
                "forecast": [],
                "primary_driver": "balanced",
                "interventions": INTERVENTIONS_DB["balanced"],
                "risk_factors": [],
                "history_points": 0,
            }

        latest = history[-1]
        current_score = latest.pulse_score or 0.0
        conflict = latest.conflict_score or 0.0
        food = latest.food_score or 0.0
        economic = latest.economic_score or 0.0

        # Trend: compare latest to score ~30 days ago
        trend_30d = 0.0
        cutoff_30 = date.today() - timedelta(days=30)
        scores_before_30 = [h for h in history if h.score_date <= cutoff_30]
        if scores_before_30:
            score_30d_ago = scores_before_30[-1].pulse_score or 0.0
            trend_30d = round(current_score - score_30d_ago, 2)
        daily_trend = trend_30d / 30.0

        # Trajectory
        if trend_30d > 2:
            trajectory = "deteriorating"
        elif trend_30d < -2:
            trajectory = "improving"
        else:
            trajectory = "stable"

        # Primary driver
        scores_dict = {"conflict": conflict, "food": food, "economic": economic}
        max_score = max(scores_dict.values())
        sorted_scores = sorted(scores_dict.values(), reverse=True)
        if len(sorted_scores) >= 2 and (sorted_scores[0] - sorted_scores[1]) <= 3:
            primary_driver = "balanced"
        else:
            primary_driver = max(scores_dict, key=lambda k: scores_dict[k])

        # Risk factors
        risk_factors = []
        if food >= 30:
            risk_factors.append("Deteriorating food security")
        if conflict >= 35:
            risk_factors.append("Active armed conflict")
        if economic >= 30:
            risk_factors.append("Economic instability")
        if not risk_factors and current_score >= 20:
            risk_factors.append("Moderate multi-dimensional stress")

        # Forecast
        forecast = []
        for n, confidence in [(30, 0.85), (60, 0.70), (90, 0.55)]:
            predicted = max(0.0, min(100.0, current_score + daily_trend * n))
            forecast.append({
                "days": n,
                "predicted_score": round(predicted, 1),
                "confidence": confidence,
            })

        # Interventions (top 3)
        driver_key = primary_driver if primary_driver in INTERVENTIONS_DB else "balanced"
        interventions = INTERVENTIONS_DB[driver_key][:3]

        return {
            "iso3": iso3,
            "name": country.name,
            "current_score": round(current_score, 1),
            "trend_30d": trend_30d,
            "trajectory": trajectory,
            "forecast": forecast,
            "primary_driver": primary_driver,
            "interventions": interventions,
            "risk_factors": risk_factors,
            "history_points": len(history),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"get_forecast error for {iso3}: {exc}")
        return {}


# ── Lab: Anomalies ─────────────────────────────────────────────────────────────

@router.get("/lab/anomalies")
async def get_lab_anomalies(db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """Returns countries with statistically unusual score deviations."""
    try:
        cutoff = date.today() - timedelta(days=90)

        history_result = await db.execute(
            select(PulseScore)
            .where(PulseScore.score_date >= cutoff)
            .order_by(PulseScore.country_iso3, PulseScore.score_date)
        )
        all_scores = history_result.scalars().all()

        # Group by country
        country_scores: dict[str, list[float]] = {}
        country_latest: dict[str, float] = {}
        for ps in all_scores:
            if ps.pulse_score is None:
                continue
            iso3_key = ps.country_iso3
            if iso3_key not in country_scores:
                country_scores[iso3_key] = []
            country_scores[iso3_key].append(ps.pulse_score)
            country_latest[iso3_key] = ps.pulse_score  # last one wins (sorted asc)

        # Fetch country info
        countries_result = await db.execute(select(Country))
        country_map = {c.iso3: c for c in countries_result.scalars()}

        anomalies = []
        for iso3_key, scores_list in country_scores.items():
            if len(scores_list) < 10:
                continue
            n = len(scores_list)
            mean = sum(scores_list) / n
            variance = sum((s - mean) ** 2 for s in scores_list) / n
            std = variance ** 0.5
            current = country_latest[iso3_key]
            if std <= 0:
                continue
            sigma = (current - mean) / std
            if abs(sigma) < 1.5 or abs(current - mean) < 3.0:
                continue

            country_obj = country_map.get(iso3_key)
            anomalies.append({
                "iso3": iso3_key,
                "name": country_obj.name if country_obj else iso3_key,
                "region": country_obj.region if country_obj else None,
                "current_score": round(current, 1),
                "historical_mean": round(mean, 1),
                "deviation": round(current - mean, 1),
                "sigma": round(sigma, 2),
                "direction": "spike" if current > mean else "dip",
            })

        anomalies.sort(key=lambda a: abs(a["sigma"]), reverse=True)
        return anomalies[:20]

    except Exception as exc:
        logger.error(f"get_lab_anomalies error: {exc}")
        return []


# ── Lab: Correlations ──────────────────────────────────────────────────────────

@router.get("/lab/correlations")
async def get_lab_correlations(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Returns cross-country pulse score correlations for the top 15 highest-scoring countries."""
    try:
        # Get top 15 countries by latest pulse score
        subq = (
            select(PulseScore.country_iso3, func.max(PulseScore.score_date).label("latest"))
            .group_by(PulseScore.country_iso3)
        ).subquery()

        top_result = await db.execute(
            select(PulseScore)
            .join(
                subq,
                (PulseScore.country_iso3 == subq.c.country_iso3)
                & (PulseScore.score_date == subq.c.latest),
            )
            .where(PulseScore.pulse_score != None)
            .order_by(desc(PulseScore.pulse_score))
            .limit(15)
        )
        top_scores = top_result.scalars().all()
        top_iso3s = [ps.country_iso3 for ps in top_scores]
        top_score_map = {ps.country_iso3: round(ps.pulse_score, 1) for ps in top_scores}

        # Fetch country names
        countries_result = await db.execute(
            select(Country).where(Country.iso3.in_(top_iso3s))
        )
        names_map = {c.iso3: c.name for c in countries_result.scalars()}

        # Get last 60 days of scores for these countries
        cutoff = date.today() - timedelta(days=60)
        history_result = await db.execute(
            select(PulseScore)
            .where(
                PulseScore.country_iso3.in_(top_iso3s),
                PulseScore.score_date >= cutoff,
            )
            .order_by(PulseScore.country_iso3, PulseScore.score_date)
        )
        all_history = history_result.scalars().all()

        # Build date-indexed series per country
        from collections import defaultdict
        date_scores: dict[str, dict[str, float | None]] = defaultdict(dict)
        for ps in all_history:
            date_scores[ps.country_iso3][str(ps.score_date)] = ps.pulse_score

        # Collect all unique dates
        all_dates = sorted({d for series in date_scores.values() for d in series})

        # Build aligned time series per country
        series: dict[str, list[float | None]] = {}
        for iso3_key in top_iso3s:
            series[iso3_key] = [date_scores[iso3_key].get(d) for d in all_dates]

        def pearson(xs: list, ys: list) -> float | None:
            pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
            n = len(pairs)
            if n < 5:
                return None
            mx = sum(p[0] for p in pairs) / n
            my = sum(p[1] for p in pairs) / n
            num = sum((p[0] - mx) * (p[1] - my) for p in pairs)
            dx = sum((p[0] - mx) ** 2 for p in pairs) ** 0.5
            dy = sum((p[1] - my) ** 2 for p in pairs) ** 0.5
            if dx == 0 or dy == 0:
                return None
            return round(num / (dx * dy), 3)

        # Compute all pairs
        pairs_out = []
        for i in range(len(top_iso3s)):
            for j in range(i + 1, len(top_iso3s)):
                a = top_iso3s[i]
                b = top_iso3s[j]
                corr = pearson(series[a], series[b])
                if corr is None:
                    continue
                n_points = sum(
                    1 for x, y in zip(series[a], series[b])
                    if x is not None and y is not None
                )
                pairs_out.append({
                    "a_iso3": a,
                    "b_iso3": b,
                    "correlation": corr,
                    "n_points": n_points,
                })

        pairs_out.sort(key=lambda p: abs(p["correlation"]), reverse=True)

        countries_list = [
            {
                "iso3": iso3_key,
                "name": names_map.get(iso3_key, iso3_key),
                "score": top_score_map.get(iso3_key),
            }
            for iso3_key in top_iso3s
        ]

        return {"countries": countries_list, "pairs": pairs_out}

    except Exception as exc:
        logger.error(f"get_lab_correlations error: {exc}")
        return {"countries": [], "pairs": []}
