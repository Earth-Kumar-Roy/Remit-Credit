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
      ? Number((poolStats.totalLent * 100n) / poolStats.totalLiquidity)
      : 0;

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

  const maxActionStroops =
    tab === 'deposit' ? (hasActiveLoan ? 0n : usdcBalance) : withdrawableNow;

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
        // When withdrawing 100% of total share entitlement (no active loans), pass full share value
        // so integer division burns 100% of lpShares without leaving 1-stroop dust shares.
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
      {/* Uncovered Default Drawdown Notice (reimbursed first when defaulted borrower rehabilitates) */}
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

      {/* Global Pool & Backstop Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-lg">
          <div className="text-xs text-slate-400">Total Vault Assets</div>
          <div className="tabular-nums mt-1.5 text-xl font-bold text-white">
            {formatUsdc(poolStats.totalLiquidity)}{' '}
            <span className="text-xs font-normal text-slate-400">USDC</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Idle + Active Loan Principal</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-lg">
          <div className="text-xs text-slate-400">Active Loans Deployed</div>
          <div className="tabular-nums mt-1.5 text-xl font-bold text-sky-400">
            {formatUsdc(poolStats.totalLent)}{' '}
            <span className="text-xs font-normal text-slate-400">USDC</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Utilization: {utilizationPct}%</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-lg">
          <div className="text-xs text-slate-400">Pool Idle Cash</div>
          <div className="tabular-nums mt-1.5 text-xl font-bold text-emerald-400">
            {formatUsdc(poolStats.availableLiquidity)}{' '}
            <span className="text-xs font-normal text-slate-400">USDC</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Shared pro-rata across LPs</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5 shadow-lg">
          <div className="text-xs text-slate-400">Cumulative LP Yield</div>
          <div className="tabular-nums mt-1.5 text-xl font-bold text-amber-400">
            {formatUsdc(poolStats.totalYieldEarned)}{' '}
            <span className="text-xs font-normal text-slate-400">USDC</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Loan Fee: {formatBps(config.loanFeeBps)}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/25 p-5 shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            First-Loss Backstop
          </div>
          <div className="tabular-nums mt-1.5 text-xl font-bold text-emerald-300">
            {formatUsdc(poolStats.backstopReserve)}{' '}
            <span className="text-xs font-normal text-emerald-400/70">USDC</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-400/80">
            2% remit + {formatBps(config.backstopFeeBps)} loan fee
          </div>
        </div>
      </div>

      {/* LP Position & Action Card */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 shadow-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-500/30">
              <Coins className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Your LP Position &amp; Pro-Rata Analytics
              </h3>
              <p className="text-xs text-slate-400">
                Active loan exposure &amp; idle liquidity are split pro-rata by your {poolSharePct}%
                pool share
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Pool Share</div>
              <div className="tabular-nums text-sm font-semibold text-slate-200">
                {poolSharePct}%
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Withdrawable Now
              </div>
              <div className="tabular-nums text-xl font-bold text-emerald-400">
                {formatUsdc(withdrawableNow)} USDC
              </div>
            </div>
          </div>
        </div>

        {/* 4-Metric Individual LP Breakdown */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
            <div className="text-[11px] text-slate-400">Net Principal Supplied</div>
            <div className="tabular-nums mt-1 text-base font-bold text-white">
              {formatUsdc(netSupplied)} USDC
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Your net capital basis</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
            <div className="text-[11px] text-slate-400">Total Share Entitlement</div>
            <div className="tabular-nums mt-1 text-base font-bold text-sky-400">
              {formatUsdc(shareValue)} USDC
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Principal + pro-rata yield/loss
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Net Yield / Drawdown</span>
              {netPnl >= 0n ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
              )}
            </div>
            <div
              className={`tabular-nums mt-1 text-base font-bold ${
                netPnl >= 0n ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {netPnl >= 0n ? `+${formatUsdc(netPnl)}` : `-${formatUsdc(-netPnl)}`} USDC
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              {netPnl >= 0n ? 'Realized fee yield' : 'Pending default recovery'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Your Share in Active Loans</span>
              <Lock className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="tabular-nums mt-1 text-base font-bold text-amber-300">
              {formatUsdc(lockedInLoans)} USDC
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">
              Unlocks as borrowers repay
            </div>
          </div>
        </div>

        {/* Ongoing Loan Warning Banner */}
        {isConnected && hasActiveLoan && (
          <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/50 p-3.5 text-xs text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong>Active Loan Ongoing:</strong> You cannot supply new liquidity to the LP
              Vault while you have an active borrower loan. Settle your active loan in the
              Borrower Vault first.
            </span>
          </div>
        )}

        {/* Deposit / Withdraw Switch */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={hasActiveLoan}
            onClick={() => {
              setTab('deposit');
              setStatusMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
              tab === 'deposit'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Supply USDC
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('withdraw');
              setStatusMsg(null);
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
              tab === 'withdraw'
                ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                : 'border border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpFromLine className="h-3.5 w-3.5" />
            Withdraw USDC
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 max-w-lg space-y-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {tab === 'deposit' ? 'Supply Amount' : 'Withdraw Amount (Pro-Rata Idle Cash)'}
              </span>
              <button
                type="button"
                onClick={handleFillMax}
                disabled={!isConnected || (tab === 'deposit' && hasActiveLoan)}
                className="tabular-nums font-medium text-sky-400 hover:text-sky-300 disabled:opacity-50"
              >
                Max: {formatUsdc(maxActionStroops)} USDC
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                placeholder="1000.00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                disabled={!isConnected || isSubmitting || (tab === 'deposit' && hasActiveLoan)}
                className="tabular-nums w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 pr-16 text-base font-semibold text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none disabled:opacity-50"
              />
              <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs font-semibold text-slate-400">
                USDC
              </span>
            </div>
          </div>

          {statusMsg && (
            <div
              className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
                statusMsg.type === 'error'
                  ? 'border-rose-500/30 bg-rose-950/60 text-rose-200'
                  : 'border-emerald-500/30 bg-emerald-950/60 text-emerald-200'
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
              (tab === 'deposit' && hasActiveLoan)
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/20 transition hover:from-sky-400 hover:to-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {!isConnected
              ? 'Connect Freighter Wallet'
              : tab === 'deposit'
              ? hasActiveLoan
                ? 'Settle Active Loan Before Depositing'
                : 'Deposit Liquidity'
              : 'Withdraw Liquidity'}
          </button>
        </form>
      </div>
    </div>
  );
};