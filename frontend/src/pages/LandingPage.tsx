import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, RotateCw, Wallet } from 'lucide-react';
import { getExplorerContractUrl, STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { PoolStatsData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { KycStanding } from '@/hooks/useKycStatus';
import { formatBps, formatUsdc } from '@/utils/stroops';

interface LandingPageProps {
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  kycStatus: KycStanding;
}

interface DroppingHeadingProps {
  lines: string[];
  className?: string;
  wordClassName?: string;
  triggerKey?: number;
}

/**
 * Drops each word from above when scrolled into view (or when `triggerKey` increments).
 */
const DroppingHeading: React.FC<DroppingHeadingProps> = ({
  lines,
  className = '',
  wordClassName = '',
  triggerKey = 0,
}) => {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const wasVisible = useRef(false);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        if (visible && !wasVisible.current) {
          setAnimKey((k) => k + 1);
        }
        wasVisible.current = visible;
      },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const combinedKey = `${animKey}-${triggerKey}`;
  let globalIndex = 0;

  return (
    <h2 ref={ref} key={combinedKey} className={className} aria-label={lines.join(' ')}>
      {lines.map((line, lineIdx) => (
        <span key={lineIdx} className="block">
          {line.split(' ').map((word, wordIdx) => {
            const delay = globalIndex * 0.14;
            globalIndex += 1;
            return (
              <span
                key={`${lineIdx}-${wordIdx}`}
                className={`rc-word mr-[0.24em] ${wordClassName}`}
                style={{ animationDelay: `${delay}s` }}
              >
                {word}
              </span>
            );
          })}
        </span>
      ))}
    </h2>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ poolStats, config, kycStatus }) => {
  const { address, isConnecting, connect, setActivePage } = useWallet();
  const [simMonthlyInflow, setSimMonthlyInflow] = useState(400);
  const [simCycles, setSimCycles] = useState(6);
  const [simLoansRepaid, setSimLoansRepaid] = useState(1);
  const [dropKey, setDropKey] = useState(0);
  const heroRef = useRef<HTMLElement | null>(null);
  const wasHeroVisible = useRef(false);

  // Ledger page flip state (false = Page 1 Pool Ledger, true = Page 2 Contract Rules Sheet)
  const [pageTurned, setPageTurned] = useState(false);

  // Interactive crate state (false = Closed Crate, true = Opened Crate)
  const [crateOpen, setCrateOpen] = useState(false);

  // Hero tagline drops on initial load + whenever user scrolls back to hero
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries[0]?.isIntersecting ?? false;
        if (visible && !wasHeroVisible.current) setDropKey((k) => k + 1);
        wasHeroVisible.current = visible;
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const quoteWords = ['Your', 'Remittance.', 'Your', 'Credit.', 'Your', 'Financial', 'Freedom.'];

  const waterfallRepayRatio = Number(config.waterfallSplitBps || 4000) / 10_000;
  const waterfallDirectRatio = Math.max(0, 1 - waterfallRepayRatio);
  const simRepayAmount = simMonthlyInflow * waterfallRepayRatio;
  const simFamilyAmount = simMonthlyInflow * waterfallDirectRatio;

  const t1Cap = Number(config.tier1Cap) / 10_000_000 || 50;
  const t2Cap = Number(config.tier2Cap) / 10_000_000 || 100;
  const t3Cap = Number(config.tier3Cap) / 10_000_000 || 200;
  const t4Cap = Number(config.tier4Cap) / 10_000_000 || 400;

  let simTier = 0;
  let simTierLabel = 'TIER 0 [LOCKED · < 3 CYCLES]';
  let simHardCap = 0;

  if (simCycles >= config.minCyclesRequired) {
    if (simLoansRepaid >= 4 && simCycles >= 15 && simMonthlyInflow >= t4Cap) {
      simTier = 4;
      simTierLabel = 'TIER 4 [SOVEREIGN MAX]';
      simHardCap = t4Cap;
    } else if (simLoansRepaid >= 2 && simCycles >= 10 && simMonthlyInflow >= t3Cap) {
      simTier = 3;
      simTierLabel = 'TIER 3 [ESTABLISHED]';
      simHardCap = t3Cap;
    } else if (simLoansRepaid >= 1 && simCycles >= 6 && simMonthlyInflow >= t2Cap) {
      simTier = 2;
      simTierLabel = 'TIER 2 [VERIFIED STREAM]';
      simHardCap = t2Cap;
    } else {
      simTier = 1;
      simTierLabel = 'TIER 1 [UNLOCKED]';
      simHardCap = t1Cap;
    }
  }

  const simCreditLimit = simTier > 0 ? Math.min(simMonthlyInflow * 0.5, simHardCap) : 0;
  const borrowedLabel = formatUsdc(poolStats.totalLent, 0);
  const shortContractId =
    STELLAR_CONFIG.remitContractId.length > 12
      ? `${STELLAR_CONFIG.remitContractId.slice(0, 6)}...${STELLAR_CONFIG.remitContractId.slice(-6)}`
      : STELLAR_CONFIG.remitContractId;

  return (
    <div className="rc-human space-y-16 pb-14 text-[#1d2a1e]">
      <style>{`
        .rc-human{font-family: Georgia,'Times New Roman',serif}
        .rc-sans{font-family: ui-sans-serif,system-ui,sans-serif}
        .rc-hand{font-family:'Segoe Print','Bradley Hand','Comic Sans MS',cursive}
        .rc-paper{background:#f7f1de;background-image:radial-gradient(#1d2a1e12 1px,transparent 1px);background-size:22px 22px}
        .rc-ledger{background:repeating-linear-gradient(#fffdf4 0,#fffdf4 31px,#cbd5c8 31px,#fffdf4 32px)}
        .rc-tape{position:relative}.rc-tape:before{content:'';position:absolute;top:-11px;left:50%;transform:translateX(-50%) rotate(-3deg);width:92px;height:24px;background:#d9c98a99;border-left:1px dashed #a99a5a;border-right:1px dashed #a99a5a}
        .rc-stamp{border:2.5px solid #166534;color:#166534;border-radius:9999px;transform:rotate(-8deg)}
        @keyframes rc-drop{0%{transform:translateY(-70px) rotate(-8deg);opacity:0}18%{opacity:1}70%{transform:translateY(118px) rotate(5deg);opacity:1}100%{transform:translateY(148px) rotate(3deg);opacity:0}}
        @keyframes rc-float{0%,100%{transform:translateY(0) rotate(-1deg)}50%{transform:translateY(-6px) rotate(1deg)}}
        .rc-drop{animation:rc-drop 2.6s ease-in forwards}.rc-float{animation:rc-float 5s ease-in-out infinite}
        .rc-range{accent-color:#166534}
        @keyframes rc-word{0%{transform:translateY(-42px) rotate(-6deg);opacity:0}25%{opacity:1}100%{transform:translateY(0) rotate(0deg);opacity:1}}
        .rc-word{display:inline-block;opacity:0;animation:rc-word 1.2s cubic-bezier(.2,.9,.3,1.2) forwards}
        @keyframes rc-underline{from{stroke-dashoffset:130}to{stroke-dashoffset:0}}
        .rc-underline{stroke-dasharray:130;animation:rc-underline 1.1s ease .9s forwards}

        /* Interactive 3D Book Page Flip */
        .rc-book-stage{perspective:1600px}
        .rc-sheet{transition:transform .65s cubic-bezier(.22,.85,.32,1), opacity .35s ease;transform-origin:left center}
        .rc-sheet-flipping{transform:rotateY(-14deg) scale(0.985)}

        /* Interactive Crate Open / Close Transitions */
        .rc-crate-lid{
          transform-origin:top center;
          transition:transform .65s cubic-bezier(.22,.9,.32,1.15), box-shadow .5s ease;
        }
        .rc-crate-lid-closed{transform:perspective(750px) rotateX(0deg)}
        .rc-crate-lid-opened{transform:perspective(750px) rotateX(-118deg)}
        .rc-crate-content{
          transition:opacity .45s ease, transform .55s cubic-bezier(.22,.9,.32,1.1);
        }
      `}</style>

      {/* HERO — AN OPEN BOOK */}
      <section
        ref={heroRef}
        className="rc-paper relative overflow-hidden rounded-[28px] border-2 border-[#1d2a1e] shadow-[8px_8px_0_#1d2a1e]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-dashed border-[#1d2a1e]/30 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            {/* Larger Pure-Black Logo Emblem */}
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-[#1d2a1e] bg-black p-2 shadow-[4px_4px_0_#1d2a1e] sm:h-24 sm:w-24">
              <img
                src="/Logo.png"
                alt="RemitCredit Emblem"
                className="h-full w-full object-contain brightness-110 contrast-115 saturate-125"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#166534]/40 bg-[#d8ead0] px-2.5 py-0.5">
                <span className="h-2 w-2 rounded-full bg-[#166534]" />
                <span className="rc-sans text-[10px] font-black uppercase tracking-wider text-[#166534]">
                  SOROBAN V3 · SEP-12 &amp; SEP-31
                </span>
              </div>
              <p className="rc-sans mt-1 text-xl font-black tracking-tight sm:text-2xl">
                RemitCredit
              </p>
              <p className="rc-hand text-xs text-[#4a5a4a] sm:text-sm">
                zero-collateral cross-border remittance credit
              </p>
            </div>
          </div>
          <p className="rc-sans text-[11px] font-bold uppercase tracking-widest">
            Network · {STELLAR_CONFIG.network} &nbsp;•&nbsp;{' '}
            <span className="text-[#166534]">0% crypto collateral</span>
          </p>
        </div>

        {/* Dropping green credit */}
        <div
          className="pointer-events-none absolute right-6 top-28 z-10 hidden h-40 w-28 overflow-hidden sm:block"
          aria-hidden
        >
          <div
            key={dropKey}
            className="rc-drop absolute left-2 top-0 w-24 rounded-sm border border-[#166534] bg-[#d8ead0] px-2 py-2 text-center shadow"
          >
            <p className="rc-sans text-[10px] font-black text-[#166534]">CREDIT</p>
            <p className="rc-sans text-sm font-black">$ {simCreditLimit.toFixed(0)}</p>
            <p className="text-[9px]">USDC · unlocked</p>
          </div>
          <p className="absolute bottom-1 w-full text-center text-[10px]">↓ it lands here ↓</p>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_.85fr]">
          {/* LEFT PAGE — the story */}
          <div className="rc-ledger relative px-5 py-8 sm:px-9 sm:py-10">
            <p className="rc-hand text-lg text-[#8a5a17]">dear family,</p>

            {/* THE quotation — drops word-by-word on load / scroll-back */}
            <h1
              key={dropKey}
              className="mt-2 text-[42px] font-black leading-[1.02] tracking-tight sm:text-6xl"
              aria-label="Your Remittance. Your Credit. Your Financial Freedom."
            >
              {quoteWords.map((w, i) => (
                <span
                  key={i}
                  className="rc-word mr-[0.22em] text-[#166534]"
                  style={{ animationDelay: `${i * 0.22}s` }}
                >
                  {w}
                </span>
              ))}
              <svg
                className="mt-1 block h-3 w-56 max-w-full"
                viewBox="0 0 220 10"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  className="rc-underline"
                  d="M3 7 Q60 2 110 6 T217 4"
                  fill="none"
                  stroke="#166534"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </h1>

            <p className="rc-sans mt-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#5a6a5a]">
              Bridging global remittances with financial opportunity
            </p>
            <button
              type="button"
              onClick={() => setDropKey((k) => k + 1)}
              className="rc-sans mt-2 text-xs font-bold text-[#166534] underline underline-offset-2"
            >
              ↺ drop it again
            </button>

            <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-[#344433]">
              Every remittance you already send is proof. RemitCredit reads that history — not a
              bank file, not a crypto wallet — and turns it into instant USDC credit. The family
              still gets paid first.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {!address ? (
                <button
                  type="button"
                  onClick={connect}
                  disabled={isConnecting}
                  className="rc-sans rounded-full bg-[#166534] px-5 py-3 text-sm font-black text-white shadow-[3px_3px_0_#1d2a1e] transition hover:-translate-y-0.5 hover:shadow-[4px_5px_0_#1d2a1e]"
                >
                  <Wallet className="mr-2 inline h-4 w-4" />
                  {isConnecting ? 'Connecting Freighter…' : 'Open my book → Connect Freighter'}
                </button>
              ) : kycStatus !== 'VERIFIED' ? (
                <button
                  type="button"
                  onClick={() => setActivePage('kyc')}
                  className="rc-sans rounded-full bg-[#166534] px-5 py-3 text-sm font-black text-white shadow-[3px_3px_0_#1d2a1e]"
                >
                  Complete SEP-12 KYC <ArrowRight className="ml-1 inline h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActivePage('dashboard')}
                  className="rc-sans rounded-full bg-[#166534] px-5 py-3 text-sm font-black text-white shadow-[3px_3px_0_#1d2a1e]"
                >
                  Open my credit vault <ArrowRight className="ml-1 inline h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setActivePage('pool')}
                className="rc-sans rounded-full border-2 border-[#1d2a1e] bg-white px-5 py-3 text-sm font-black"
              >
                Supply USDC liquidity
              </button>
            </div>

            <p className="rc-hand mt-5 text-sm text-[#5a6a5a]">
              — no forms that ask who your father works for. just your own receipts. ✎
            </p>
          </div>

          {/* RIGHT PAGE — Interactive 2-Page Ledger Book */}
          <div className="rc-book-stage relative border-t-2 border-[#1d2a1e] bg-[#fffdf4] px-5 py-7 sm:px-7 lg:border-l-2 lg:border-t-0">
            <div className="flex items-center justify-between">
              <p className="rc-sans text-[11px] font-black uppercase tracking-widest">
                {pageTurned ? 'Page 02 · Contract Rules' : 'Page 01 · Live Pool Ledger'}
              </p>
              <span className="rc-stamp px-2 py-0.5 text-[10px] font-black">VERIFIED ✓</span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPageTurned((prev) => !prev)}
                className="rc-sans inline-flex items-center gap-1.5 rounded-full border border-[#1d2a1e] bg-[#f7f1de] px-3 py-1 text-xs font-bold text-[#1d2a1e] shadow-[2px_2px_0_#1d2a1e] transition hover:-translate-y-0.5"
              >
                <RotateCw className="h-3 w-3" />
                <span>{pageTurned ? 'Flip back to Page 01' : 'Flip to Page 02'}</span>
              </button>
              <span className="rc-sans text-[10px] font-bold text-[#5a6a5a]">
                {pageTurned ? '2 / 2' : '1 / 2'}
              </span>
            </div>

            {!pageTurned ? (
              /* PAGE 01: Live Pool Telemetry */
              <div className="rc-sheet mt-4 space-y-3">
                <div className="rounded-xl border-2 border-[#1d2a1e] bg-[#eef5e9] p-4">
                  <p className="rc-sans text-[11px] font-bold text-[#166534]">TOTAL IN THE POT</p>
                  <p className="tabular-nums text-3xl font-black">
                    ${formatUsdc(poolStats.totalLiquidity, 0)} <span className="text-sm">USDC</span>
                  </p>
                  <p className="rc-hand text-sm">…and it keeps moving.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">BORROWED SO FAR</p>
                    <p className="text-xl font-black">${borrowedLabel}</p>
                  </div>
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">CREDIT RANGE</p>
                    <p className="text-xl font-black">
                      ${formatUsdc(config.tier1Cap, 0)}–${formatUsdc(config.tier4Cap, 0)}
                    </p>
                  </div>
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">WATERFALL</p>
                    <p className="text-xl font-black">
                      {formatBps(config.waterfallSplitBps)} /{' '}
                      {formatBps(10000 - config.waterfallSplitBps)}
                    </p>
                  </div>
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">LTV</p>
                    <p className="text-xl font-black">50% · rolling 8-avg</p>
                  </div>
                </div>
                <p className="rc-hand text-center text-sm">
                  every line above is on-chain. check it, don&apos;t trust us.
                </p>
              </div>
            ) : (
              /* PAGE 02: On-Chain Contract & Identity Seal */
              <div className="rc-sheet mt-4 space-y-3">
                <div className="rounded-xl border-2 border-[#1d2a1e] bg-[#fff3c4] p-4">
                  <p className="rc-sans text-[11px] font-bold text-[#8a5a17]">
                    SOROBAN CONTRACT SEAL
                  </p>
                  <p className="font-mono text-base font-black text-[#1d2a1e]">{shortContractId}</p>
                  <p className="rc-hand text-xs text-[#5a6a5a]">
                    immutable rust bytecode on stellar testnet
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">LOAN MATURITY</p>
                    <p className="text-lg font-black">Fixed 30 Days</p>
                  </div>
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">MIN WIRE / LP</p>
                    <p className="text-lg font-black">100.00 USDC</p>
                  </div>
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">SYBIL GUARD</p>
                    <p className="text-lg font-black">SEP-12 SHA-256</p>
                  </div>
                  <div className="border border-dashed border-[#1d2a1e]/50 bg-white p-3 text-[#1d2a1e]">
                    <p className="rc-sans text-[10px] font-bold">STRIKE LIMIT</p>
                    <p className="text-lg font-black">6 Strikes (+50%)</p>
                  </div>
                </div>
                <p className="rc-hand text-center text-sm">
                  click “Flip back to Page 01” to inspect live pool balances.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* THE BOX — Interactive Click-to-Open / Click-to-Close Crate */}
      <section className="rc-paper rounded-[24px] border-2 border-[#1d2a1e] p-5 shadow-[6px_6px_0_#1d2a1e] sm:p-7">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <p className="rc-hand text-xl text-[#8a5a17]">first, the box arrives…</p>
            <DroppingHeading
              lines={['One remittance goes in.', 'Two things come out.']}
              className="text-3xl font-black leading-tight sm:text-4xl"
            />
            <p className="mt-3 leading-relaxed text-[#344433]">
              The contract splits it in a single transaction. No waiting room, no “we’ll get back to
              you in 3–5 days”. If you’re late, the whole thing sweeps to the loan — that’s the
              deal, written in public.
            </p>
            <button
              type="button"
              onClick={() => setCrateOpen((prev) => !prev)}
              className="rc-sans mt-5 inline-flex items-center gap-2 rounded-full border-2 border-[#1d2a1e] bg-[#f3c969] px-5 py-2.5 text-sm font-black shadow-[3px_3px_0_#1d2a1e] transition hover:-translate-y-0.5 hover:bg-[#f6d482]"
            >
              <span>{crateOpen ? '◼ Click to Close Crate' : '◻ Click to Open Crate'}</span>
            </button>
          </div>

          {/* Interactive Single Crate Stage */}
          <div className="flex flex-col items-center">
            <p className="rc-sans mb-3 text-center text-[11px] font-black uppercase tracking-widest text-[#166534]">
              {crateOpen
                ? '◻ Crate Opened — Click Crate to Seal Shut'
                : '◼ Crate Sealed — Click Crate to Unpack'}
            </p>

            <div
              role="button"
              tabIndex={0}
              onClick={() => setCrateOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setCrateOpen((prev) => !prev);
                }
              }}
              aria-label={crateOpen ? 'Close remittance crate' : 'Open remittance crate'}
              className="group relative mx-auto w-full max-w-md cursor-pointer select-none pt-4"
            >
              {/* Animated Crate Lid */}
              <div
                className={`rc-crate-lid relative z-20 mx-auto h-11 w-[88%] rounded-t-md border-2 border-b-0 border-[#1d2a1e] bg-[#b98a3e] text-center text-xs font-black leading-10 text-[#1d2a1e] shadow-sm ${
                  crateOpen ? 'rc-crate-lid-opened' : 'rc-crate-lid-closed'
                }`}
              >
                {crateOpen ? 'REMITS · OPENED ✓' : 'REMITS · THIS SIDE UP ↑'}
              </div>

              {/* Crate Body */}
              <div className="relative min-h-[196px] overflow-hidden rounded-b-xl border-2 border-[#1d2a1e] bg-[#d9b06a] p-5 shadow-[6px_6px_0_#1d2a1e] transition group-hover:shadow-[8px_8px_0_#1d2a1e]">
                {!crateOpen ? (
                  <div className="rc-crate-content flex flex-col items-center justify-center py-8 text-center">
                    <p className="text-lg font-black text-[#1d2a1e]">100.00 USDC inside.</p>
                    <p className="rc-hand mt-1 text-base text-[#344433]">
                      still sealed — click to split on-chain.
                    </p>
                  </div>
                ) : (
                  <div className="rc-crate-content grid grid-cols-2 gap-3 pt-1">
                    <div className="rc-tape rounded bg-[#dff2d6] p-3 text-[#1d2a1e] shadow">
                      <p className="rc-sans text-[10px] font-black text-[#166534]">→ FAMILY</p>
                      <p className="text-xl font-black">
                        {formatBps(10000 - config.waterfallSplitBps)}
                      </p>
                      <p className="text-xs">Straight to home. No detour.</p>
                    </div>
                    <div className="rc-tape rounded bg-[#fff3c4] p-3 text-[#1d2a1e] shadow">
                      <p className="rc-sans text-[10px] font-black text-[#8a5a17]">→ LOAN</p>
                      <p className="text-xl font-black">{formatBps(config.waterfallSplitBps)}</p>
                      <p className="text-xs">Auto-repay. 100% if you’re late.</p>
                    </div>
                    <p className="col-span-2 pt-1 text-center text-xs font-bold text-[#1d2a1e]">
                      Fee: {formatBps(config.remitFeeBps)} · cap ${formatUsdc(config.remitFeeCap, 0)}{' '}
                      · ~5s finality
                    </p>
                  </div>
                )}
              </div>

              {/* Credit Stamp Badge Pops Out When Opened */}
              <div
                className={`absolute -bottom-3 left-8 z-30 rounded-sm border-2 border-[#166534] bg-[#d8ead0] px-3 py-1 text-center text-[11px] font-black text-[#166534] shadow transition-all duration-500 ${
                  crateOpen
                    ? 'translate-y-0 scale-100 opacity-100'
                    : 'pointer-events-none translate-y-2 scale-90 opacity-0'
                }`}
              >
                +$ CREDIT SCORE UNLOCKED
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE RULES — sticky notes */}
      <section className="rc-paper rounded-[24px] border-2 border-[#1d2a1e] p-5 shadow-[6px_6px_0_#1d2a1e] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="rc-hand text-xl text-[#8a5a17]">the house rules, taped to the wall</p>
            <DroppingHeading
              lines={['Three rules. No fine print tricks.']}
              className="text-3xl font-black"
            />
          </div>
          <a
            href={getExplorerContractUrl()}
            target="_blank"
            rel="noreferrer"
            className="rc-sans text-sm font-bold underline"
          >
            Read the contract yourself ↗
          </a>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {[
            {
              n: '01',
              t: 'One human = one vault',
              d: 'An anchor checks your ID once, off-chain. On-chain we only keep a salted hash. No farming ten wallets. Six missed payments and the vault pauses until you cure it.',
              c: 'bg-[#dff2d6]',
              r: '-rotate-1',
            },
            {
              n: '02',
              t: 'Your history is your score',
              d: `We average your last 8 remittances and lend 50% of that. After ${config.minCyclesRequired} cycles you unlock Tier 1 ($${formatUsdc(config.tier1Cap, 0)}), and you climb to Tier 4 ($${formatUsdc(config.tier4Cap, 0)}).`,
              c: 'bg-[#fff3c4]',
              r: 'rotate-1',
            },
            {
              n: '03',
              t: 'The split never changes',
              d: 'Every single remittance is split the same way, in the same transaction. Nobody in an office can quietly rewrite it later. That is the whole point.',
              c: 'bg-[#ffe4d6]',
              r: '-rotate-1',
            },
          ].map((x) => (
            <article
              key={x.n}
              className={`rc-tape ${x.c} ${x.r} rounded-sm border border-[#1d2a1e]/20 p-5 shadow-[4px_4px_0_#1d2a1e22]`}
            >
              <p className="rc-sans text-xs font-black">RULE {x.n}</p>
              <h3 className="mt-2 text-xl font-black">{x.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed">{x.d}</p>
            </article>
          ))}
        </div>
      </section>

      {/* SIMULATOR — try it with your own numbers */}
      <section className="rc-paper rounded-[24px] border-2 border-[#1d2a1e] p-5 shadow-[6px_6px_0_#1d2a1e] sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="rc-hand text-xl text-[#8a5a17]">scribble your numbers here</p>
            <DroppingHeading lines={['What would you unlock?']} className="text-3xl font-black" />
          </div>
          <span className="rc-sans rounded-full bg-[#166534] px-3 py-1 text-xs font-black text-white">
            {simTierLabel}
          </span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-7">
          <div className="space-y-5 lg:col-span-4">
            <label className="block">
              <span className="rc-sans flex justify-between text-sm font-bold">
                Avg remittance <b className="text-[#166534]">${simMonthlyInflow} USDC</b>
              </span>
              <input
                type="range"
                min={50}
                max={1200}
                step={25}
                value={simMonthlyInflow}
                onChange={(e) => setSimMonthlyInflow(Number(e.target.value))}
                className="rc-range w-full"
              />
            </label>
            <label className="block">
              <span className="rc-sans flex justify-between text-sm font-bold">
                Verified cycles <b>{simCycles}</b>
              </span>
              <input
                type="range"
                min={1}
                max={20}
                value={simCycles}
                onChange={(e) => setSimCycles(Number(e.target.value))}
                className="rc-range w-full"
              />
            </label>
            <label className="block">
              <span className="rc-sans flex justify-between text-sm font-bold">
                Loans repaid <b>{simLoansRepaid}</b>
              </span>
              <input
                type="range"
                min={0}
                max={6}
                value={simLoansRepaid}
                onChange={(e) => setSimLoansRepaid(Number(e.target.value))}
                className="rc-range w-full"
              />
            </label>
            <p className="rc-hand text-sm">
              drag them. nothing here touches your wallet — it’s just maths.
            </p>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-[#166534] bg-[#eef5e9] p-5 lg:col-span-3">
            <p className="rc-sans text-[11px] font-black uppercase tracking-widest text-[#166534]">
              Your max credit, today
            </p>
            <p className="rc-float tabular-nums mt-2 text-5xl font-black text-[#166534]">
              ${simCreditLimit.toFixed(2)} <span className="text-base text-[#1d2a1e]">USDC</span>
            </p>
            <p className="mt-1 text-sm">
              {simTier > 0
                ? `50% of $${simMonthlyInflow} avg · capped at $${simHardCap} (Tier ${simTier})`
                : `Finish ${config.minCyclesRequired} verified cycles to unlock Tier 1`}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="bg-white p-2.5">
                <b className="text-[#8a5a17]">{formatBps(config.waterfallSplitBps)} → loan</b>
                <br />${simRepayAmount.toFixed(2)}
              </div>
              <div className="bg-white p-2.5">
                <b className="text-[#166534]">
                  {formatBps(10000 - config.waterfallSplitBps)} → family
                </b>
                <br />${simFamilyAmount.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PARAMETERS — ledger table */}
      <section className="rc-paper rounded-[24px] border-2 border-[#1d2a1e] p-5 shadow-[6px_6px_0_#1d2a1e] sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="rc-hand text-xl text-[#8a5a17]">the small print, but readable</p>
            <DroppingHeading
              lines={['What the contract actually enforces']}
              className="text-2xl font-black"
            />
          </div>
          <button
            type="button"
            onClick={() => setActivePage('status')}
            className="rc-sans text-sm font-bold underline"
          >
            Full telemetry →
          </button>
        </div>
        <div className="rc-paper mt-4 overflow-x-auto rounded-xl border-2 border-[#1d2a1e]">
          <table className="rc-sans w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[#1d2a1e]">
                <th className="px-4 py-3">Rule</th>
                <th className="px-4 py-3">Live value</th>
                <th className="px-4 py-3">How it’s enforced</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dashed divide-[#1d2a1e]/30">
              <tr>
                <td className="px-4 py-3 font-bold">Loan maturity</td>
                <td className="px-4 py-3">Fixed 30 days</td>
                <td className="px-4 py-3 font-mono text-xs">borrow(…, 2_592_000)</td>
                <td className="px-4 py-3 text-right font-black text-[#166534]">ENFORCED</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold">Remittance fee</td>
                <td className="px-4 py-3">
                  {formatBps(config.remitFeeBps)} · cap ${formatUsdc(config.remitFeeCap, 0)}
                </td>
                <td className="px-4 py-3">Risk &amp; reserve routing</td>
                <td className="px-4 py-3 text-right font-black text-[#166534]">ACTIVE</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold">Loan fee &amp; yield</td>
                <td className="px-4 py-3">
                  {formatBps(config.loanFeeBps)} flat · {formatBps(10000 - config.backstopFeeBps)}{' '}
                  LP yield
                </td>
                <td className="px-4 py-3">Pro-rata distribution</td>
                <td className="px-4 py-3 text-right font-black text-[#166534]">ACTIVE</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold">Default &amp; recovery</td>
                <td className="px-4 py-3">6 strikes · +50% cure penalty</td>
                <td className="px-4 py-3">LPs repaid first</td>
                <td className="px-4 py-3 text-right font-black text-[#8a5a17]">SYBIL_LOCKED</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold">Anchor rails</td>
                <td className="px-4 py-3">SEP-12 KYC · SEP-31</td>
                <td className="px-4 py-3">Salted SHA-256 nullifier</td>
                <td className="px-4 py-3 text-right font-black">TESTNET_READY</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="rc-sans mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-[#1d2a1e]/50 bg-white px-4 py-3 text-xs text-[#1d2a1e]">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#166534]" /> Deployed on Stellar Soroban Testnet (
            {shortContractId})
          </span>
          <a
            href={getExplorerContractUrl()}
            target="_blank"
            rel="noreferrer"
            className="font-bold underline"
          >
            Verify on Stellar Expert ↗
          </a>
        </div>
      </section>
    </div>
  );
};