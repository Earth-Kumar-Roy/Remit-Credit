import React, { useState } from 'react';
import { WalletProvider, useWallet } from '@/context/WalletContext';
import { useBorrowerProfile } from '@/hooks/useBorrowerProfile';
import { useKycStatus } from '@/hooks/useKycStatus';
import { useProtocolEvents } from '@/hooks/useProtocolEvents';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { KycBanner } from '@/components/kyc/KycBanner';
import { KycRegistrationModal } from '@/components/kyc/KycRegistrationModal';
import { LandingPage } from '@/pages/LandingPage';
import { BorrowerDashboardPage } from '@/pages/BorrowerDashboardPage';
import { LiquidityPoolPage } from '@/pages/LiquidityPoolPage';
import { AccountHistoryPage } from '@/pages/AccountHistoryPage';
import { KycVerificationPage } from '@/pages/KycVerificationPage';
import { ProtocolStatusPage } from '@/pages/ProtocolStatusPage';

const AppContent: React.FC = () => {
  const { address, activePage } = useWallet();
  const {
    profile,
    activeLoan,
    poolStats,
    config,
    usdcBalance,
    lpDeposit,
    lpShares,
    lpPosition,
    isLoading,
    refresh,
  } = useBorrowerProfile();

  const {
    kycStatus,
    kycRecord,
    isKycLoading,
    kycError,
    refreshKycStatus,
    submitKycRegistration,
  } = useKycStatus();

  const {
    events,
    isLoading: eventsLoading,
    keeperOnline,
    refreshEvents,
  } = useProtocolEvents(activePage === 'dashboard' ? address : null);

  const [isQuickKycOpen, setIsQuickKycOpen] = useState(false);

  const handleFullSync = async () => {
    await Promise.all([refresh(), refreshEvents(), refreshKycStatus()]);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar
        usdcBalance={usdcBalance}
        kycStatus={kycStatus}
        isRefreshing={isLoading}
        onRefresh={handleFullSync}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {(activePage === 'dashboard' || activePage === 'pool') && (
          <>
            <RoleSwitcher keeperOnline={keeperOnline} />
            <KycBanner
              kycStatus={kycStatus}
              kycRecord={kycRecord}
              onOpenQuickVerify={() => setIsQuickKycOpen(true)}
            />
          </>
        )}

        {activePage === 'landing' && (
          <LandingPage
            poolStats={poolStats}
            config={config}
            kycStatus={kycStatus}
          />
        )}

        {activePage === 'dashboard' && (
          <BorrowerDashboardPage
            profile={profile}
            activeLoan={activeLoan}
            poolStats={poolStats}
            config={config}
            usdcBalance={usdcBalance}
            lpDeposit={lpDeposit}
            lpShares={lpShares}
            kycStatus={kycStatus}
            events={events}
            isEventsLoading={eventsLoading}
            keeperOnline={keeperOnline}
            onRefreshAll={handleFullSync}
          />
        )}

        {activePage === 'pool' && (
          <LiquidityPoolPage
            activeLoan={activeLoan}
            poolStats={poolStats}
            config={config}
            usdcBalance={usdcBalance}
            lpDeposit={lpDeposit}
            lpShares={lpShares}
            lpPosition={lpPosition}
            events={events}
            isEventsLoading={eventsLoading}
            onRefreshAll={handleFullSync}
          />
        )}

        {activePage === 'history' && <AccountHistoryPage />}

        {activePage === 'kyc' && (
          <KycVerificationPage
            kycStatus={kycStatus}
            kycRecord={kycRecord}
            isKycLoading={isKycLoading}
            kycError={kycError}
            onSubmitKyc={submitKycRegistration}
            onRefreshAll={handleFullSync}
          />
        )}

        {activePage === 'status' && (
          <ProtocolStatusPage
            poolStats={poolStats}
            config={config}
            keeperOnline={keeperOnline}
          />
        )}
      </main>

      <Footer keeperOnline={keeperOnline} />

      <KycRegistrationModal
        isOpen={isQuickKycOpen}
        isSubmitting={isKycLoading}
        onClose={() => setIsQuickKycOpen(false)}
        onSubmitKyc={submitKycRegistration}
        onSuccess={handleFullSync}
      />
    </div>
  );
};

export function App() {
  return (
    <WalletProvider>
      <AppContent />
    </WalletProvider>
  );
}

export default App;