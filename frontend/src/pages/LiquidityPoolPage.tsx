import React from 'react';
import { Landmark, ShieldCheck, Layers } from 'lucide-react';
import { WaterfallFeed } from '@/components/borrower/WaterfallFeed';
import { BackstopMetricsCard } from '@/components/lender/BackstopMetricsCard';
import { LiquidityPoolCard } from '@/components/lender/LiquidityPoolCard';
import { useWallet } from '@/context/WalletContext';
import {
  ActiveLoanData,
  LpPositionBreakdown,
  PoolStatsData,
  ProtocolConfigData,
} from '@/hooks/useBorrowerProfile';
import { ProtocolEventItem } from '@/hooks/useProtocolEvents';
import { formatBps } from '@/utils/stroops';

interface LiquidityPoolPageProps {
  activeLoan?: ActiveLoanData | null;
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  usdcBalance: bigint;
  lpDeposit: bigint;
  lpShares: bigint;
  lpPosition?: LpPositionBreakdown;
  events: ProtocolEventItem[];
  isEventsLoading: boolean;
  onRefreshAll: () => Promise<void>;
}

export const LiquidityPoolPage: React.FC<LiquidityPoolPageProps> = ({
  activeLoan = null,
  poolStats,
  config,
  usdcBalance,
  lpDeposit,
  lpShares,
  lpPosition,
  events,
  isEventsLoading,
  onRefreshAll,
}) => {
  const { address } = useWallet();

  const poolEvents = events.filter((ev) =>
    [
      'LP_SUPPLY',
      'LP_WITHDRAW',
      'WATERFALL_REPAY',
      'DIRECT_REPAY',
      'LOAN_DEFAULT',
      'ACCOUNT_REHABILITATED',
      'REMIT_FEE_BACKSTOP',
    ].includes(ev.tx_category)
  );

  return (
    <div className="space-y-6 pb-10">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/25 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-500/35">
              <Landmark className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">USDC Liquidity Vault &amp; Backstop</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Provide USDC to underwrite verified cross-border remittance streams and earn{' '}
                {formatBps(config.loanFeeBps)} loan yield shielded by the First-Loss Backstop
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              {formatBps(config.backstopFeeBps)} Fee Backstop Cut
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 font-medium text-sky-300">
              <Layers className="h-4 w-4 text-sky-400" />
              {formatBps(config.waterfallSplitBps)} Auto-Waterfall
            </span>
          </div>
        </div>
      </div>

      {/* LP Metrics & Pro-Rata Deposit/Withdraw Controls */}
      <LiquidityPoolCard
        isConnected={Boolean(address)}
        hasActiveLoan={Boolean(activeLoan)}
        poolStats={poolStats}
        config={config}
        usdcBalance={usdcBalance}
        lpDeposit={lpDeposit}
        lpShares={lpShares}
        lpPosition={lpPosition}
        onSuccess={onRefreshAll}
      />

      {/* First-Loss Backstop Coverage & Fee Split Card */}
      <BackstopMetricsCard poolStats={poolStats} config={config} />

      {/* Vault Cash-Flow & Repayment Ledger */}
      <WaterfallFeed
        events={poolEvents}
        isLoading={isEventsLoading}
        title="Vault Liquidity & Repayment Ledger"
        subtitle="LP supplies, pro-rata withdrawals, waterfall repayments, and backstop settlements"
      />
    </div>
  );
};