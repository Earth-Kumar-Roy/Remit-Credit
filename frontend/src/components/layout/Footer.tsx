import React from 'react';
import { ExternalLink } from 'lucide-react';
import { STELLAR_CONFIG, getExplorerContractUrl } from '@/config/stellar';
import { AppPage, useWallet } from '@/context/WalletContext';
import { shortenAddress } from '@/utils/stroops';

interface FooterProps {
  keeperOnline: boolean;
}

const FOOTER_LINKS: { id: AppPage; label: string }[] = [
  { id: 'landing', label: 'Overview' },
  { id: 'remit', label: 'Send Remittance' },
  { id: 'dashboard', label: 'Credit Vault' },
  { id: 'pool', label: 'Liquidity Pool' },
  { id: 'history', label: 'Account History' },
  { id: 'kyc', label: 'SEP-12 KYC' },
  { id: 'status', label: 'Protocol Status' },
];

export const Footer: React.FC<FooterProps> = ({ keeperOnline }) => {
  const { setActivePage } = useWallet();

  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-[#080e1a]/95">
      <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:px-8">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/Logo.png"
              alt="RemitCredit Logo"
              className="h-6 w-6 rounded-md object-contain"
            />
            <span className="text-sm font-bold text-white">RemitCredit Protocol</span>
            <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-medium text-cyan-300">
              Soroban v3 · SEP-12 / SEP-31
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Undercollateralized cross-border remittance credit lines on Stellar Testnet.
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
          {FOOTER_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => setActivePage(link.id)}
              className="transition hover:text-cyan-300"
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Contract & Keeper Status */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <a
            href={getExplorerContractUrl(STELLAR_CONFIG.remitContractId)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-slate-400 transition hover:text-cyan-300"
          >
            {shortenAddress(STELLAR_CONFIG.remitContractId, 6, 5)}
            <ExternalLink className="h-3 w-3" />
          </a>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900 px-2.5 py-1 font-mono text-[11px] text-slate-300">
            <span
              className={`h-2 w-2 rounded-full ${
                keeperOnline ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            {keeperOnline ? 'Keeper Synced' : 'Keeper Offline'}
          </span>
        </div>
      </div>
    </footer>
  );
};