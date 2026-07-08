"""
Scoring engine: iterates over all countries, builds feature vectors,
runs PulseScorer, persists results to pulse_scores table.
"""
import logging
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Country, PulseScore
from ..utils.country_codes import get_all_iso3
from .features import build_feature_vector
from .model import scorer

logger = logging.getLogger(__name__)


async def compute_all_scores(db: AsyncSession) -> int:
    """Compute pulse scores for all countries. Returns number of countries scored."""
    today = date.today()
    iso3_list = get_all_iso3()
    scored = 0

    for iso3 in iso3_list:
        try:
            features, data_quality = await build_feature_vector(db, iso3)
            pulse, conflict, food, economic = scorer.score(features)

            # Upsert score for today
            existing = await db.execute(
                select(PulseScore).where(
                    PulseScore.country_iso3 == iso3,
                    PulseScore.score_date == today,
                )
            )
            row = existing.scalar_one_or_none()

            if row:
                row.pulse_score = pulse
                row.conflict_score = conflict
                row.food_score = food
                row.economic_score = economic
                row.data_quality = data_quality
                row.computed_at = datetime.utcnow()
            else:
                db.add(
                    PulseScore(
                        country_iso3=iso3,
                        score_date=today,
                        pulse_score=pulse,
                        conflict_score=conflict,
                        food_score=food,
                        economic_score=economic,
                        data_quality=data_quality,
                    )
                )
            scored += 1
        except Exception as exc:
            logger.error(f"Failed to score {iso3}: {exc}")

    await db.commit()
    logger.info(f"Scored {scored} countries for {today}")
    return scored
