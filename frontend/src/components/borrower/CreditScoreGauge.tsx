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

  let tierLabel = 'TIER 0 · BUILDING HISTORY';
  let strokeColor = '#f59e0b';
  if (profile.hasDefaulted) {
    tierLabel = 'TIER 0 · 6-STRIKE BANNED';
    strokeColor = '#f43f5e';
  } else if (profile.creditTier >= 4) {
    tierLabel = `TIER 4 · MAX ($${formatUsdc(config.tier4Cap, 0)} CAP)`;
    strokeColor = '#10b981';
  } else if (profile.creditTier === 3) {
    tierLabel = `TIER 3 · PRIME ($${formatUsdc(config.tier3Cap, 0)} CAP)`;
    strokeColor = '#22d3ee';
  } else if (profile.creditTier === 2) {
    tierLabel = `TIER 2 · GROWTH ($${formatUsdc(config.tier2Cap, 0)} CAP)`;
    strokeColor = '#38bdf8';
  } else if (profile.creditTier === 1) {
    tierLabel = `TIER 1 · STARTER ($${formatUsdc(config.tier1Cap, 0)} CAP)`;
    strokeColor = '#fbbf24';
  }

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
      {/* Subtle Blueprint Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-15">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="gaugeCadGrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1e293b" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#gaugeCadGrid)" />
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <span className="pointer-events-none absolute left-3 top-2 select-none font-mono text-[9px] text-slate-500">
        ⌜ SCORE_MATRIX ⌝
      </span>

      <div className="relative z-10 mt-2 flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
            ◈ CASH-FLOW TELEMETRY
          </div>
          <h2 className="mt-0.5 text-base font-bold text-white">On-Chain Remittance Score</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Rolling 8-inflow underwriting &amp; 4-tier progressive caps
          </p>
        </div>

        {profile.hasDefaulted ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-rose-300 ring-1 ring-rose-500/40">
            <Ban className="h-3.5 w-3.5" />
            BANNED (6/6)
          </span>
        ) : isEligible ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/35">
            <CheckCircle2 className="h-3.5 w-3.5" />
            TIER {profile.creditTier} ACTIVE
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-300 ring-1 ring-amber-500/35">
            <Clock className="h-3.5 w-3.5" />
            {profile.remittanceCycles}/{config.minCyclesRequired} CYCLES
          </span>
        )}
      </div>

      {/* Semi-Circular Architectural Gauge */}
      <div className="relative z-10 my-5 flex flex-col items-center rounded-xl border border-slate-800/80 bg-slate-950/75 py-5">
        <div className="relative h-28 w-48">
          <svg viewBox="0 0 200 110" className="h-full w-full overflow-visible">
            <path
              d="M 22 96 A 78 78 0 0 1 178 96"
              fill="none"
              stroke="#1e293b"
              strokeWidth="13"
              strokeLinecap="round"
            />
            <path
              d="M 22 96 A 78 78 0 0 1 178 96"
              fill="none"
              stroke={strokeColor}
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center text-center">
            <span className="tabular-nums font-mono text-4xl font-extrabold tracking-tight text-white">
              {clampedScore}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider text-amber-300">
              <Award className="h-3.5 w-3.5 text-amber-400" />
              {tierLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Cycle Eligibility Bar & Tectonic Sub-Blocks */}
      <div className="relative z-10 space-y-3 border-t border-slate-800/80 pt-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between font-mono text-[11px]">
            <span className="uppercase text-slate-400">CYCLE THRESHOLD</span>
            <span className="tabular-nums font-semibold text-cyan-300">
              {profile.remittanceCycles}/{config.minCyclesRequired} ({cycleProgressPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 transition-all duration-500"
              style={{ width: `${cycleProgressPct}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1 font-mono">
          <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-400">8-AVG INFLOW</div>
            <div className="tabular-nums mt-0.5 text-xs font-bold text-white">
              ${formatUsdc(profile.avgCycleAmount)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-2.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-400">NET VOLUME</div>
            <div className="tabular-nums mt-0.5 text-xs font-bold text-emerald-400">
              ${formatUsdc(profile.totalRemitted)}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-2.5">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-400">
              <TrendingUp className="h-3 w-3 text-cyan-400" />
              REPAID
            </div>
            <div className="tabular-nums mt-0.5 text-xs font-bold text-cyan-300">
              {profile.loansRepaidCount} {profile.loansRepaidCount === 1 ? 'LOAN' : 'LOANS'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};