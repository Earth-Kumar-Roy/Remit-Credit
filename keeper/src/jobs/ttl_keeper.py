import logging
from typing import Set

from src.db import (
    fetch_recent_events,
    list_tracked_borrowers,
    mark_borrower_ttl_extended,
    upsert_tracked_borrower,
)
from src.jobs.event_indexer import poll_contract_events
from src.stellar_client import StellarKeeperClient

logger = logging.getLogger("remit_keeper.ttl_keeper")


def _collect_active_borrower_candidates(limit: int = 100) -> Set[str]:
    """Combines in-memory tracked borrowers with wallets from recent INSTANT_BORROW events in Sheets."""
    candidates: Set[str] = set(list_tracked_borrowers(limit=limit))
    try:
        recent_borrows = fetch_recent_events(category="INSTANT_BORROW", limit=limit)
        for row in recent_borrows:
            wallet = str(row.get("wallet_address", "")).strip().upper()
            if wallet.startswith("G") and len(wallet) == 56:
                upsert_tracked_borrower(wallet)
                candidates.add(wallet)
    except Exception as exc:
        logger.debug("Could not seed borrower candidates from Sheets: %s", exc)
    return candidates


def enforce_overdue_defaults() -> int:
    """
    Checks tracked borrowers for overdue loans and invokes `slash_default` on-chain
    when overdue strikes accrue or reach 6/6 (banning the borrower and indexing the event).
    """
    borrowers = _collect_active_borrower_candidates(limit=100)
    if not borrowers:
        return 0

    client = StellarKeeperClient()
    slashed_count = 0

    for addr in borrowers:
        try:
            slash_res = client.slash_default(addr)
            slashed_count += 1
            logger.warning(
                "Slashed overdue loan for borrower=%s (tx=%s)",
                addr,
                slash_res["tx_hash"],
            )
        except Exception as exc:
            err = str(exc)
            if "Error(Contract, #12)" not in err and "Error(Contract, #16)" not in err:
                logger.debug("Default check skipped for %s: %s", addr, err)

    if slashed_count > 0:
        try:
            poll_contract_events()
        except Exception as exc:
            logger.warning("Event poll after slash_default failed: %s", exc)

    return slashed_count


def refresh_borrower_ttls() -> int:
    """
    Periodically extends on-chain TTL for tracked active borrowers and enforces overdue defaults.
    """
    borrowers = _collect_active_borrower_candidates(limit=100)
    if not borrowers:
        return 0

    client = StellarKeeperClient()
    refreshed = 0

    for addr in borrowers:
        try:
            res = client.extend_account_ttl(addr)
            mark_borrower_ttl_extended(addr)
            refreshed += 1
            logger.info("Extended on-chain TTL for borrower=%s (tx=%s)", addr, res["tx_hash"])
        except Exception as exc:
            logger.warning("Failed to extend TTL for borrower=%s: %s", addr, exc)

    enforce_overdue_defaults()
    return refreshed