import React, { useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Filter,
  History,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { BorrowModal } from '@/components/borrower/BorrowModal';
import { getExplorerTxUrl } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { useAccountHistory } from '@/hooks/useAccountHistory';
import { useBorrowerProfile } from '@/hooks/useBorrowerProfile';
import { formatDueCountdown, formatUnixToIST, formatUsdc, shortenAddress } from '@/utils/stroops';

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Activity' },
  { id: 'REMITTANCE_IN', label: 'Remittances' },
  { id: 'INSTANT_BORROW', label: 'Credit Draws' },
  { id: 'WATERFALL_REPAY', label: 'Waterfall Splits' },
  { id: 'DIRECT_REPAY', label: 'Direct Repayments' },
  { id: 'LP_SUPPLY', label: 'LP Supply' },
  { id: 'LP_WITHDRAW', label: 'LP Withdraw' },
  { id: 'KYC_VERIFIED', label: 'SEP-12 KYC' },
  { id: 'LOAN_DEFAULT', label: 'Defaults' },
];

export const AccountHistoryPage: React.FC = () => {
  const { address, connect } = useWallet();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isRepayModalOpen, setIsRepayModalOpen] = useState<boolean>(false);

  const { profile, activeLoan, poolStats, config, usdcBalance, refresh } = useBorrowerProfile();
  const { transactions, isLoading, error, refreshHistory } = useAccountHistory(
    address,
    selectedCategory,
    100
  );

  const handleSyncAll = async () => {
    await Promise.all([refresh(), refreshHistory()]);
  };

  const handleExportCsv = () => {
    if (!transactions.length) return;
    const headers = [
      'event_id',
      'tx_hash',
      'ledger',
      'timestamp_ist',
      'wallet_address',
      'counterparty',
      'tx_category',
      'event_type',
      'gross_amount_usdc',
      'pool_allocated_usdc',
      'user_net_usdc',
      'fee_or_yield_usdc',
      'remaining_debt_usdc',
      'credit_tier',
      'status',
    ];
    const rows = transactions.map((tx) =>
      headers
        .map((h) => JSON.stringify((tx as unknown as Record<string, unknown>)[h] ?? ''))
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `remitcredit-history-${address ? address.slice(0, 8) : 'all'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dueInfo = activeLoan ? formatDueCountdown(activeLoan.dueAt) : null;

  return (
    <div className="space-y-6 pb-10">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-r from-slate-900 via-slate-900 to-cyan-950/25 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-500/35">
              <History className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Account Ledger &amp; Audit History</h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Complete Soroban event history synced in Indian Standard Time (IST)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              Sync Ledger
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={transactions.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-slate-800/80 pt-4">
          <Filter className="mr-1 h-3.5 w-3.5 text-slate-400" />
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                selectedCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/70 text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Loan & One-Click Full Settlement Card */}
      {address && activeLoan && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-5 shadow-lg">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Active Loan Obligation
              </span>
              {dueInfo && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                  <Clock className="h-3 w-3" />
                  {dueInfo.label}
                </span>
              )}
            </div>
            <div className="tabular-nums text-2xl font-bold text-white">
              {formatUsdc(activeLoan.remainingDebt)} USDC{' '}
              <span className="text-xs font-normal text-slate-400">
                remaining of {formatUsdc(activeLoan.totalOwed)} USDC total owed
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
              <span>Due By (IST): {formatUnixToIST(activeLoan.dueAt)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRepayModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-400 px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-cyan-300"
          >
            <CheckCircle2 className="h-4 w-4" />
            Pay Full Loan at Once ({formatUsdc(activeLoan.remainingDebt)} USDC)
          </button>
        </div>
      )}

      {!address ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-10 text-center">
          <Wallet className="mx-auto h-10 w-10 text-cyan-400" />
          <h2 className="mt-3 text-lg font-semibold text-white">Connect Freighter to View History</h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Connect your Stellar wallet to inspect your personal remittances, credit draws,
            waterfall splits, and LP positions.
          </p>
          <button
            type="button"
            onClick={connect}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <Wallet className="h-4 w-4" />
            Connect Freighter
          </button>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-950/40 p-5 text-xs text-rose-200">
          {error}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/75 shadow-xl">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-slate-950/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Timestamp (IST)</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-right">Gross USDC</th>
                  <th className="px-4 py-3.5 text-right">Pool / Debt Split</th>
                  <th className="px-4 py-3.5 text-right">Net Wallet USDC</th>
                  <th className="px-4 py-3.5 text-right">Remaining Debt</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Explorer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      {isLoading
                        ? 'Loading ledger records from Google Sheets...'
                        : 'No transactions found for this filter.'}
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.event_id} className="transition hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-300">
                        {tx.timestamp_ist}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 font-semibold text-slate-200">
                          {tx.tx_category}
                        </span>
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right font-semibold text-white">
                        {Number(tx.gross_amount_usdc || 0).toFixed(2)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right text-sky-300">
                        {Number(tx.pool_allocated_usdc || 0).toFixed(2)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right text-emerald-400">
                        {Number(tx.user_net_usdc || 0).toFixed(2)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-right text-amber-300">
                        {Number(tx.remaining_debt_usdc || 0).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                          {tx.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {tx.tx_hash ? (
                          <a
                            href={getExplorerTxUrl(tx.tx_hash)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-emerald-400"
                          >
                            {shortenAddress(tx.tx_hash, 5, 4)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* One-Click Full Payoff Modal */}
      <BorrowModal
        isOpen={isRepayModalOpen}
        mode="repay"
        prefillFullRepay={true}
        profile={profile}
        activeLoan={activeLoan}
        poolStats={poolStats}
        config={config}
        usdcBalance={usdcBalance}
        onClose={() => setIsRepayModalOpen(false)}
        onSuccess={handleSyncAll}
      />
    </div>
  );
};