from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Float, Integer, Date, DateTime, func, UniqueConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column
from pydantic import BaseModel
from .database import Base


# ── ORM Models ────────────────────────────────────────────────────────────────

class Country(Base):
    __tablename__ = "countries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    iso3: Mapped[str] = mapped_column(String(3), unique=True, nullable=False, index=True)
    iso2: Mapped[str] = mapped_column(String(2), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region: Mapped[Optional[str]] = mapped_column(String(100))
    lat: Mapped[Optional[float]] = mapped_column(Float)
    lon: Mapped[Optional[float]] = mapped_column(Float)
    population: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class PulseScore(Base):
    __tablename__ = "pulse_scores"
    __table_args__ = (UniqueConstraint("country_iso3", "score_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    country_iso3: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    score_date: Mapped[date] = mapped_column(Date, nullable=False)
    pulse_score: Mapped[Optional[float]] = mapped_column(Float)
    conflict_score: Mapped[Optional[float]] = mapped_column(Float)
    food_score: Mapped[Optional[float]] = mapped_column(Float)
    economic_score: Mapped[Optional[float]] = mapped_column(Float)
    data_quality: Mapped[Optional[float]] = mapped_column(Float)  # 0-1
    computed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RawMetric(Base):
    __tablename__ = "raw_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    country_iso3: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    metric_value: Mapped[Optional[float]] = mapped_column(Float)
    metric_date: Mapped[Optional[date]] = mapped_column(Date)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ScraperRun(Base):
    __tablename__ = "scraper_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scraper_name: Mapped[str] = mapped_column(String(50), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="running")
    records_fetched: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text)


# ── Pydantic Schemas ───────────────────────────────────────────────────────────

class CountrySchema(BaseModel):
    iso3: str
    iso2: str
    name: str
    region: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None

    model_config = {"from_attributes": True}


class PulseScoreSchema(BaseModel):
    country_iso3: str
    score_date: date
    pulse_score: Optional[float] = None
    conflict_score: Optional[float] = None
    food_score: Optional[float] = None
    economic_score: Optional[float] = None
    data_quality: Optional[float] = None
    computed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CountryWithScore(BaseModel):
    iso3: str
    iso2: str
    name: str
    region: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    pulse_score: Optional[float] = None
    conflict_score: Optional[float] = None
    food_score: Optional[float] = None
    economic_score: Optional[float] = None
    data_quality: Optional[float] = None
    score_date: Optional[date] = None


class GlobalStats(BaseModel):
    total_countries: int
    countries_scored: int
    avg_pulse_score: float
    highest_stress: Optional[CountryWithScore] = None
    lowest_stress: Optional[CountryWithScore] = None
    last_updated: Optional[datetime] = None
