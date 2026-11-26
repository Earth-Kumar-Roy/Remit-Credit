import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List

from stellar_sdk import StrKey, scval, xdr

from src.db import (
    get_kv,
    insert_transactions_batch,
    ist_now_str,
    set_kv,
    update_kyc_standing,
    upsert_tracked_borrower,
)
from src.stellar_client import StellarKeeperClient

logger = logging.getLogger("remit_keeper.event_indexer")

STROOPS_DIVISOR = Decimal("10000000")
IST = timezone(timedelta(hours=5, minutes=30))


def _stroops_to_usdc(val: Any) -> float:
    try:
        return round(float(Decimal(str(val or 0)) / STROOPS_DIVISOR), 4)
    except Exception:
        return 0.0


def _iso_to_ist(closed_at: str) -> str:
    if not closed_at:
        return ist_now_str()
    try:
        dt = datetime.fromisoformat(closed_at.replace("Z", "+00:00"))
        return dt.astimezone(IST).strftime("%d-%m-%Y %H:%M:%S")
    except Exception:
        return ist_now_str()


def _decode_scval_safe(b64_xdr: str) -> Any:
    try:
        val = xdr.SCVal.from_xdr(b64_xdr)
        return scval.to_native(val)
    except Exception:
        return b64_xdr


def _normalize_native(obj: Any) -> Any:
    """Recursively converts bytes/Address/Symbol/custom SDK objects into JSON-serializable primitives."""
    if isinstance(obj, dict):
        return {str(k): _normalize_native(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_normalize_native(i) for i in obj]
    if isinstance(obj, bytes):
        return obj.hex()
    if hasattr(obj, "address"):
        return str(obj.address)
    if isinstance(obj, (str, int, float, bool)) or obj is None:
        return obj
    return str(obj)


def _map_event_to_sheet_rows(
    event_id: str,
    tx_hash: str,
    ledger: int,
    timestamp_ist: str,
    event_type: str,
    topics: List[Any],
    data: Any,
) -> List[Dict[str, Any]]:
    """Normalizes a decoded v3 Soroban contract event into 1 or more 15-column Transactions rows."""
    payload = data if isinstance(data, dict) else {}
    topic_1 = str(topics[1]).strip() if len(topics) > 1 else ""
    topic_2 = str(topics[2]).strip() if len(topics) > 2 else ""

    if event_type == "KycVerified":
        wallet = topic_1
        upsert_tracked_borrower(wallet)
        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": topic_2 or "SEP12_ANCHOR",
                "tx_category": "KYC_VERIFIED",
                "event_type": event_type,
                "gross_amount_usdc": 0.0,
                "pool_allocated_usdc": 0.0,
                "user_net_usdc": 0.0,
                "fee_or_yield_usdc": 0.0,
                "remaining_debt_usdc": 0.0,
                "credit_tier": 0,
                "status": "VERIFIED",
            }
        ]

    if event_type == "RemittanceLogged":
        beneficiary = topic_1.upper()
        sender = topic_2.upper()
        gross = _stroops_to_usdc(payload.get("gross_amount") or payload.get("total_amount"))
        remit_fee = _stroops_to_usdc(payload.get("remit_fee", 0))
        net = _stroops_to_usdc(payload.get("net_amount")) if "net_amount" in payload else gross
        tier = int(payload.get("credit_tier", 0))
        upsert_tracked_borrower(beneficiary)
        try:
            update_kyc_standing(wallet_address=beneficiary, credit_tier=tier)
        except Exception as exc:
            logger.debug(
                "Skipped tier sync for unregistered remittance recipient %s: %s",
                beneficiary,
                exc,
            )

        rows: List[Dict[str, Any]] = [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": beneficiary,
                "counterparty": sender or "REMIT_SENDER",
                "tx_category": "REMITTANCE_IN",
                "event_type": event_type,
                "gross_amount_usdc": gross,
                "pool_allocated_usdc": remit_fee,
                "user_net_usdc": net,
                "fee_or_yield_usdc": remit_fee,
                "remaining_debt_usdc": 0.0,
                "credit_tier": tier,
                "status": "CONFIRMED",
            }
        ]

        # Emit a companion sender-side ledger record so the sender's wallet history logs outgoing wires
        if StrKey.is_valid_ed25519_public_key(sender) and sender != beneficiary:
            rows.append(
                {
                    "event_id": f"{event_id}-out",
                    "tx_hash": tx_hash,
                    "ledger": ledger,
                    "timestamp_ist": timestamp_ist,
                    "wallet_address": sender,
                    "counterparty": beneficiary,
                    "tx_category": "REMITTANCE_OUT",
                    "event_type": event_type,
                    "gross_amount_usdc": gross,
                    "pool_allocated_usdc": remit_fee,
                    "user_net_usdc": round(-gross, 4),
                    "fee_or_yield_usdc": remit_fee,
                    "remaining_debt_usdc": 0.0,
                    "credit_tier": 0,
                    "status": "SENT",
                }
            )

        return rows

    if event_type == "RemitFeeCollected":
        wallet = topic_1
        fee_amount = _stroops_to_usdc(payload.get("fee_amount"))
        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": "BACKSTOP_RESERVE",
                "tx_category": "REMIT_FEE_BACKSTOP",
                "event_type": event_type,
                "gross_amount_usdc": fee_amount,
                "pool_allocated_usdc": fee_amount,
                "user_net_usdc": 0.0,
                "fee_or_yield_usdc": fee_amount,
                "remaining_debt_usdc": 0.0,
                "credit_tier": 0,
                "status": "BACKSTOP_FUNDED",
            }
        ]

    if event_type == "WaterfallRepaid":
        wallet = topic_1
        repaid = _stroops_to_usdc(payload.get("repaid_to_pool"))
        forwarded = _stroops_to_usdc(payload.get("forwarded_to_user"))
        remaining = _stroops_to_usdc(payload.get("remaining_debt"))
        closed = bool(payload.get("loan_closed", False))
        upsert_tracked_borrower(wallet)
        if closed:
            try:
                update_kyc_standing(wallet_address=wallet, kyc_status="VERIFIED")
            except Exception:
                pass

        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": "LP_VAULT",
                "tx_category": "WATERFALL_REPAY",
                "event_type": event_type,
                "gross_amount_usdc": round(repaid + forwarded, 4),
                "pool_allocated_usdc": repaid,
                "user_net_usdc": forwarded,
                "fee_or_yield_usdc": 0.0,
                "remaining_debt_usdc": remaining,
                "credit_tier": 0,
                "status": "LOAN_CLOSED" if closed else "PARTIAL_REPAID",
            }
        ]

    if event_type == "DirectRepaid":
        wallet = topic_1
        repaid = _stroops_to_usdc(payload.get("repaid_amount"))
        remaining = _stroops_to_usdc(payload.get("remaining_debt"))
        closed = bool(payload.get("loan_closed", False))
        upsert_tracked_borrower(wallet)
        if closed:
            try:
                update_kyc_standing(wallet_address=wallet, kyc_status="VERIFIED")
            except Exception:
                pass

        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": "LP_VAULT",
                "tx_category": "DIRECT_REPAY",
                "event_type": event_type,
                "gross_amount_usdc": repaid,
                "pool_allocated_usdc": repaid,
                "user_net_usdc": 0.0,
                "fee_or_yield_usdc": 0.0,
                "remaining_debt_usdc": remaining,
                "credit_tier": 0,
                "status": "LOAN_CLOSED" if closed else "PARTIAL_REPAID",
            }
        ]

    if event_type == "LoanDisbursed":
        wallet = topic_1
        principal = _stroops_to_usdc(payload.get("principal"))
        total_owed = _stroops_to_usdc(payload.get("total_owed"))
        fee = round(max(0.0, total_owed - principal), 4)
        tier = int(payload.get("credit_tier", 1))
        upsert_tracked_borrower(wallet)

        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": "LP_VAULT",
                "tx_category": "INSTANT_BORROW",
                "event_type": event_type,
                "gross_amount_usdc": principal,
                "pool_allocated_usdc": round(-principal, 4),
                "user_net_usdc": principal,
                "fee_or_yield_usdc": fee,
                "remaining_debt_usdc": total_owed,
                "credit_tier": tier,
                "status": "ACTIVE_LOAN",
            }
        ]

    if event_type == "OverdueStrikeAdded":
        wallet = topic_1
        strikes = int(payload.get("late_periods", 1))
        new_remaining = _stroops_to_usdc(payload.get("new_remaining_balance"))
        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": "RISK_ENGINE",
                "tx_category": "OVERDUE_STRIKE",
                "event_type": event_type,
                "gross_amount_usdc": new_remaining,
                "pool_allocated_usdc": 0.0,
                "user_net_usdc": 0.0,
                "fee_or_yield_usdc": 0.0,
                "remaining_debt_usdc": new_remaining,
                "credit_tier": 0,
                "status": f"STRIKE_{strikes}_OF_6",
            }
        ]

    if event_type == "LoanDefaulted":
        wallet = topic_1
        unpaid = _stroops_to_usdc(payload.get("unpaid_principal"))
        covered = _stroops_to_usdc(payload.get("backstop_covered"))
        defaulted_debt = _stroops_to_usdc(payload.get("defaulted_debt_owed") or unpaid)
        try:
            update_kyc_standing(
                wallet_address=wallet,
                kyc_status="BANNED",
                credit_tier=0,
                increment_default=True,
            )
        except Exception as exc:
            logger.error("Failed to mark defaulted borrower %s as BANNED in Sheets: %s", wallet, exc)

        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": "BACKSTOP_RESERVE",
                "tx_category": "LOAN_DEFAULT",
                "event_type": event_type,
                "gross_amount_usdc": defaulted_debt,
                "pool_allocated_usdc": covered,
                "user_net_usdc": 0.0,
                "fee_or_yield_usdc": covered,
                "remaining_debt_usdc": defaulted_debt,
                "credit_tier": 0,
                "status": "BANNED_6_STRIKES",
            }
        ]

    if event_type == "AccountRehabilitated":
        wallet = topic_1
        debt_cleared = _stroops_to_usdc(payload.get("debt_cleared"))
        penalty_paid = _stroops_to_usdc(payload.get("penalty_paid"))
        total_to_backstop = _stroops_to_usdc(
            payload.get("total_to_backstop") or (debt_cleared + penalty_paid)
        )
        upsert_tracked_borrower(wallet)
        try:
            update_kyc_standing(
                wallet_address=wallet,
                kyc_status="VERIFIED",
                credit_tier=0,
            )
        except Exception as exc:
            logger.error(
                "Failed to restore rehabilitated borrower %s from BANNED to VERIFIED in Sheets: %s",
                wallet,
                exc,
            )

        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": wallet,
                "counterparty": "BACKSTOP_RESERVE",
                "tx_category": "ACCOUNT_REHABILITATED",
                "event_type": event_type,
                "gross_amount_usdc": total_to_backstop,
                "pool_allocated_usdc": total_to_backstop,
                "user_net_usdc": 0.0,
                "fee_or_yield_usdc": penalty_paid,
                "remaining_debt_usdc": 0.0,
                "credit_tier": 0,
                "status": "BAN_LIFTED_RESET",
            }
        ]

    if event_type == "LiquidityUpdated":
        provider = topic_1
        is_deposit = bool(payload.get("is_deposit", True))
        amount = _stroops_to_usdc(payload.get("asset_amount"))
        shares = _stroops_to_usdc(payload.get("shares_delta"))

        return [
            {
                "event_id": event_id,
                "tx_hash": tx_hash,
                "ledger": ledger,
                "timestamp_ist": timestamp_ist,
                "wallet_address": provider,
                "counterparty": "LP_VAULT",
                "tx_category": "LP_SUPPLY" if is_deposit else "LP_WITHDRAW",
                "event_type": event_type,
                "gross_amount_usdc": amount,
                "pool_allocated_usdc": amount if is_deposit else round(-amount, 4),
                "user_net_usdc": 0.0 if is_deposit else amount,
                "fee_or_yield_usdc": shares,
                "remaining_debt_usdc": 0.0,
                "credit_tier": 0,
                "status": "CONFIRMED",
            }
        ]

    return []


def poll_contract_events() -> int:
    """
    Fetches new Soroban v3 contract events since the last indexed ledger sequence
    for the active contract ID and appends normalized rows to the Google Sheets Transactions tab.
    """
    client = StellarKeeperClient()
    cursor_key = f"last_indexed_ledger:{client.contract_id}"

    try:
        latest_ledger = client.get_latest_ledger()
    except Exception as exc:
        logger.warning("Failed to fetch latest ledger from Soroban RPC: %s", exc)
        return 0

    saved_cursor = get_kv(cursor_key) or get_kv("last_indexed_ledger")
    if saved_cursor is not None:
        start_ledger = int(saved_cursor) + 1
    else:
        start_ledger = max(1, latest_ledger - 2000)

    if start_ledger > latest_ledger:
        return 0

    try:
        resp = client.get_contract_events(start_ledger=start_ledger, limit=100)
    except Exception as exc:
        logger.warning("Soroban get_events failed (start_ledger=%d): %s", start_ledger, exc)
        return 0

    events = getattr(resp, "events", []) or []
    sheet_rows: List[Dict[str, Any]] = []

    for ev in events:
        decoded_topics = [_normalize_native(_decode_scval_safe(t)) for t in (ev.topic or [])]
        decoded_value = _normalize_native(_decode_scval_safe(ev.value))
        raw_topic_0 = str(decoded_topics[0]) if decoded_topics else ""
        topic_map = {
            "kyc_verified": "KycVerified",
            "KycVerified": "KycVerified",
            "remittance_logged": "RemittanceLogged",
            "RemittanceLogged": "RemittanceLogged",
            "remit_fee_collected": "RemitFeeCollected",
            "RemitFeeCollected": "RemitFeeCollected",
            "waterfall_repaid": "WaterfallRepaid",
            "WaterfallRepaid": "WaterfallRepaid",
            "direct_repaid": "DirectRepaid",
            "DirectRepaid": "DirectRepaid",
            "loan_disbursed": "LoanDisbursed",
            "LoanDisbursed": "LoanDisbursed",
            "overdue_strike_added": "OverdueStrikeAdded",
            "OverdueStrikeAdded": "OverdueStrikeAdded",
            "loan_defaulted": "LoanDefaulted",
            "LoanDefaulted": "LoanDefaulted",
            "account_rehabilitated": "AccountRehabilitated",
            "AccountRehabilitated": "AccountRehabilitated",
            "liquidity_updated": "LiquidityUpdated",
            "LiquidityUpdated": "LiquidityUpdated",
        }
        event_type = topic_map.get(raw_topic_0, raw_topic_0)

        tx_hash = str(
            getattr(ev, "transaction_hash", None)
            or getattr(ev, "tx_hash", "")
        )
        ledger_closed_at = str(
            getattr(ev, "ledger_close_at", None)
            or getattr(ev, "ledger_closed_at", "")
        )
        timestamp_ist = _iso_to_ist(ledger_closed_at)

        mapped_rows = _map_event_to_sheet_rows(
            event_id=str(ev.id),
            tx_hash=tx_hash,
            ledger=int(ev.ledger),
            timestamp_ist=timestamp_ist,
            event_type=event_type,
            topics=decoded_topics,
            data=decoded_value,
        )
        if mapped_rows:
            sheet_rows.extend(mapped_rows)

    inserted = 0
    if sheet_rows:
        try:
            inserted = insert_transactions_batch(sheet_rows)
        except Exception as exc:
            logger.error("Failed writing contract events to Google Sheets: %s", exc)
            return 0

    highest_ledger = max([int(e.ledger) for e in events], default=latest_ledger)
    set_kv(cursor_key, str(highest_ledger))
    set_kv("last_indexed_ledger", str(highest_ledger))

    if inserted > 0:
        logger.info("Logged %d new Soroban events to Google Sheets up to ledger %d", inserted, highest_ledger)

    return inserted