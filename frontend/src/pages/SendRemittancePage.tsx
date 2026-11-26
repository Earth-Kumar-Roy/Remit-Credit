import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Cpu,
  ExternalLink,
  Layers,
  Search,
  Send,
  ShieldCheck,
  SplitSquareVertical,
  X,
} from 'lucide-react';
import { AnchorSimulator } from '@/components/simulator/AnchorSimulator';
import { getExplorerContractUrl, getExplorerTxUrl, STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { PoolStatsData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { KycStanding } from '@/hooks/useKycStatus';
import { ProtocolEventItem } from '@/hooks/useProtocolEvents';
import { formatBps, formatUsdc, shortenAddress } from '@/utils/stroops';

interface SendRemittancePageProps {
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  usdcBalance: bigint;
  kycStatus: KycStanding;
  events: ProtocolEventItem[];
  isEventsLoading: boolean;
  keeperOnline: boolean;
  onRefreshAll: () => Promise<void>;
}

const ITEMS_PER_PAGE = 10;

export const SendRemittancePage: React.FC<SendRemittancePageProps> = ({
  config,
  usdcBalance,
  kycStatus,
  events,
  isEventsLoading,
  keeperOnline,
  onRefreshAll,
}) => {
  const { address } = useWallet();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // When no wallet is connected, show no remittance history
  const walletRemittanceEvents = useMemo(() => {
    if (!address) return [];
    const normalizedWallet = address.trim().toUpperCase();

    return events.filter((ev) => {
      const cat = ev.tx_category;
      if (cat !== 'REMITTANCE_IN' && cat !== 'REMITTANCE_OUT') return false;
      const w = (ev.wallet_address || '').trim().toUpperCase();
      const cp = (ev.counterparty || '').trim().toUpperCase();
      return w === normalizedWallet || cp === normalizedWallet;
    });
  }, [address, events]);

  // Search filter across wallet address, counterparty, tx hash, timestamp, or amount
  const filteredRemittances = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return walletRemittanceEvents;
    return walletRemittanceEvents.filter(
      (ev) =>
        (ev.wallet_address && ev.wallet_address.toLowerCase().includes(q)) ||
        (ev.counterparty && ev.counterparty.toLowerCase().includes(q)) ||
        (ev.tx_hash && ev.tx_hash.toLowerCase().includes(q)) ||
        (ev.timestamp_ist && ev.timestamp_ist.toLowerCase().includes(q)) ||
        String(ev.gross_amount_usdc ?? '').includes(q)
    );
  }, [walletRemittanceEvents, searchQuery]);

  // Reset to page 1 when wallet or search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [address, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRemittances.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedRemittances = filteredRemittances.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const shortContractId =
    STELLAR_CONFIG.remitContractId.length > 12
      ? `${STELLAR_CONFIG.remitContractId.slice(0, 6)}...${STELLAR_CONFIG.remitContractId.slice(-6)}`
      : STELLAR_CONFIG.remitContractId;

  return (
    <div className="space-y-6 pb-10">
      {/* Architectural Header Monolith */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_90%)]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="remitPageCadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.85" />
                <circle cx="40" cy="40" r="1" fill="#22d3ee" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#remitPageCadGrid)" />
          </svg>
        </div>

        <div className="pointer-events-none absolute -top-20 right-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-amber-500/10 blur-[120px]" />
        <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-cyan-400/70">
          ⌜ SEC_02 // REMITTANCE_CORRIDOR ⌝
        </span>
        <span className="pointer-events-none absolute right-4 top-3 select-none font-mono text-[10px] text-slate-600">
          [+]
        </span>

        <div className="relative z-10 mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 ring-1 ring-cyan-500/35">
              <Send className="h-6 w-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-base font-extrabold tracking-wide text-amber-300 sm:text-lg">
                “Move Money Across Borders. Make Every Transfer Count.”
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
                <span className="font-bold text-cyan-300">◈ SEP-31 ATOMIC SETTLEMENT RAIL</span>
                <span className="text-slate-600">//</span>
                <span className="text-emerald-300">MIN TRANSFER: 100 USDC</span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Send Cross-Border Remittance
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                Dispatch USDC directly to family or beneficiaries on Stellar. Every wire builds
                recipient cash-flow credit history, funds the First-Loss Backstop Reserve, and
                auto-settles active loans in a single atomic transaction.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1.5 font-bold text-amber-300">
              <span>2%+ FEES</span>
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold ${
                keeperOnline
                  ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-300'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  keeperOnline ? 'animate-pulse bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              {keeperOnline ? 'ANCHOR_RELAY: ONLINE' : 'ANCHOR_RELAY: STANDBY'}
            </span>

            <a
              href={getExplorerContractUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
            >
              <Cpu className="h-3.5 w-3.5 text-cyan-400" />
              <span>{shortContractId}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* Main Quotation & Atomic Wire Transfer Box (SEP-12 KYC Gated) */}
      <AnchorSimulator
        keeperOnline={keeperOnline}
        kycStatus={kycStatus}
        usdcBalance={usdcBalance}
        remitFeeBps={config.remitFeeBps}
        remitFeeCap={config.remitFeeCap}
        waterfallSplitBps={config.waterfallSplitBps}
        onSettled={onRefreshAll}
      />

      {/* Settlement Guarantees Strip */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>Exact Beneficiary Delivery</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Gross wire amount is pre-computed automatically so the {formatBps(config.remitFeeBps)}{' '}
            Backstop fee (capped at ${formatUsdc(config.remitFeeCap, 0)} USDC) never reduces your
            recipient&apos;s intended payout.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-cyan-400">
            <SplitSquareVertical className="h-4 w-4" />
            <span>Single-Tx Waterfall Split</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            If the recipient holds an active loan, {formatBps(config.waterfallSplitBps)} of the
            loan obligation is settled on-time (or 100% if overdue) inside the same ledger close.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-amber-400">
            <Layers className="h-4 w-4" />
            <span>Rolling 8-Inflow Credit Boost</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
            Every verified transfer updates the recipient&apos;s rolling 8-remittance average and
            cycle streak toward unlocking 50% LTV zero-collateral microcredit.
          </p>
        </div>
      </div>

      {/* Remittance History — Shown ONLY when a Freighter wallet is connected */}
      {address && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
          <span className="pointer-events-none absolute left-3 top-2 select-none font-mono text-[9px] text-slate-500">
            ⌜ REMITTANCE_LEDGER // WALLET: {shortenAddress(address, 5, 4)} ⌝
          </span>

          {/* Header & Search Input */}
          <div className="mt-2 flex flex-col justify-between gap-4 border-b border-slate-800/90 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                ◈ VERIFIED REMITTANCE STREAM
              </div>
              <h2 className="mt-0.5 text-base font-bold text-white">Remittance History</h2>
              <p className="text-xs text-slate-400">
                Showing {paginatedRemittances.length} of {filteredRemittances.length} remittance
                transfers for {shortenAddress(address, 6, 5)}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wallet, tx hash, or IST date..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-8 font-mono text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
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

          {/* Remittance Rows */}
          {paginatedRemittances.length === 0 ? (
            <div className="py-10 text-center font-mono text-xs text-slate-500">
              {isEventsLoading
                ? 'SYNCING REMITTANCE LEDGER RECORDS...'
                : searchQuery
                ? 'NO REMITTANCE RECORDS MATCH YOUR SEARCH.'
                : 'NO REMITTANCE TRANSFERS RECORDED FOR THIS WALLET YET.'}
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {paginatedRemittances.map((ev) => {
                const normalizedWallet = address.trim().toUpperCase();
                const isOutgoing =
                  ev.tx_category === 'REMITTANCE_OUT' ||
                  (ev.counterparty || '').trim().toUpperCase() === normalizedWallet;
                const gross = Number(ev.gross_amount_usdc || 0).toFixed(2);
                const net = Math.abs(Number(ev.user_net_usdc || ev.gross_amount_usdc || 0)).toFixed(2);

                return (
                  <div
                    key={ev.event_id}
                    className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/75 px-4 py-3 transition hover:border-slate-700 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          isOutgoing
                            ? 'border-amber-500/35 bg-amber-500/10 text-amber-400'
                            : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {isOutgoing ? (
                          <Send className="h-4 w-4" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 font-mono">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ring-1 ${
                              isOutgoing
                                ? 'bg-amber-500/15 text-amber-300 ring-amber-500/35'
                                : 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/35'
                            }`}
                          >
                            {isOutgoing ? 'REMITTANCE OUT' : 'REMITTANCE IN'}
                          </span>
                          {ev.wallet_address && (
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-cyan-300">
                              {isOutgoing
                                ? `To: ${shortenAddress(ev.counterparty || ev.wallet_address, 5, 4)}`
                                : `To: ${shortenAddress(ev.wallet_address, 5, 4)}`}
                            </span>
                          )}
                          {!isOutgoing && ev.counterparty && (
                            <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-slate-400">
                              From: {shortenAddress(ev.counterparty, 5, 4)}
                            </span>
                          )}
                          {ev.timestamp_ist && (
                            <span className="text-[10px] text-slate-500">{ev.timestamp_ist} IST</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-slate-300">
                          {isOutgoing ? (
                            <>
                              Sent{' '}
                              <strong className="tabular-nums text-amber-300">{gross} USDC</strong>{' '}
                              total debited (Recipient delivered:{' '}
                              <strong className="tabular-nums text-white">{net} USDC</strong>)
                            </>
                          ) : (
                            <>
                              Verified remittance of{' '}
                              <strong className="tabular-nums text-emerald-400">
                                {gross} USDC
                              </strong>{' '}
                              credited (Net delivered:{' '}
                              <strong className="tabular-nums text-white">{net} USDC</strong> · Tier{' '}
                              {ev.credit_tier})
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
                        className="inline-flex items-center gap-1 self-start rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300 sm:self-center"
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
          {filteredRemittances.length > ITEMS_PER_PAGE && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-4 font-mono text-xs">
              <span className="text-slate-400">
                Page <strong className="text-white">{safePage}</strong> of{' '}
                <strong className="text-white">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
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