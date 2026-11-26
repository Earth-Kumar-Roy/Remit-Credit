import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Filter,
  History,
  Landmark,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Split,
  Wallet,
  X,
} from 'lucide-react';
import { BorrowModal } from '@/components/borrower/BorrowModal';
import { getExplorerTxUrl } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { useAccountHistory } from '@/hooks/useAccountHistory';
import { useBorrowerProfile } from '@/hooks/useBorrowerProfile';
import { ProtocolEventItem } from '@/hooks/useProtocolEvents';
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
  { id: 'ACCOUNT_REHABILITATED', label: 'Rehabilitations' },
];

const CATEGORY_META: Record<
  string,
  {
    label: string;
    badgeClass: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  WATERFALL_REPAY: {
    label: 'WATERFALL SPLIT',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/35',
    icon: Split,
  },
  DIRECT_REPAY: {
    label: 'DIRECT REPAYMENT',
    badgeClass: 'bg-sky-500/15 text-sky-300 ring-sky-500/35',
    icon: CheckCircle2,
  },
  REMITTANCE_IN: {
    label: 'REMITTANCE IN',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/35',
    icon: ArrowDownLeft,
  },
  INSTANT_BORROW: {
    label: 'CREDIT DRAWN',
    badgeClass: 'bg-amber-500/15 text-amber-300 ring-amber-500/35',
    icon: ArrowUpRight,
  },
  LP_SUPPLY: {
    label: 'LP SUPPLY',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 ring-indigo-500/35',
    icon: Landmark,
  },
  LP_WITHDRAW: {
    label: 'LP WITHDRAW',
    badgeClass: 'bg-purple-500/15 text-purple-300 ring-purple-500/35',
    icon: Landmark,
  },
  KYC_VERIFIED: {
    label: 'SEP-12 KYC',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/35',
    icon: ShieldCheck,
  },
  LOAN_DEFAULT: {
    label: 'DEFAULT SLASHED',
    badgeClass: 'bg-rose-500/15 text-rose-300 ring-rose-500/35',
    icon: Ban,
  },
  ACCOUNT_REHABILITATED: {
    label: 'BAN LIFTED · CURED',
    badgeClass: 'bg-amber-500/15 text-amber-300 ring-amber-500/35',
    icon: CheckCircle2,
  },
};

const ITEMS_PER_PAGE = 15;

export const AccountHistoryPage: React.FC = () => {
  const { address, connect, isConnecting } = useWallet();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedTx, setSelectedTx] = useState<ProtocolEventItem | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRepayModalOpen, setIsRepayModalOpen] = useState<boolean>(false);

  const { profile, activeLoan, poolStats, config, usdcBalance, refresh } = useBorrowerProfile();
  // Keep limit at 100 so backend FastAPI Query(..., le=100/200) validation always succeeds
  const { transactions, isLoading, error, refreshHistory } = useAccountHistory(
    address,
    selectedCategory,
    100
  );

  const formattedError = useMemo(() => {
    if (!error) return null;
    if (typeof error === 'string' && error !== '[object Object]') return error;
    return 'Unable to load account transaction history from keeper.';
  }, [error]);

  // Strictly scope to the connected wallet address
  const walletTransactions = useMemo(() => {
    if (!address) return [];
    const normalizedWallet = address.trim().toUpperCase();
    return transactions.filter(
      (tx) => !tx.wallet_address || tx.wallet_address.trim().toUpperCase() === normalizedWallet
    );
  }, [address, transactions]);

  // Apply search query across hash, category, event, counterparty, timestamp, ledger, or amounts
  const filteredTransactions = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    if (!q) return walletTransactions;
    return walletTransactions.filter(
      (tx) =>
        (tx.tx_hash && tx.tx_hash.toLowerCase().includes(q)) ||
        (tx.event_id && tx.event_id.toLowerCase().includes(q)) ||
        (tx.tx_category && tx.tx_category.toLowerCase().includes(q)) ||
        (tx.event_type && tx.event_type.toLowerCase().includes(q)) ||
        (tx.counterparty && tx.counterparty.toLowerCase().includes(q)) ||
        (tx.timestamp_ist && tx.timestamp_ist.toLowerCase().includes(q)) ||
        String(tx.ledger ?? '').includes(q) ||
        String(tx.gross_amount_usdc ?? '').includes(q) ||
        String(tx.user_net_usdc ?? '').includes(q)
    );
  }, [walletTransactions, appliedSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [address, selectedCategory, appliedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedTransactions = filteredTransactions.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchInput);
    setCurrentPage(1);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  const handleSyncAll = async () => {
    await Promise.all([refresh(), refreshHistory()]);
  };

  const handleCopyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleExportCsv = () => {
    if (!filteredTransactions.length) return;
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
    const rows = filteredTransactions.map((tx) =>
      headers
        .map((h) => JSON.stringify((tx as unknown as Record<string, unknown>)[h] ?? ''))
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `remitcredit-history-${address ? address.slice(0, 8) : 'wallet'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dueInfo = activeLoan ? formatDueCountdown(activeLoan.dueAt) : null;

  return (
    <div className="space-y-6 pb-10">
      {/* Architectural Header Monolith */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_90%)]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="historyCadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.85" />
                <circle cx="40" cy="40" r="1" fill="#22d3ee" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#historyCadGrid)" />
          </svg>
        </div>

        <div className="pointer-events-none absolute -top-20 right-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-amber-500/10 blur-[120px]" />
        <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-cyan-400/70">
          ⌜ SEC_05 // ACCOUNT_AUDIT_LEDGER ⌝
        </span>
        <span className="pointer-events-none absolute right-4 top-3 select-none font-mono text-[10px] text-amber-400/70">
          [+]
        </span>

        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-500/35">
              <History className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
                <span className="font-bold text-cyan-300">◈ SOROBAN EVENT LEDGER</span>
                <span className="text-slate-600">//</span>
                <span className="text-amber-300">
                  {address ? `WALLET: ${shortenAddress(address, 6, 5)}` : 'WALLET DISCONNECTED'}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Account Ledger &amp; Audit History
              </h1>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                Wallet-scoped Soroban contract history synced in Indian Standard Time (IST). Click
                any transaction row to inspect full cryptographic audit details.
              </p>
            </div>
          </div>

          {address && (
            <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
              <button
                type="button"
                onClick={handleSyncAll}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 font-semibold text-slate-200 transition hover:border-cyan-500/50 hover:text-white disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`}
                />
                <span>Sync Ledger</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filteredTransactions.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-cyan-400 px-3.5 py-2 font-bold uppercase tracking-wider text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          )}
        </div>

        {/* Category Filter Pills + Search Bar with Search Button (Only when wallet is connected) */}
        {address && (
          <div className="relative z-10 mt-6 space-y-4 border-t border-slate-800/80 pt-5">
            <div className="flex flex-wrap items-center gap-1.5 font-mono">
              <Filter className="mr-1 h-3.5 w-3.5 text-cyan-400" />
              {CATEGORY_FILTERS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedCategory === cat.id
                      ? 'bg-gradient-to-r from-amber-400/20 to-cyan-500/20 text-amber-300 ring-1 ring-amber-400/45'
                      : 'bg-slate-950/80 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-col gap-2 sm:flex-row sm:items-center"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (!e.target.value.trim() && appliedSearch) {
                      setAppliedSearch('');
                    }
                  }}
                  placeholder="Search by tx hash, counterparty, category, ledger #, IST date, or USDC amount..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-9 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    title="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 font-mono">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-cyan-300"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Search</span>
                </button>
                {appliedSearch && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white"
                  >
                    Reset
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Active Loan & One-Click Full Settlement Card */}
      {address && activeLoan && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 p-5 shadow-lg">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                ● ACTIVE LOAN OBLIGATION
              </span>
              {dueInfo && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-500/30">
                  <Clock className="h-3 w-3" />
                  {dueInfo.label}
                </span>
              )}
            </div>
            <div className="tabular-nums font-mono text-2xl font-bold text-white">
              {formatUsdc(activeLoan.remainingDebt)} USDC{' '}
              <span className="font-sans text-xs font-normal text-slate-400">
                remaining of {formatUsdc(activeLoan.totalOwed)} USDC total owed
              </span>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-xs text-slate-300">
              <CalendarClock className="h-3.5 w-3.5 text-amber-400" />
              <span>DUE BY (IST): {formatUnixToIST(activeLoan.dueAt)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsRepayModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:opacity-95"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Pay Full Loan ({formatUsdc(activeLoan.remainingDebt)} USDC)</span>
          </button>
        </div>
      )}

      {/* State 1: No Wallet Connected */}
      {!address ? (
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-12 text-center shadow-xl">
          <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-slate-600">
            ⌜ WALLET_AUTH // REQUIRED ⌝
          </span>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/35 bg-cyan-500/10">
            <Wallet className="h-7 w-7 text-cyan-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">
            No Wallet Connected · Connect Freighter to View History
          </h2>
          <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-400">
            Your ledger audit trail is bound to your Stellar address. Connect your Freighter
            wallet to inspect your personal remittances, credit draws, waterfall splits, and LP
            positions.
          </p>
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:opacity-95 disabled:opacity-60"
          >
            <Wallet className="h-4 w-4" />
            <span>{isConnecting ? 'Connecting Freighter...' : '[ ⬡ Connect Freighter Wallet ]'}</span>
          </button>
        </div>
      ) : formattedError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/35 bg-rose-950/40 p-5 text-xs text-rose-200">
          <span>{formattedError}</span>
          <button
            type="button"
            onClick={handleSyncAll}
            className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 font-mono font-semibold text-rose-100 hover:bg-rose-500/25"
          >
            Retry Sync
          </button>
        </div>
      ) : filteredTransactions.length === 0 ? (
        /* State 2: Wallet Connected, No History Found */
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-12 text-center shadow-xl">
          <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-slate-600">
            ⌜ LEDGER_STATE // EMPTY_RESULT ⌝
          </span>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
            <Layers className="h-7 w-7 text-slate-400" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-white">
            {isLoading
              ? 'Syncing Wallet History from Soroban Ledger...'
              : 'No Transaction History Found for This Wallet'}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md font-mono text-xs text-slate-400">
            Connected Wallet: <span className="text-cyan-300">{shortenAddress(address, 8, 8)}</span>
            {appliedSearch
              ? ` · No records match "${appliedSearch}"`
              : selectedCategory !== 'ALL'
              ? ` · Filter: ${selectedCategory}`
              : ' · 0 indexed events recorded yet'}
          </p>
          {!isLoading && (appliedSearch || selectedCategory !== 'ALL') && (
            <div className="mt-5 flex justify-center gap-2 font-mono text-xs">
              {appliedSearch && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 font-semibold text-cyan-200 hover:bg-cyan-500/25"
                >
                  Clear Search
                </button>
              )}
              {selectedCategory !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 font-semibold text-slate-200 hover:border-slate-600"
                >
                  Show All Categories
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* State 3: Wallet Connected with Transactions (Max 15 per page + Clickable Detail Modal) */
        <div className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080e1a] shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 bg-slate-950/80 px-5 py-3 font-mono text-[11px] text-slate-400">
            <span>
              SHOWING <strong className="text-white">{paginatedTransactions.length}</strong> OF{' '}
              <strong className="text-cyan-300">{filteredTransactions.length}</strong> TRANSACTIONS
              FOR <strong className="text-emerald-300">{shortenAddress(address, 6, 5)}</strong>
            </span>
            <span className="text-amber-300">CLICK ANY ROW TO INSPECT FULL TX DETAILS</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800/80 text-left text-xs">
              <thead className="bg-slate-950/95 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">Timestamp (IST)</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 text-right">Gross USDC</th>
                  <th className="px-4 py-3.5 text-right">Pool / Debt Split</th>
                  <th className="px-4 py-3.5 text-right">Net Wallet USDC</th>
                  <th className="px-4 py-3.5 text-right">Remaining Debt</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Tx Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedTransactions.map((tx) => {
                  const meta = CATEGORY_META[tx.tx_category] || {
                    label: tx.tx_category || tx.event_type,
                    badgeClass: 'bg-slate-800 text-slate-200 ring-slate-700',
                    icon: Activity,
                  };
                  const Icon = meta.icon;

                  return (
                    <tr
                      key={tx.event_id}
                      onClick={() => setSelectedTx(tx)}
                      className="cursor-pointer transition hover:bg-slate-900/90"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-300">
                        {tx.timestamp_ist}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider ring-1 ${meta.badgeClass}`}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-right font-mono font-bold text-white">
                        {Number(tx.gross_amount_usdc || 0).toFixed(2)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-right font-mono text-cyan-300">
                        {Number(tx.pool_allocated_usdc || 0).toFixed(2)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-right font-mono text-emerald-400">
                        {Number(tx.user_net_usdc || 0).toFixed(2)}
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3.5 text-right font-mono text-amber-300">
                        {Number(tx.remaining_debt_usdc || 0).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                          {tx.status || 'CONFIRMED'}
                        </span>
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-3.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tx.tx_hash ? (
                          <a
                            href={getExplorerTxUrl(tx.tx_hash)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-slate-400 hover:text-cyan-300"
                          >
                            {shortenAddress(tx.tx_hash, 5, 4)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls (Max 15 per page) */}
          {filteredTransactions.length > ITEMS_PER_PAGE && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/90 bg-slate-950/80 px-5 py-3.5 font-mono text-xs">
              <span className="text-slate-400">
                Page <strong className="text-white">{safePage}</strong> of{' '}
                <strong className="text-white">{totalPages}</strong> (15 per page)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transaction Inspection Modal */}
      {selectedTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md"
          onClick={() => setSelectedTx(null)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-[#080e1a] p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
            <span className="pointer-events-none absolute left-4 top-2 select-none font-mono text-[9px] text-cyan-400/70">
              ⌜ SOROBAN_EVENT_RECEIPT // LEDGER #{selectedTx.ledger} ⌝
            </span>

            <div className="mt-2 flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                  ◈ CRYPTOGRAPHIC AUDIT RECORD
                </div>
                <h3 className="mt-0.5 text-lg font-bold text-white">
                  {selectedTx.tx_category} · {selectedTx.event_type}
                </h3>
                <p className="font-mono text-xs text-slate-400">{selectedTx.timestamp_ist} IST</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:border-slate-700 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Financial Breakdown Blocks */}
            <div className="mt-4 grid grid-cols-2 gap-3 font-mono sm:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="text-[10px] uppercase text-slate-400">Gross Amount</div>
                <div className="tabular-nums mt-1 text-base font-bold text-white">
                  {Number(selectedTx.gross_amount_usdc || 0).toFixed(2)} USDC
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="text-[10px] uppercase text-slate-400">Pool / Debt Split</div>
                <div className="tabular-nums mt-1 text-base font-bold text-cyan-300">
                  {Number(selectedTx.pool_allocated_usdc || 0).toFixed(2)} USDC
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="text-[10px] uppercase text-slate-400">Net Wallet USDC</div>
                <div className="tabular-nums mt-1 text-base font-bold text-emerald-400">
                  {Number(selectedTx.user_net_usdc || 0).toFixed(2)} USDC
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <div className="text-[10px] uppercase text-slate-400">Remaining Debt</div>
                <div className="tabular-nums mt-1 text-base font-bold text-amber-300">
                  {Number(selectedTx.remaining_debt_usdc || 0).toFixed(2)} USDC
                </div>
              </div>
            </div>

            {/* Full Metadata Key-Value Grid */}
            <div className="mt-4 space-y-2 rounded-xl border border-slate-800/90 bg-slate-950/90 p-4 font-mono text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2">
                <span className="text-slate-400">EVENT_ID</span>
                <span className="text-slate-200">{selectedTx.event_id}</span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2">
                <span className="text-slate-400">TX_HASH</span>
                {selectedTx.tx_hash ? (
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300">
                      {shortenAddress(selectedTx.tx_hash, 12, 10)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyText('hash', selectedTx.tx_hash)}
                      className="rounded border border-slate-800 bg-slate-900 p-1 text-slate-400 hover:text-white"
                      title="Copy Full Transaction Hash"
                    >
                      {copiedField === 'hash' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2">
                <span className="text-slate-400">WALLET_ADDRESS</span>
                <span className="text-emerald-300">
                  {selectedTx.wallet_address || address}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2">
                <span className="text-slate-400">COUNTERPARTY</span>
                <span className="text-slate-200">{selectedTx.counterparty || 'Protocol Vault'}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-4">
                <div>
                  <span className="block text-[10px] text-slate-500">LEDGER</span>
                  <span className="text-white">#{selectedTx.ledger}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500">FEE / YIELD</span>
                  <span className="text-cyan-300">
                    {Number(selectedTx.fee_or_yield_usdc || 0).toFixed(4)} USDC
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500">CREDIT TIER</span>
                  <span className="text-amber-300">Tier {selectedTx.credit_tier ?? 0}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500">STATUS</span>
                  <span className="text-emerald-400">{selectedTx.status || 'CONFIRMED'}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
              {selectedTx.tx_hash ? (
                <a
                  href={getExplorerTxUrl(selectedTx.tx_hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2 font-bold text-cyan-200 transition hover:bg-cyan-500/25"
                >
                  <span>View on Stellar Expert</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span />
              )}

              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="rounded-xl bg-slate-800 px-5 py-2 font-semibold text-white transition hover:bg-slate-700"
              >
                Close
              </button>
            </div>
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