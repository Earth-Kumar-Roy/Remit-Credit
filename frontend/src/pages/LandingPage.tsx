import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Globe2,
  Landmark,
  Layers,
  ShieldCheck,
  Sliders,
  SplitSquareVertical,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { getExplorerContractUrl, STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { PoolStatsData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { KycStanding } from '@/hooks/useKycStatus';
import { formatBps, formatUsdc } from '@/utils/stroops';

interface LandingPageProps {
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  kycStatus: KycStanding;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  poolStats,
  config,
  kycStatus,
}) => {
  const { address, isConnecting, connect, setActivePage } = useWallet();

  // Interactive Cash-Flow & Credit Unlock Simulator State
  const [simMonthlyInflow, setSimMonthlyInflow] = useState<number>(400);
  const [simCycles, setSimCycles] = useState<number>(6);
  const [simLoansRepaid, setSimLoansRepaid] = useState<number>(1);

  const waterfallRepayRatio = Number(config.waterfallSplitBps || 4000) / 10_000;
  const waterfallDirectRatio = Math.max(0, 1 - waterfallRepayRatio);
  const simRepayAmount = simMonthlyInflow * waterfallRepayRatio;
  const simFamilyAmount = simMonthlyInflow * waterfallDirectRatio;

  const t1Cap = Number(config.tier1Cap) / 10_000_000 || 50;
  const t2Cap = Number(config.tier2Cap) / 10_000_000 || 100;
  const t3Cap = Number(config.tier3Cap) / 10_000_000 || 200;
  const t4Cap = Number(config.tier4Cap) / 10_000_000 || 400;

  let simTier = 0;
  let simTierLabel = 'TIER 0 [LOCKED · < 3 CYCLES]';
  let simHardCap = 0;

  if (simCycles >= config.minCyclesRequired) {
    if (simLoansRepaid >= 4 && simCycles >= 15 && simMonthlyInflow >= t4Cap) {
      simTier = 4;
      simTierLabel = 'TIER 4 [SOVEREIGN MAX]';
      simHardCap = t4Cap;
    } else if (simLoansRepaid >= 2 && simCycles >= 10 && simMonthlyInflow >= t3Cap) {
      simTier = 3;
      simTierLabel = 'TIER 3 [ESTABLISHED]';
      simHardCap = t3Cap;
    } else if (simLoansRepaid >= 1 && simCycles >= 6 && simMonthlyInflow >= t2Cap) {
      simTier = 2;
      simTierLabel = 'TIER 2 [VERIFIED STREAM]';
      simHardCap = t2Cap;
    } else {
      simTier = 1;
      simTierLabel = 'TIER 1 [UNLOCKED]';
      simHardCap = t1Cap;
    }
  }

  // Mirrors on-chain `min(rolling_8_avg * 50%, tier_hard_cap)`
  const simCreditLimit = simTier > 0 ? Math.min(simMonthlyInflow * 0.5, simHardCap) : 0;

  const shortContractId =
    STELLAR_CONFIG.remitContractId.length > 12
      ? `${STELLAR_CONFIG.remitContractId.slice(0, 6)}...${STELLAR_CONFIG.remitContractId.slice(-6)}`
      : STELLAR_CONFIG.remitContractId;

  return (
    <div className="space-y-14 pb-12">
      {/* SECTION 00: ARCHITECTURAL HERO MONOLITH + CYBERNETIC CAD GRID */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] px-6 py-10 shadow-2xl sm:px-10 lg:py-14">
        {/* CAD Coordinate Grid Overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="remitCadGrid" width="44" height="44" patternUnits="userSpaceOnUse">
                <path
                  d="M 44 0 L 0 0 0 44"
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="0.85"
                />
                <circle cx="44" cy="44" r="1.1" fill="#22d3ee" opacity="0.55" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#remitCadGrid)" />
          </svg>
        </div>

        {/* Atmospheric Ambient Glows */}
        <div className="pointer-events-none absolute -top-24 right-12 h-80 w-80 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-28 left-12 h-80 w-80 rounded-full bg-cyan-500/12 blur-[130px]" />

        {/* Architectural Corner Crosshairs */}
        <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[11px] text-cyan-400/70">
          ⌜ 01 // SOROBAN_CORE ⌝
        </span>
        <span className="pointer-events-none absolute right-4 top-3 select-none font-mono text-[11px] text-slate-600">
          [+]
        </span>
        <span className="pointer-events-none absolute bottom-3 left-4 select-none font-mono text-[11px] text-slate-600">
          [x]
        </span>
        <span className="pointer-events-none absolute bottom-3 right-4 select-none font-mono text-[11px] text-amber-400/80">
          ⌞ RC-V3 · SEP-12/31 ⌟
        </span>

        <div className="relative z-10 space-y-8">
          {/* Top Brand Emblem & Telemetry Status Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Brand Logo Emblem on pure #000000 black background */}
              <div className="flex items-center gap-3 rounded-xl border border-cyan-400/35 bg-black px-3.5 py-2 shadow-[0_0_24px_rgba(34,211,238,0.15)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black">
                  <img
                    src="/Logo.png"
                    alt="RemitCredit Logo"
                    className="h-9 w-9 object-contain brightness-110 contrast-110 saturate-125"
                  />
                </div>
                <div className="leading-tight">
                  <div className="font-mono text-xs font-extrabold tracking-wider text-white">
                    REMIT<span className="text-cyan-400">-</span>
                    <span className="text-amber-300">CREDIT</span>
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
                    SOROBAN V3
                  </div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                <span>RWA Credit Protocol · SEP-12 &amp; SEP-31 Native</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
              <span className="text-cyan-400">NETWORK // {STELLAR_CONFIG.network.toUpperCase()}</span>
              <span>·</span>
              <span className="text-emerald-400">COLLATERAL: 0.00% CRYPTO</span>
            </div>
          </div>

          {/* 12-Column Monolith Grid: Editorial Left + Branded State Vector Stela Right */}
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-8">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-slate-400">
                <span className="font-bold text-amber-400">◈ STELLAR CONSENSUS MONOLITH</span>
                <span>// DECENTRALIZED CASH-FLOW UNDERWRITING</span>
              </div>

              <h1 className="text-4xl font-extrabold uppercase tracking-tight text-white sm:text-5xl lg:text-6xl">
                Turn Cross-Border{' '}
                <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-200 bg-clip-text text-transparent">
                  Remittances
                </span>{' '}
                Into{' '}
                <span className="bg-gradient-to-r from-cyan-300 via-sky-400 to-emerald-300 bg-clip-text text-transparent">
                  Instant Credit
                </span>
              </h1>

              {/* Quote Callout Slab */}
              <div className="rounded-xl border-l-2 border-amber-400 bg-slate-900/80 px-4 py-3">
                <p className="text-base font-semibold tracking-wide text-amber-300">
                  “Your Remittance. Your Credit. Your Financial Freedom.”
                </p>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-widest text-cyan-300">
                  Bridging Global Remittances with Financial Opportunity
                </p>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                RemitCredit underwrites migrant families and micro-entrepreneurs on-chain using
                verified remittance cash flows—unlocking instant USDC credit with{' '}
                <span className="font-semibold text-emerald-300">0% crypto collateral</span> and
                automated{' '}
                <span className="font-semibold text-amber-300">
                  {formatBps(config.waterfallSplitBps)}
                </span>{' '}
                repayment waterfalls.
              </p>

              {/* Monumental Action CTAs */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                {!address ? (
                  <button
                    type="button"
                    onClick={connect}
                    disabled={isConnecting}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.35)] transition hover:from-amber-300 hover:to-amber-400"
                  >
                    <Wallet className="h-4 w-4" />
                    {isConnecting ? 'Connecting Freighter...' : '[ ⬡ Launch App · Connect Freighter ]'}
                  </button>
                ) : kycStatus !== 'VERIFIED' ? (
                  <button
                    type="button"
                    onClick={() => setActivePage('kyc')}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-emerald-400 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.35)] transition hover:opacity-95"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    [ ◈ Complete SEP-12 KYC Verification ]
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActivePage('dashboard')}
                    className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_25px_rgba(16,185,129,0.35)] transition hover:from-emerald-300 hover:to-cyan-300"
                  >
                    [ ◈ Open Borrower Credit Vault ]
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActivePage('pool')}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-900/90 px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-cyan-300 transition hover:border-cyan-400 hover:bg-slate-800 hover:text-white"
                >
                  <Landmark className="h-4 w-4 text-cyan-400" />
                  [ ⊞ Supply USDC Liquidity ]
                </button>
              </div>
            </div>

            {/* Right Column: Branded Soroban State Vector Stela */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-slate-800 bg-black p-5 shadow-inner">
                <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                  <span>SOROBAN_STATE_VECTOR</span>
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    RUNNING
                  </span>
                </div>

                {/* Chiseled Octagonal Stela on Pure Black (#000000) to Match Logo Background */}
                <div className="relative my-4 flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-black py-5">
                  <div className="relative flex h-56 w-56 items-center justify-center">
                    <svg className="h-full w-full" fill="none" viewBox="0 0 220 220">
                      <polygon
                        points="66,12 154,12 208,66 208,154 154,208 66,208 12,154 12,66"
                        stroke="#64748b"
                        strokeDasharray="4 3"
                        strokeWidth="1.25"
                      />
                      <polygon
                        points="76,26 144,26 194,76 194,144 144,194 76,194 26,144 26,76"
                        stroke="#f59e0b"
                        strokeWidth="1.35"
                      />
                      <circle cx="110" cy="110" r="68" stroke="#22d3ee" strokeOpacity="0.65" strokeWidth="1.25" />
                      <path
                        d="M 110 12 L 110 42 M 110 178 L 110 208 M 12 110 L 42 110 M 178 110 L 208 110"
                        stroke="#1e293b"
                        strokeWidth="1.1"
                      />
                      <circle cx="110" cy="42" r="3.5" fill="#10b981" />
                      <circle cx="110" cy="178" r="3.5" fill="#f59e0b" />
                      <circle cx="42" cy="110" r="3.5" fill="#22d3ee" />
                      <circle cx="178" cy="110" r="3.5" fill="#a5f3fc" />
                    </svg>

                    {/* Large Brand Logo Blending Seamlessly into Pure Black (#000000) */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="flex h-28 w-28 items-center justify-center rounded-full bg-black">
                        <img
                          src="/Logo.png"
                          alt="RemitCredit Emblem"
                          className="h-28 w-28 object-contain brightness-110 contrast-115 saturate-125"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Clean Waterfall Split Pill Positioned Below the Stela */}
                  <div className="mt-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-0.5 font-mono text-[10px] font-bold tracking-widest text-amber-300">
                    {Math.round(waterfallRepayRatio * 100)}/{Math.round(waterfallDirectRatio * 100)} WATERFALL SPLIT
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <div className="text-[10px] text-slate-400">COLLATERAL</div>
                    <div className="mt-0.5 font-bold text-emerald-400">0% CRYPTO</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <div className="text-[10px] text-slate-400">ROLLING LTV</div>
                    <div className="mt-0.5 font-bold text-cyan-300">50% 8-AVG</div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2.5 font-mono text-[10px] text-slate-400">
                  <span>WASM: RC_V3.WASM</span>
                  <span className="text-amber-300">ID: {shortContractId}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 01: LIVE ON-CHAIN TELEMETRY VAULT (4 TECTONIC SLABS) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
          <div className="flex items-center gap-2 text-cyan-300">
            <Activity className="h-4 w-4 text-emerald-400" />
            <span>[SEC_01 // LIVE ON-CHAIN TELEMETRY VAULT]</span>
          </div>
          <span className="text-slate-500">+ REAL-TIME SOROBAN RPC STATE +</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/85 p-5 shadow-lg transition hover:border-amber-500/40">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[01] VAULT TOTAL TVL</span>
              <span className="text-amber-400">+</span>
            </div>
            <div className="tabular-nums mt-2 text-2xl font-bold text-amber-300">
              ${formatUsdc(poolStats.totalLiquidity)}
            </div>
            <div className="mt-1 font-mono text-[11px] text-emerald-400">
              ▲ ACTIVE USDC LIQUIDITY
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/85 p-5 shadow-lg transition hover:border-cyan-500/40">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[02] AVAILABLE CREDIT</span>
              <span className="text-cyan-400">+</span>
            </div>
            <div className="tabular-nums mt-2 text-2xl font-bold text-cyan-300">
              ${formatUsdc(poolStats.availableLiquidity)}
            </div>
            <div className="mt-1 font-mono text-[11px] text-slate-400">
              IDLE POOL CAPACITY
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/85 p-5 shadow-lg transition hover:border-amber-500/40">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[03] 4-TIER CAPS</span>
              <span className="text-amber-400">+</span>
            </div>
            <div className="tabular-nums mt-2 text-2xl font-bold text-white">
              ${formatUsdc(config.tier1Cap, 0)}–${formatUsdc(config.tier4Cap, 0)}
            </div>
            <div className="mt-1 font-mono text-[11px] text-amber-300">
              50% ROLLING 8-AVG LTV
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/90 bg-slate-900/85 p-5 shadow-lg transition hover:border-cyan-500/40">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[04] WATERFALL SPLIT</span>
              <span className="text-cyan-400">+</span>
            </div>
            <div className="tabular-nums mt-2 text-2xl font-bold text-amber-300">
              {formatBps(config.waterfallSplitBps)} / {formatBps(10000 - config.waterfallSplitBps)}
            </div>
            <div className="mt-1 font-mono text-[11px] text-cyan-300">
              LOAN REPAY / DIRECT PAYOUT
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: ANIMATED MECHANISM MATRIX (ATOMIC WATERFALL SCHEMATIC) */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-cyan-400">
              ARCHITECTURE QUADRANT // SEC-02
            </span>
            <h2 className="mt-1 text-2xl font-bold uppercase tracking-tight text-white">
              Mechanism Matrix: Atomic Remittance Waterfall
            </h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
            <span>SETTLEMENT: ~5s FINALITY</span>
            <span>·</span>
            <span className="text-emerald-400">STRIKE ENGINE: 6-PERIOD GUARD</span>
          </div>
        </div>

        {/* Animated Node Flow Diagram */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 lg:flex-row">
          {/* Node 1: Origin Sender */}
          <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:w-1/4">
            <div className="flex items-center justify-between font-mono text-[10px] text-cyan-300">
              <span>NODE_A // ORIGIN</span>
              <span>[SEP-31]</span>
            </div>
            <div className="mt-2 text-lg font-bold text-white">100.00 USDC Inbound</div>
            <p className="mt-1 text-xs text-slate-400">
              Verified cross-border remittance via licensed Anchor or atomic{' '}
              <code className="text-slate-200">send_remittance()</code>.
            </p>
            <div className="mt-3 rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] text-amber-300">
              Protocol Fee: {formatBps(config.remitFeeBps)} (Cap ${formatUsdc(config.remitFeeCap, 0)})
            </div>
          </div>

          {/* Animated SVG Pulse Line 1 */}
          <div className="hidden w-24 items-center justify-center lg:flex">
            <svg className="h-10 w-full" fill="none" viewBox="0 0 120 40">
              <path d="M 0 20 L 112 20" stroke="#334155" strokeDasharray="4,4" strokeWidth="2" />
              <path d="M 0 20 L 112 20" stroke="#22d3ee" strokeDasharray="24,96" strokeWidth="2.5">
                <animate
                  attributeName="stroke-dashoffset"
                  dur="1.8s"
                  repeatCount="indefinite"
                  values="120;0"
                />
              </path>
              <polygon fill="#22d3ee" points="110,15 120,20 110,25" />
            </svg>
          </div>

          {/* Node 2: Soroban Core Router */}
          <div className="relative w-full rounded-2xl border border-amber-500/40 bg-gradient-to-b from-slate-900 to-amber-950/20 p-5 shadow-[0_0_25px_rgba(245,158,11,0.12)] lg:w-1/3">
            <span className="absolute -top-3 left-4 rounded bg-amber-400 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-950">
              EXECUTION CORE // SOROBAN V3
            </span>
            <div className="mt-1 flex items-center justify-between font-mono text-xs text-amber-300">
              <span>process_remittance_settlement()</span>
              <span className="animate-pulse">● ATOMIC</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Updates rolling 8-remittance average, verifies SEP-12 KYC standing, and checks
              active loan maturity (<code className="text-amber-200">due_at</code>) in one ledger
              transaction.
            </p>
            <div className="mt-3 rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] text-emerald-400">
              on_time ? {formatBps(config.waterfallSplitBps)}_loan_split : 100%_overdue_sweep
            </div>
          </div>

          {/* Animated SVG Split Paths */}
          <div className="hidden w-28 items-center justify-center lg:flex">
            <svg className="h-24 w-full" fill="none" viewBox="0 0 130 80">
              <path
                d="M 0 40 C 45 40, 65 16, 120 16"
                stroke="#334155"
                strokeDasharray="4,4"
                strokeWidth="2"
              />
              <path
                d="M 0 40 C 45 40, 65 64, 120 64"
                stroke="#334155"
                strokeDasharray="4,4"
                strokeWidth="2"
              />
              <path
                d="M 0 40 C 45 40, 65 16, 120 16"
                stroke="#10b981"
                strokeDasharray="24,100"
                strokeWidth="2.5"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  dur="1.8s"
                  repeatCount="indefinite"
                  values="124;0"
                />
              </path>
              <path
                d="M 0 40 C 45 40, 65 64, 120 64"
                stroke="#f59e0b"
                strokeDasharray="24,100"
                strokeWidth="2.5"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  dur="1.8s"
                  repeatCount="indefinite"
                  values="124;0"
                />
              </path>
              <polygon fill="#10b981" points="118,11 128,16 118,21" />
              <polygon fill="#f59e0b" points="118,59 128,64 118,69" />
            </svg>
          </div>

          {/* Node 3: Split Outputs */}
          <div className="w-full space-y-3 lg:w-1/4">
            <div className="rounded-xl border border-emerald-500/35 bg-slate-900/90 p-4">
              <div className="flex items-center justify-between font-mono text-[10px] text-emerald-400">
                <span>BRANCH 01 // RECIPIENT</span>
                <span>DIRECT</span>
              </div>
              <div className="mt-1 text-base font-bold text-white">
                {formatBps(10000 - config.waterfallSplitBps)} Net Remittance
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Forwarded immediately to family wallet in USDC.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/35 bg-slate-900/90 p-4">
              <div className="flex items-center justify-between font-mono text-[10px] text-amber-300">
                <span>BRANCH 02 // LP VAULT</span>
                <span>AUTO-REPAY</span>
              </div>
              <div className="mt-1 text-base font-bold text-white">
                {formatBps(config.waterfallSplitBps)} Loan Split (100% if Late)
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Settles principal + pro-rata LP yield.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 03: THREE CRYPTOGRAPHIC PILLARS */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-amber-400">
              IMMUTABLE PROTOCOL RULES // SEC-03
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Three Cryptographic Pillars of Non-Collateralized Lending
            </h2>
          </div>
          <a
            href={getExplorerContractUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-cyan-400 transition hover:text-cyan-300"
          >
            <span>Inspect Live Soroban Contract on Stellar Expert</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <Fingerprint className="h-5 w-5 text-emerald-400" />
              </div>
              <span className="font-mono text-[11px] text-slate-400">[PILLAR_01]</span>
            </div>
            <div className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
              SEP-12 Sybil Shield
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">1 Human = 1 Credit Vault</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Whitelisted Anchors verify government IDs off-chain and bind a salted SHA-256
              identity nullifier on-chain—preventing multi-wallet farming and suspending accounts
              after 6 overdue strikes until cured.
            </p>
            <div className="mt-auto pt-4 font-mono text-[11px] text-emerald-300">
              ◈ Salted Nullifier + LP/Borrower Isolation Guard
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 ring-1 ring-cyan-500/30">
                <TrendingUp className="h-5 w-5 text-cyan-400" />
              </div>
              <span className="font-mono text-[11px] text-slate-400">[PILLAR_02]</span>
            </div>
            <div className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
              Rolling 8-Inflow Cash-Flow Scoring
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              4-Tier Progressive Micro-Caps
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Verified remittance inflows compute a rolling 8-transfer average at{' '}
              <strong className="text-slate-200">50% LTV</strong>. After{' '}
              {config.minCyclesRequired} verified cycles, borrowers unlock Tier 1 ($
              {formatUsdc(config.tier1Cap, 0)}), scaling up to Tier 4 ($
              {formatUsdc(config.tier4Cap, 0)}).
            </p>
            <div className="mt-auto pt-4">
              <div className="mb-1 flex justify-between font-mono text-[10px] text-slate-400">
                <span>T1 (${formatUsdc(config.tier1Cap, 0)})</span>
                <span>T2 (${formatUsdc(config.tier2Cap, 0)})</span>
                <span>T3 (${formatUsdc(config.tier3Cap, 0)})</span>
                <span className="font-bold text-amber-300">T4 (${formatUsdc(config.tier4Cap, 0)})</span>
              </div>
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-1/4 bg-emerald-400" />
                <div className="h-full w-1/4 bg-cyan-400" />
                <div className="h-full w-1/4 bg-sky-400" />
                <div className="h-full w-1/4 bg-amber-400" />
              </div>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30">
                <SplitSquareVertical className="h-5 w-5 text-amber-400" />
              </div>
              <span className="font-mono text-[11px] text-slate-400">[PILLAR_03]</span>
            </div>
            <div className="mt-4 font-mono text-xs font-bold uppercase tracking-wider text-amber-400">
              Atomic Waterfall &amp; LP Recovery
            </div>
            <h3 className="mt-1 text-lg font-semibold text-white">
              {formatBps(config.waterfallSplitBps)} Auto-Repay /{' '}
              {formatBps(10000 - config.waterfallSplitBps)} Direct
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Incoming remittances repay active loans automatically inside{' '}
              <code className="text-slate-200">send_remittance()</code>. Any default drawdown is
              reimbursed to LPs first with 100% of accrued default fees upon account
              rehabilitation.
            </p>
            <div className="mt-auto pt-4 font-mono text-[11px] text-amber-300">
              ◈ Pro-Rata Idle Liquidity &amp; Default Shield
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 04: INTERACTIVE CASH-FLOW & CREDIT UNLOCK SIMULATOR */}
      <section className="rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-cyan-400">
              <Sliders className="h-3.5 w-3.5" />
              ALGORITHMIC SIMULATOR // QUADRANT-04
            </span>
            <h2 className="mt-1 text-2xl font-bold uppercase tracking-tight text-white">
              Interactive Credit Unlock &amp; Waterfall Simulator
            </h2>
          </div>
          <span className="font-mono text-xs text-amber-300">
            FORMULA: MIN(ROLLING_8_AVG × 50%, TIER_CAP)
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Sliders */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
              <div className="mb-2 flex items-center justify-between font-mono text-xs">
                <span className="text-slate-300">01 // AVG NET REMITTANCE INFLOW</span>
                <span className="text-base font-bold text-amber-300">
                  ${simMonthlyInflow.toFixed(0)} USDC
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={1200}
                step={25}
                value={simMonthlyInflow}
                onChange={(e) => setSimMonthlyInflow(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-amber-400"
              />
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
                <span>$50 MIN</span>
                <span>$400 TIER-4 THRESHOLD</span>
                <span>$1,200 MAX</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="mb-2 flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-300">02 // VERIFIED CYCLES</span>
                  <span className="text-sm font-bold text-cyan-300">{simCycles} Cycles</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={simCycles}
                  onChange={(e) => setSimCycles(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
                />
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
                  <span>1</span>
                  <span>3 (T1)</span>
                  <span>15 (T4)</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                <div className="mb-2 flex items-center justify-between font-mono text-xs">
                  <span className="text-slate-300">03 // LOANS REPAID</span>
                  <span className="text-sm font-bold text-emerald-400">{simLoansRepaid} Paid</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={1}
                  value={simLoansRepaid}
                  onChange={(e) => setSimLoansRepaid(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-emerald-400"
                />
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
                  <span>0</span>
                  <span>1 (T2)</span>
                  <span>4+ (T4)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Output Panel */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-5 lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-slate-400">
                CALCULATED TIER SPEC
              </span>
              <span className="rounded bg-amber-400/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-300 ring-1 ring-amber-400/35">
                {simTierLabel}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="font-mono text-[10px] uppercase text-slate-400">
                MAX ZERO-COLLATERAL CREDIT LIMIT
              </div>
              <div className="tabular-nums mt-1 text-3xl font-extrabold text-emerald-400">
                ${simCreditLimit.toFixed(2)}{' '}
                <span className="text-sm font-medium text-slate-400">USDC</span>
              </div>
              <div className="mt-1 font-mono text-[11px] text-cyan-300">
                {simTier > 0
                  ? `50% of $${simMonthlyInflow} avg (Capped at $${simHardCap} Tier ${simTier})`
                  : `Complete ${config.minCyclesRequired} verified cycles to unlock Tier 1`}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between font-mono text-[11px] text-slate-400">
                <span>ON-TIME REMITTANCE SPLIT</span>
                <span className="text-white">
                  {formatBps(config.waterfallSplitBps)} /{' '}
                  {formatBps(10000 - config.waterfallSplitBps)}
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-950">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${waterfallRepayRatio * 100}%` }}
                />
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${waterfallDirectRatio * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                <div className="rounded-lg bg-slate-950 p-2.5">
                  <span className="block text-[10px] text-amber-300">
                    {formatBps(config.waterfallSplitBps)} LOAN REPAY
                  </span>
                  <span className="font-bold text-white">${simRepayAmount.toFixed(2)} USDC</span>
                </div>
                <div className="rounded-lg bg-slate-950 p-2.5">
                  <span className="block text-[10px] text-emerald-400">
                    {formatBps(10000 - config.waterfallSplitBps)} FAMILY DIRECT
                  </span>
                  <span className="font-bold text-white">${simFamilyAmount.toFixed(2)} USDC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 05: LIVE ON-CHAIN PROTOCOL PARAMETER MATRIX */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
              PARAMETERS &amp; RISK ENGINE // SEC-05
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Institutional Guardrails &amp; Live Contract Parameters
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('status')}
            className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-amber-300 transition hover:text-amber-200"
          >
            <Cpu className="h-4 w-4" />
            <span>Open Full Telemetry &amp; Keeper Status →</span>
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800/90 bg-slate-900/75 shadow-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/90 font-mono text-[11px] uppercase text-cyan-300">
                <th className="px-5 py-3.5">Parameter Specification</th>
                <th className="px-5 py-3.5">Live On-Chain Value</th>
                <th className="px-5 py-3.5">Contract Enforcement</th>
                <th className="px-5 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono">
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-semibold text-white">Borrower Loan Maturity</td>
                <td className="px-5 py-3.5 text-amber-300">Fixed 30 Days</td>
                <td className="px-5 py-3.5 text-slate-400">borrow(beneficiary, principal, 2_592_000)</td>
                <td className="px-5 py-3.5 text-right text-emerald-400">ENFORCED</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-semibold text-white">Remittance Protocol Fee</td>
                <td className="px-5 py-3.5 text-slate-200">
                  {formatBps(config.remitFeeBps)} (Capped at ${formatUsdc(config.remitFeeCap, 0)} USDC)
                </td>
                <td className="px-5 py-3.5 text-slate-400">Protocol Risk &amp; Reserve Routing</td>
                <td className="px-5 py-3.5 text-right text-emerald-400">ACTIVE</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-semibold text-white">Loan Fee &amp; Yield Split</td>
                <td className="px-5 py-3.5 text-cyan-300">
                  {formatBps(config.loanFeeBps)} Flat ({formatBps(10000 - config.backstopFeeBps)} LP Yield)
                </td>
                <td className="px-5 py-3.5 text-slate-400">Pro-Rata Share Yield Distribution</td>
                <td className="px-5 py-3.5 text-right text-emerald-400">ACTIVE</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-semibold text-white">Default &amp; LP Recovery</td>
                <td className="px-5 py-3.5 text-rose-300">
                  6 Overdue Strikes (+50% Cure Penalty)
                </td>
                <td className="px-5 py-3.5 text-slate-400">
                  LPs Reimbursed Principal + 100% Strike Fees First
                </td>
                <td className="px-5 py-3.5 text-right text-amber-300">SYBIL_LOCKED</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="px-5 py-3.5 font-semibold text-white">Stellar Anchor Rails</td>
                <td className="px-5 py-3.5 text-slate-200">SEP-12 KYC &amp; SEP-31 Remittance</td>
                <td className="px-5 py-3.5 text-slate-400">Salted SHA-256 Identity Nullifier</td>
                <td className="px-5 py-3.5 text-right text-cyan-300">TESTNET_READY</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bottom Guardrails & Verification Strip */}
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 md:grid-cols-2">
          <div className="flex items-start gap-3">
            <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                SEP-31 Corridor &amp; Atomic Router
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Single-transaction cross-border remittances with stateless serverless event
                indexing and 60-day persistent ledger TTL extensions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Pro-Rata Pool Protection
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Mutual-exclusion guards prevent circular self-borrowing, and idle cash is split
                pro-rata across all LPs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/80 px-4 py-3 font-mono text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Deployed &amp; verified on Stellar Soroban Testnet ({shortContractId})</span>
          </div>
          <a
            href={getExplorerContractUrl()}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-cyan-400 transition hover:text-cyan-300"
          >
            Verify Contract Bytecode on Stellar Expert ↗
          </a>
        </div>
      </section>
    </div>
  );
};