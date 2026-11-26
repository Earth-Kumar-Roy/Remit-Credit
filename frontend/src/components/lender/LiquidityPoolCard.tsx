import React, { useEffect, useState } from 'react';
import {
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Lock,
  PieChart,
} from 'lucide-react';
import {
  LpPositionBreakdown,
  PoolStatsData,
  ProtocolConfigData,
} from '@/hooks/useBorrowerProfile';
import { useRemitContract } from '@/hooks/useRemitContract';
import { formatBps, formatUsdc, parseUsdcToStroops } from '@/utils/stroops';

interface LiquidityPoolCardProps {
  isConnected: boolean;
  hasActiveLoan?: boolean;
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  usdcBalance: bigint;
  lpDeposit: bigint;
  lpShares: bigint;
  lpPosition?: LpPositionBreakdown;
  onSuccess: () => Promise<void>;
}

const MIN_LP_SUPPLY_STROOPS = 1_000_000_000n; // 100.00 USDC minimum LP supply

export const LiquidityPoolCard: React.FC<LiquidityPoolCardProps> = ({
  isConnected,
  hasActiveLoan = false,
  poolStats,
  config,
  usdcBalance,
  lpDeposit,
  lpShares,
  lpPosition,
  onSuccess,
}) => {
  const { depositLiquidity, withdrawLiquidity } = useRemitContract();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>(
    hasActiveLoan ? 'withdraw' : 'deposit'
  );
  const [amountInput, setAmountInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (hasActiveLoan && tab === 'deposit') {
      setTab('withdraw');
      setAmountInput('');
    }
  }, [hasActiveLoan, tab]);

  const utilizationPct =
    poolStats.totalLiquidity > 0n
      ? ((Number(poolStats.totalLent) / Number(poolStats.totalLiquidity)) * 100).toFixed(1)
      : '0.0';

  const idleRatioPct =
    poolStats.totalLiquidity > 0n
      ? ((Number(poolStats.availableLiquidity) / Number(poolStats.totalLiquidity)) * 100).toFixed(1)
      : '0.0';

  const poolSharePct =
    poolStats.totalShares > 0n
      ? ((Number(lpShares) / Number(poolStats.totalShares)) * 100).toFixed(2)
      : '0.00';

  // Pro-rata position analytics
  const shareValue = lpPosition ? lpPosition.shareValue : lpDeposit;
  const netSupplied = lpPosition ? lpPosition.netPrincipalDeposited : shareValue;
  const netPnl = lpPosition ? lpPosition.netProfitOrLoss : 0n;
  const lockedInLoans =
    lpPosition
      ? lpPosition.lockedInActiveLoans
      : poolStats.totalShares > 0n
      ? (lpShares * poolStats.totalLent) / poolStats.totalShares
      : 0n;
  const withdrawableNow =
    lpPosition
      ? lpPosition.withdrawableNow
      : poolStats.totalShares > 0n
      ? (lpShares * poolStats.availableLiquidity) / poolStats.totalShares
      : 0n;

  // Individual LP percentage metrics
  const netRoiPct =
    netSupplied > 0n
      ? ((Number(netPnl) / Number(netSupplied)) * 100).toFixed(2)
      : '0.00';
  const withdrawablePctOfPos =
    shareValue > 0n
      ? ((Number(withdrawableNow) / Number(shareValue)) * 100).toFixed(1)
      : '0.0';
  const deployedPctOfPos =
    shareValue > 0n
      ? ((Number(lockedInLoans) / Number(shareValue)) * 100).toFixed(1)
      : '0.0';

  const maxActionStroops =
    tab === 'deposit' ? (hasActiveLoan ? 0n : usdcBalance) : withdrawableNow;

  // Check if typed deposit amount is below the 100 USDC minimum
  let parsedInputStroops: bigint | null = null;
  if (amountInput.trim()) {
    try {
      parsedInputStroops = parseUsdcToStroops(amountInput);
    } catch {
      parsedInputStroops = null;
    }
  }

  const isDepositBelowMin =
    tab === 'deposit' &&
    amountInput.trim().length > 0 &&
    parsedInputStroops !== null &&
    parsedInputStroops < MIN_LP_SUPPLY_STROOPS;

  const isDepositBalanceBelowMin =
    isConnected && tab === 'deposit' && !hasActiveLoan && usdcBalance < MIN_LP_SUPPLY_STROOPS;

  const handleFillMax = () => {
    const whole = maxActionStroops / 10_000_000n;
    const frac = (maxActionStroops % 10_000_000n).toString().padStart(7, '0').replace(/0+$/, '');
    setAmountInput(frac ? `${whole}.${frac}` : whole.toString());
    setStatusMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    try {
      if (tab === 'deposit' && hasActiveLoan) {
        throw new Error('Repay your active loan before supplying liquidity to the LP vault.');
      }

      const stroops = parseUsdcToStroops(amountInput);
      if (tab === 'deposit' && stroops < MIN_LP_SUPPLY_STROOPS) {
        throw new Error('Minimum liquidity supply amount is 100.00 USDC.');
      }

      if (stroops > maxActionStroops) {
        throw new Error(
          tab === 'deposit'
            ? `Exceeds wallet USDC balance of ${formatUsdc(maxActionStroops)} USDC.`
            : `Exceeds your pro-rata withdrawable idle cash of ${formatUsdc(maxActionStroops)} USDC.`
        );
      }

      setIsSubmitting(true);
      if (tab === 'deposit') {
        await depositLiquidity(stroops);
        setStatusMsg({
          type: 'success',
          text: `Supplied ${formatUsdc(stroops)} USDC into the liquidity vault.`,
        });
      } else {
        const effectiveWithdrawStroops =
          poolStats.totalLent === 0n && stroops >= shareValue
            ? poolStats.totalLiquidity
            : stroops;

        await withdrawLiquidity(
          effectiveWithdrawStroops,
          poolStats.totalLiquidity,
          poolStats.totalShares,
          lpShares
        );
        setStatusMsg({
          type: 'success',
          text: `Withdrew ${formatUsdc(stroops)} USDC (pro-rata principal + yield) from the vault.`,
        });
      }

      setAmountInput('');
      await onSuccess();
    } catch (err) {
      setStatusMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'LP transaction failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Uncovered Default Drawdown Notice */}
      {poolStats.uncoveredLpLoss > 0n && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/50 p-4 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <div className="font-semibold text-white">
              Temporary Default Drawdown Active: {formatUsdc(poolStats.uncoveredLpLoss)} USDC
            </div>
            <p className="mt-1 text-amber-200/90">
              A defaulted loan exceeded the First-Loss Backstop Reserve, temporarily reducing LP
              share values by <strong>{formatUsdc(poolStats.uncoveredLpLoss)} USDC</strong>. When
              the suspended borrower settles their rehabilitation payment (+50% penalty), LP
              capital and accrued default fees are reimbursed <strong>first</strong> before
              replenishing the Backstop.
            </p>
          </div>
        </div>
      )}

      {/* Global Vault Telemetry Slabs (Distinct Slate/Cyan Macro Overview) */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>[01] TOTAL VAULT TVL</span>
            <span className="text-cyan-400">100%</span>
          </div>
          <div className="tabular-nums mt-1.5 font-mono text-xl font-bold text-white">
            ${formatUsdc(poolStats.totalLiquidity)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-slate-500">IDLE + DEPLOYED USDC</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>[02] ACTIVE LOANS</span>
            <span className="text-sky-400">{utilizationPct}%</span>
          </div>
          <div className="tabular-nums mt-1.5 font-mono text-xl font-bold text-sky-400">
            ${formatUsdc(poolStats.totalLent)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-slate-400">
            UTILIZATION: {utilizationPct}%
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>[03] IDLE LIQUIDITY</span>
            <span className="text-emerald-400">{idleRatioPct}%</span>
          </div>
          <div className="tabular-nums mt-1.5 font-mono text-xl font-bold text-emerald-400">
            ${formatUsdc(poolStats.availableLiquidity)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-slate-500">
            AVAILABLE ({idleRatioPct}%)
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
            <span>[04] CUMULATIVE YIELD</span>
            <span className="text-amber-400">{formatBps(config.loanFeeBps)}</span>
          </div>
          <div className="tabular-nums mt-1.5 font-mono text-xl font-bold text-amber-300">
            ${formatUsdc(poolStats.totalYieldEarned)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-slate-400">REALIZED LP FEES</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-slate-900 to-emerald-950/30 p-4 shadow-lg">
          <div className="flex items-center justify-between font-mono text-[10px] font-semibold text-emerald-300">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              [05] BACKSTOP SHIELD
            </span>
          </div>
          <div className="tabular-nums mt-1.5 font-mono text-xl font-bold text-emerald-300">
            ${formatUsdc(poolStats.backstopReserve)}
          </div>
          <div className="mt-1 font-mono text-[10px] text-emerald-400/85">
            {formatBps(config.remitFeeBps)} WIRE + {formatBps(config.backstopFeeBps)} FEE
          </div>
        </div>
      </div>

      {/* Distinct Personal LP Position & Pro-Rata Analytics Monolith */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-15">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="lpPosGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1e293b" strokeWidth="0.8" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lpPosGrid)" />
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
        <span className="pointer-events-none absolute left-4 top-2.5 select-none font-mono text-[9px] text-amber-400/75">
          ⌜ PERSONAL_LP_VAULT // PRO_RATA_SHARE: {poolSharePct}% ⌝
        </span>

        {/* Position Header */}
        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/35 bg-amber-400/10">
              <Coins className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                ◈ INDIVIDUAL LP EQUITY &amp; YIELD TELEMETRY
              </div>
              <h3 className="mt-0.5 text-lg font-bold text-white">
                Your LP Position &amp; Pro-Rata Analytics
              </h3>
              <p className="text-xs text-slate-400">
                You own <strong className="text-cyan-300">{poolSharePct}%</strong> of total vault
                shares · Idle cash and active loans scale pro-rata with your pool share
              </p>
            </div>
          </div>

          {/* Highlighted Pool Ownership & Immediate Liquidity Badges */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-800 bg-slate-950/90 px-4 py-3 font-mono">
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase text-slate-400">
                <PieChart className="h-3 w-3 text-cyan-400" />
                <span>Pool Ownership</span>
              </div>
              <div className="tabular-nums mt-0.5 text-lg font-extrabold text-cyan-300">
                {poolSharePct}%
              </div>
            </div>

            <div className="h-8 w-px bg-slate-800" />

            <div>
              <div className="text-[10px] uppercase text-slate-400">
                Withdrawable Now ({withdrawablePctOfPos}%)
              </div>
              <div className="tabular-nums mt-0.5 text-lg font-extrabold text-emerald-400">
                ${formatUsdc(withdrawableNow)} USDC
              </div>
            </div>
          </div>
        </div>

        {/* 4-Metric Individual LP Breakdown with % Ratios */}
        <div className="relative z-10 mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase text-slate-400">
              <span>Net Principal Supplied</span>
              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-slate-300">100% BASIS</span>
            </div>
            <div className="tabular-nums mt-1.5 font-mono text-lg font-bold text-white">
              ${formatUsdc(netSupplied)} USDC
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-500">
              Your net deposited capital
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase text-slate-400">
              <span>Total Share Entitlement</span>
              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-bold text-cyan-300">
                {poolSharePct}% POOL
              </span>
            </div>
            <div className="tabular-nums mt-1.5 font-mono text-lg font-bold text-cyan-300">
              ${formatUsdc(shareValue)} USDC
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-400">
              Principal + pro-rata yield/loss
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase text-slate-400">
              <span>Net Yield / Drawdown</span>
              <span
                className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-bold ${
                  netPnl >= 0n
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-rose-500/15 text-rose-300'
                }`}
              >
                {netPnl >= 0n ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {netPnl >= 0n ? `+${netRoiPct}%` : `${netRoiPct}%`}
              </span>
            </div>
            <div
              className={`tabular-nums mt-1.5 font-mono text-lg font-bold ${
                netPnl >= 0n ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netPnl >= 0n ? `+$${formatUsdc(netPnl)}` : `-$${formatUsdc(-netPnl)}`} USDC
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-400">
              {netPnl >= 0n ? `Net return (${netRoiPct}%)` : 'Pending default recovery'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] uppercase text-slate-400">
              <span>Deployed in Loans</span>
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-bold text-amber-300">
                <Lock className="h-3 w-3" />
                {deployedPctOfPos}%
              </span>
            </div>
            <div className="tabular-nums mt-1.5 font-mono text-lg font-bold text-amber-300">
              ${formatUsdc(lockedInLoans)} USDC
            </div>
            <div className="mt-1 font-mono text-[10px] text-slate-400">
              {deployedPctOfPos}% locked · {withdrawablePctOfPos}% idle
            </div>
          </div>
        </div>

        {/* Ongoing Loan Warning Banner */}
        {isConnected && hasActiveLoan && (
          <div className="relative z-10 mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/50 p-3.5 text-xs text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Active Loan Ongoing:</strong> You cannot supply new liquidity to the LP
              Vault while you have an active borrower loan. Settle your active loan in the
              Borrower Vault first.
            </span>
          </div>
        )}

        {/* Deposit / Withdraw Controls */}
        <div className="relative z-10 mt-6 border-t border-slate-800/80 pt-5">
          <div className="flex gap-2 font-mono">
            <button
              type="button"
              disabled={hasActiveLoan}
              onClick={() => {
                setTab('deposit');
                setStatusMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-45 ${
                tab === 'deposit'
                  ? 'bg-gradient-to-r from-amber-400 to-cyan-400 text-slate-950 shadow-md'
                  : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <ArrowDownToLine className="h-3.5 w-3.5" />
              <span>Supply USDC</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTab('withdraw');
                setStatusMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition ${
                tab === 'withdraw'
                  ? 'bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 shadow-md'
                  : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <ArrowUpFromLine className="h-3.5 w-3.5" />
              <span>Withdraw USDC</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 max-w-lg space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between font-mono text-xs">
                <span className="text-slate-400">
                  {tab === 'deposit'
                    ? 'SUPPLY AMOUNT (MIN 100 USDC)'
                    : `WITHDRAW AMOUNT (${withdrawablePctOfPos}% IDLE CASH)`}
                </span>
                <button
                  type="button"
                  onClick={handleFillMax}
                  disabled={!isConnected || (tab === 'deposit' && hasActiveLoan)}
                  className="tabular-nums font-bold text-cyan-400 hover:text-cyan-300 disabled:opacity-50"
                >
                  MAX: {formatUsdc(maxActionStroops)} USDC
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={tab === 'deposit' ? '100.00' : '50.00'}
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value);
                    setStatusMsg(null);
                  }}
                  disabled={!isConnected || isSubmitting || (tab === 'deposit' && hasActiveLoan)}
                  className="tabular-nums w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-16 font-mono text-base font-bold text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none disabled:opacity-50"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-xs font-bold text-cyan-400">
                  USDC
                </span>
              </div>
            </div>

            {isDepositBelowMin && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-950/60 p-3 text-xs text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Minimum liquidity supply deposit is <strong>100.00 USDC</strong>.
                </span>
              </div>
            )}

            {isDepositBalanceBelowMin && !isDepositBelowMin && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-950/60 p-3 text-xs text-amber-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                <span>
                  Minimum LP supply is <strong>100.00 USDC</strong> (your current wallet balance is{' '}
                  <strong>{formatUsdc(usdcBalance)} USDC</strong>).
                </span>
              </div>
            )}

            {statusMsg && (
              <div
                className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                  statusMsg.type === 'error'
                    ? 'border-rose-500/35 bg-rose-950/60 text-rose-200'
                    : 'border-emerald-500/35 bg-emerald-950/60 text-emerald-200'
                }`}
              >
                {statusMsg.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                )}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={
                !isConnected ||
                isSubmitting ||
                !amountInput.trim() ||
                isDepositBelowMin ||
                (tab === 'deposit' && hasActiveLoan)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:from-slate-800 disabled:via-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {!isConnected
                  ? 'Connect Freighter Wallet'
                  : tab === 'deposit'
                  ? hasActiveLoan
                    ? 'Settle Active Loan Before Depositing'
                    : '[ + Deposit USDC Liquidity ]'
                  : '[ ↗ Withdraw Pro-Rata USDC ]'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};