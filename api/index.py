import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
KEEPER_DIR = ROOT_DIR / "keeper"

for path_entry in (str(ROOT_DIR), str(KEEPER_DIR)):
    if path_entry not in sys.path:
        sys.path.insert(0, path_entry)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from keeper.src.api.routes import router

app = FastAPI(title="RemitCredit Keeper Serverless API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount both at `/api` (Vercel path) and `/` (direct invocation compatibility)
app.include_router(router, prefix="/api")
app.include_router(router)