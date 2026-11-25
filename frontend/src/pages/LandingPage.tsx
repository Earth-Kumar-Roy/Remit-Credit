import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  Landmark,
  Layers,
  Lock,
  ShieldCheck,
  Sparkles,
  SplitSquareVertical,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { getExplorerContractUrl } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { PoolStatsData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { KycStanding } from '@/hooks/useKycStatus';
import { formatBps, formatUsdc } from '@/utils/stroops';

interface LandingPageProps {
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  kycStatus: KycStanding;
}

function formatDurationText(secsBig: bigint): string {
  const secs = Number(secsBig);
  if (secs >= 86400) {
    const days = Math.round(secs / 86400);
    return `${days}-day`;
  }
  const mins = Math.max(1, Math.round(secs / 60));
  return `${mins}-minute`;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  poolStats,
  config,
  kycStatus,
}) => {
  const { address, isConnecting, connect, setActivePage } = useWallet();

  return (
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-br from-slate-900 via-slate-950 to-emerald-950/30 px-6 py-14 shadow-2xl sm:px-12 lg:py-20">
        <div className="pointer-events-none absolute -top-24 right-10 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Stellar Soroban v3 RWA Credit Protocol · SEP-12 &amp; SEP-31 Native</span>
          </div>

          <h1 className="mt-6 bg-gradient-to-r from-white via-slate-100 to-emerald-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
            Turn Cross-Border Remittances Into Instant Credit
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            RemitCredit underwrites migrant families and micro-entrepreneurs on-chain using verified
            remittance cash flows—unlocking instant USDC credit with{' '}
            <span className="font-semibold text-emerald-300">0% crypto collateral</span> and
            automated <span className="font-semibold text-sky-300">{formatBps(config.waterfallSplitBps)}</span>{' '}
            repayment waterfalls.
          </p>

          {/* Primary Hero CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {!address ? (
              <button
                type="button"
                onClick={connect}
                disabled={isConnecting}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-cyan-400"
              >
                <Wallet className="h-4 w-4" />
                {isConnecting ? 'Connecting Freighter...' : 'Launch App · Connect Freighter'}
              </button>
            ) : kycStatus !== 'VERIFIED' ? (
              <button
                type="button"
                onClick={() => setActivePage('kyc')}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/20 transition hover:opacity-95"
              >
                <ShieldCheck className="h-4 w-4" />
                Complete SEP-12 KYC Verification
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActivePage('dashboard')}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:from-emerald-400 hover:to-cyan-400"
              >
                Open Borrower Credit Vault
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setActivePage('pool')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/90 px-6 py-3.5 text-sm font-semibold text-slate-200 transition hover:border-sky-500/50 hover:text-white"
            >
              <Landmark className="h-4 w-4 text-sky-400" />
              Supply USDC Liquidity
            </button>
          </div>

          {/* Live On-Chain Telemetry Strip */}
          <div className="mt-12 grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-8 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <div className="text-xs text-slate-400">Vault Total TVL</div>
              <div className="tabular-nums mt-1 text-xl font-bold text-white">
                ${formatUsdc(poolStats.totalLiquidity)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <div className="text-xs text-slate-400">Available Credit</div>
              <div className="tabular-nums mt-1 text-xl font-bold text-emerald-400">
                ${formatUsdc(poolStats.availableLiquidity)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <div className="text-xs text-slate-400">Backstop Reserve</div>
              <div className="tabular-nums mt-1 text-xl font-bold text-cyan-400">
                ${formatUsdc(poolStats.backstopReserve)}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <div className="text-xs text-slate-400">4-Tier Credit Caps</div>
              <div className="tabular-nums mt-1 text-xl font-bold text-amber-300">
                ${formatUsdc(config.tier1Cap, 0)}–${formatUsdc(config.tier4Cap, 0)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Architecture Walkthrough */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              How RemitCredit Underwrites Real-World Cash Flows
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              End-to-end cryptographic underwriting enforced by Soroban v3 smart contracts
            </p>
          </div>
          <a
            href={getExplorerContractUrl()}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            Inspect Live Soroban Contract on Stellar Expert ↗
          </a>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-6 shadow-lg">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="mt-4 text-xs font-bold uppercase tracking-wider text-emerald-400">
              Step 01 · SEP-12 Sybil Shield
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">1 Human = 1 Credit Vault</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Whitelisted Anchors verify government IDs off-chain and bind a salted SHA-256
              identity nullifier on-chain—preventing multi-wallet farming and permanently banning
              accounts after 6 overdue strikes.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-6 shadow-lg">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/30">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="mt-4 text-xs font-bold uppercase tracking-wider text-cyan-400">
              Step 02 · EMA Cash-Flow Scoring
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">4-Tier Progressive Micro-Caps</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Verified remittance inflows build an Exponential Moving Average (EMA) stream. After{' '}
              {config.minCyclesRequired} verified cycles, borrowers unlock Tier 1 ($
              {formatUsdc(config.tier1Cap, 0)}), scaling up to Tier 4 ($
              {formatUsdc(config.tier4Cap, 0)}).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-6 shadow-lg">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-500/30">
              <SplitSquareVertical className="h-5 w-5 text-sky-400" />
            </div>
            <div className="mt-4 text-xs font-bold uppercase tracking-wider text-sky-400">
              Step 03 · Atomic Waterfall Split
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {formatBps(config.waterfallSplitBps)} Auto-Repay /{' '}
              {formatBps(10000 - config.waterfallSplitBps)} Direct
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              When a loan is active, incoming remittances split atomically inside{' '}
              <code className="text-slate-200">send_remittance()</code>—repaying LP principal +
              yield while forwarding the remainder straight to the recipient&apos;s wallet.
            </p>
          </div>
        </div>
      </section>

      {/* Institutional Guardrails Banner */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Self-Funded Backstop Reserve</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {formatBps(config.remitFeeBps)} of every remittance (capped at $
                {formatUsdc(config.remitFeeCap, 0)}) plus {formatBps(config.backstopFeeBps)} of
                loan fees fund an on-chain reserve that absorbs defaults before LP capital.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">SEP-31 Corridor &amp; Atomic Router</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Built natively for single-transaction cross-border remittances and licensed Stellar
                anchors with stateless serverless indexing.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Deterministic Maturity &amp; Strikes</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Every loan carries an explicit {formatDurationText(config.loanDurationSecs)}{' '}
                period deadline, direct wallet repayment, and 6-strike progressive default
                enforcement.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-5 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Deployed &amp; verified on Stellar Soroban Testnet</span>
          </div>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActivePage('status')}
              className="font-semibold text-slate-300 transition hover:text-white"
            >
              View Live Contract Parameters →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};