import React from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {
  STELLAR_CONFIG,
  getExplorerAccountUrl,
  getExplorerContractUrl,
} from '@/config/stellar';
import { PoolStatsData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { formatBps, formatUsdc, shortenAddress } from '@/utils/stroops';

interface ProtocolStatusPageProps {
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  keeperOnline: boolean;
}

function formatLoanPeriod(secsBig: bigint): string {
  const secs = Number(secsBig);
  if (secs >= 86400) {
    const days = Math.round(secs / 86400);
    return `${days} ${days === 1 ? 'Day' : 'Days'}`;
  }
  if (secs >= 3600) {
    const hrs = Math.round(secs / 3600);
    return `${hrs} ${hrs === 1 ? 'Hour' : 'Hours'}`;
  }
  const mins = Math.max(1, Math.round(secs / 60));
  return `${mins} ${mins === 1 ? 'Min' : 'Mins'} (${secs}s)`;
}

export const ProtocolStatusPage: React.FC<ProtocolStatusPageProps> = ({
  poolStats,
  config,
  keeperOnline,
}) => {
  return (
    <div className="space-y-6 pb-10">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/25 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
              <Activity className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Protocol Telemetry &amp; Risk Parameters</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Real-time inspection of on-chain Soroban v3 governance constants and serverless
                indexer infrastructure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                config.isPaused
                  ? 'bg-rose-500/15 text-rose-300 ring-rose-500/40'
                  : 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/35'
              }`}
            >
              {config.isPaused ? (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  Circuit Breaker: PAUSED
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Contract: ACTIVE
                </>
              )}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                keeperOnline
                  ? 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/35'
                  : 'bg-amber-500/15 text-amber-300 ring-amber-500/35'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              {keeperOnline ? 'Keeper + Sheets DB: ONLINE' : 'Keeper: OFFLINE'}
            </span>
          </div>
        </div>
      </div>

      {/* Infrastructure Endpoints */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>RemitCredit v3 Contract</span>
            <Cpu className="h-4 w-4 text-emerald-400" />
          </div>
          <a
            href={getExplorerContractUrl(STELLAR_CONFIG.remitContractId)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-300 hover:underline"
          >
            {shortenAddress(STELLAR_CONFIG.remitContractId, 10, 8)}
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-1 text-[11px] text-slate-500">Stellar Soroban Testnet</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Settlement USDC SAC</span>
            <Layers className="h-4 w-4 text-sky-400" />
          </div>
          <a
            href={getExplorerContractUrl(STELLAR_CONFIG.usdcSacId)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-sky-300 hover:underline"
          >
            {shortenAddress(STELLAR_CONFIG.usdcSacId, 10, 8)}
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-1 text-[11px] text-slate-500">7-Decimal Stellar Asset Contract</div>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Whitelisted SEP-12/31 Anchor</span>
            <ShieldCheck className="h-4 w-4 text-amber-400" />
          </div>
          <a
            href={getExplorerAccountUrl(STELLAR_CONFIG.anchorPublicKey)}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-300 hover:underline"
          >
            {shortenAddress(STELLAR_CONFIG.anchorPublicKey, 10, 8)}
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="mt-1 text-[11px] text-slate-500">Authorized KYC &amp; Wire Relayer</div>
        </div>
      </div>

      {/* On-Chain Underwriting & Risk Parameters */}
      <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-6 shadow-xl">
        <h2 className="border-b border-slate-800 pb-3 text-base font-semibold text-white">
          On-Chain Risk &amp; Underwriting Constants
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">Min Remittance Cycles</div>
            <div className="tabular-nums mt-1 text-lg font-bold text-white">
              {config.minCyclesRequired} cycles
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">Cycle / Repay Cooldown</div>
            <div className="tabular-nums mt-1 text-lg font-bold text-white">
              {Number(config.minCycleIntervalSecs)}s / {Number(config.postRepayCooldownSecs)}s
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">Remit Fee &rarr; Backstop</div>
            <div className="tabular-nums mt-1 text-lg font-bold text-emerald-400">
              {formatBps(config.remitFeeBps)} (Max ${formatUsdc(config.remitFeeCap, 0)})
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">Auto-Repay Waterfall</div>
            <div className="tabular-nums mt-1 text-lg font-bold text-sky-400">
              {formatBps(config.waterfallSplitBps)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">Loan Fee &amp; Strike Limit</div>
            <div className="tabular-nums mt-1 text-lg font-bold text-amber-400">
              {formatBps(config.loanFeeBps)} · 6 Strikes
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">4-Tier Credit Caps</div>
            <div className="tabular-nums mt-1 text-sm font-bold text-white">
              ${formatUsdc(config.tier1Cap, 0)} / ${formatUsdc(config.tier2Cap, 0)} / $
              {formatUsdc(config.tier3Cap, 0)} / ${formatUsdc(config.tier4Cap, 0)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">Loan Period Duration</div>
            <div className="tabular-nums mt-1 text-lg font-bold text-white">
              {formatLoanPeriod(config.loanDurationSecs)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="text-xs text-slate-400">Backstop Coverage Ratio</div>
            <div className="tabular-nums mt-1 text-lg font-bold text-cyan-400">
              {poolStats.totalLent > 0n
                ? `${((Number(poolStats.backstopReserve) / Number(poolStats.totalLent)) * 100).toFixed(2)}%`
                : '100% (No Debt)'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};