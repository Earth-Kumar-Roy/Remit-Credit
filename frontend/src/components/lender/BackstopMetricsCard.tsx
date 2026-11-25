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
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/25 p-6 shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
            <Umbrella className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-white">
                First-Loss Backstop Reserve
              </h3>
              {hasUncoveredLoss ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-500/35">
                  <AlertTriangle className="h-3 w-3" />
                  {formatUsdc(poolStats.uncoveredLpLoss)} USDC Priority LP Recovery Pending
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  LP Principal Shield Active
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Funded by {formatBps(config.remitFeeBps)} capped remittance fees &amp;{' '}
              {formatBps(config.backstopFeeBps)} of realized loan fees to absorb defaults before LP
              capital is impacted
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-emerald-300/80">
            Reserve Balance
          </div>
          <div className="tabular-nums text-2xl font-bold text-emerald-400">
            {formatUsdc(poolStats.backstopReserve)} USDC
          </div>
        </div>
      </div>

      {/* Coverage Bar & Fee Allocation Breakdown */}
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Active Debt Coverage</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="tabular-nums mt-1 text-base font-bold text-white">{coveragePct}%</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, coveragePct)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>LP Yield Allocation</span>
            <Lock className="h-3.5 w-3.5 text-sky-400" />
          </div>
          <div className="tabular-nums mt-1 text-base font-bold text-sky-400">
            {formatBps(lpYieldShareBps)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Of {formatBps(config.loanFeeBps)} fee</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Backstop Fee Sources</span>
            <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="tabular-nums mt-1 text-base font-bold text-amber-300">
            {formatBps(config.remitFeeBps)} + {formatBps(config.backstopFeeBps)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Remit fee + loan fee cut</div>
        </div>
      </div>
    </div>
  );
};