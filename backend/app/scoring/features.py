"""
Feature engineering: pull raw_metrics from DB, normalize to 0-1 per-feature,
return a feature vector for each country.
"""
import logging
from datetime import date, timedelta
from typing import Optional

import numpy as np
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import RawMetric

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
    "conflict_events_norm",       # 0
    "conflict_fatalities_norm",   # 1
    "gdelt_conflict_norm",        # 2
    "gdelt_tone_norm",            # 3 — inverted: negative tone → high stress
    "food_price_norm",            # 4
    "food_security_norm",         # 5
    "gdp_stress_norm",            # 6 — inverted: low/negative growth → high stress
    "inflation_norm",             # 7
    "unemployment_norm",          # 8
    "displacement_norm",          # 9
]

# Normalization bounds (domain-expert-defined, tuned for realistic ranges)
_BOUNDS = {
    "conflict_events_30d":    (0,   500),    # ACLED events per 30 days
    "conflict_fatalities_30d":(0,   5000),
    "gdelt_conflict_events":  (0,   200),
    "gdelt_avg_tone":         (-10, 5),      # GDELT tone: negative = bad
    "food_price_index":       (80,  200),    # FAO FPI baseline ~100
    "fao_undernourishment":   (0,   60),     # % undernourished population
    "undernourishment":       (0,   60),     # WB undernourishment
    "gdp_growth":             (-15, 10),     # GDP % growth
    "inflation":              (-2,  100),    # CPI inflation %
    "unemployment":           (0,   40),     # unemployment %
    "displacement_rate":      (0,   0.5),    # fraction of population displaced
}


def _clip_normalize(value: float, low: float, high: float) -> float:
    """Normalize value to [0, 1], clipped."""
    if high == low:
        return 0.5
    return float(np.clip((value - low) / (high - low), 0.0, 1.0))


def _invert(v: float) -> float:
    return 1.0 - v


async def get_latest_metric(
    db: AsyncSession,
    iso3: str,
    metric_name: str,
    within_days: int = 90,
) -> Optional[float]:
    cutoff = date.today() - timedelta(days=within_days)
    result = await db.execute(
        select(RawMetric.metric_value)
        .where(
            RawMetric.country_iso3 == iso3,
            RawMetric.metric_name == metric_name,
            RawMetric.metric_date >= cutoff,
        )
        .order_by(RawMetric.metric_date.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    return float(row) if row is not None else None


async def build_feature_vector(
    db: AsyncSession, iso3: str
) -> tuple[np.ndarray, float]:
    """
    Returns (feature_vector[10], data_quality_0_to_1).
    data_quality is the fraction of features that have real data.
    """

    async def get(metric: str, days: int = 90) -> Optional[float]:
        return await get_latest_metric(db, iso3, metric, days)

    # Raw values
    raw = {
        "conflict_events":    await get("conflict_events_30d", 45),
        "conflict_fatalities":await get("conflict_fatalities_30d", 45),
        "gdelt_events":       await get("gdelt_conflict_events", 7),
        "gdelt_tone":         await get("gdelt_avg_tone", 7),
        "food_price":         await get("food_price_index", 90),
        "food_security":      await get("fao_undernourishment", 365)
                              or await get("undernourishment", 365),
        "gdp_growth":         await get("gdp_growth", 730),
        "inflation":          await get("inflation", 730),
        "unemployment":       await get("unemployment", 730),
        "displacement":       await get("displacement_rate", 180),
    }

    filled = sum(1 for v in raw.values() if v is not None)
    data_quality = filled / len(raw)

    # Defaults when data is absent — neutral 50/100 stress
    def d(key: str, default: float) -> float:
        v = raw[key]
        return v if v is not None else default

    # Normalize each feature to 0-1 (1 = maximum stress)
    b = _BOUNDS
    f0 = _clip_normalize(d("conflict_events", 5), *b["conflict_events_30d"])
    f1 = _clip_normalize(d("conflict_fatalities", 5), *b["conflict_fatalities_30d"])
    f2 = _clip_normalize(d("gdelt_events", 2), *b["gdelt_conflict_events"])
    # GDELT tone: -10 is very negative (high stress), +5 is positive (low stress)
    f3 = _invert(_clip_normalize(d("gdelt_tone", -1), *b["gdelt_avg_tone"]))
    f4 = _clip_normalize(d("food_price", 120), *b["food_price_index"])
    f5 = _clip_normalize(d("food_security", 8), *b["fao_undernourishment"])
    # GDP growth: low/negative = high stress → invert
    f6 = _invert(_clip_normalize(d("gdp_growth", 2), *b["gdp_growth"]))
    f7 = _clip_normalize(d("inflation", 5), *b["inflation"])
    f8 = _clip_normalize(d("unemployment", 8), *b["unemployment"])
    f9 = _clip_normalize(d("displacement", 0.01), *b["displacement_rate"])

    features = np.array([f0, f1, f2, f3, f4, f5, f6, f7, f8, f9], dtype=np.float32)
    return features, data_quality
