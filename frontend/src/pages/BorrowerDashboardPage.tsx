import React, { useState } from 'react';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { BorrowModal } from '@/components/borrower/BorrowModal';
import { CreditScoreGauge } from '@/components/borrower/CreditScoreGauge';
import { VaultCard } from '@/components/borrower/VaultCard';
import { WaterfallFeed } from '@/components/borrower/WaterfallFeed';
import { AnchorSimulator } from '@/components/simulator/AnchorSimulator';
import { useWallet } from '@/context/WalletContext';
import {
  ActiveLoanData,
  BorrowerProfileData,
  PoolStatsData,
  ProtocolConfigData,
} from '@/hooks/useBorrowerProfile';
import { KycStanding } from '@/hooks/useKycStatus';
import { ProtocolEventItem } from '@/hooks/useProtocolEvents';

interface BorrowerDashboardPageProps {
  profile: BorrowerProfileData;
  activeLoan: ActiveLoanData | null;
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  usdcBalance: bigint;
  lpDeposit?: bigint;
  lpShares?: bigint;
  kycStatus: KycStanding;
  events: ProtocolEventItem[];
  isEventsLoading: boolean;
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
  events,
  isEventsLoading,
  keeperOnline,
  onRefreshAll,
}) => {
  const { address, setActivePage } = useWallet();
  const [modalState, setModalState] = useState<{
    mode: 'borrow' | 'repay' | null;
    prefillFullRepay: boolean;
  }>({ mode: null, prefillFullRepay: false });

  return (
    <div className="space-y-6 pb-10">
      {/* Contextual SEP-12 KYC Prompt Banner */}
      {address && kycStatus === 'UNVERIFIED' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 px-5 py-3.5">
          <div className="flex items-center gap-3 text-xs text-amber-200">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
            <span>
              <strong>SEP-12 KYC Pending:</strong> You can receive remittances now, but must bind
              your one-time identity credential before drawing undercollateralized USDC credit.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('kyc')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300"
          >
            Verify Identity
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
            onOpenBorrow={() => setModalState({ mode: 'borrow', prefillFullRepay: false })}
            onOpenRepay={(payFull = false) =>
              setModalState({ mode: 'repay', prefillFullRepay: payFull })
            }
            onRehabilitated={onRefreshAll}
          />
        </div>
      </div>

      {/* Testnet SEP-31 Anchor Simulator */}
      <AnchorSimulator keeperOnline={keeperOnline} onSettled={onRefreshAll} />

      {/* Live Waterfall & Ledger Feed */}
      <WaterfallFeed
        events={events}
        isLoading={isEventsLoading}
        title={address ? 'Your Vault & Waterfall Activity' : 'Recent Protocol Waterfall Activity'}
        subtitle="Real-time remittances, instant credit draws, and automated 40%/60% splits"
      />

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