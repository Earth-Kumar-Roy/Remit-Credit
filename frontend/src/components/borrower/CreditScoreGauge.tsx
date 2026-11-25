import React from 'react';
import { Award, Ban, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { BorrowerProfileData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { formatUsdc } from '@/utils/stroops';

interface CreditScoreGaugeProps {
  profile: BorrowerProfileData;
  config: ProtocolConfigData;
}

export const CreditScoreGauge: React.FC<CreditScoreGaugeProps> = ({
  profile,
  config,
}) => {
  const minScore = 250;
  const maxScore = 850;
  const clampedScore = Math.min(maxScore, Math.max(minScore, profile.creditScore));
  const pct = (clampedScore - minScore) / (maxScore - minScore);

  const radius = 78;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - pct);

  const isEligible =
    profile.isKycVerified &&
    !profile.hasDefaulted &&
    profile.remittanceCycles >= config.minCyclesRequired;

  const cycleProgressPct = Math.min(
    100,
    Math.round((profile.remittanceCycles / Math.max(1, config.minCyclesRequired)) * 100)
  );

  let tierLabel = 'Tier 0 · Building History';
  let strokeColor = '#f59e0b';
  if (profile.hasDefaulted) {
    tierLabel = 'Tier 0 · 6-Strike Banned';
    strokeColor = '#f43f5e';
  } else if (profile.creditTier >= 4) {
    tierLabel = `Tier 4 · Max ($${formatUsdc(config.tier4Cap, 0)} Cap)`;
    strokeColor = '#10b981';
  } else if (profile.creditTier === 3) {
    tierLabel = `Tier 3 · Prime ($${formatUsdc(config.tier3Cap, 0)} Cap)`;
    strokeColor = '#14b8a6';
  } else if (profile.creditTier === 2) {
    tierLabel = `Tier 2 · Growth ($${formatUsdc(config.tier2Cap, 0)} Cap)`;
    strokeColor = '#06b6d4';
  } else if (profile.creditTier === 1) {
    tierLabel = `Tier 1 · Starter ($${formatUsdc(config.tier1Cap, 0)} Cap)`;
    strokeColor = '#38bdf8';
  }

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">On-Chain Remittance Score</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Deterministic EMA cash-flow underwriting &amp; 4-tier progressive caps
          </p>
        </div>

        {profile.hasDefaulted ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/35">
            <Ban className="h-3.5 w-3.5" />
            Banned (6/6)
          </span>
        ) : isEligible ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Tier {profile.creditTier} Active
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
            <Clock className="h-3.5 w-3.5" />
            {profile.remittanceCycles}/{config.minCyclesRequired} Cycles
          </span>
        )}
      </div>

      {/* Semi-Circular Gauge */}
      <div className="my-5 flex flex-col items-center">
        <div className="relative h-28 w-48">
          <svg viewBox="0 0 200 110" className="h-full w-full overflow-visible">
            <path
              d="M 22 96 A 78 78 0 0 1 178 96"
              fill="none"
              stroke="#1e293b"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <path
              d="M 22 96 A 78 78 0 0 1 178 96"
              fill="none"
              stroke={strokeColor}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
            <span className="tabular-nums text-4xl font-bold tracking-tight text-white">
              {clampedScore}
            </span>
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-slate-300">
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              {tierLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Cycle Eligibility Bar & Metrics */}
      <div className="space-y-3 border-t border-slate-800/80 pt-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-slate-400">Sybil-Resistant Cycle Threshold</span>
            <span className="tabular-nums font-medium text-slate-200">
              {profile.remittanceCycles} of {config.minCyclesRequired} cycles ({cycleProgressPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${cycleProgressPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">EMA Inflow</div>
            <div className="tabular-nums mt-0.5 text-xs font-semibold text-white">
              ${formatUsdc(profile.avgCycleAmount)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Net Volume</div>
            <div className="tabular-nums mt-0.5 text-xs font-semibold text-emerald-400">
              ${formatUsdc(profile.totalRemitted)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400">
              <TrendingUp className="h-3 w-3 text-cyan-400" />
              Repaid
            </div>
            <div className="tabular-nums mt-0.5 text-xs font-semibold text-cyan-300">
              {profile.loansRepaidCount} {profile.loansRepaidCount === 1 ? 'Loan' : 'Loans'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};