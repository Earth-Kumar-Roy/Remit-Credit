import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe2,
  Loader2,
  Receipt,
  Send,
  ShieldCheck,
  SplitSquareVertical,
  Wallet,
} from 'lucide-react';
import {
  Address,
  Contract,
  Horizon,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, getExplorerTxUrl } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { formatBps, formatUsdc, parseUsdcToStroops } from '@/utils/stroops';

interface AnchorSimulatorProps {
  keeperOnline: boolean;
  usdcBalance?: bigint;
  remitFeeBps?: number;
  remitFeeCap?: bigint;
  waterfallSplitBps?: number;
  onSettled: () => Promise<void>;
}

const DEFAULT_FEE_CAP_STROOPS = 150_000_000n; // 15.00 USDC max fee cap in v3 contract
const MIN_REMITTANCE_USDC = 100;

/**
 * Computes the exact gross stroops to pass into `send_remittance` so that after the contract
 * deducts `min(floor(gross * feeBps / 10_000), feeCap)`, the recipient receives the full
 * `targetNetStroops` entered by the sender.
 */
function calculateGrossForExactNet(
  targetNetStroops: bigint,
  feeBps: bigint = 200n,
  feeCapStroops: bigint = DEFAULT_FEE_CAP_STROOPS
): {
  grossStroops: bigint;
  feeStroops: bigint;
  actualNetStroops: bigint;
  isFeeCapped: boolean;
} {
  if (targetNetStroops <= 0n) {
    return { grossStroops: 0n, feeStroops: 0n, actualNetStroops: 0n, isFeeCapped: false };
  }

  // Case A: Fee hits the max fee cap (e.g., 15.00 USDC)
  const cappedGross = targetNetStroops + feeCapStroops;
  if ((cappedGross * feeBps) / 10_000n >= feeCapStroops) {
    return {
      grossStroops: cappedGross,
      feeStroops: feeCapStroops,
      actualNetStroops: targetNetStroops,
      isFeeCapped: true,
    };
  }

  // Case B: Uncapped proportional fee (gross = ceil(targetNet * 10_000 / (10_000 - feeBps)))
  const netRatio = 10_000n - feeBps;
  let gross = (targetNetStroops * 10_000n + (netRatio - 1n)) / netRatio;
  let fee = (gross * feeBps) / 10_000n;
  while (gross - fee < targetNetStroops) {
    gross += 1n;
    fee = (gross * feeBps) / 10_000n;
  }

  return {
    grossStroops: gross,
    feeStroops: fee,
    actualNetStroops: gross - fee,
    isFeeCapped: false,
  };
}

export const AnchorSimulator: React.FC<AnchorSimulatorProps> = ({
  keeperOnline,
  usdcBalance,
  remitFeeBps = 200,
  remitFeeCap = DEFAULT_FEE_CAP_STROOPS,
  waterfallSplitBps = 4000,
  onSettled,
}) => {
  const { address, isConnecting, connect, signTx } = useWallet();
  const [beneficiary, setBeneficiary] = useState<string>('');
  const [amountUsdc, setAmountUsdc] = useState<string>('100');
  const [stepLabel, setStepLabel] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<{
    txHash: string;
    totalDebitedUsdc: number;
    feeUsdc: number;
    netDeliveredUsdc: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (address && beneficiary.trim().toUpperCase() === address.trim().toUpperCase()) {
      setBeneficiary('');
    }
  }, [address, beneficiary]);

  const cleanBeneficiary = beneficiary.trim().toUpperCase();
  const isSelfTransfer =
    Boolean(address) &&
    cleanBeneficiary.length > 0 &&
    cleanBeneficiary === address!.trim().toUpperCase();

  const parsedNetAmount = Number(amountUsdc);
  const isBelowMinimum =
    amountUsdc.trim().length > 0 &&
    (!Number.isFinite(parsedNetAmount) || parsedNetAmount < MIN_REMITTANCE_USDC);
  const validPreview = Number.isFinite(parsedNetAmount) && parsedNetAmount >= MIN_REMITTANCE_USDC;

  let quoteGrossStroops = 0n;
  let quoteFeeStroops = 0n;
  let quoteNetStroops = 0n;
  let quoteCapped = false;

  if (validPreview) {
    try {
      const targetNetStroops = parseUsdcToStroops(amountUsdc);
      const calc = calculateGrossForExactNet(
        targetNetStroops,
        BigInt(remitFeeBps),
        remitFeeCap > 0n ? remitFeeCap : DEFAULT_FEE_CAP_STROOPS
      );
      quoteGrossStroops = calc.grossStroops;
      quoteFeeStroops = calc.feeStroops;
      quoteNetStroops = calc.actualNetStroops;
      quoteCapped = calc.isFeeCapped;
    } catch {
      // Ignore partial decimal typing
    }
  }

  // Only check wallet balance when a wallet is actually connected
  const insufficientBalance =
    Boolean(address) &&
    typeof usdcBalance === 'bigint' &&
    quoteGrossStroops > 0n &&
    quoteGrossStroops > usdcBalance;

  const waterfallRepayPct = Math.round(waterfallSplitBps / 100);
  const waterfallDirectPct = Math.max(0, 100 - waterfallRepayPct);

  const handleAtomicRemittance = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setReceipt(null);

    if (!address) {
      setErrorMsg('Connect your Freighter wallet to send a cross-border remittance.');
      return;
    }

    if (!cleanBeneficiary || cleanBeneficiary.length !== 56 || !cleanBeneficiary.startsWith('G')) {
      setErrorMsg('Enter a valid 56-character Stellar recipient address (G...).');
      return;
    }

    if (cleanBeneficiary === address.trim().toUpperCase()) {
      setErrorMsg('Self-remittance is not allowed. Enter a different recipient Stellar address.');
      return;
    }

    if (!Number.isFinite(parsedNetAmount) || parsedNetAmount < MIN_REMITTANCE_USDC) {
      setErrorMsg(`Minimum remittance amount is ${MIN_REMITTANCE_USDC.toFixed(2)} USDC.`);
      return;
    }

    if (insufficientBalance) {
      setErrorMsg(
        `Insufficient wallet balance: quote requires ${formatUsdc(quoteGrossStroops)} USDC (you have ${formatUsdc(usdcBalance!)} USDC).`
      );
      return;
    }

    setIsSending(true);
    try {
      const targetNetStroops = parseUsdcToStroops(amountUsdc);
      const { grossStroops, feeStroops, actualNetStroops } = calculateGrossForExactNet(
        targetNetStroops,
        BigInt(remitFeeBps),
        remitFeeCap > 0n ? remitFeeCap : DEFAULT_FEE_CAP_STROOPS
      );

      setStepLabel('Sign atomic remittance in Freighter...');
      const horizon = new Horizon.Server(STELLAR_CONFIG.horizonUrl);
      const sorobanServer = new rpc.Server(STELLAR_CONFIG.rpcUrl);
      const sourceAccount = await horizon.loadAccount(address);

      const remitContract = new Contract(STELLAR_CONFIG.remitContractId);
      const sendOp = remitContract.call(
        'send_remittance',
        new Address(address).toScVal(),
        new Address(cleanBeneficiary).toScVal(),
        nativeToScVal(grossStroops, { type: 'i128' })
      );

      const rawTx = new TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      })
        .addOperation(sendOp)
        .setTimeout(120)
        .build();

      const preparedTx = await sorobanServer.prepareTransaction(rawTx);
      const signResult = await signTx(preparedTx.toXDR());
      const signedXdr =
        typeof signResult === 'string' ? signResult : signResult?.signedTxXdr;

      if (!signedXdr) {
        throw new Error('Freighter signature rejected or cancelled.');
      }

      const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_CONFIG.networkPassphrase);
      const sendResult = await sorobanServer.sendTransaction(signedTx);

      if (sendResult.status === 'ERROR') {
        throw new Error('Failed broadcasting remittance transaction to Stellar.');
      }

      const txHash = sendResult.hash;

      setStepLabel('Confirming atomic settlement on Stellar...');
      let confirmed = false;
      for (let i = 0; i < 20; i++) {
        const txCheck = await sorobanServer.getTransaction(txHash);
        if (txCheck.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          confirmed = true;
          break;
        }
        if (txCheck.status === rpc.Api.GetTransactionStatus.FAILED) {
          throw new Error('Remittance transaction failed on-chain.');
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (!confirmed) {
        throw new Error('Timed out waiting for Stellar confirmation.');
      }

      if (keeperOnline) {
        fetch(`${STELLAR_CONFIG.keeperApiUrl}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: cleanBeneficiary, check_overdue: false }),
        }).catch(() => {});
      }

      setReceipt({
        txHash,
        totalDebitedUsdc: Number(grossStroops) / 10_000_000,
        feeUsdc: Number(feeStroops) / 10_000_000,
        netDeliveredUsdc: Number(actualNetStroops) / 10_000_000,
      });

      await onSettled();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to complete cross-border remittance.'
      );
    } finally {
      setIsSending(false);
      setStepLabel('');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
      {/* CAD Grid & Top Accent */}
      <div className="pointer-events-none absolute inset-0 opacity-15">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="remitSimGrid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#1e293b" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#remitSimGrid)" />
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
      <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-cyan-400/70">
        ⌜ SEP-31_WIRE_ROUTER // EXACT_DELIVERY · MIN $100 ⌝
      </span>
      <span className="pointer-events-none absolute right-4 top-3 select-none font-mono text-[10px] text-amber-400/70">
        [+]
      </span>

      <div className="relative z-10 mt-2 space-y-6">
        {/* Header + Amount Presets */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              <Globe2 className="h-3.5 w-3.5" />
              <span>ATOMIC CROSS-BORDER SETTLEMENT</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">
              SEP-31 Cross-Border Remittance Corridor
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-400">
              Minimum transfer: <strong className="text-amber-300">100.00 USDC</strong>. Recipient
              receives 100% of your entered payout (or {waterfallRepayPct}%/{waterfallDirectPct}%
              waterfall split if a loan is active), while the {formatBps(remitFeeBps)} fee (capped
              at ${formatUsdc(remitFeeCap, 0)} USDC) funds the First-Loss Backstop Reserve.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono">
            {[100, 250, 500, 1000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmountUsdc(String(preset));
                  setErrorMsg(null);
                }}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition ${
                  Number(amountUsdc) === preset
                    ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                    : 'border-slate-800 bg-slate-950/80 text-cyan-200 hover:border-cyan-400/50'
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>
        </div>

        {/* Form Controls (Recipient Address + Net Payout + Send Button) */}
        <form onSubmit={handleAtomicRemittance} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-slate-400">
              01 // Recipient Beneficiary Address (G...)
            </label>
            <input
              type="text"
              placeholder="Enter recipient 56-char Stellar address (G...)"
              value={beneficiary}
              onChange={(e) => {
                setBeneficiary(e.target.value);
                setErrorMsg(null);
              }}
              disabled={isSending}
              className="w-full rounded-xl border border-slate-700/90 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-slate-400">
              02 // Net Payout (Min 100 USDC)
            </label>
            <input
              type="number"
              step="any"
              min={MIN_REMITTANCE_USDC}
              value={amountUsdc}
              onChange={(e) => {
                setAmountUsdc(e.target.value);
                setErrorMsg(null);
              }}
              disabled={isSending}
              className="tabular-nums w-full rounded-xl border border-slate-700/90 bg-slate-950 px-3.5 py-2.5 font-mono text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-end lg:col-span-2">
            <button
              type="submit"
              disabled={
                !address ||
                isSending ||
                isSelfTransfer ||
                isBelowMinimum ||
                !validPreview ||
                insufficientBalance
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:from-slate-800 disabled:via-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{stepLabel || 'Sending...'}</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>Send Wire</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Cryptographic FX & Settlement Quotation Box */}
        {validPreview && quoteGrossStroops > 0n && !isSelfTransfer && (
          <div className="rounded-2xl border border-slate-800/90 bg-slate-950/90 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 font-mono text-[10px]">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-300">
                <Receipt className="h-3.5 w-3.5 text-amber-400" />
                LIVE SEP-31 SETTLEMENT QUOTATION
              </span>
              <span className="text-slate-400">
                {quoteCapped
                  ? `FEE CAP APPLIED ($${formatUsdc(remitFeeCap)} MAX)`
                  : `STANDARD ${formatBps(remitFeeBps)} BACKSTOP FEE`}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 font-mono text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-[10px] uppercase text-slate-400">1. Recipient Net Delivery</div>
                <div className="tabular-nums mt-1 text-base font-bold text-emerald-400">
                  {formatUsdc(quoteNetStroops)} USDC
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  100% guaranteed delivery
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
                  <span>2. Backstop Reserve Cut</span>
                </div>
                <div className="tabular-nums mt-1 text-base font-bold text-cyan-300">
                  +{formatUsdc(quoteFeeStroops)} USDC
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  {formatBps(remitFeeBps)} (capped at ${formatUsdc(remitFeeCap, 0)})
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-slate-900/80 p-3">
                <div className="text-[10px] uppercase text-amber-300">3. Total Sender Debit</div>
                <div className="tabular-nums mt-1 text-base font-bold text-white">
                  {formatUsdc(quoteGrossStroops)} USDC
                </div>
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {address && typeof usdcBalance === 'bigint'
                    ? `Wallet: ${formatUsdc(usdcBalance)} USDC`
                    : 'Connect Freighter to check balance'}
                </div>
              </div>
            </div>

            {/* Recipient Routing Scenario Preview */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-3.5 py-2 font-mono text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5 text-cyan-300">
                <SplitSquareVertical className="h-3.5 w-3.5" />
                IF RECIPIENT HAS ACTIVE LOAN:
              </span>
              <span className="flex items-center gap-2">
                <span>
                  On-Time: <strong className="text-amber-300">{waterfallRepayPct}%</strong> loan /{' '}
                  <strong className="text-emerald-300">{waterfallDirectPct}%</strong> direct
                </span>
                <ArrowRight className="h-3 w-3 text-slate-600" />
                <span>
                  Overdue: <strong className="text-rose-300">100%</strong> debt sweep
                </span>
              </span>
            </div>
          </div>
        )}

        {!address && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/35 bg-cyan-950/40 px-4 py-3 text-xs text-cyan-200">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 shrink-0 text-cyan-400" />
              <span>
                Connect your Freighter wallet to verify your USDC balance and dispatch an atomic
                cross-border remittance.
              </span>
            </div>
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Freighter'}</span>
            </button>
          </div>
        )}

        {isBelowMinimum && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-950/60 px-3.5 py-2.5 text-xs text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Minimum cross-border remittance amount is <strong>100.00 USDC</strong>.
            </span>
          </div>
        )}

        {isSelfTransfer && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-950/60 px-3.5 py-2.5 text-xs text-amber-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              You cannot send a remittance to your own connected wallet. Enter a different recipient
              Stellar address.
            </span>
          </div>
        )}

        {insufficientBalance && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>
              Insufficient USDC balance for quoted debit of{' '}
              <strong>{formatUsdc(quoteGrossStroops)} USDC</strong> (available:{' '}
              <strong>{formatUsdc(usdcBalance!)} USDC</strong>).
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/35 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {receipt && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/60 px-4 py-3 text-xs text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Delivered full <strong>{receipt.netDeliveredUsdc.toFixed(2)} USDC</strong> to
                recipient ({receipt.totalDebitedUsdc.toFixed(2)} USDC total debited incl.{' '}
                {receipt.feeUsdc.toFixed(2)} USDC Backstop fee).
              </span>
            </div>
            <a
              href={getExplorerTxUrl(receipt.txHash)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono font-bold text-emerald-300 underline hover:text-white"
            >
              <span>View Atomic Tx</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};