import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Cpu,
  History,
  Landmark,
  Layers,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { BorrowModal } from '@/components/borrower/BorrowModal';
import { CreditScoreGauge } from '@/components/borrower/CreditScoreGauge';
import { VaultCard } from '@/components/borrower/VaultCard';
import { getExplorerContractUrl, STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import {
  ActiveLoanData,
  BorrowerProfileData,
  PoolStatsData,
  ProtocolConfigData,
} from '@/hooks/useBorrowerProfile';
import { KycStanding } from '@/hooks/useKycStatus';
import { formatBps, formatUnixToIST, formatUsdc } from '@/utils/stroops';

interface BorrowerDashboardPageProps {
  profile: BorrowerProfileData;
  activeLoan: ActiveLoanData | null;
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  usdcBalance: bigint;
  lpDeposit?: bigint;
  lpShares?: bigint;
  kycStatus: KycStanding;
  keeperOnline: boolean;
  onRefreshAll: () => Promise<void>;
}

export const BorrowerDashboardPage: React.FC<BorrowerDashboardPageProps> = ({
  profile,
  activeLoan,
  poolStats,
  config,
  usdcBalance,
  lpDeposit = 0n,
  lpShares = 0n,
  kycStatus,
  keeperOnline,
  onRefreshAll,
}) => {
  const { address, setActivePage } = useWallet();
  const [modalState, setModalState] = useState<{
    mode: 'borrow' | 'repay' | null;
    prefillFullRepay: boolean;
  }>({ mode: null, prefillFullRepay: false });

  const shortContractId =
    STELLAR_CONFIG.remitContractId.length > 12
      ? `${STELLAR_CONFIG.remitContractId.slice(0, 6)}...${STELLAR_CONFIG.remitContractId.slice(-6)}`
      : STELLAR_CONFIG.remitContractId;

  const effectiveMaxBorrow =
    profile.maxCreditLimit < poolStats.availableLiquidity
      ? profile.maxCreditLimit
      : poolStats.availableLiquidity;

  const utilizationPct =
    poolStats.totalLiquidity > 0n
      ? Number((poolStats.totalLent * 100n) / poolStats.totalLiquidity)
      : 0;

  return (
    <div className="space-y-6 pb-10">
      {/* Architectural Vault Header Monolith */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        {/* CAD Coordinate Grid Overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_90%)]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="vaultCadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.85" />
                <circle cx="40" cy="40" r="1" fill="#22d3ee" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#vaultCadGrid)" />
          </svg>
        </div>

        {/* Ambient Glows & Architectural Corner Marks */}
        <div className="pointer-events-none absolute -top-20 right-12 h-64 w-64 rounded-full bg-amber-500/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />
        <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-cyan-400/70">
          ⌜ SEC_03 // CREDIT_VAULT ⌝
        </span>
        <span className="pointer-events-none absolute right-4 top-3 select-none font-mono text-[10px] text-slate-600">
          [+]
        </span>

        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
              <span className="font-bold text-amber-400">◈ UNDERCOLLATERALIZED CREDIT ENGINE</span>
              <span className="text-slate-600">//</span>
              <span className="text-cyan-300">50% ROLLING 8-INFLOW LTV</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Borrower Credit Vault &amp; Cash-Flow Underwriting
            </h1>
            <p className="max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
              Draw instant USDC liquidity with <span className="font-semibold text-emerald-400">0% upfront crypto collateral</span>, backed by your verified SEP-31 remittance stream and settled automatically via the{' '}
              <span className="font-semibold text-amber-300">{formatBps(config.waterfallSplitBps)}</span> repayment waterfall.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold ${
                keeperOnline
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  keeperOnline ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {keeperOnline ? 'KEEPER_SYNC: ONLINE' : 'KEEPER_SYNC: STANDBY'}
            </span>

            <a
              href={getExplorerContractUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
            >
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>{shortContractId}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* 4 Tectonic Borrower Telemetry Slabs */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-5 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[01] WALLET USDC</span>
              <span className="text-emerald-400">+</span>
            </div>
            <div className="tabular-nums mt-1 text-lg font-bold text-white">
              ${formatUsdc(usdcBalance)}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-500">LIQUID BALANCE</div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[02] DRAWABLE LIMIT</span>
              <span className="text-amber-400">+</span>
            </div>
            <div className="tabular-nums mt-1 text-lg font-bold text-emerald-400">
              ${formatUsdc(effectiveMaxBorrow)}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-amber-300">
              TIER {profile.creditTier} · 50% AVG LTV
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[03] ROLLING 8-AVG</span>
              <span className="text-cyan-400">+</span>
            </div>
            <div className="tabular-nums mt-1 text-lg font-bold text-cyan-300">
              ${formatUsdc(profile.avgCycleAmount)}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-400">
              {profile.remittanceCycles} VERIFIED CYCLES
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-950/80 p-3.5">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[04] POOL LIQUIDITY</span>
              <span className="text-sky-400">+</span>
            </div>
            <div className="tabular-nums mt-1 text-lg font-bold text-sky-300">
              ${formatUsdc(poolStats.availableLiquidity)}
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-400">
              UTILIZATION: {utilizationPct}%
            </div>
          </div>
        </div>
      </section>

      {/* Primary Underwriting & Credit Vault Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <CreditScoreGauge profile={profile} config={config} />
        </div>
        <div className="lg:col-span-7">
          <VaultCard
            isConnected={Boolean(address)}
            profile={profile}
            activeLoan={activeLoan}
            poolStats={poolStats}
            config={config}
            kycStatus={kycStatus}
            lpShares={lpShares}
            lpDeposit={lpDeposit}
            onOpenBorrow={() => {
              if (kycStatus !== 'VERIFIED') {
                setActivePage('kyc');
                return;
              }
              setModalState({ mode: 'borrow', prefillFullRepay: false });
            }}
            onOpenRepay={(payFull = false) =>
              setModalState({ mode: 'repay', prefillFullRepay: payFull })
            }
            onRehabilitated={onRefreshAll}
          />
        </div>
      </div>

      {/* Borrower Underwriting Rules & Quick Route Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Active Underwriting Telemetry */}
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-xl lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                On-Chain Underwriting &amp; Waterfall Mechanics
              </h3>
            </div>
            <span className="font-mono text-[10px] text-cyan-400">SOROBAN_V3_RULES</span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                On-Time Waterfall ({formatBps(config.waterfallSplitBps)})
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Incoming remittances before <code className="text-slate-200">due_at</code> route{' '}
                <strong className="text-white">{formatBps(config.waterfallSplitBps)}</strong> of
                total debt to the pool and forward the rest directly to your wallet.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-amber-300">
                <Clock className="h-3.5 w-3.5" />
                Overdue Sweep &amp; 6-Strike Guard
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Overdue remittances sweep <strong className="text-white">100%</strong> of remaining
                debt. Each missed period adds +{formatBps(config.loanFeeBps)} up to 6 strikes.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-cyan-300">
                <Sparkles className="h-3.5 w-3.5" />
                4-Tier Progressive Caps
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                T1 <strong className="text-white">${formatUsdc(config.tier1Cap, 0)}</strong> · T2{' '}
                <strong className="text-white">${formatUsdc(config.tier2Cap, 0)}</strong> · T3{' '}
                <strong className="text-white">${formatUsdc(config.tier3Cap, 0)}</strong> · T4{' '}
                <strong className="text-emerald-300">${formatUsdc(config.tier4Cap, 0)}</strong>{' '}
                capped at 50% of rolling 8-inflow average.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-sky-300">
                <CalendarClock className="h-3.5 w-3.5" />
                Last Remittance &amp; Repayment
              </div>
              <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-slate-300">
                Inflow:{' '}
                <span className="text-white">
                  {profile.lastRemittanceTs > 0n
                    ? formatUnixToIST(profile.lastRemittanceTs)
                    : 'No inflows yet'}
                </span>
                <br />
                Repaid:{' '}
                <span className="text-emerald-300">
                  {profile.lastRepaidTs > 0n
                    ? formatUnixToIST(profile.lastRepaidTs)
                    : `${profile.loansRepaidCount} loans closed`}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Dedicated Navigation Shortcuts to Send Remittance, History & LP Pool */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-xl lg:col-span-5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Protocol Modules
                </h3>
              </div>
              <span className="font-mono text-[10px] text-slate-400">DIRECT_ROUTES</span>
            </div>

            <div className="mt-4 space-y-2.5">
              <button
                type="button"
                onClick={() => setActivePage('remit')}
                className="group flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-left transition hover:border-amber-500/40 hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                    <Send className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300">
                      Send Cross-Border Remittance
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Trigger SEP-31 wire or atomic USDC transfer
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-amber-300" />
              </button>

              <button
                type="button"
                onClick={() => setActivePage('history')}
                className="group flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-left transition hover:border-cyan-500/40 hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                    <History className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                      Account Ledger &amp; Waterfall History
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Audit IST receipts, splits &amp; CSV exports
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
              </button>

              <button
                type="button"
                onClick={() => setActivePage('pool')}
                className="group flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-left transition hover:border-emerald-500/40 hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-emerald-300">
                      USDC Liquidity Pool &amp; Backstop
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Inspect TVL, LP yield &amp; First-Loss Reserve
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3 font-mono text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              SEP-12 / SEP-31 VERIFIED
            </span>
            <span className="inline-flex items-center gap-1">
              <Activity className="h-3.5 w-3.5 text-cyan-400" />
              0% COLLATERAL VAULT
            </span>
          </div>
        </div>
      </div>

      {/* Borrow / Direct Repayment Modal */}
      <BorrowModal
        isOpen={modalState.mode !== null}
        mode={modalState.mode || 'borrow'}
        prefillFullRepay={modalState.prefillFullRepay}
        profile={profile}
        activeLoan={activeLoan}
        poolStats={poolStats}
        config={config}
        usdcBalance={usdcBalance}
        onClose={() => setModalState({ mode: null, prefillFullRepay: false })}
        onSuccess={onRefreshAll}
      />
    </div>
  );
};