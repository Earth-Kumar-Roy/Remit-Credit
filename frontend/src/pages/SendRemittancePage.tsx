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
  const [dropKey, setDropKey] = useState(0);
  const heroRef = React.useRef<HTMLElement | null>(null);
  const wasVisible = React.useRef(false);
  useEffect(() => {
    const el = heroRef.current; if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting ?? false;
      if (visible && !wasVisible.current) setDropKey(k => k + 1); // scrolled back into view
      wasVisible.current = visible;
    }, { threshold: 0.35 });
    obs.observe(el); return () => obs.disconnect();
  }, []);
  const quoteWords = ['Move', 'Money', 'Across', 'Borders.', 'Make', 'Every', 'Transfer', 'Count.'];
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
    <div className="rc-human space-y-10 pb-14 text-[#1d2a1e]">
      <style>{`
        .rc-human{font-family: Georgia,'Times New Roman',serif}
        .rc-sans{font-family: ui-sans-serif,system-ui,sans-serif}
        .rc-hand{font-family:'Segoe Print','Bradley Hand','Comic Sans MS',cursive}
        .rc-paper{background:#f7f1de;background-image:radial-gradient(#1d2a1e12 1px,transparent 1px);background-size:22px 22px}
        .rc-ledger{background:repeating-linear-gradient(#fffdf4 0,#fffdf4 31px,#cbd5c8 31px,#fffdf4 32px)}
        .rc-tape{position:relative}.rc-tape:before{content:'';position:absolute;top:-11px;left:50%;transform:translateX(-50%) rotate(-3deg);width:92px;height:24px;background:#d9c98a99;border-left:1px dashed #a99a5a;border-right:1px dashed #a99a5a}
        .rc-stamp{border:2.5px solid #166534;color:#166534;border-radius:9999px;transform:rotate(-8deg)}
        @keyframes rc-word{0%{transform:translateY(-46px) rotate(-7deg);opacity:0}18%{opacity:1}100%{transform:translateY(0) rotate(0deg);opacity:1}}
        .rc-word{display:inline-block;opacity:0;animation:rc-word 3.4s cubic-bezier(.2,.9,.3,1.2) forwards}
        @keyframes rc-underline{from{stroke-dashoffset:130}to{stroke-dashoffset:0}}
        .rc-underline{stroke-dasharray:130;animation:rc-underline 1.1s ease .9s forwards}
        @keyframes rc-lid{from{transform:perspective(700px) rotateX(0)}to{transform:perspective(700px) rotateX(-108deg)}}
        .rc-lid-open{animation:rc-lid .9s ease forwards;transform-origin:top center}
        @keyframes rc-drop{0%{transform:translateY(-70px) rotate(-8deg);opacity:0}18%{opacity:1}100%{transform:translateY(118px) rotate(3deg);opacity:1}}
        .rc-drop{animation:rc-drop 2.2s ease-in forwards}
      `}</style>
      {/* Header — paper, not a CAD monolith */}
      <section ref={heroRef} className="rc-paper relative overflow-hidden rounded-[28px] border-2 border-[#1d2a1e] shadow-[8px_8px_0_#1d2a1e]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-[#1d2a1e]/30 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-[#1d2a1e] bg-black"><Send className="h-5 w-5 text-white" /></div>
            <div><p className="rc-sans text-sm font-black tracking-tight">Send Remittance</p><p className="rc-hand text-xs text-[#4a5a5a]">SEP-31 · one transaction</p></div>
          </div>
          <p className="rc-sans text-[11px] font-bold uppercase tracking-widest">Min transfer · 100 USDC &nbsp;•&nbsp; <span className="text-[#166534]">~5s finality</span></p>
        </div>

        <div className="grid gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[1.2fr_.8fr]">
          <div className="rc-ledger relative px-1 py-2">
            {/* THE quotation — drops word-by-word, only on first load / scroll-back */}
            <h1 key={dropKey} className="text-[36px] font-black leading-[1.02] tracking-tight sm:text-5xl" aria-label="Move Money Across Borders. Make Every Transfer Count.">
              {quoteWords.map((w, i) => (<span key={i} className="rc-word mr-[0.22em] text-[#166534]" style={{ animationDelay: `${i * 0.28}s` }}>{w}</span>))}
              <svg className="mt-1 block h-3 w-56 max-w-full" viewBox="0 0 220 10" preserveAspectRatio="none" aria-hidden><path className="rc-underline" d="M3 7 Q60 2 110 6 T217 4" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" /></svg>
            </h1>
            <button type="button" onClick={() => setDropKey(k => k + 1)} className="rc-sans mt-2 text-xs font-bold text-[#166534] underline underline-offset-2">↺ drop it again</button>
            <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#344433]">
              Send USDC straight to family or a beneficiary on Stellar. Every wire builds their
              cash-flow credit history, tops up the First-Loss Backstop Reserve, and settles an
              active loan in the same transaction.
            </p>
          </div>

          {/* Right page — the two crates, closed + open */}
          <div className="rounded-xl border-2 border-dashed border-[#166534] bg-[#fffdf4] p-4">
            <div className="flex items-center justify-between"><p className="rc-sans text-[11px] font-black uppercase tracking-widest">What happens to one wire</p><span className="rc-stamp px-2 py-0.5 text-[10px] font-black">ATOMIC ✓</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><p className="rc-sans mb-1 text-center text-[10px] font-black uppercase text-[#1d2a1e]">◼ Closed</p>
                <div className="mx-auto h-7 w-[86%] rounded-t border-2 border-b-0 border-[#1d2a1e] bg-[#b98a3e] text-center text-[10px] font-black leading-7 text-[#1d2a1e]">SEALED</div>
                <div className="rounded-b border-2 border-[#1d2a1e] bg-[#d9b06a] px-2 py-3 text-center text-xs font-black text-[#1d2a1e]">100+ USDC<br /><span className="rc-hand font-normal">inside</span></div></div>
              <div><p className="rc-sans mb-1 text-center text-[10px] font-black uppercase text-[#166534]">◻ Open</p>
                <div className="rc-lid-open mx-auto h-7 w-[86%] rounded-t border-2 border-b-0 border-[#1d2a1e] bg-[#b98a3e] text-center text-[10px] font-black leading-7 text-[#1d2a1e]">OPENED ✓</div>
                <div className="rounded-b border-2 border-[#1d2a1e] bg-[#d9b06a] px-2 py-3 text-center text-xs font-black text-[#1d2a1e]"><span className="text-[#166534]">{formatBps(10000 - config.waterfallSplitBps)} → family</span><br /><span className="text-[#8a5a17]">{formatBps(config.waterfallSplitBps)} → loan</span></div></div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`rc-sans inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${keeperOnline ? 'border-[#166534] bg-[#dff2d6] text-[#166534]' : 'border-[#8a5a17] bg-[#fff3c4] text-[#8a5a17]'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${keeperOnline ? 'bg-[#166534]' : 'bg-[#8a5a17]'}`} />{keeperOnline ? 'Anchor relay: online' : 'Anchor relay: standby'}
              </span>
              <a href={getExplorerContractUrl()} target="_blank" rel="noreferrer" className="rc-sans inline-flex items-center gap-1 rounded-full border border-[#1d2a1e] bg-white px-3 py-1 text-[11px] font-bold text-[#1d2a1e]"><Cpu className="h-3.5 w-3.5" />{shortContractId}<ArrowUpRight className="h-3.5 w-3.5" /></a>
            </div>
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
      <div className="rc-paper grid grid-cols-1 gap-5 rounded-[24px] border-2 border-[#1d2a1e] p-5 shadow-[6px_6px_0_#1d2a1e] sm:p-6 md:grid-cols-3">
        <div className="rc-tape -rotate-1 rounded-sm border border-[#1d2a1e]/20 bg-[#dff2d6] p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#166534]">
            <ShieldCheck className="h-4 w-4" />
            <span>Exact Beneficiary Delivery</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#344433]">
            Gross wire amount is pre-computed automatically so the {formatBps(config.remitFeeBps)}{' '}
            Backstop fee (capped at ${formatUsdc(config.remitFeeCap, 0)} USDC) never reduces your
            recipient&apos;s intended payout.
          </p>
        </div>

        <div className="rc-tape rotate-1 rounded-sm border border-[#1d2a1e]/20 bg-[#fff3c4] p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#8a5a17]">
            <SplitSquareVertical className="h-4 w-4" />
            <span>Single-Tx Waterfall Split</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#344433]">
            If the recipient holds an active loan, {formatBps(config.waterfallSplitBps)} of the
            loan obligation is settled on-time (or 100% if overdue) inside the same ledger close.
          </p>
        </div>

        <div className="rc-tape -rotate-1 rounded-sm border border-[#1d2a1e]/20 bg-[#ffe4d6] p-5">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-[#8a5a17]">
            <Layers className="h-4 w-4" />
            <span>Rolling 8-Inflow Credit Boost</span>
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#344433]">
            Every verified transfer updates the recipient&apos;s rolling 8-remittance average and
            cycle streak toward unlocking 50% LTV zero-collateral microcredit.
          </p>
        </div>
      </div>

      {/* Remittance History — Shown ONLY when a Freighter wallet is connected */}
      {address && (
        <div className="rc-paper relative overflow-hidden rounded-[24px] border-2 border-[#1d2a1e] p-5 shadow-[6px_6px_0_#1d2a1e] sm:p-6">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[#166534]/40" />
          <span className="pointer-events-none absolute left-3 top-2 select-none font-mono text-[9px] text-[#5a6a5a]">
            ⌜ REMITTANCE_LEDGER // WALLET: {shortenAddress(address, 5, 4)} ⌝
          </span>

          {/* Header & Search Input */}
          <div className="mt-2 flex flex-col justify-between gap-4 border-b-2 border-dashed border-[#1d2a1e]/30 pb-4 sm:flex-row sm:items-center">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#166534]">
                ◈ VERIFIED REMITTANCE STREAM
              </div>
              <h2 className="mt-0.5 text-base font-black text-[#1d2a1e]">Remittance History</h2>
              <p className="text-xs text-[#344433]">
                Showing {paginatedRemittances.length} of {filteredRemittances.length} remittance
                transfers for {shortenAddress(address, 6, 5)}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5a6a5a]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wallet, tx hash, or IST date..."
                className="w-full rounded-xl border-2 border-[#1d2a1e] bg-white py-2 pl-9 pr-8 font-mono text-xs text-[#1d2a1e] placeholder-[#8a9a8a] focus:border-[#166534] focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#5a6a5a] hover:text-[#1d2a1e]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Remittance Rows */}
          {paginatedRemittances.length === 0 ? (
            <div className="py-10 text-center font-mono text-xs text-[#5a6a5a]">
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
                    className="flex flex-col justify-between gap-2 rounded-xl border border-[#1d2a1e]/30 bg-white px-4 py-3 text-[#1d2a1e] transition hover:border-[#166534] sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          isOutgoing
                            ? 'border-[#8a5a17]/40 bg-[#fff3c4] text-[#8a5a17]'
                            : 'border-[#166534]/40 bg-[#dff2d6] text-[#166534]'
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
                                ? 'bg-[#fff3c4] text-[#8a5a17] ring-[#8a5a17]/40'
                                : 'bg-[#dff2d6] text-[#166534] ring-[#166534]/40'
                            }`}
                          >
                            {isOutgoing ? 'REMITTANCE OUT' : 'REMITTANCE IN'}
                          </span>
                          {ev.wallet_address && (
                            <span className="rounded bg-[#eef5e9] px-1.5 py-0.5 text-[11px] text-[#166534]">
                              {isOutgoing
                                ? `To: ${shortenAddress(ev.counterparty || ev.wallet_address, 5, 4)}`
                                : `To: ${shortenAddress(ev.wallet_address, 5, 4)}`}
                            </span>
                          )}
                          {!isOutgoing && ev.counterparty && (
                            <span className="rounded bg-[#f7f1de] px-1.5 py-0.5 text-[11px] text-[#5a6a5a]">
                              From: {shortenAddress(ev.counterparty, 5, 4)}
                            </span>
                          )}
                          {ev.timestamp_ist && (
                            <span className="text-[10px] text-[#5a6a5a]">{ev.timestamp_ist} IST</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[#344433]">
                          {isOutgoing ? (
                            <>
                              Sent{' '}
                              <strong className="tabular-nums text-[#8a5a17]">{gross} USDC</strong>{' '}
                              total debited (Recipient delivered:{' '}
                              <strong className="tabular-nums text-[#1d2a1e]">{net} USDC</strong>)
                            </>
                          ) : (
                            <>
                              Verified remittance of{' '}
                              <strong className="tabular-nums text-[#166534]">
                                {gross} USDC
                              </strong>{' '}
                              credited (Net delivered:{' '}
                              <strong className="tabular-nums text-[#1d2a1e]">{net} USDC</strong> · Tier{' '}
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
                        className="inline-flex items-center gap-1 self-start rounded-lg border border-[#1d2a1e]/40 bg-white px-2.5 py-1 font-mono text-[11px] font-semibold text-[#344433] transition hover:border-[#166534] hover:text-[#166534] sm:self-center"
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
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[#1d2a1e]/30 pt-4 font-mono text-xs text-[#1d2a1e]">
              <span className="text-slate-400">
                Page <strong className="text-[#1d2a1e]">{safePage}</strong> of{' '}
                <strong className="text-[#1d2a1e]">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-[#1d2a1e] bg-white px-3 py-1.5 font-semibold text-[#1d2a1e] transition hover:border-[#166534] hover:text-[#166534] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="inline-flex items-center gap-1 rounded-lg border-2 border-[#1d2a1e] bg-white px-3 py-1.5 font-semibold text-[#1d2a1e] transition hover:border-[#166534] hover:text-[#166534] disabled:cursor-not-allowed disabled:opacity-40"
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