from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field
from stellar_sdk import Server, StrKey

from src.config import get_settings
from src.db import (
    check_kyc_record,
    compute_kyc_nullifier,
    fetch_recent_events,
    mask_government_id,
    save_kyc_registration,
    upsert_tracked_borrower,
)
from src.jobs.anchor_router import route_incoming_remittance
from src.jobs.event_indexer import poll_contract_events
from src.stellar_client import StellarKeeperClient

router = APIRouter()


class Sep12RegisterRequest(BaseModel):
    wallet_address: str = Field(..., min_length=56, max_length=56)
    full_name: str = Field(..., min_length=2, max_length=120)
    email: str = Field(..., min_length=5, max_length=120)
    country_code: str = Field(..., min_length=2, max_length=3)
    id_type: str = Field(..., min_length=2, max_length=32)
    id_number: str = Field(..., min_length=4, max_length=64)


class AnchorWebhookRequest(BaseModel):
    idempotency_key: str = Field(..., min_length=4, max_length=128)
    beneficiary: str = Field(..., min_length=56, max_length=56)
    amount_usdc: float = Field(..., gt=0, le=1_000_000)


class SelfFundedRemittanceRequest(BaseModel):
    sender: str = Field(..., min_length=56, max_length=56)
    beneficiary: str = Field(..., min_length=56, max_length=56)
    amount_usdc: float = Field(..., gt=0, le=100_000)
    funding_tx_hash: str = Field(..., min_length=64, max_length=64)


class SyncRequest(BaseModel):
    wallet: Optional[str] = Field(default=None, min_length=56, max_length=56)
    check_overdue: bool = False


def _verify_anchor_funding_tx(
    funding_tx_hash: str,
    expected_sender: str,
    expected_anchor: str,
    expected_amount_usdc: float,
) -> None:
    settings = get_settings()
    horizon = Server(horizon_url=settings.HORIZON_URL)
    try:
        tx_record = horizon.transactions().transaction(funding_tx_hash).call()
    except Exception as exc:
        raise ValueError(f"Funding transaction {funding_tx_hash} not found on Stellar: {exc}") from exc

    if not tx_record.get("successful"):
        raise ValueError("Sender funding transaction failed on-chain.")

    ops_page = horizon.operations().for_transaction(funding_tx_hash).call()
    records = ops_page.get("_embedded", {}).get("records", [])

    expected_dec = Decimal(str(expected_amount_usdc))
    matched = False
    for op in records:
        op_type = op.get("type")
        if op_type == "payment" and op.get("asset_code") == "USDC":
            if (
                op.get("from") == expected_sender
                and op.get("to") == expected_anchor
                and Decimal(str(op.get("amount", "0"))) >= expected_dec
            ):
                matched = True
                break
        elif op_type == "invoke_host_function":
            if op.get("source_account") == expected_sender:
                matched = True
                break

    if not matched:
        raise ValueError(
            "Funding transaction did not transfer the required USDC from sender to Anchor."
        )


@router.get("/health")
def health_check():
    settings = get_settings()
    return {
        "status": "ok",
        "network": settings.STELLAR_NETWORK,
        "contract_id": settings.REMIT_CREDIT_CONTRACT_ID,
        "usdc_sac_id": settings.USDC_SAC_ID,
        "anchor_public_key": settings.ANCHOR_PUBLIC_KEY,
        "simulator_enabled": settings.ENABLE_TESTNET_SIMULATOR,
        "simulator_max_usdc": settings.SIMULATOR_MAX_USDC,
    }


@router.post("/sync")
def sync_onchain_events(payload: Optional[SyncRequest] = None):
    """
    Stateless on-demand indexer trigger for Vercel Serverless mode:
    indexes recent v3 Soroban events into Google Sheets and optionally checks overdue strikes.
    """
    indexed = poll_contract_events()
    overdue_tx_hash = None

    if payload and payload.wallet:
        wallet = payload.wallet.strip().upper()
        if StrKey.is_valid_ed25519_public_key(wallet):
            upsert_tracked_borrower(wallet)
            if payload.check_overdue:
                try:
                    client = StellarKeeperClient()
                    res = client.slash_default(wallet)
                    overdue_tx_hash = res["tx_hash"]
                    indexed += poll_contract_events()
                except Exception:
                    pass

    return {
        "status": "synced",
        "indexed_events": indexed,
        "overdue_tx_hash": overdue_tx_hash,
    }


@router.get("/sep12/customer")
def get_sep12_customer(wallet: str = Query(..., min_length=56, max_length=56)):
    wallet = wallet.strip().upper()
    if not StrKey.is_valid_ed25519_public_key(wallet):
        raise HTTPException(status_code=400, detail="Invalid Stellar public key.")

    try:
        res = check_kyc_record(wallet_address=wallet)
        record = res.get("record")
        if not res.get("exists") or not record:
            return {
                "registered": False,
                "kyc_status": "UNVERIFIED",
                "wallet_address": wallet,
                "record": None,
            }
        return {
            "registered": True,
            "kyc_status": record.get("kyc_status", "VERIFIED"),
            "wallet_address": wallet,
            "record": record,
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"KYC lookup failed: {exc}") from exc


@router.post("/sep12/customer")
def register_sep12_customer(payload: Sep12RegisterRequest):
    wallet = payload.wallet_address.strip().upper()
    if not StrKey.is_valid_ed25519_public_key(wallet):
        raise HTTPException(status_code=400, detail="Invalid Stellar public key.")

    nullifier = compute_kyc_nullifier(
        country_code=payload.country_code,
        id_type=payload.id_type,
        id_number=payload.id_number,
    )
    masked_id = mask_government_id(payload.id_number)

    try:
        existing = check_kyc_record(wallet_address=wallet, kyc_nullifier=nullifier)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Sheets registry check failed: {exc}") from exc

    if existing.get("nullifier_exists"):
        owner = existing.get("nullifier_owner")
        status = existing.get("nullifier_status", "VERIFIED")
        if owner and owner != wallet:
            if status == "BANNED":
                raise HTTPException(
                    status_code=403,
                    detail="This government ID is permanently banned due to hitting 6 overdue loan strikes.",
                )
            raise HTTPException(
                status_code=409,
                detail="This government ID is already bound to another Stellar wallet (1 human = 1 vault).",
            )

    if existing.get("exists"):
        record = existing.get("record") or {}
        if record.get("kyc_status") == "BANNED":
            raise HTTPException(
                status_code=403,
                detail="Wallet is permanently banned due to hitting 6 overdue loan strikes.",
            )
        return {
            "status": "ALREADY_VERIFIED",
            "wallet_address": wallet,
            "kyc_status": record.get("kyc_status", "VERIFIED"),
            "record": record,
        }

    try:
        client = StellarKeeperClient()
        tx_res = client.register_kyc(beneficiary_address=wallet, kyc_nullifier_hex=nullifier)
        tx_hash = tx_res["tx_hash"]
    except Exception as exc:
        err_msg = str(exc)
        if "Error(Contract, #15)" in err_msg:
            raise HTTPException(
                status_code=409,
                detail="On-chain Sybil guard rejected duplicate identity nullifier.",
            ) from exc
        raise HTTPException(status_code=502, detail=f"On-chain KYC binding failed: {exc}") from exc

    try:
        saved = save_kyc_registration(
            wallet_address=wallet,
            kyc_nullifier=nullifier,
            full_name=payload.full_name,
            email=payload.email,
            country_code=payload.country_code,
            id_type=payload.id_type,
            masked_id=masked_id,
            onchain_tx_hash=tx_hash,
        )
        upsert_tracked_borrower(wallet)
        poll_contract_events()
        return {
            "status": "VERIFIED",
            "wallet_address": wallet,
            "kyc_status": "VERIFIED",
            "tx_hash": tx_hash,
            "registered_at_ist": saved.get("registered_at_ist"),
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed saving KYC to Sheets: {exc}") from exc


@router.post("/webhook/anchor")
def handle_anchor_webhook(
    payload: AnchorWebhookRequest,
    x_anchor_secret: Optional[str] = Header(default=None),
):
    settings = get_settings()
    if not x_anchor_secret or x_anchor_secret.strip() != settings.GSHEETS_API_SECRET:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized Anchor webhook: valid X-Anchor-Secret header required.",
        )

    try:
        receipt = route_incoming_remittance(
            idempotency_key=payload.idempotency_key,
            beneficiary=payload.beneficiary,
            amount_usdc=payload.amount_usdc,
        )
        poll_contract_events()
        return receipt
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stellar settlement failed: {exc}") from exc


@router.post("/simulate/remittance")
def settle_self_funded_remittance(payload: SelfFundedRemittanceRequest):
    settings = get_settings()
    if not settings.ENABLE_TESTNET_SIMULATOR:
        raise HTTPException(
            status_code=403,
            detail="Interactive corridor sender is disabled; use signed /webhook/anchor.",
        )

    if payload.amount_usdc > settings.SIMULATOR_MAX_USDC:
        raise HTTPException(
            status_code=400,
            detail=f"Single wire limit is {settings.SIMULATOR_MAX_USDC:.2f} USDC.",
        )

    sender = payload.sender.strip().upper()
    beneficiary = payload.beneficiary.strip().upper()
    funding_hash = payload.funding_tx_hash.strip().lower()

    if not StrKey.is_valid_ed25519_public_key(sender) or not StrKey.is_valid_ed25519_public_key(
        beneficiary
    ):
        raise HTTPException(status_code=400, detail="Invalid Stellar sender or beneficiary key.")

    try:
        _verify_anchor_funding_tx(
            funding_tx_hash=funding_hash,
            expected_sender=sender,
            expected_anchor=settings.ANCHOR_PUBLIC_KEY,
            expected_amount_usdc=payload.amount_usdc,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    idempotency_key = f"sep31-fund-{funding_hash}"
    try:
        receipt = route_incoming_remittance(
            idempotency_key=idempotency_key,
            beneficiary=beneficiary,
            amount_usdc=payload.amount_usdc,
        )
        poll_contract_events()
        return receipt
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Stellar settlement failed: {exc}") from exc


@router.get("/history/{wallet}")
def get_account_history(
    wallet: str,
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
):
    wallet = wallet.strip().upper()
    if not StrKey.is_valid_ed25519_public_key(wallet):
        raise HTTPException(status_code=400, detail="Invalid Stellar public key.")
    try:
        txs = fetch_recent_events(beneficiary=wallet, category=category, limit=limit)
        return {"wallet": wallet, "count": len(txs), "transactions": txs}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"History fetch failed: {exc}") from exc


@router.get("/feed")
def get_protocol_feed(
    beneficiary: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
):
    try:
        events = fetch_recent_events(beneficiary=beneficiary, category=category, limit=limit)
        return {"count": len(events), "events": events}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Feed fetch failed: {exc}") from exc