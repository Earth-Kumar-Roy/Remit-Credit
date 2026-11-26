import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CalendarClock,
  CheckCircle2,
  Clock,
  Droplets,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SplitSquareVertical,
} from 'lucide-react';
import { STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import {
  ActiveLoanData,
  BorrowerProfileData,
  PoolStatsData,
  ProtocolConfigData,
} from '@/hooks/useBorrowerProfile';
import { KycStanding } from '@/hooks/useKycStatus';
import { useRemitContract } from '@/hooks/useRemitContract';
import { formatBps, formatDueCountdown, formatUnixToIST, formatUsdc } from '@/utils/stroops';

interface VaultCardProps {
  isConnected: boolean;
  profile: BorrowerProfileData;
  activeLoan: ActiveLoanData | null;
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  kycStatus: KycStanding;
  lpShares?: bigint;
  lpDeposit?: bigint;
  onOpenBorrow: () => void;
  onOpenRepay: (payFull?: boolean) => void;
  onRehabilitated?: () => Promise<void>;
}

/**
 * Mirrors on-chain `apply_overdue_penalties` in real time so strikes, accrued penalty fees,
 * and remaining debt update live every second once `dueAt` is passed.
 */
export function projectLiveLoanState(
  loan: ActiveLoanData,
  config: ProtocolConfigData,
  nowSecs: bigint
): {
  liveLatePeriods: number;
  liveTotalOwed: bigint;
  liveRemainingDebt: bigint;
  pendingPenaltyFee: bigint;
  effectiveDueAt: bigint;
  isDefaultedNow: boolean;
} {
  const periodSecs =
    loan.periodDurationSecs && loan.periodDurationSecs > 0n
      ? loan.periodDurationSecs
      : config.loanDurationSecs > 0n
      ? config.loanDurationSecs
      : 2_592_000n;
  let liveLatePeriods = loan.latePeriods;
  let liveTotalOwed = loan.totalOwed;
  let liveRemainingDebt = loan.remainingDebt;
  let effectiveDueAt = loan.dueAt;

  if (!loan.isDefaulted && loan.remainingDebt > 0n && nowSecs > effectiveDueAt && liveLatePeriods < 6) {
    const overdueSecs = nowSecs - effectiveDueAt;
    const newlyElapsed = Number(overdueSecs / periodSecs) + 1;
    const maxAddable = 6 - liveLatePeriods;
    const periodsToAdd = Math.min(newlyElapsed, maxAddable);

    if (periodsToAdd > 0) {
      const feePerPeriod = (loan.principal * BigInt(config.loanFeeBps)) / 10_000n;
      const addedFee = feePerPeriod * BigInt(periodsToAdd);

      liveLatePeriods += periodsToAdd;
      liveTotalOwed += addedFee;
      liveRemainingDebt += addedFee;
      effectiveDueAt += periodSecs * BigInt(periodsToAdd);
    }
  }

  return {
    liveLatePeriods,
    liveTotalOwed,
    liveRemainingDebt,
    pendingPenaltyFee: liveRemainingDebt - loan.remainingDebt,
    effectiveDueAt,
    isDefaultedNow: loan.isDefaulted || liveLatePeriods >= 6,
  };
}

export const VaultCard: React.FC<VaultCardProps> = ({
  isConnected,
  profile,
  activeLoan,
  poolStats,
  config,
  kycStatus,
  lpShares = 0n,
  lpDeposit = 0n,
  onOpenBorrow,
  onOpenRepay,
  onRehabilitated,
}) => {
  const { address, setActivePage } = useWallet();
  const { rehabilitateAccount } = useRemitContract();
  const [nowSecs, setNowSecs] = useState<bigint>(() => BigInt(Math.floor(Date.now() / 1000)));
  const [isRehabbing, setIsRehabbing] = useState<boolean>(false);
  const [rehabError, setRehabError] = useState<string | null>(null);
  const slashTriggeredRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowSecs(BigInt(Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const isKycOk = kycStatus === 'VERIFIED';
  const isBanned = kycStatus === 'BANNED' || profile.hasDefaulted;
  const hasPoolLiquidity = poolStats.availableLiquidity > 0n;
  const hasActiveLpPosition = lpShares > 0n;

  const liveLoan = activeLoan ? projectLiveLoanState(activeLoan, config, nowSecs) : null;

  // Automatically trigger keeper `slash_default` on-chain the moment 6 overdue strikes are reached
  useEffect(() => {
    if (!address || !activeLoan || !liveLoan?.isDefaultedNow || isBanned) return;
    const loanKey = `${address}:${activeLoan.originatedAt.toString()}`;
    if (slashTriggeredRef.current === loanKey) return;
    slashTriggeredRef.current = loanKey;

    fetch(`${STELLAR_CONFIG.keeperApiUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: address,
        check_overdue: true,
      }),
    })
      .then(async (res) => {
        if (res.ok && onRehabilitated) {
          await onRehabilitated();
        }
      })
      .catch(() => {
        slashTriggeredRef.current = null;
      });
  }, [address, activeLoan, liveLoan?.isDefaultedNow, isBanned, onRehabilitated]);

  const defaultedDebt = profile.defaultedDebtOwed ?? 0n;
  const rehabPenalty = (defaultedDebt * 5_000n) / 10_000n;
  const totalCurePayment = defaultedDebt + rehabPenalty;

  const handleLiftBan = async () => {
    setRehabError(null);
    setIsRehabbing(true);
    try {
      await rehabilitateAccount();
      if (onRehabilitated) {
        await onRehabilitated();
      }
    } catch (err) {
      setRehabError(err instanceof Error ? err.message : 'Failed to lift account suspension.');
    } finally {
      setIsRehabbing(false);
    }
  };

  const cooldownEndsAt = profile.lastRepaidTs + config.postRepayCooldownSecs;
  const cooldownRemaining =
    profile.lastRepaidTs > 0n && nowSecs < cooldownEndsAt
      ? Number(cooldownEndsAt - nowSecs)
      : 0;

  const effectiveMaxBorrow =
    profile.maxCreditLimit < poolStats.availableLiquidity
      ? profile.maxCreditLimit
      : poolStats.availableLiquidity;

  const isEligible =
    isConnected &&
    isKycOk &&
    !isBanned &&
    !hasActiveLpPosition &&
    !profile.needsCleanCycle &&
    cooldownRemaining === 0 &&
    profile.remittanceCycles >= config.minCyclesRequired &&
    effectiveMaxBorrow > 0n &&
    !activeLoan;

  const repaidAmount =
    activeLoan && liveLoan ? liveLoan.liveTotalOwed - liveLoan.liveRemainingDebt : 0n;

  const repaymentPct =
    activeLoan && liveLoan && liveLoan.liveTotalOwed > 0n
      ? Number((repaidAmount * 100n) / liveLoan.liveTotalOwed)
      : 0;

  const dueInfo =
    activeLoan && liveLoan
      ? liveLoan.liveLatePeriods > 0
        ? {
            isOverdue: true,
            label: `OVERDUE · STRIKE ${liveLoan.liveLatePeriods}/6`,
          }
        : formatDueCountdown(activeLoan.dueAt)
      : null;

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
      {/* Subtle CAD Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-15">
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="vaultCardCadGrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1e293b" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#vaultCardCadGrid)" />
        </svg>
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
      <span className="pointer-events-none absolute left-3 top-2 select-none font-mono text-[9px] text-slate-500">
        ⌜ VAULT_EXECUTION_CORE ⌝
      </span>
      <span className="pointer-events-none absolute right-3 top-2 select-none font-mono text-[9px] text-amber-400/70">
        [+]
      </span>

      <div className="relative z-10 mt-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
              ◈ ZERO-COLLATERAL CREDIT FACILITY
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <h2 className="text-base font-bold text-white">
                Undercollateralized Credit Vault
              </h2>
              {isKycOk && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300 ring-1 ring-emerald-500/35">
                  <ShieldCheck className="h-3 w-3" />
                  SEP-12 BOUND
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              0% upfront crypto collateral · Backed by rolling 8-remittance average (50% LTV) &amp; LP Vault
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5 font-mono text-[11px] font-bold text-cyan-300">
            <SplitSquareVertical className="h-3.5 w-3.5" />
            {formatBps(config.waterfallSplitBps)} SPLIT
          </div>
        </div>

        {/* Primary Credit Limit / Active Debt Tectonic Block */}
        <div className="mt-5 rounded-xl border border-slate-800/90 bg-slate-950/90 p-4">
          {activeLoan && liveLoan ? (
            <div className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400">
                  ● ACTIVE LOAN · REMAINING DEBT
                </span>
                <div className="flex items-center gap-1.5 font-mono">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ${
                      liveLoan.liveLatePeriods > 0
                        ? 'bg-rose-500/15 text-rose-300 ring-rose-500/40'
                        : 'bg-slate-900 text-slate-300 ring-slate-700'
                    }`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    STRIKES: {liveLoan.liveLatePeriods}/6
                  </span>
                  {dueInfo && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[10px] font-bold ring-1 ${
                        dueInfo.isOverdue || liveLoan.isDefaultedNow
                          ? 'bg-rose-500/15 text-rose-300 ring-rose-500/40'
                          : 'bg-amber-500/15 text-amber-300 ring-amber-500/35'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      {dueInfo.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-baseline gap-2.5">
                <div className="tabular-nums font-mono text-3xl font-extrabold text-white">
                  {formatUsdc(liveLoan.liveRemainingDebt)}{' '}
                  <span className="text-sm font-semibold text-cyan-400">USDC</span>
                </div>
                {liveLoan.pendingPenaltyFee > 0n && (
                  <span className="rounded-md bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-300 ring-1 ring-rose-500/35">
                    +{formatUsdc(liveLoan.pendingPenaltyFee)} USDC LATE FEE
                  </span>
                )}
              </div>

              {/* Explicit Due Date & Principal Breakdown Matrix */}
              <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-800/90 bg-slate-900/75 p-3 font-mono text-xs sm:grid-cols-2">
                <div>
                  <div className="text-[10px] uppercase text-slate-400">
                    PRINCIPAL + FEES ({liveLoan.liveLatePeriods} STRIKES)
                  </div>
                  <div className="tabular-nums mt-0.5 font-bold text-slate-200">
                    {formatUsdc(activeLoan.principal)} +{' '}
                    {formatUsdc(liveLoan.liveTotalOwed - activeLoan.principal)} ={' '}
                    {formatUsdc(liveLoan.liveTotalOwed)} USDC
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-[10px] uppercase text-amber-300">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {liveLoan.liveLatePeriods > 0
                      ? 'NEXT STRIKE WINDOW (IST)'
                      : '30-DAY MATURITY (IST)'}
                  </div>
                  <div className="tabular-nums mt-0.5 font-bold text-white">
                    {formatUnixToIST(liveLoan.effectiveDueAt)}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between font-mono text-[11px] text-slate-400">
                  <span>REPAID VIA WATERFALL / DIRECT</span>
                  <span className="tabular-nums font-semibold text-emerald-400">
                    {formatUsdc(repaidAmount)} / {formatUsdc(liveLoan.liveTotalOwed)} USDC (
                    {repaymentPct}%)
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, repaymentPct)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className="uppercase tracking-wider text-slate-400">
                  AVAILABLE CREDIT CEILING
                </span>
                <span className="text-cyan-300">
                  FEE: {formatBps(config.loanFeeBps)} · TERM: FIXED 30D
                </span>
              </div>

              <div className="tabular-nums mt-1.5 font-mono text-3xl font-extrabold text-emerald-400">
                {formatUsdc(effectiveMaxBorrow)}{' '}
                <span className="text-sm font-semibold text-slate-400">USDC</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] text-slate-400">
                <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5">
                  T1: ${formatUsdc(config.tier1Cap, 0)}
                </span>
                <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5">
                  T2: ${formatUsdc(config.tier2Cap, 0)}
                </span>
                <span className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5">
                  T3: ${formatUsdc(config.tier3Cap, 0)}
                </span>
                <span className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-amber-300">
                  T4 MAX: ${formatUsdc(config.tier4Cap, 0)}
                </span>
                <span className="rounded-md border border-cyan-500/35 bg-cyan-500/10 px-2 py-0.5 text-cyan-300">
                  LP IDLE: ${formatUsdc(poolStats.availableLiquidity)}
                </span>
              </div>

              {!hasPoolLiquidity && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-sky-500/35 bg-sky-950/40 p-2.5 text-[11px] text-sky-200">
                  <Droplets className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span>
                    <strong>LP Vault Liquidity is 0.00 USDC:</strong> Incoming remittances still
                    credit your wallet and build your score, but Liquidity Providers must supply
                    USDC in the{' '}
                    <button
                      type="button"
                      onClick={() => setActivePage('pool')}
                      className="font-semibold underline hover:text-white"
                    >
                      Liquidity Pool
                    </button>{' '}
                    before zero-collateral credit draws can be funded.
                  </span>
                </div>
              )}

              <p className="mt-2.5 text-xs text-slate-400">
                When active, on-time incoming remittances deduct{' '}
                <span className="font-semibold text-amber-300">
                  {formatBps(config.waterfallSplitBps)}
                </span>{' '}
                of your total loan obligation, while overdue remittances automatically clear{' '}
                <span className="font-semibold text-emerald-300">100%</span> of remaining debt.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 mt-5">
        {!isConnected ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 font-mono text-xs text-slate-400">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span>Connect your Freighter wallet to view credit eligibility and draw USDC.</span>
          </div>
        ) : isBanned ? (
          <div className="space-y-3 rounded-xl border border-rose-500/40 bg-rose-950/60 p-4 text-xs text-rose-200">
            <div className="flex items-start gap-2">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <div>
                <div className="font-bold text-white">
                  Account &amp; SEP-12 Identity Suspended (6 Overdue Strikes)
                </div>
                <p className="mt-1 text-rose-200/90">
                  To lift this ban and reimburse LP / First-Loss Backstop reserves, settle your
                  defaulted balance plus a <strong>50% rehabilitation fee</strong>. Your credit
                  history will reset to Tier 0 (0 cycles).
                </p>
                {defaultedDebt > 0n && (
                  <div className="tabular-nums mt-2 rounded-lg border border-rose-500/30 bg-slate-950/80 px-3 py-2 font-mono text-[11px]">
                    DEBT: <strong>{formatUsdc(defaultedDebt)} USDC</strong> + 50% PENALTY:{' '}
                    <strong>{formatUsdc(rehabPenalty)} USDC</strong> ={' '}
                    <span className="font-bold text-white">
                      {formatUsdc(totalCurePayment)} USDC
                    </span>
                  </div>
                )}
              </div>
            </div>

            {rehabError && (
              <div className="rounded-lg border border-rose-400/40 bg-rose-900/50 px-3 py-2 text-[11px] text-rose-100">
                {rehabError}
              </div>
            )}

            <button
              type="button"
              onClick={handleLiftBan}
              disabled={isRehabbing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition hover:from-amber-300 hover:to-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRehabbing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing Rehabilitation Settlement...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {totalCurePayment > 0n
                      ? `Lift Ban & Reset Credit (${formatUsdc(totalCurePayment)} USDC)`
                      : 'Lift Ban & Reset Credit'}
                  </span>
                </>
              )}
            </button>
          </div>
        ) : activeLoan && liveLoan ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onOpenRepay(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:from-emerald-300 hover:to-cyan-300"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Pay Full ({formatUsdc(liveLoan.liveRemainingDebt)} USDC)</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenRepay(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/25"
            >
              <span>Partial / Custom</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        ) : !isKycOk ? (
          <button
            type="button"
            onClick={() => setActivePage('kyc')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/45 bg-amber-500/15 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/25"
          >
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>[ ◈ Complete SEP-12 KYC to Unlock Borrowing ]</span>
          </button>
        ) : hasActiveLpPosition ? (
          <div className="space-y-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-3.5 text-xs text-cyan-200">
            <div className="flex items-start gap-2">
              <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
              <span>
                You currently hold <strong>{formatUsdc(lpDeposit)} USDC</strong> in the LP Vault.
                Borrowing is disabled while supplying liquidity — withdraw your LP funds instead.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('pool')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300"
            >
              <Droplets className="h-4 w-4" />
              <span>Withdraw Your LP Liquidity ({formatUsdc(lpDeposit)} USDC)</span>
            </button>
          </div>
        ) : profile.needsCleanCycle ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-950/50 px-4 py-3 text-xs text-amber-200">
            <Clock className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Previous loan was repaid late. Complete <strong>1 clean remittance cycle</strong> to
              unlock your next borrow.
            </span>
          </div>
        ) : cooldownRemaining > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-cyan-500/35 bg-cyan-950/40 px-4 py-3 font-mono text-xs text-cyan-200">
            <Clock className="h-4 w-4 shrink-0 text-cyan-400" />
            <span>
              POST-REPAYMENT COOLDOWN: UNLOCKS IN <strong>{cooldownRemaining}S</strong>
            </span>
          </div>
        ) : !hasPoolLiquidity ? (
          <button
            type="button"
            onClick={() => setActivePage('pool')}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/25"
          >
            <Droplets className="h-4 w-4 text-cyan-400" />
            <span>[ ⊞ LP Pool Empty (0 USDC) · Supply Liquidity First ]</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenBorrow}
            disabled={!isEligible}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-4 py-3.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:from-slate-800 disabled:via-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {isEligible
                ? `[ ⬡ Draw Instant USDC Credit (Up to ${formatUsdc(effectiveMaxBorrow)} USDC) ]`
                : `Complete ${config.minCyclesRequired} Remittance Cycles (${profile.remittanceCycles}/${config.minCyclesRequired})`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};