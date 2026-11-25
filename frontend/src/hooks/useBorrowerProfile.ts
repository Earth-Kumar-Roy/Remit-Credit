import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { useRemitContract } from '@/hooks/useRemitContract';

export interface BorrowerProfileData {
  isKycVerified: boolean;
  hasDefaulted: boolean;
  defaultedDebtOwed: bigint;
  needsCleanCycle: boolean;
  creditScore: number;
  creditTier: number;
  remittanceCycles: number;
  totalRemitted: bigint;
  avgCycleAmount: bigint;
  maxCreditLimit: bigint;
  lastRemittanceTs: bigint;
  lastRepaidTs: bigint;
  loansRepaidCount: number;
}

export interface ActiveLoanData {
  principal: bigint;
  totalOwed: bigint;
  remainingDebt: bigint;
  originatedAt: bigint;
  dueAt: bigint;
  periodDurationSecs: bigint;
  latePeriods: number;
  isDefaulted: boolean;
}

export interface PoolStatsData {
  totalLiquidity: bigint;
  totalShares: bigint;
  totalLent: bigint;
  availableLiquidity: bigint;
  totalYieldEarned: bigint;
  backstopReserve: bigint;
  uncoveredLpLoss: bigint;
}

export interface LpPositionBreakdown {
  shares: bigint;
  netPrincipalDeposited: bigint;
  shareValue: bigint;
  netProfitOrLoss: bigint;
  lockedInActiveLoans: bigint;
  withdrawableNow: bigint;
  poolShareBps: number;
}

export interface ProtocolConfigData {
  minCyclesRequired: number;
  minCycleIntervalSecs: bigint;
  postRepayCooldownSecs: bigint;
  remitFeeBps: number;
  remitFeeCap: bigint;
  waterfallSplitBps: number;
  loanFeeBps: number;
  backstopFeeBps: number;
  tier1Cap: bigint;
  tier2Cap: bigint;
  tier3Cap: bigint;
  tier4Cap: bigint;
  loanDurationSecs: bigint;
  isPaused: boolean;
}

const DEFAULT_PROFILE: BorrowerProfileData = {
  isKycVerified: false,
  hasDefaulted: false,
  defaultedDebtOwed: 0n,
  needsCleanCycle: false,
  creditScore: 300,
  creditTier: 0,
  remittanceCycles: 0,
  totalRemitted: 0n,
  avgCycleAmount: 0n,
  maxCreditLimit: 0n,
  lastRemittanceTs: 0n,
  lastRepaidTs: 0n,
  loansRepaidCount: 0,
};

const DEFAULT_POOL: PoolStatsData = {
  totalLiquidity: 0n,
  totalShares: 0n,
  totalLent: 0n,
  availableLiquidity: 0n,
  totalYieldEarned: 0n,
  backstopReserve: 0n,
  uncoveredLpLoss: 0n,
};

const DEFAULT_LP_POSITION: LpPositionBreakdown = {
  shares: 0n,
  netPrincipalDeposited: 0n,
  shareValue: 0n,
  netProfitOrLoss: 0n,
  lockedInActiveLoans: 0n,
  withdrawableNow: 0n,
  poolShareBps: 0,
};

const DEFAULT_CONFIG: ProtocolConfigData = {
  minCyclesRequired: 3,
  minCycleIntervalSecs: 60n,
  postRepayCooldownSecs: 60n,
  remitFeeBps: 200,
  remitFeeCap: 150_000_000n,
  waterfallSplitBps: 4000,
  loanFeeBps: 250,
  backstopFeeBps: 2000,
  tier1Cap: 500_000_000n,
  tier2Cap: 1_000_000_000n,
  tier3Cap: 2_000_000_000n,
  tier4Cap: 4_000_000_000n,
  loanDurationSecs: 180n,
  isPaused: false,
};

const READ_ONLY_SOURCE = STELLAR_CONFIG.anchorPublicKey;

function tierToDisplayScore(tier: number, cycles: number, hasDefaulted: boolean): number {
  if (hasDefaulted) return 250;
  if (tier >= 4) return 830;
  if (tier === 3) return 770;
  if (tier === 2) return 700;
  if (tier === 1) return 620;
  return Math.min(540, 300 + cycles * 80);
}

function getTierCeiling(tier: number, cfg: ProtocolConfigData): bigint {
  if (tier >= 4) return cfg.tier4Cap;
  if (tier === 3) return cfg.tier3Cap;
  if (tier === 2) return cfg.tier2Cap;
  if (tier === 1) return cfg.tier1Cap;
  return 0n;
}

export function useBorrowerProfile() {
  const { address } = useWallet();
  const { fetchUsdcBalance } = useRemitContract();

  const [profile, setProfile] = useState<BorrowerProfileData>(DEFAULT_PROFILE);
  const [activeLoan, setActiveLoan] = useState<ActiveLoanData | null>(null);
  const [poolStats, setPoolStats] = useState<PoolStatsData>(DEFAULT_POOL);
  const [config, setConfig] = useState<ProtocolConfigData>(DEFAULT_CONFIG);
  const [usdcBalance, setUsdcBalance] = useState<bigint>(0n);
  const [lpDeposit, setLpDeposit] = useState<bigint>(0n);
  const [lpShares, setLpShares] = useState<bigint>(0n);
  const [lpPosition, setLpPosition] = useState<LpPositionBreakdown>(DEFAULT_LP_POSITION);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const rpcServer = useMemo(
    () => new rpc.Server(STELLAR_CONFIG.rpcUrl, { allowHttp: false }),
    []
  );

  const simulateRead = useCallback(
    async <T>(method: string, args: xdr.ScVal[] = []): Promise<T | null> => {
      try {
        const account = await rpcServer.getAccount(READ_ONLY_SOURCE);
        const contract = new Contract(STELLAR_CONFIG.remitContractId);
        const tx = new TransactionBuilder(account, {
          fee: '100',
          networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        })
          .addOperation(contract.call(method, ...args))
          .setTimeout(30)
          .build();

        const sim = await rpcServer.simulateTransaction(tx);
        if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
          return scValToNative(sim.result.retval) as T;
        }
        return null;
      } catch {
        return null;
      }
    },
    [rpcServer]
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [p, c] = await Promise.all([
        simulateRead<Record<string, bigint | number | boolean>>('get_pool_state'),
        simulateRead<Record<string, bigint | number | boolean>>('get_protocol_config'),
      ]);

      let totalAssets = 0n;
      let totalShares = 0n;
      let totalLent = 0n;
      let availableLiquidity = 0n;
      let resolvedConfig = DEFAULT_CONFIG;

      if (p) {
        totalAssets = BigInt(String(p.total_assets ?? 0));
        totalShares = BigInt(String(p.total_shares ?? 0));
        totalLent = BigInt(String(p.total_principal_lent ?? 0));
        availableLiquidity = totalAssets > totalLent ? totalAssets - totalLent : 0n;

        setPoolStats({
          totalLiquidity: totalAssets,
          totalShares,
          totalLent,
          availableLiquidity,
          totalYieldEarned: BigInt(String(p.total_yield_earned ?? 0)),
          backstopReserve: BigInt(String(p.backstop_reserve ?? 0)),
          uncoveredLpLoss: BigInt(String(p.uncovered_lp_loss ?? 0)),
        });
      }

      if (c) {
        resolvedConfig = {
          minCyclesRequired: Number(c.min_cycles_required ?? 3),
          minCycleIntervalSecs: BigInt(String(c.min_cycle_interval_secs ?? 60)),
          postRepayCooldownSecs: BigInt(String(c.post_repay_cooldown_secs ?? 60)),
          remitFeeBps: Number(c.remit_fee_bps ?? 200),
          remitFeeCap: BigInt(String(c.remit_fee_cap ?? 150_000_000)),
          waterfallSplitBps: Number(c.waterfall_split_bps ?? 4000),
          loanFeeBps: Number(c.loan_fee_bps ?? 250),
          backstopFeeBps: Number(c.backstop_fee_bps ?? 2000),
          tier1Cap: BigInt(String(c.tier_1_cap ?? 500_000_000)),
          tier2Cap: BigInt(String(c.tier_2_cap ?? 1_000_000_000)),
          tier3Cap: BigInt(String(c.tier_3_cap ?? 2_000_000_000)),
          tier4Cap: BigInt(String(c.tier_4_cap ?? 4_000_000_000)),
          loanDurationSecs: BigInt(String(c.loan_duration_secs ?? 180)),
          isPaused: Boolean(c.is_paused ?? false),
        };
        setConfig(resolvedConfig);
      }

      if (address) {
        const addrScVal = nativeToScVal(Address.fromString(address), { type: 'address' });

        const [rawProfile, rawLimit, rawLoan, rawLpPos, rawShares, walletUsdc] =
          await Promise.all([
            simulateRead<Record<string, unknown>>('get_borrower_profile', [addrScVal]),
            simulateRead<bigint | number>('get_borrower_limit', [addrScVal]),
            simulateRead<Record<string, unknown> | null>('get_active_loan', [addrScVal]),
            simulateRead<Record<string, unknown> | null>('get_lp_position', [addrScVal]),
            simulateRead<bigint | number>('get_provider_shares', [addrScVal]),
            fetchUsdcBalance(address),
          ]);

        setUsdcBalance(walletUsdc);

        const userShares =
          rawLpPos && rawLpPos.shares !== undefined
            ? BigInt(String(rawLpPos.shares))
            : rawShares !== null && rawShares !== undefined
            ? BigInt(String(rawShares))
            : 0n;

        const netPrincipalDeposited =
          rawLpPos && rawLpPos.net_deposited !== undefined
            ? BigInt(String(rawLpPos.net_deposited))
            : 0n;

        const shareValue =
          totalShares > 0n ? (userShares * totalAssets) / totalShares : userShares;
        const lockedInActiveLoans =
          totalShares > 0n ? (userShares * totalLent) / totalShares : 0n;
        const withdrawableNow =
          totalShares > 0n ? (userShares * availableLiquidity) / totalShares : 0n;
        const poolShareBps =
          totalShares > 0n ? Number((userShares * 10_000n) / totalShares) : 0;

        setLpShares(userShares);
        setLpDeposit(shareValue);
        setLpPosition({
          shares: userShares,
          netPrincipalDeposited,
          shareValue,
          netProfitOrLoss: shareValue - netPrincipalDeposited,
          lockedInActiveLoans,
          withdrawableNow,
          poolShareBps,
        });

        if (rawProfile) {
          const cycles = Number(rawProfile.verified_cycles ?? 0);
          const tier = Number(rawProfile.credit_tier ?? 0);
          const isKycVerified = Boolean(rawProfile.is_kyc_verified ?? false);
          const hasDefaulted = Boolean(rawProfile.has_defaulted ?? false);
          const onChainLimit =
            rawLimit !== null && rawLimit !== undefined ? BigInt(String(rawLimit)) : 0n;
          const tierCeiling = getTierCeiling(tier, resolvedConfig);

          setProfile({
            isKycVerified,
            hasDefaulted,
            defaultedDebtOwed: BigInt(String(rawProfile.defaulted_debt_owed ?? 0)),
            needsCleanCycle: Boolean(rawProfile.needs_clean_cycle ?? false),
            creditScore: tierToDisplayScore(tier, cycles, hasDefaulted),
            creditTier: tier,
            remittanceCycles: cycles,
            totalRemitted: BigInt(String(rawProfile.total_received ?? 0)),
            avgCycleAmount: BigInt(String(rawProfile.ema_inflow ?? 0)),
            maxCreditLimit: onChainLimit > 0n ? onChainLimit : tierCeiling,
            lastRemittanceTs: BigInt(String(rawProfile.last_remittance_ts ?? 0)),
            lastRepaidTs: BigInt(String(rawProfile.last_repaid_ts ?? 0)),
            loansRepaidCount: Number(rawProfile.loans_repaid_count ?? 0),
          });
        }

        if (rawLoan && rawLoan.is_active && BigInt(String(rawLoan.remaining_balance ?? 0)) > 0n) {
          setActiveLoan({
            principal: BigInt(String(rawLoan.principal ?? 0)),
            totalOwed: BigInt(String(rawLoan.total_owed ?? 0)),
            remainingDebt: BigInt(String(rawLoan.remaining_balance ?? 0)),
            originatedAt: BigInt(String(rawLoan.disbursed_at ?? 0)),
            dueAt: BigInt(String(rawLoan.due_at ?? 0)),
            periodDurationSecs: BigInt(
              String(rawLoan.period_duration_secs ?? resolvedConfig.loanDurationSecs)
            ),
            latePeriods: Number(rawLoan.late_periods ?? 0),
            isDefaulted: Boolean(rawLoan.is_defaulted ?? false),
          });
        } else {
          setActiveLoan(null);
        }
      } else {
        setProfile(DEFAULT_PROFILE);
        setActiveLoan(null);
        setUsdcBalance(0n);
        setLpDeposit(0n);
        setLpShares(0n);
        setLpPosition(DEFAULT_LP_POSITION);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load on-chain protocol state.');
    } finally {
      setIsLoading(false);
    }
  }, [address, fetchUsdcBalance, simulateRead]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return {
    profile,
    activeLoan,
    poolStats,
    config,
    usdcBalance,
    lpDeposit,
    lpShares,
    lpPosition,
    isLoading,
    error,
    refresh,
  };
}