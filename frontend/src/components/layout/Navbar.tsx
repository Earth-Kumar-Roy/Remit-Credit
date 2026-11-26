import React from 'react';
import {
  Wallet,
  LogOut,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Ban,
  LayoutDashboard,
  Landmark,
  History,
  UserCheck,
  Activity,
  Home,
  Send,
} from 'lucide-react';
import { STELLAR_CONFIG, getExplorerContractUrl } from '@/config/stellar';
import { AppPage, useWallet } from '@/context/WalletContext';
import { KycStanding } from '@/hooks/useKycStatus';
import { formatUsdc, shortenAddress } from '@/utils/stroops';

interface NavbarProps {
  usdcBalance: bigint;
  kycStatus: KycStanding;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const NAV_ITEMS: { id: AppPage; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'landing', label: 'Overview', icon: Home },
  { id: 'remit', label: 'Send Remittance', icon: Send },
  { id: 'dashboard', label: 'Credit Vault', icon: LayoutDashboard },
  { id: 'pool', label: 'Liquidity Pool', icon: Landmark },
  { id: 'history', label: 'History', icon: History },
  { id: 'kyc', label: 'SEP-12 KYC', icon: UserCheck },
  { id: 'status', label: 'Protocol', icon: Activity },
];

export const Navbar: React.FC<NavbarProps> = ({
  usdcBalance,
  kycStatus,
  isRefreshing,
  onRefresh,
}) => {
  const {
    address,
    isConnecting,
    networkError,
    activePage,
    setActivePage,
    connect,
    disconnect,
  } = useWallet();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#080e1a]/95 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:px-6 xl:flex-nowrap">
        {/* Brand Logo & Contract Link */}
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActivePage('landing')}
            className="flex items-center gap-2.5 text-left transition hover:opacity-90"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cyan-400/35 bg-slate-900/90 p-1 shadow-lg shadow-cyan-500/10">
              <img
                src="/Logo.png"
                alt="RemitCredit Logo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="whitespace-nowrap">
              <div className="flex items-center gap-1.5">
                <span className="bg-gradient-to-r from-white via-slate-100 to-cyan-200 bg-clip-text text-base font-bold tracking-tight text-transparent">
                  RemitCredit
                </span>
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/30">
                  {STELLAR_CONFIG.network}
                </span>
              </div>
              <a
                href={getExplorerContractUrl()}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block font-mono text-[10px] text-slate-400 transition hover:text-cyan-300"
              >
                {shortenAddress(STELLAR_CONFIG.remitContractId, 5, 4)} ↗
              </a>
            </div>
          </button>
        </div>

        {/* Multi-Page Navigation Pills (Single Line on Desktop) */}
        <nav className="order-3 flex w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-800/90 bg-slate-900/85 p-1 xl:order-2 xl:w-auto xl:shrink-0">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActivePage(item.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-400/20 to-cyan-500/20 text-amber-300 ring-1 ring-amber-400/45 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{item.label}</span>
                {item.id === 'kyc' && address && kycStatus !== 'VERIFIED' && (
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      kycStatus === 'BANNED' ? 'bg-rose-500' : 'bg-amber-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Wallet, KYC Badge & Balance Controls (Single Line) */}
        <div className="order-2 flex shrink-0 items-center gap-2 whitespace-nowrap xl:order-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sync on-chain state"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 transition hover:border-slate-700 hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
            />
          </button>

          {address ? (
            <div className="flex shrink-0 items-center gap-1.5">
              {/* KYC Status Pill */}
              <button
                type="button"
                onClick={() => setActivePage('kyc')}
                title="View SEP-12 KYC verification status"
                className={`hidden shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold ring-1 transition md:inline-flex ${
                  kycStatus === 'VERIFIED'
                    ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30 hover:bg-emerald-500/20'
                    : kycStatus === 'BANNED'
                    ? 'bg-rose-500/15 text-rose-300 ring-rose-500/40 hover:bg-rose-500/25'
                    : 'bg-amber-500/10 text-amber-300 ring-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                {kycStatus === 'VERIFIED' ? (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span>KYC Verified</span>
                  </>
                ) : kycStatus === 'BANNED' ? (
                  <>
                    <Ban className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                    <span>Banned</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <span>Verify KYC</span>
                  </>
                )}
              </button>

              {/* Compact Single-Line Wallet USDC Balance */}
              <div className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1.5 font-mono text-[11px] sm:inline-flex">
                <span className="text-slate-400">BAL:</span>
                <span className="tabular-nums font-bold text-emerald-400">
                  {formatUsdc(usdcBalance)} USDC
                </span>
              </div>

              {/* Connected Address Chip */}
              <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-medium text-emerald-200">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="font-mono text-[11px]">{shortenAddress(address, 4, 4)}</span>
                <button
                  type="button"
                  onClick={disconnect}
                  title="Disconnect wallet"
                  className="rounded p-0.5 text-emerald-300/70 transition hover:bg-emerald-500/20 hover:text-white"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-3.5 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:opacity-95 disabled:opacity-60"
            >
              <Wallet className="h-3.5 w-3.5 shrink-0" />
              <span>{isConnecting ? 'Connecting...' : 'Connect Freighter'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Network / Wallet Alert Banner */}
      {networkError && (
        <div className="border-t border-rose-500/30 bg-rose-950/70 px-4 py-2 text-xs text-rose-200">
          <div className="mx-auto flex max-w-7xl items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{networkError}</span>
          </div>
        </div>
      )}
    </header>
  );
};