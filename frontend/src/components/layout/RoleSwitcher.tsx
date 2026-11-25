import React from 'react';
import { ArrowDownLeft, Landmark, Radio } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';

interface RoleSwitcherProps {
  keeperOnline: boolean;
}

export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ keeperOnline }) => {
  const { activeRole, setActiveRole, activePage, setActivePage } = useWallet();

  const handleSelectRole = (role: 'borrower' | 'lp') => {
    setActiveRole(role);
    setActivePage(role === 'borrower' ? 'dashboard' : 'pool');
  };

  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      {/* Segmented Role & Page Switcher */}
      <div className="inline-flex rounded-xl border border-slate-800/90 bg-slate-900/90 p-1 shadow-inner">
        <button
          type="button"
          onClick={() => handleSelectRole('borrower')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activePage === 'dashboard' || (activePage !== 'pool' && activeRole === 'borrower')
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 font-semibold text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowDownLeft className="h-4 w-4" />
          Borrower &amp; Credit Vault
        </button>

        <button
          type="button"
          onClick={() => handleSelectRole('lp')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
            activePage === 'pool'
              ? 'bg-gradient-to-r from-sky-500 to-cyan-400 font-semibold text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Landmark className="h-4 w-4" />
          Liquidity Pool (LP)
        </button>
      </div>

      {/* Python Keeper Daemon Status Pill */}
      <div className="inline-flex items-center gap-2 self-start rounded-full border border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs sm:self-auto">
        <Radio
          className={`h-3.5 w-3.5 ${
            keeperOnline ? 'animate-pulse text-emerald-400' : 'text-rose-400'
          }`}
        />
        <span className="text-slate-400">Anchor &amp; Sheets Relayer:</span>
        <span className={keeperOnline ? 'font-semibold text-emerald-300' : 'font-semibold text-rose-300'}>
          {keeperOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
};