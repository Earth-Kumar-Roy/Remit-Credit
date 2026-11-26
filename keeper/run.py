import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure `keeper/src` is importable whether run from root (`python keeper/run.py`) or `keeper/`
KEEPER_DIR = Path(__file__).resolve().parent
if str(KEEPER_DIR) not in sys.path:
    sys.path.insert(0, str(KEEPER_DIR))

import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.config import get_settings
from src.db import init_db
from src.jobs.event_indexer import poll_contract_events
from src.jobs.ttl_keeper import refresh_borrower_ttls

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("remit_keeper")

scheduler = BackgroundScheduler()
tick_router = APIRouter()


def run_full_keeper_sweep() -> dict:
    init_db()
    poll_contract_events()
    refresh_borrower_ttls()
    return {"status": "ok", "sweep": "completed"}


@tick_router.api_route("/tick", methods=["GET", "POST"])
def trigger_keeper_tick():
    return run_full_keeper_sweep()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    logger.info("Connecting RemitCredit Keeper to Google Sheets DB (%s)", settings.GSHEETS_WEBAPP_URL)

    # Full catch-up sweep on boot (events + overdue strikes/bans + TTLs)
    run_full_keeper_sweep()

    scheduler.add_job(
        poll_contract_events,
        "interval",
        seconds=settings.EVENT_POLL_INTERVAL_SECS,
        id="event_indexer",
        replace_existing=True,
    )
    scheduler.add_job(
        refresh_borrower_ttls,
        "interval",
        seconds=settings.TTL_KEEPALIVE_INTERVAL_SECS,
        id="ttl_keeper",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(
        "Keeper scheduler started (contract=%s, event_poll=%ds, ttl_keepalive=%ds)",
        settings.REMIT_CREDIT_CONTRACT_ID,
        settings.EVENT_POLL_INTERVAL_SECS,
        settings.TTL_KEEPALIVE_INTERVAL_SECS,
    )

    yield

    scheduler.shutdown(wait=False)
    logger.info("Keeper scheduler stopped.")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="RemitCredit Anchor & Keeper Daemon",
        version="0.3.0",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    app.include_router(tick_router)
    return app


app = create_app()

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "run:app",
        host="0.0.0.0",
        port=settings.KEEPER_PORT,
        reload=False,
    )