import React, { useCallback, useEffect, useRef, useState } from 'react';
import { STELLAR_CONFIG } from '@/config/stellar';
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
import { SendRemittancePage } from '@/pages/SendRemittancePage';
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
  } = useProtocolEvents(null);

  const [isQuickKycOpen, setIsQuickKycOpen] = useState(false);
  const tickInFlightRef = useRef(false);

  const handleFullSync = useCallback(async () => {
    await Promise.all([refresh(), refreshEvents(), refreshKycStatus()]);
  }, [refresh, refreshEvents, refreshKycStatus]);

  // On-demand serverless keeper sweep: runs immediately when app opens and every 20s while tab is visible
  useEffect(() => {
    let cancelled = false;

    const runKeeperSweep = async (refreshUiAfter: boolean) => {
      if (tickInFlightRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      tickInFlightRef.current = true;
      try {
        const res = await fetch(`${STELLAR_CONFIG.keeperApiUrl}/tick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!cancelled && res.ok && refreshUiAfter) {
          await handleFullSync();
        }
      } catch {
        // Ignore transient network errors; next heartbeat retries automatically
      } finally {
        tickInFlightRef.current = false;
      }
    };

    // Immediate full sweep on app mount / wallet change (indexes events, checks overdue strikes/bans, extends TTLs)
    runKeeperSweep(true);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runKeeperSweep(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(() => runKeeperSweep(true), 20_000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [address, handleFullSync]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      <Navbar
        usdcBalance={usdcBalance}
        kycStatus={kycStatus}
        isRefreshing={isLoading}
        onRefresh={handleFullSync}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {(activePage === 'dashboard' || activePage === 'pool') && (
          <RoleSwitcher keeperOnline={keeperOnline} />
        )}

        {(activePage === 'remit' || activePage === 'dashboard' || activePage === 'pool') && (
          <KycBanner
            kycStatus={kycStatus}
            kycRecord={kycRecord}
            onOpenQuickVerify={() => setIsQuickKycOpen(true)}
          />
        )}

        {activePage === 'landing' && (
          <LandingPage
            poolStats={poolStats}
            config={config}
            kycStatus={kycStatus}
          />
        )}

        {activePage === 'remit' && (
          <SendRemittancePage
            poolStats={poolStats}
            config={config}
            usdcBalance={usdcBalance}
            kycStatus={kycStatus}
            events={events}
            isEventsLoading={eventsLoading}
            keeperOnline={keeperOnline}
            onRefreshAll={handleFullSync}
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
            kycStatus={kycStatus}
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