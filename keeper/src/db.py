import hashlib
import json
import logging
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from src.config import get_settings

logger = logging.getLogger("remit_keeper.gsheets_db")

IST = timezone(timedelta(hours=5, minutes=30))

# Ephemeral runtime state (survives across requests; cursor seeded from Sheets on boot)
_KV_STORE: Dict[str, str] = {}
_PROCESSED_WEBHOOKS: Dict[str, Dict[str, Any]] = {}
_TRACKED_BORROWERS: Dict[str, str] = {}


def ist_now_str() -> str:
    return datetime.now(IST).strftime("%d-%m-%Y %H:%M:%S")


def compute_kyc_nullifier(country_code: str, id_type: str, id_number: str) -> str:
    """Produces a deterministic 64-char hex SHA-256 salted nullifier (1 human = 1 wallet)."""
    settings = get_settings()
    normalized = (
        f"{settings.SEP12_KYC_SALT.strip()}:"
        f"{country_code.strip().upper()}:"
        f"{id_type.strip().upper()}:"
        f"{''.join(id_number.strip().upper().split())}"
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def mask_government_id(id_number: str) -> str:
    cleaned = "".join(id_number.strip().split())
    if len(cleaned) <= 4:
        return "XXXX"
    return f"{'X' * (len(cleaned) - 4)}{cleaned[-4:]}"


def _gas_get(params: Dict[str, Any]) -> Dict[str, Any]:
    settings = get_settings()
    query_params = {**params, "secret": settings.GSHEETS_API_SECRET}
    url = f"{settings.GSHEETS_WEBAPP_URL}?{urllib.parse.urlencode(query_params)}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        if not data.get("ok"):
            raise RuntimeError(data.get("error", "Google Apps Script GET failed"))
        return data


def _gas_post(payload: Dict[str, Any]) -> Dict[str, Any]:
    settings = get_settings()
    body = json.dumps({**payload, "secret": settings.GSHEETS_API_SECRET}).encode("utf-8")
    req = urllib.request.Request(
        settings.GSHEETS_WEBAPP_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=25) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        if not data.get("ok"):
            raise RuntimeError(data.get("error", "Google Apps Script POST failed"))
        return data


def init_db() -> None:
    """Verifies Google Apps Script Web App connectivity and seeds the ledger cursor from Sheets."""
    health = _gas_get({"action": "health"})
    logger.info("Connected to Google Sheets DB (%s)", health.get("timestamp_ist"))

    cursor_data = _gas_get({"action": "get_indexer_cursor"})
    last_ledger = int(cursor_data.get("last_ledger", 0))
    if last_ledger > 0:
        _KV_STORE["last_indexed_ledger"] = str(last_ledger)
        logger.info("Seeded indexer ledger cursor from Transactions sheet: %d", last_ledger)


def get_kv(key: str) -> Optional[str]:
    return _KV_STORE.get(key)


def set_kv(key: str, value: str) -> None:
    _KV_STORE[key] = value


def get_processed_webhook(idempotency_key: str) -> Optional[Dict[str, Any]]:
    return _PROCESSED_WEBHOOKS.get(idempotency_key)


def record_processed_webhook(
    idempotency_key: str,
    beneficiary: str,
    amount_stroops: int,
    tx_hash: str,
    status: str = "CONFIRMED",
) -> None:
    _PROCESSED_WEBHOOKS[idempotency_key] = {
        "idempotency_key": idempotency_key,
        "beneficiary": beneficiary,
        "amount_stroops": amount_stroops,
        "tx_hash": tx_hash,
        "status": status,
        "created_at": ist_now_str(),
    }


def upsert_tracked_borrower(address: str) -> None:
    if address and address.startswith("G"):
        _TRACKED_BORROWERS[address.strip().upper()] = ist_now_str()


def list_tracked_borrowers(limit: int = 100) -> List[str]:
    return list(_TRACKED_BORROWERS.keys())[:limit]


def mark_borrower_ttl_extended(address: str) -> None:
    _TRACKED_BORROWERS[address.strip().upper()] = ist_now_str()


# --- SEP-12 KYC Registry Helpers (Google Sheets "Registrations" Tab) ---


def check_kyc_record(
    wallet_address: Optional[str] = None,
    kyc_nullifier: Optional[str] = None,
) -> Dict[str, Any]:
    params: Dict[str, Any] = {"action": "check_kyc"}
    if wallet_address:
        params["wallet"] = wallet_address.strip().upper()
    if kyc_nullifier:
        params["nullifier"] = kyc_nullifier.strip().lower()
    return _gas_get(params)


def save_kyc_registration(
    wallet_address: str,
    kyc_nullifier: str,
    full_name: str,
    email: str,
    country_code: str,
    id_type: str,
    masked_id: str,
    onchain_tx_hash: str,
    credit_tier: int = 0,
) -> Dict[str, Any]:
    return _gas_post(
        {
            "action": "register_kyc",
            "wallet_address": wallet_address.strip().upper(),
            "kyc_nullifier": kyc_nullifier.strip().lower(),
            "full_name": full_name.strip(),
            "email": email.strip(),
            "country_code": country_code.strip().upper(),
            "id_type": id_type.strip().upper(),
            "masked_id": masked_id,
            "kyc_status": "VERIFIED",
            "credit_tier": credit_tier,
            "default_count": 0,
            "onchain_tx_hash": onchain_tx_hash,
        }
    )


def update_kyc_standing(
    wallet_address: str,
    kyc_status: Optional[str] = None,
    credit_tier: Optional[int] = None,
    increment_default: bool = False,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "action": "update_kyc_status",
        "wallet_address": wallet_address.strip().upper(),
    }
    if kyc_status is not None:
        payload["kyc_status"] = kyc_status
    if credit_tier is not None:
        payload["credit_tier"] = credit_tier
    if increment_default:
        payload["increment_default"] = True
    return _gas_post(payload)


# --- Unified Transactions Ledger Helpers (Google Sheets "Transactions" Tab) ---


def insert_transactions_batch(transactions: List[Dict[str, Any]]) -> int:
    if not transactions:
        return 0
    res = _gas_post(
        {
            "action": "log_transactions_batch",
            "transactions": transactions,
        }
    )
    return int(res.get("inserted", 0))


def fetch_recent_events(
    beneficiary: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    normalized_cat = category.strip().upper() if category and category.strip().upper() != "ALL" else None

    if not beneficiary:
        params: Dict[str, Any] = {"action": "get_history", "limit": limit}
        if normalized_cat:
            params["category"] = normalized_cat
        res = _gas_get(params)
        return res.get("transactions", [])

    wallet = beneficiary.strip().upper()

    # 1. Direct wallet-owned records from Google Sheets
    wallet_params: Dict[str, Any] = {"action": "get_history", "wallet": wallet, "limit": limit}
    if normalized_cat:
        wallet_params["category"] = normalized_cat
    direct_res = _gas_get(wallet_params)
    merged: List[Dict[str, Any]] = list(direct_res.get("transactions", []))
    seen_ids = {str(tx.get("event_id", "")) for tx in merged}

    # 2. Backfill historical outgoing remittances where `wallet` was stored in `counterparty`
    if normalized_cat in (None, "REMITTANCE_OUT"):
        try:
            remit_res = _gas_get(
                {"action": "get_history", "category": "REMITTANCE_IN", "limit": max(limit, 100)}
            )
            for tx in remit_res.get("transactions", []):
                sender = str(tx.get("counterparty", "")).strip().upper()
                recipient = str(tx.get("wallet_address", "")).strip().upper()
                if sender == wallet and recipient != wallet:
                    out_id = f"{tx.get('event_id', '')}-out"
                    if out_id in seen_ids:
                        continue
                    seen_ids.add(out_id)
                    gross = float(tx.get("gross_amount_usdc") or 0.0)
                    fee = float(tx.get("fee_or_yield_usdc") or tx.get("pool_allocated_usdc") or 0.0)
                    merged.append(
                        {
                            "event_id": out_id,
                            "tx_hash": tx.get("tx_hash", ""),
                            "ledger": tx.get("ledger", 0),
                            "timestamp_ist": tx.get("timestamp_ist", ""),
                            "wallet_address": wallet,
                            "counterparty": recipient,
                            "tx_category": "REMITTANCE_OUT",
                            "event_type": tx.get("event_type", "RemittanceLogged"),
                            "gross_amount_usdc": gross,
                            "pool_allocated_usdc": fee,
                            "user_net_usdc": round(-gross, 4),
                            "fee_or_yield_usdc": fee,
                            "remaining_debt_usdc": 0.0,
                            "credit_tier": 0,
                            "status": "SENT",
                        }
                    )
        except Exception as exc:
            logger.debug("Could not backfill outgoing remittances for %s: %s", wallet, exc)

    merged.sort(key=lambda item: (int(item.get("ledger") or 0), str(item.get("event_id") or "")), reverse=True)
    return merged[:limit]