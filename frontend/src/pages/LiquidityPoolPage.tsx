import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Landmark,
  Layers,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { BackstopMetricsCard } from '@/components/lender/BackstopMetricsCard';
import { LiquidityPoolCard } from '@/components/lender/LiquidityPoolCard';
import { getExplorerTxUrl } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import {
  ActiveLoanData,
  LpPositionBreakdown,
  PoolStatsData,
  ProtocolConfigData,
} from '@/hooks/useBorrowerProfile';
import { ProtocolEventItem } from '@/hooks/useProtocolEvents';
import { formatBps, shortenAddress } from '@/utils/stroops';

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

const ITEMS_PER_PAGE = 10;

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // When no wallet is connected, show no LP history; when connected, scope strictly to that wallet's LP IN / LP OUT
  const lpEvents = useMemo(() => {
    if (!address) return [];
    const normalizedWallet = address.trim().toUpperCase();
    return events.filter(
      (ev) =>
        (ev.tx_category === 'LP_SUPPLY' || ev.tx_category === 'LP_WITHDRAW') &&
        (ev.wallet_address || '').trim().toUpperCase() === normalizedWallet
    );
  }, [address, events]);

  // Filter by LP wallet address, tx hash, direction, timestamp, or amount
  const filteredLpEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return lpEvents;
    return lpEvents.filter(
      (ev) =>
        (ev.wallet_address && ev.wallet_address.toLowerCase().includes(q)) ||
        (ev.tx_hash && ev.tx_hash.toLowerCase().includes(q)) ||
        (ev.timestamp_ist && ev.timestamp_ist.toLowerCase().includes(q)) ||
        (ev.tx_category && ev.tx_category.toLowerCase().includes(q)) ||
        String(ev.gross_amount_usdc ?? '').includes(q)
    );
  }, [lpEvents, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [address, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredLpEvents.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedLpEvents = filteredLpEvents.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 pb-10">
      {/* Architectural Header Monolith with Larger Tagline */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-gradient-to-r from-[#080e1a] via-slate-900 to-sky-950/30 p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_90%)]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="lpHeaderGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.85" />
                <circle cx="40" cy="40" r="1" fill="#38bdf8" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#lpHeaderGrid)" />
          </svg>
        </div>
        <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-sky-400/75">
          ⌜ SEC_04 // LIQUIDITY_VAULT_ARCHITECTURE ⌝
        </span>

        <div className="relative z-10 mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-400/35 bg-sky-500/15">
              <Landmark className="h-6 w-6 text-sky-400" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-extrabold tracking-wide text-amber-300 sm:text-lg">
                “Provide Liquidity. Power Credit. Earn Together.”
              </p>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
                <span className="font-bold text-sky-300">◈ ERC-4626 PRO-RATA LIQUIDITY VAULT</span>
                <span className="text-slate-600">//</span>
                <span className="text-emerald-300">MIN SUPPLY: 100 USDC</span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                USDC Liquidity Vault &amp; Backstop
              </h1>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                Supply USDC to underwrite verified cross-border remittance streams and earn{' '}
                {formatBps(config.loanFeeBps)} loan yield shielded by the First-Loss Backstop
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{formatBps(config.backstopFeeBps)} BACKSTOP CUT</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 font-semibold text-sky-300">
              <Layers className="h-4 w-4 text-sky-400" />
              <span>{formatBps(config.waterfallSplitBps)} WATERFALL</span>
            </span>
          </div>
        </div>
      </section>

      {/* LP Metrics & Distinct Personal Position Controls */}
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

      {/* LP-Only Activity Ledger — Shown ONLY when a Freighter wallet is connected */}
      {address && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-400/45 to-transparent" />
          <span className="pointer-events-none absolute left-3 top-2 select-none font-mono text-[9px] text-slate-500">
            ⌜ LP_FLOW_LEDGER // WALLET: {shortenAddress(address, 5, 4)} ⌝
          </span>

          {/* Header & Search Bar */}
          <div className="mt-2 flex flex-col justify-between gap-4 border-b border-slate-800/90 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-sky-400">
                ◈ LIQUIDITY PROVIDER FLOWS
              </div>
              <h2 className="mt-0.5 text-base font-bold text-white">
                LP Supply &amp; Withdraw Ledger
              </h2>
              <p className="text-xs text-slate-400">
                Showing {paginatedLpEvents.length} of {filteredLpEvents.length} LP deposits &amp;
                withdrawals for {shortenAddress(address, 6, 5)}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search LP tx hash or IST date..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-8 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-sky-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* LP IN / LP OUT Rows */}
          {paginatedLpEvents.length === 0 ? (
            <div className="py-10 text-center font-mono text-xs text-slate-500">
              {isEventsLoading
                ? 'SYNCING LP SUPPLY & WITHDRAWAL RECORDS...'
                : searchQuery
                ? 'NO LP TRANSACTIONS MATCH YOUR SEARCH.'
                : 'NO LP DEPOSITS OR WITHDRAWALS RECORDED FOR THIS WALLET YET.'}
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {paginatedLpEvents.map((ev) => {
                const isSupply = ev.tx_category === 'LP_SUPPLY';
                const amount = Number(ev.gross_amount_usdc || 0).toFixed(2);

                return (
                  <div
                    key={ev.event_id}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/75 px-4 py-3 transition hover:border-slate-700 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          isSupply
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'
                            : 'border-amber-500/35 bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {isSupply ? (
                          <ArrowDownToLine className="h-4 w-4" />
                        ) : (
                          <ArrowUpFromLine className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ring-1 ${
                              isSupply
                                ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/35'
                                : 'bg-amber-500/15 text-amber-300 ring-amber-500/35'
                            }`}
                          >
                            {isSupply ? 'LP IN · SUPPLY' : 'LP OUT · WITHDRAW'}
                          </span>
                          {ev.wallet_address && (
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-cyan-300">
                              {shortenAddress(ev.wallet_address, 6, 5)}
                            </span>
                          )}
                          {ev.timestamp_ist && (
                            <span className="text-[10px] text-slate-500">{ev.timestamp_ist} IST</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-300">
                          {isSupply ? (
                            <>
                              Supplied{' '}
                              <strong className="tabular-nums text-emerald-400">
                                {amount} USDC
                              </strong>{' '}
                              into the Liquidity Vault
                            </>
                          ) : (
                            <>
                              Withdrew{' '}
                              <strong className="tabular-nums text-amber-300">
                                {amount} USDC
                              </strong>{' '}
                              from the Liquidity Vault
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {ev.tx_hash && (
                      <a
                        href={getExplorerTxUrl(ev.tx_hash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 self-start rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-400 transition hover:border-sky-500/40 hover:text-sky-300 sm:self-center"
                      >
                        <span>{shortenAddress(ev.tx_hash, 6, 4)}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls (Max 10 per page) */}
          {filteredLpEvents.length > ITEMS_PER_PAGE && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4 font-mono text-xs">
              <span className="text-slate-400">
                Page <strong className="text-white">{safePage}</strong> of{' '}
                <strong className="text-white">{totalPages}</strong> (10 per page)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-sky-500/40 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-sky-500/40 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};