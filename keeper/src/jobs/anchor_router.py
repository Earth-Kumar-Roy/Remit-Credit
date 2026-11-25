import logging
from decimal import Decimal, ROUND_DOWN
from typing import Any, Dict

from stellar_sdk import StrKey

from src.db import (
    check_kyc_record,
    get_processed_webhook,
    insert_transactions_batch,
    ist_now_str,
    record_processed_webhook,
    upsert_tracked_borrower,
)
from src.jobs.event_indexer import poll_contract_events
from src.stellar_client import StellarKeeperClient

logger = logging.getLogger("remit_keeper.anchor_router")

STROOPS_PER_USDC = Decimal("10000000")  # 10^7


def usdc_to_stroops(amount_usdc: float | str | Decimal) -> int:
    dec = Decimal(str(amount_usdc))
    if dec <= 0:
        raise ValueError("Remittance amount must be greater than zero.")
    stroops = int((dec * STROOPS_PER_USDC).to_integral_value(rounding=ROUND_DOWN))
    if stroops <= 0:
        raise ValueError("Remittance amount is below minimum stroop precision (0.0000001 USDC).")
    return stroops


def route_incoming_remittance(
    idempotency_key: str,
    beneficiary: str,
    amount_usdc: float | str | Decimal,
) -> Dict[str, Any]:
    """
    Validates, deduplicates, and settles an incoming cross-border remittance on Soroban,
    and immediately records the settlement in the Google Sheets Transactions ledger.
    """
    beneficiary = beneficiary.strip().upper()
    if not StrKey.is_valid_ed25519_public_key(beneficiary):
        raise ValueError(f"Invalid Stellar beneficiary public key: {beneficiary}")

    # 1. Idempotency check
    existing = get_processed_webhook(idempotency_key)
    if existing:
        logger.info(
            "Duplicate webhook ignored for key=%s (existing tx=%s)",
            idempotency_key,
            existing["tx_hash"],
        )
        return {
            "status": "ALREADY_PROCESSED",
            "idempotency_key": idempotency_key,
            "beneficiary": existing["beneficiary"],
            "amount_stroops": existing["amount_stroops"],
            "tx_hash": existing["tx_hash"],
        }

    # 2. Check Google Sheets Registrations standing
    current_tier = 0
    try:
        kyc_info = check_kyc_record(wallet_address=beneficiary)
        record = kyc_info.get("record") or {}
        current_tier = int(record.get("credit_tier", 0) or 0)
        if record.get("kyc_status") == "BANNED":
            logger.warning(
                "Routing remittance to BANNED borrower %s (40%% waterfall will auto-recover debt)",
                beneficiary,
            )
    except Exception as exc:
        logger.debug("Non-blocking KYC pre-check warning for %s: %s", beneficiary, exc)

    amount_stroops = usdc_to_stroops(amount_usdc)
    gross_usdc = round(float(Decimal(amount_stroops) / STROOPS_PER_USDC), 4)

    # 3. Submit on-chain deposit_remittance() signed by whitelisted Anchor
    client = StellarKeeperClient()
    logger.info(
        "Routing remittance: beneficiary=%s amount_usdc=%s (%d stroops)",
        beneficiary,
        amount_usdc,
        amount_stroops,
    )
    tx_result = client.deposit_remittance(
        beneficiary_address=beneficiary,
        amount_stroops=amount_stroops,
    )

    tx_hash = tx_result["tx_hash"]
    ledger_num = int(tx_result.get("ledger") or 0)

    # 4. Record idempotency receipt & register borrower for periodic TTL keepalive
    record_processed_webhook(
        idempotency_key=idempotency_key,
        beneficiary=beneficiary,
        amount_stroops=amount_stroops,
        tx_hash=tx_hash,
        status="CONFIRMED",
    )
    upsert_tracked_borrower(beneficiary)

    # 5. Trigger event indexer to capture exact on-chain RemittanceLogged / WaterfallRepaid events
    indexed_count = 0
    try:
        indexed_count = poll_contract_events()
    except Exception as exc:
        logger.warning("Immediate event poll after deposit_remittance failed: %s", exc)

    # 6. Guarantee Google Sheets Transactions row exists even if RPC event propagation lags
    if indexed_count == 0:
        try:
            insert_transactions_batch(
                [
                    {
                        "event_id": f"{tx_hash}-remit-0",
                        "tx_hash": tx_hash,
                        "ledger": ledger_num,
                        "timestamp_ist": ist_now_str(),
                        "wallet_address": beneficiary,
                        "counterparty": client.anchor_kp.public_key,
                        "tx_category": "REMITTANCE_IN",
                        "event_type": "RemittanceLogged",
                        "gross_amount_usdc": gross_usdc,
                        "pool_allocated_usdc": 0.0,
                        "user_net_usdc": gross_usdc,
                        "fee_or_yield_usdc": 0.0,
                        "remaining_debt_usdc": 0.0,
                        "credit_tier": current_tier,
                        "status": "CONFIRMED",
                    }
                ]
            )
        except Exception as exc:
            logger.error("Failed fallback Sheets transaction write for %s: %s", tx_hash, exc)

    logger.info(
        "Remittance settled on-chain & logged to Sheets: tx_hash=%s ledger=%s",
        tx_hash,
        ledger_num,
    )

    return {
        "status": "CONFIRMED",
        "idempotency_key": idempotency_key,
        "beneficiary": beneficiary,
        "amount_stroops": amount_stroops,
        "tx_hash": tx_hash,
        "ledger": ledger_num,
    }