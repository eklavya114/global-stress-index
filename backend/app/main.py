import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .routers import health, scores, countries, intel
from .tasks.scheduler import start_scheduler, shutdown_scheduler

logging.basicConfig(level=settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Earth Pulse API starting up…")
    await init_db()

    # Trigger first scraper run + score compute on startup (in background)
    from .routers.scores import _run_all_scrapers_and_score
    import asyncio
    asyncio.create_task(_run_all_scrapers_and_score())

    start_scheduler()
    yield
    shutdown_scheduler()
    logger.info("Earth Pulse API shut down.")


app = FastAPI(
    title="Earth Pulse API",
    description="Real-time civilization stress index",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(scores.router, prefix="/api", tags=["scores"])
app.include_router(countries.router, prefix="/api", tags=["countries"])
app.include_router(intel.router, prefix="/api", tags=["intel"])


@app.get("/")
async def root():
    return {"message": "Earth Pulse API", "docs": "/docs"}
