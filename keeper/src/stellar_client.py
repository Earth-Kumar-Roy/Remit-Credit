import time
from typing import Any, Dict, List, Optional

from stellar_sdk import Address, SorobanServer, TransactionBuilder, scval
from stellar_sdk.exceptions import PrepareTransactionException
from stellar_sdk.soroban_rpc import GetTransactionStatus, SendTransactionStatus
from stellar_sdk.xdr import SCVal

from src.config import get_settings


class StellarKeeperClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.server = SorobanServer(self.settings.SOROBAN_RPC_URL)
        self.anchor_kp = self.settings.anchor_keypair
        self.contract_id = self.settings.REMIT_CREDIT_CONTRACT_ID
        self.network_passphrase = self.settings.NETWORK_PASSPHRASE

    def _submit_contract_call(
        self,
        function_name: str,
        parameters: List[SCVal],
        base_fee: int = 100_000,
        timeout_secs: int = 30,
    ) -> Dict[str, Any]:
        source_account = self.server.load_account(self.anchor_kp.public_key)

        tx = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=self.network_passphrase,
                base_fee=base_fee,
            )
            .add_time_bounds(0, int(time.time()) + 120)
            .append_invoke_contract_function_op(
                contract_id=self.contract_id,
                function_name=function_name,
                parameters=parameters,
            )
            .build()
        )

        # Simulate first so exact contract error codes (#2, #5, #15) are surfaced cleanly
        sim_resp = self.server.simulate_transaction(tx)
        if getattr(sim_resp, "error", None):
            raise RuntimeError(
                f"Soroban simulation failed for {function_name}: {sim_resp.error}"
            )

        try:
            prepared_tx = self.server.prepare_transaction(tx)
        except PrepareTransactionException as exc:
            sim_err = getattr(getattr(exc, "simulate_transaction_response", None), "error", None)
            raise RuntimeError(
                f"Soroban prepare failed for {function_name}: {sim_err or exc}"
            ) from exc

        prepared_tx.sign(self.anchor_kp)

        send_resp = self.server.send_transaction(prepared_tx)
        if send_resp.status == SendTransactionStatus.ERROR:
            raise RuntimeError(
                f"Soroban send_transaction failed for {function_name}: {send_resp.error_result_xdr}"
            )

        tx_hash = send_resp.hash
        deadline = time.time() + timeout_secs

        while time.time() < deadline:
            tx_resp = self.server.get_transaction(tx_hash)
            if tx_resp.status == GetTransactionStatus.SUCCESS:
                return {
                    "tx_hash": tx_hash,
                    "ledger": tx_resp.ledger,
                    "result_xdr": tx_resp.result_xdr,
                }
            if tx_resp.status == GetTransactionStatus.FAILED:
                raise RuntimeError(
                    f"Soroban transaction {tx_hash} failed on-chain: {tx_resp.result_xdr}"
                )
            time.sleep(1.5)

        raise TimeoutError(f"Timed out waiting for transaction {tx_hash} confirmation")

    def register_kyc(self, beneficiary_address: str, kyc_nullifier_hex: str) -> Dict[str, Any]:
        """Invokes RemitCreditContract::register_kyc signed by the whitelisted SEP-12 Anchor."""
        nullifier_bytes = bytes.fromhex(kyc_nullifier_hex.strip())
        if len(nullifier_bytes) != 32:
            raise ValueError("kyc_nullifier must be a 32-byte (64-char hex) SHA-256 digest.")

        params = [
            Address(self.anchor_kp.public_key).to_xdr_sc_val(),
            Address(beneficiary_address).to_xdr_sc_val(),
            scval.to_bytes(nullifier_bytes),
        ]
        return self._submit_contract_call("register_kyc", params)

    def deposit_remittance(self, beneficiary_address: str, amount_stroops: int) -> Dict[str, Any]:
        """Invokes RemitCreditContract::deposit_remittance signed by the whitelisted Anchor."""
        params = [
            Address(self.anchor_kp.public_key).to_xdr_sc_val(),
            Address(beneficiary_address).to_xdr_sc_val(),
            scval.to_int128(amount_stroops),
        ]
        return self._submit_contract_call("deposit_remittance", params)

    def slash_default(self, borrower_address: str) -> Dict[str, Any]:
        """Invokes RemitCreditContract::slash_default when a loan passes its due_at deadline."""
        params = [
            Address(borrower_address).to_xdr_sc_val(),
        ]
        return self._submit_contract_call("slash_default", params)

    def extend_account_ttl(self, borrower_address: str) -> Dict[str, Any]:
        """Invokes RemitCreditContract::extend_account_ttl to prevent archival of borrower storage."""
        params = [
            Address(borrower_address).to_xdr_sc_val(),
        ]
        return self._submit_contract_call("extend_account_ttl", params)

    def get_latest_ledger(self) -> int:
        return self.server.get_latest_ledger().sequence

    def get_contract_events(
        self, start_ledger: int, cursor: Optional[str] = None, limit: int = 50
    ) -> Any:
        from stellar_sdk.soroban_rpc import EventFilter, EventFilterType

        event_filter = EventFilter(
            event_type=EventFilterType.CONTRACT,
            contract_ids=[self.contract_id],
        )
        if cursor:
            return self.server.get_events(
                start_ledger=start_ledger,
                filters=[event_filter],
                cursor=cursor,
                limit=limit,
            )
        return self.server.get_events(
            start_ledger=start_ledger,
            filters=[event_filter],
            limit=limit,
        )