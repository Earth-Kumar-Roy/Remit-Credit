from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict
from stellar_sdk import Keypair

# Resolve root .env when running locally; on Vercel, environment variables come from process env
ROOT_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ENV_PATH) if ENV_PATH.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Network configuration
    STELLAR_NETWORK: str = "testnet"
    SOROBAN_RPC_URL: str = "https://soroban-testnet.stellar.org"
    HORIZON_URL: str = "https://horizon-testnet.stellar.org"
    NETWORK_PASSPHRASE: str = "Test SDF Network ; September 2015"

    # Deployed Soroban v3 contract & USDC SAC
    REMIT_CREDIT_CONTRACT_ID: str = "CCPRKASCF2M3SQ5XKK323KF4WKJ32IHIDAM6D75D5EMH6S6JM7KKT46P"
    USDC_SAC_ID: str = "CDUIQMEIO3VBVUPJUCI47XRJGNW5D2LX5PJJML23DUALE3B4AC5UZTRK"

    # Anchor / Relayer signing credentials
    ANCHOR_PUBLIC_KEY: str
    ANCHOR_SECRET_KEY: str

    # Google Apps Script Database Bridge (zero SQLite)
    GSHEETS_WEBAPP_URL: str
    GSHEETS_API_SECRET: str

    # SEP-12 KYC Salt & Corridor Guardrails
    SEP12_KYC_SALT: str = "remitcredit_prod_salt_v2_9f8e7d6c5b4a"
    ENABLE_TESTNET_SIMULATOR: bool = True
    SIMULATOR_MAX_USDC: float = 1500.0

    # Keeper runtime
    KEEPER_PORT: int = 8000
    KEEPER_CORS_ORIGINS: str = "http://localhost:5173"

    # Scheduler intervals (seconds) for local daemon mode
    EVENT_POLL_INTERVAL_SECS: int = 12
    TTL_KEEPALIVE_INTERVAL_SECS: int = 3600

    @property
    def anchor_keypair(self) -> Keypair:
        return Keypair.from_secret(self.ANCHOR_SECRET_KEY.strip())

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.KEEPER_CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()