import { useCallback, useMemo } from 'react';
import {
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';

const READ_ONLY_SOURCE = STELLAR_CONFIG.anchorPublicKey;

const CONTRACT_ERROR_MAP: Record<number, string> = {
  3: 'Protocol is currently paused by emergency circuit breaker.',
  4: 'Caller is not authorized for this administrative action.',
  5: 'Caller is not a whitelisted SEP-31 remittance anchor.',
  6: 'Amount must be greater than zero.',
  7: 'Invalid protocol parameter.',
  8: 'Minimum verified remittance cycles not yet reached.',
  9: 'You already have an active loan. Settle it before drawing another.',
  10: 'Requested loan exceeds your rolling 8-remittance credit limit or tier cap.',
  11: 'Insufficient pro-rata idle USDC liquidity available in the vault.',
  12: 'No active loan or defaulted balance found to settle.',
  14: 'SEP-12 KYC verification is required before borrowing.',
  15: 'This government ID is already bound to another Stellar wallet.',
  16: 'Loan has not passed its current period deadline yet.',
  17: 'Account suspended after 6 overdue strikes. Clear defaulted debt + 50% penalty to lift ban.',
  18: 'Post-repayment cooldown is still active. Wait before drawing a new loan.',
  19: 'Your previous loan was repaid late. Complete 1 clean remittance cycle first.',
  20: 'You have active liquidity supplied in the LP Vault. Withdraw your LP liquidity first instead of drawing a loan.',
  21: 'Selected loan period must be between 2 minutes (120s) and 30 days (2,592,000s).',
};

function formatSorobanError(raw: unknown): string {
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const match = text.match(/Error\(Contract,\s*#(\d+)\)/);
  if (match) {
    const code = Number(match[1]);
    if (CONTRACT_ERROR_MAP[code]) {
      return CONTRACT_ERROR_MAP[code];
    }
  }
  return text;
}

export function useRemitContract() {
  const { address, signTx } = useWallet();

  const rpcServer = useMemo(
    () => new rpc.Server(STELLAR_CONFIG.rpcUrl, { allowHttp: false }),
    []
  );

  const triggerStatelessSync = useCallback(
    (walletToSync?: string, checkOverdue = false) => {
      fetch(`${STELLAR_CONFIG.keeperApiUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletToSync || address || undefined,
          check_overdue: checkOverdue,
        }),
      }).catch(() => {});
    },
    [address]
  );

  const invokeWrite = useCallback(
    async <T = unknown>(
      method: string,
      args: xdr.ScVal[],
      syncWallet?: string
    ): Promise<T | null> => {
      if (!address) throw new Error('Connect Freighter wallet first.');

      try {
        const sourceAccount = await rpcServer.getAccount(address);
        const contract = new Contract(STELLAR_CONFIG.remitContractId);

        const rawTx = new TransactionBuilder(sourceAccount, {
          fee: '100000',
          networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        })
          .addOperation(contract.call(method, ...args))
          .setTimeout(120)
          .build();

        const preparedTx = await rpcServer.prepareTransaction(rawTx);
        const signResult = await signTx(preparedTx.toXDR());
        const signedTxXdr =
          typeof signResult === 'string' ? signResult : signResult?.signedTxXdr;

        if (!signedTxXdr) {
          throw new Error('Freighter signature rejected or cancelled.');
        }

        const signedTx = TransactionBuilder.fromXDR(
          signedTxXdr,
          STELLAR_CONFIG.networkPassphrase
        );

        const sendResp = await rpcServer.sendTransaction(signedTx);
        if (sendResp.status === 'ERROR') {
          throw new Error(formatSorobanError(sendResp.errorResult));
        }

        const deadline = Date.now() + 35_000;
        while (Date.now() < deadline) {
          const txResp = await rpcServer.getTransaction(sendResp.hash);
          if (txResp.status === rpc.Api.GetTransactionStatus.SUCCESS) {
            triggerStatelessSync(syncWallet || address);
            return txResp.returnValue ? (scValToNative(txResp.returnValue) as T) : null;
          }
          if (txResp.status === rpc.Api.GetTransactionStatus.FAILED) {
            throw new Error(formatSorobanError(txResp.resultXdr));
          }
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        throw new Error(`Timed out waiting for transaction ${sendResp.hash} confirmation.`);
      } catch (err) {
        throw new Error(
          err instanceof Error ? formatSorobanError(err.message) : formatSorobanError(err)
        );
      }
    },
    [address, rpcServer, signTx, triggerStatelessSync]
  );

  const fetchUsdcBalance = useCallback(
    async (targetAddress: string): Promise<bigint> => {
      try {
        const account = await rpcServer.getAccount(READ_ONLY_SOURCE);
        const sac = new Contract(STELLAR_CONFIG.usdcSacId);
        const tx = new TransactionBuilder(account, {
          fee: '100',
          networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        })
          .addOperation(
            sac.call('balance', nativeToScVal(Address.fromString(targetAddress), { type: 'address' }))
          )
          .setTimeout(30)
          .build();

        const sim = await rpcServer.simulateTransaction(tx);
        if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
          const val = scValToNative(sim.result.retval);
          return BigInt(val.toString());
        }
        return 0n;
      } catch {
        return 0n;
      }
    },
    [rpcServer]
  );

  // Matches Rust: pub fn set_loan_duration(env: Env, loan_duration_secs: u64)
  const setLoanDuration = useCallback(
    async (durationSecs: bigint) => {
      if (!address) throw new Error('Connect Freighter wallet first.');
      if (durationSecs < 120n || durationSecs > 2_592_000n) {
        throw new Error('Loan duration must be between 2 minutes (120s) and 30 days (2,592,000s).');
      }
      return invokeWrite('set_loan_duration', [
        nativeToScVal(durationSecs, { type: 'u64' }),
      ]);
    },
    [address, invokeWrite]
  );

  // Matches Rust: pub fn send_remittance(env: Env, sender: Address, beneficiary: Address, amount: i128)
  const sendRemittance = useCallback(
    async (beneficiaryAddress: string, amountStroops: bigint) => {
      if (!address) throw new Error('Connect Freighter wallet first.');
      const cleanBeneficiary = beneficiaryAddress.trim().toUpperCase();
      return invokeWrite(
        'send_remittance',
        [
          nativeToScVal(Address.fromString(address), { type: 'address' }),
          nativeToScVal(Address.fromString(cleanBeneficiary), { type: 'address' }),
          nativeToScVal(amountStroops, { type: 'i128' }),
        ],
        cleanBeneficiary
      );
    },
    [address, invokeWrite]
  );

  // Matches upgraded Rust: pub fn borrow(env: Env, beneficiary: Address, principal: i128, duration_secs: u64)
  const requestLoan = useCallback(
    async (principalStroops: bigint, durationSecs: bigint) => {
      if (!address) throw new Error('Connect Freighter wallet first.');
      if (durationSecs < 120n || durationSecs > 2_592_000n) {
        throw new Error('Loan duration must be between 2 minutes (120s) and 30 days (2,592,000s).');
      }
      return invokeWrite('borrow', [
        nativeToScVal(Address.fromString(address), { type: 'address' }),
        nativeToScVal(principalStroops, { type: 'i128' }),
        nativeToScVal(durationSecs, { type: 'u64' }),
      ]);
    },
    [address, invokeWrite]
  );

  // Matches Rust: pub fn repay_loan(env: Env, beneficiary: Address, amount: i128)
  const repayDirect = useCallback(
    async (amountStroops: bigint) => {
      if (!address) throw new Error('Connect Freighter wallet first.');
      return invokeWrite('repay_loan', [
        nativeToScVal(Address.fromString(address), { type: 'address' }),
        nativeToScVal(amountStroops, { type: 'i128' }),
      ]);
    },
    [address, invokeWrite]
  );

  // Matches Rust: pub fn rehabilitate_account(env: Env, borrower: Address) -> Result<i128, RemitError>
  const rehabilitateAccount = useCallback(async () => {
    if (!address) throw new Error('Connect Freighter wallet first.');
    return invokeWrite<bigint>('rehabilitate_account', [
      nativeToScVal(Address.fromString(address), { type: 'address' }),
    ]);
  }, [address, invokeWrite]);

  // Matches Rust: pub fn provide_liquidity(env: Env, provider: Address, amount: i128)
  const depositLiquidity = useCallback(
    async (amountStroops: bigint) => {
      if (!address) throw new Error('Connect Freighter wallet first.');
      return invokeWrite('provide_liquidity', [
        nativeToScVal(Address.fromString(address), { type: 'address' }),
        nativeToScVal(amountStroops, { type: 'i128' }),
      ]);
    },
    [address, invokeWrite]
  );

  // Converts entered USDC amount into proportional LP shares and invokes withdraw_liquidity
  const withdrawLiquidity = useCallback(
    async (
      usdcAmountStroops: bigint,
      totalAssetsStroops: bigint,
      totalSharesStroops: bigint,
      userSharesStroops: bigint
    ) => {
      if (!address) throw new Error('Connect Freighter wallet first.');
      if (totalAssetsStroops <= 0n || totalSharesStroops <= 0n || userSharesStroops <= 0n) {
        throw new Error('No LP shares available to withdraw.');
      }

      let sharesToBurn = (usdcAmountStroops * totalSharesStroops) / totalAssetsStroops;
      if (sharesToBurn > userSharesStroops) {
        sharesToBurn = userSharesStroops;
      }
      if (sharesToBurn <= 0n) {
        throw new Error('Withdrawal amount is too small.');
      }

      return invokeWrite('withdraw_liquidity', [
        nativeToScVal(Address.fromString(address), { type: 'address' }),
        nativeToScVal(sharesToBurn, { type: 'i128' }),
      ]);
    },
    [address, invokeWrite]
  );

  return {
    fetchUsdcBalance,
    setLoanDuration,
    sendRemittance,
    requestLoan,
    repayDirect,
    rehabilitateAccount,
    depositLiquidity,
    withdrawLiquidity,
    triggerStatelessSync,
  };
}