import React from 'react';
import { ShieldCheck, Lock, Umbrella, AlertTriangle } from 'lucide-react';
import { PoolStatsData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { computeRatioPct } from '@/utils/formatters';
import { formatBps, formatUsdc } from '@/utils/stroops';

interface BackstopMetricsCardProps {
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
}

export const BackstopMetricsCard: React.FC<BackstopMetricsCardProps> = ({
  poolStats,
  config,
}) => {
  const coveragePct =
    poolStats.totalLent > 0n
      ? computeRatioPct(poolStats.backstopReserve, poolStats.totalLent)
      : 100;

  const lpYieldShareBps = Math.max(0, 10_000 - config.backstopFeeBps);
  const hasUncoveredLoss = poolStats.uncoveredLpLoss > 0n;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/35 bg-gradient-to-br from-slate-900 via-[#080e1a] to-emerald-950/30 p-6 shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
      <span className="pointer-events-none absolute left-4 top-2.5 select-none font-mono text-[9px] text-emerald-400/70">
        ⌜ FIRST_LOSS_RESERVE // LP_CAPITAL_SHIELD ⌝
      </span>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/15">
            <Umbrella className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-white">First-Loss Backstop Reserve</h3>
              {hasUncoveredLoss ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/35">
                  <AlertTriangle className="h-3 w-3" />
                  {formatUsdc(poolStats.uncoveredLpLoss)} USDC PRIORITY LP RECOVERY PENDING
                </span>
              ) : (
                <span className="rounded-lg bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/35">
                  LP PRINCIPAL SHIELD ACTIVE
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Funded by {formatBps(config.remitFeeBps)} capped remittance fees &amp;{' '}
              {formatBps(config.backstopFeeBps)} of realized loan fees to absorb defaults before LP
              capital is impacted
            </p>
          </div>
        </div>

        <div className="text-right font-mono">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">
            RESERVE BALANCE
          </div>
          <div className="tabular-nums text-2xl font-extrabold text-emerald-400">
            ${formatUsdc(poolStats.backstopReserve)} USDC
          </div>
        </div>
      </div>

      {/* Coverage Bar & Fee Allocation Breakdown */}
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 font-mono sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>ACTIVE DEBT COVERAGE</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="tabular-nums mt-1 text-base font-bold text-white">{coveragePct}%</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, coveragePct)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>LP YIELD SHARE</span>
            <Lock className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="tabular-nums mt-1 text-base font-bold text-cyan-300">
            {formatBps(lpYieldShareBps)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            OF {formatBps(config.loanFeeBps)} LOAN FEE
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>BACKSTOP FEE SOURCES</span>
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="tabular-nums mt-1 text-base font-bold text-amber-300">
            {formatBps(config.remitFeeBps)} + {formatBps(config.backstopFeeBps)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">REMIT FEE + LOAN FEE CUT</div>
        </div>
      </div>
    </div>
  );
};