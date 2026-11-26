import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
KEEPER_DIR = ROOT_DIR / "keeper"

for path_entry in (str(ROOT_DIR), str(KEEPER_DIR)):
    if path_entry not in sys.path:
        sys.path.insert(0, path_entry)

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router
from src.db import init_db
from src.jobs.event_indexer import poll_contract_events
from src.jobs.ttl_keeper import refresh_borrower_ttls

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("remit_keeper_serverless")


def run_full_keeper_sweep() -> dict:
    """
    Executes one complete protocol sweep:
    1. Ensures Google Sheets ledger tabs exist
    2. Indexes latest Soroban contract events
    3. Extends Persistent TTLs and enforces overdue 6-strike defaults / bans on-chain
    """
    init_db()
    poll_contract_events()
    refresh_borrower_ttls()
    return {"status": "ok", "sweep": "completed"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    logger.info("Serverless keeper cold start — running initial full sweep.")
    try:
        run_full_keeper_sweep()
    except Exception as exc:
        logger.warning("Initial cold-start sweep warning: %s", exc)
    yield


tick_router = APIRouter()


@tick_router.api_route("/tick", methods=["GET", "POST"])
def trigger_keeper_tick():
    return run_full_keeper_sweep()


app = FastAPI(
    title="RemitCredit Keeper Serverless API",
    version="0.3.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount both at `/api` (Vercel path) and `/` (direct invocation compatibility)
app.include_router(router, prefix="/api")
app.include_router(tick_router, prefix="/api")
app.include_router(router)
app.include_router(tick_router)