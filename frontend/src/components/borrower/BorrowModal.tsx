import React, { useEffect, useState } from 'react';
import {
  X,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
  Clock,
  Sparkles,
} from 'lucide-react';
import { projectLiveLoanState } from '@/components/borrower/VaultCard';
import {
  ActiveLoanData,
  BorrowerProfileData,
  PoolStatsData,
  ProtocolConfigData,
} from '@/hooks/useBorrowerProfile';
import { useRemitContract } from '@/hooks/useRemitContract';
import { formatBps, formatUnixToIST, formatUsdc, parseUsdcToStroops } from '@/utils/stroops';

interface BorrowModalProps {
  isOpen: boolean;
  mode: 'borrow' | 'repay';
  prefillFullRepay?: boolean;
  profile: BorrowerProfileData;
  activeLoan: ActiveLoanData | null;
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  usdcBalance: bigint;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const MIN_DURATION_SECS = 120; // 2 minutes
const MAX_DURATION_SECS = 2_592_000; // 30 days

const DURATION_PRESETS: { label: string; secs: number }[] = [
  { label: '2m (Test)', secs: 120 },
  { label: '3m (Test)', secs: 180 },
  { label: '1h', secs: 3_600 },
  { label: '7d', secs: 604_800 },
  { label: '14d', secs: 1_209_600 },
  { label: '30d (Prod)', secs: 2_592_000 },
];

function stroopsToInputString(stroops: bigint): string {
  if (stroops <= 0n) return '';
  const whole = stroops / 10_000_000n;
  const frac = (stroops % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export const BorrowModal: React.FC<BorrowModalProps> = ({
  isOpen,
  mode,
  prefillFullRepay = false,
  profile,
  activeLoan,
  poolStats,
  config,
  usdcBalance,
  onClose,
  onSuccess,
}) => {
  const { requestLoan, repayDirect } = useRemitContract();
  const [amountInput, setAmountInput] = useState<string>('');
  const [selectedDurationSecs, setSelectedDurationSecs] = useState<number>(
    Number(config.loanDurationSecs || 180n)
  );
  const [customValue, setCustomValue] = useState<string>(
    String(Math.max(2, Math.round(Number(config.loanDurationSecs || 180n) / 60)))
  );
  const [customUnit, setCustomUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txDone, setTxDone] = useState<boolean>(false);

  const nowSecs = BigInt(Math.floor(Date.now() / 1000));
  const liveLoan = activeLoan ? projectLiveLoanState(activeLoan, config, nowSecs) : null;

  const maxBorrowable =
    profile.maxCreditLimit < poolStats.availableLiquidity
      ? profile.maxCreditLimit
      : poolStats.availableLiquidity;

  const liveDebt = liveLoan ? liveLoan.liveRemainingDebt : 0n;
  const maxRepayable = liveLoan
    ? liveDebt < usdcBalance
      ? liveDebt
      : usdcBalance
    : 0n;

  const ceilingStroops = mode === 'borrow' ? maxBorrowable : maxRepayable;

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setTxDone(false);

    const defaultSecs = Math.min(
      MAX_DURATION_SECS,
      Math.max(MIN_DURATION_SECS, Number(config.loanDurationSecs || 180n))
    );
    setSelectedDurationSecs(defaultSecs);
    if (defaultSecs % 86_400 === 0) {
      setCustomUnit('days');
      setCustomValue(String(defaultSecs / 86_400));
    } else if (defaultSecs % 3_600 === 0) {
      setCustomUnit('hours');
      setCustomValue(String(defaultSecs / 3_600));
    } else {
      setCustomUnit('minutes');
      setCustomValue(String(Math.max(2, Math.round(defaultSecs / 60))));
    }

    if (mode === 'repay' && prefillFullRepay && ceilingStroops > 0n) {
      setAmountInput(stroopsToInputString(ceilingStroops));
    } else {
      setAmountInput('');
    }
  }, [isOpen, mode, prefillFullRepay, ceilingStroops, config.loanDurationSecs]);

  if (!isOpen) return null;

  let parsedStroops = 0n;
  try {
    if (amountInput.trim()) {
      parsedStroops = parseUsdcToStroops(amountInput);
    }
  } catch {
    parsedStroops = 0n;
  }

  const originationFeeStroops =
    mode === 'borrow' && parsedStroops > 0n
      ? (parsedStroops * BigInt(config.loanFeeBps)) / 10_000n
      : 0n;
  const totalRepaymentObligation = parsedStroops + originationFeeStroops;

  const isDurationValid =
    selectedDurationSecs >= MIN_DURATION_SECS && selectedDurationSecs <= MAX_DURATION_SECS;

  const estimatedDueUnix = Math.floor(Date.now() / 1000) + selectedDurationSecs;

  const handleSelectPreset = (secs: number) => {
    setSelectedDurationSecs(secs);
    setErrorMsg(null);
    if (secs % 86_400 === 0) {
      setCustomUnit('days');
      setCustomValue(String(secs / 86_400));
    } else if (secs % 3_600 === 0) {
      setCustomUnit('hours');
      setCustomValue(String(secs / 3_600));
    } else {
      setCustomUnit('minutes');
      setCustomValue(String(Math.round(secs / 60)));
    }
  };

  const handleCustomDurationChange = (valStr: string, unit: 'minutes' | 'hours' | 'days') => {
    setCustomValue(valStr);
    setCustomUnit(unit);
    setErrorMsg(null);

    const num = Number(valStr);
    if (!Number.isFinite(num) || num <= 0) {
      setSelectedDurationSecs(0);
      return;
    }
    const multiplier = unit === 'days' ? 86_400 : unit === 'hours' ? 3_600 : 60;
    setSelectedDurationSecs(Math.round(num * multiplier));
  };

  const handleSetFraction = (pct: bigint) => {
    const target = (ceilingStroops * pct) / 100n;
    setAmountInput(stroopsToInputString(target));
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      const stroops = parseUsdcToStroops(amountInput);
      if (stroops > ceilingStroops) {
        throw new Error(
          mode === 'borrow'
            ? `Amount exceeds available limit of ${formatUsdc(ceilingStroops)} USDC.`
            : `Amount exceeds max payable balance of ${formatUsdc(ceilingStroops)} USDC.`
        );
      }

      if (mode === 'borrow' && !isDurationValid) {
        throw new Error('Loan duration must be between 2 minutes and 30 days.');
      }

      setIsSubmitting(true);
      if (mode === 'borrow') {
        await requestLoan(stroops, BigInt(selectedDurationSecs));
      } else {
        await repayDirect(stroops);
      }

      setTxDone(true);
      await onSuccess();
      setTimeout(() => {
        setTxDone(false);
        setAmountInput('');
        onClose();
      }, 1100);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Transaction rejected or failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-[0_0_50px_rgba(0,0,0,0.85)]">
        {/* Top Accent Line & Corner Crosshairs */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        <span className="pointer-events-none absolute left-3 top-2 select-none font-mono text-[9px] text-cyan-400/60">
          ⌜ TX_EXEC // {mode === 'borrow' ? 'BORROW_V3' : 'REPAY_V3'} ⌝
        </span>

        <div className="mt-2 flex items-center justify-between border-b border-slate-800/90 pb-4">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-400">
              <Sparkles className="h-3 w-3" />
              <span>{mode === 'borrow' ? 'SOROBAN CREDIT DRAW' : 'DIRECT VAULT SETTLEMENT'}</span>
            </div>
            <h3 className="mt-0.5 text-lg font-bold tracking-tight text-white">
              {mode === 'borrow'
                ? 'Draw Instant USDC Credit'
                : prefillFullRepay
                ? 'Pay Full Loan at Once'
                : 'Direct Wallet Repayment'}
            </h3>
            <p className="text-xs text-slate-400">
              {mode === 'borrow'
                ? '0% crypto collateral · Funded from LP Vault & repaid via remittance waterfall'
                : 'Settle active loan balance directly from your Freighter USDC wallet'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-800 bg-slate-900/90 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between font-mono text-[11px]">
              <label htmlFor="modal-usdc-input" className="uppercase tracking-wider text-slate-300">
                01 // Amount (USDC)
              </label>
              <button
                type="button"
                onClick={() => handleSetFraction(100n)}
                className="tabular-nums font-semibold text-emerald-400 hover:text-emerald-300"
              >
                {mode === 'repay' ? 'FULL PAYOFF:' : 'MAX LIMIT:'} {formatUsdc(ceilingStroops)} USDC
              </button>
            </div>

            <div className="relative">
              <input
                id="modal-usdc-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setErrorMsg(null);
                }}
                disabled={isSubmitting || txDone}
                className="tabular-nums w-full rounded-xl border border-slate-700/90 bg-slate-950 px-4 py-3 pr-16 font-mono text-lg font-bold text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-xs font-bold text-cyan-400">
                USDC
              </span>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-1.5 font-mono">
              {[25n, 50n, 75n, 100n].map((pct) => (
                <button
                  key={pct.toString()}
                  type="button"
                  onClick={() => handleSetFraction(pct)}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 py-1.5 text-[11px] font-semibold text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  {pct === 100n && mode === 'repay' ? '100% FULL' : `${pct.toString()}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Borrower-Selected Loan Period Box (2 mins to 30 days) */}
          {mode === 'borrow' && (
            <div className="rounded-xl border border-slate-800/90 bg-slate-900/75 p-3.5">
              <div className="mb-2 flex items-center justify-between font-mono text-[11px]">
                <span className="inline-flex items-center gap-1.5 uppercase tracking-wider text-slate-300">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  02 // Term (2m – 30d)
                </span>
                <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-bold text-cyan-300 ring-1 ring-cyan-500/30">
                  {selectedDurationSecs >= 86_400
                    ? `${(selectedDurationSecs / 86_400).toFixed(1).replace(/\.0$/, '')}d`
                    : selectedDurationSecs >= 3_600
                    ? `${(selectedDurationSecs / 3_600).toFixed(1).replace(/\.0$/, '')}h`
                    : `${Math.round(selectedDurationSecs / 60)}m`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 font-mono">
                {DURATION_PRESETS.map((preset) => {
                  const active = selectedDurationSecs === preset.secs;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={isSubmitting || txDone}
                      onClick={() => handleSelectPreset(preset.secs)}
                      className={`rounded-lg border py-1.5 text-[11px] font-semibold transition ${
                        active
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                          : 'border-slate-800 bg-slate-950/80 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 flex gap-2 font-mono">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customValue}
                  disabled={isSubmitting || txDone}
                  onChange={(e) => handleCustomDurationChange(e.target.value, customUnit)}
                  placeholder="Duration"
                  className="tabular-nums w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                />
                <select
                  value={customUnit}
                  disabled={isSubmitting || txDone}
                  onChange={(e) =>
                    handleCustomDurationChange(
                      customValue,
                      e.target.value as 'minutes' | 'hours' | 'days'
                    )
                  }
                  className="w-1/2 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs font-semibold text-slate-200 focus:border-cyan-400 focus:outline-none"
                >
                  <option value="minutes">Minutes (min 2)</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days (max 30)</option>
                </select>
              </div>

              {!isDurationValid && (
                <p className="mt-1.5 font-mono text-[11px] text-rose-400">
                  Enter a term between 2 minutes (120s) and 30 days (43,200m).
                </p>
              )}
            </div>
          )}

          {mode === 'borrow' ? (
            <div className="space-y-2 rounded-xl border border-slate-800/90 bg-slate-950/90 p-3.5 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>PERIOD FEE ({formatBps(config.loanFeeBps)})</span>
                <span className="tabular-nums text-slate-200">
                  {formatUsdc(originationFeeStroops)} USDC
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>WATERFALL SPLIT</span>
                <span className="tabular-nums text-cyan-300">
                  {formatBps(config.waterfallSplitBps)} on-time · 100% late
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
                  DUE_AT (IST)
                </span>
                <span className="tabular-nums text-amber-300">
                  {isDurationValid ? formatUnixToIST(estimatedDueUnix) : 'INVALID_TERM'}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-white">
                <span>TOTAL OBLIGATION</span>
                <span className="tabular-nums text-emerald-400">
                  {formatUsdc(totalRepaymentObligation)} USDC
                </span>
              </div>
            </div>
          ) : (
            activeLoan &&
            liveLoan && (
              <div className="space-y-2 rounded-xl border border-slate-800/90 bg-slate-950/90 p-3.5 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>INITIAL DUE (IST)</span>
                  <span className="tabular-nums text-amber-300">
                    {formatUnixToIST(activeLoan.dueAt)}
                  </span>
                </div>
                {liveLoan.liveLatePeriods > 0 && (
                  <div className="flex justify-between text-rose-300">
                    <span>OVERDUE STRIKES</span>
                    <span className="tabular-nums font-bold">
                      {liveLoan.liveLatePeriods}/6 (+{formatUsdc(liveLoan.pendingPenaltyFee)} USDC)
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>LIVE REMAINING DEBT</span>
                  <span className="tabular-nums text-slate-200">
                    {formatUsdc(liveDebt)} USDC
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-800 pt-2 text-slate-400">
                  <span>POST-PAYMENT DEBT</span>
                  <span className="tabular-nums font-bold text-emerald-400">
                    {formatUsdc(liveDebt > parsedStroops ? liveDebt - parsedStroops : 0n)} USDC{' '}
                    {parsedStroops >= liveDebt ? '[CLOSED]' : ''}
                  </span>
                </div>
              </div>
            )
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {txDone && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 font-mono text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>CONFIRMED ON STELLAR TESTNET</span>
            </div>
          )}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              txDone ||
              !amountInput.trim() ||
              (mode === 'borrow' && !isDurationValid)
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:from-slate-800 disabled:via-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sign in Freighter...</span>
              </>
            ) : (
              <>
                <span>
                  {mode === 'borrow'
                    ? '[ ⬡ Confirm & Draw USDC ]'
                    : parsedStroops >= liveDebt
                    ? '[ ✓ Confirm & Close Full Loan ]'
                    : '[ ↗ Confirm Direct Repayment ]'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};