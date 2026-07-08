from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Country, CountrySchema

router = APIRouter()


@router.get("/countries", response_model=list[CountrySchema])
async def list_countries(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Country).order_by(Country.name))
    return result.scalars().all()


@router.get("/countries/{iso3}", response_model=CountrySchema)
async def get_country(iso3: str, db: AsyncSession = Depends(get_db)):
    from fastapi import HTTPException
    result = await db.execute(select(Country).where(Country.iso3 == iso3.upper()))
    country = result.scalar_one_or_none()
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")
    return country
