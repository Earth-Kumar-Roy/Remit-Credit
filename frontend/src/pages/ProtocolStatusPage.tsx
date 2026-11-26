import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Fingerprint,
  Landmark,
  Layers,
  Scale,
  ShieldAlert,
  ShieldCheck,
  SplitSquareVertical,
  Terminal,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  STELLAR_CONFIG,
  getExplorerAccountUrl,
  getExplorerContractUrl,
} from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { PoolStatsData, ProtocolConfigData } from '@/hooks/useBorrowerProfile';
import { formatBps, formatUsdc, shortenAddress } from '@/utils/stroops';

interface ProtocolStatusPageProps {
  poolStats: PoolStatsData;
  config: ProtocolConfigData;
  keeperOnline: boolean;
}

function formatLoanPeriod(secsBig: bigint): string {
  const secs = Number(secsBig);
  if (secs >= 86400) {
    const days = Math.round(secs / 86400);
    return `${days} ${days === 1 ? 'Day' : 'Days'}`;
  }
  if (secs >= 3600) {
    const hrs = Math.round(secs / 3600);
    return `${hrs} ${hrs === 1 ? 'Hour' : 'Hours'}`;
  }
  const mins = Math.max(1, Math.round(secs / 60));
  return `${mins} ${mins === 1 ? 'Min' : 'Mins'} (${secs}s)`;
}

export const ProtocolStatusPage: React.FC<ProtocolStatusPageProps> = ({
  poolStats,
  config,
  keeperOnline,
}) => {
  const { address, isConnecting, connect, setActivePage } = useWallet();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const cliSetupSnippet = `# 1. Create & fund a Stellar Testnet wallet
stellar keys generate alice --network testnet --fund

# 2. Establish USDC trustline (Issuer: GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5)
stellar tx new change-trust \\
  --source-account alice \\
  --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \\
  --network testnet

# 3. Query live protocol configuration on Soroban Testnet
stellar contract invoke \\
  --id ${STELLAR_CONFIG.remitContractId} \\
  --source-account alice \\
  --network testnet \\
  -- get_protocol_config`;

  const lpYieldShareBps = Math.max(0, 10_000 - config.backstopFeeBps);
  const directSplitBps = Math.max(0, 10_000 - config.waterfallSplitBps);

  return (
    <div className="space-y-8 pb-12">
      {/* Architectural Header Monolith */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_90%)]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="protoDocGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.85" />
                <circle cx="40" cy="40" r="1" fill="#22d3ee" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#protoDocGrid)" />
          </svg>
        </div>

        <div className="pointer-events-none absolute -top-20 right-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />
        <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-cyan-400/70">
          ⌜ SEC_06 // PROTOCOL_SPECIFICATION &amp; TELEMETRY ⌝
        </span>
        <span className="pointer-events-none absolute right-4 top-3 select-none font-mono text-[10px] text-amber-400/70">
          [+]
        </span>

        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
              <BookOpen className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
                <span className="font-bold text-emerald-400">◈ SOROBAN V3 TECHNICAL SPECIFICATION</span>
                <span className="text-slate-600">//</span>
                <span className="text-cyan-300">SEP-12 &amp; SEP-31 STANDARD</span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Protocol Documentation &amp; Live Risk Telemetry
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                Complete architectural reference for RemitCredit&apos;s 4-tier cash-flow underwriting,
                pro-rata ERC-4626 liquidity vault, remittance fee routing, and LP-first default
                rehabilitation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold ${
                config.isPaused
                  ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                  : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {config.isPaused ? (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  <span>CIRCUIT_BREAKER: PAUSED</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>CONTRACT: ACTIVE</span>
                </>
              )}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-semibold ${
                keeperOnline
                  ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300'
                  : 'border-amber-500/35 bg-amber-500/10 text-amber-300'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>{keeperOnline ? 'KEEPER + SHEETS: ONLINE' : 'KEEPER: STANDBY'}</span>
            </span>
          </div>
        </div>

        {/* Live Contract & Anchor Endpoints */}
        <div className="relative z-10 mt-6 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-5 md:grid-cols-3">
          <div className="rounded-xl border border-slate-800/90 bg-slate-950/85 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[01] REMIT-CREDIT CONTRACT</span>
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <a
                href={getExplorerContractUrl(STELLAR_CONFIG.remitContractId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-300 hover:underline"
              >
                <span>{shortenAddress(STELLAR_CONFIG.remitContractId, 10, 8)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy('contract', STELLAR_CONFIG.remitContractId)}
                title="Copy Contract ID"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {copiedKey === 'contract' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-500">STELLAR SOROBAN TESTNET</div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-950/85 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[02] SETTLEMENT USDC SAC</span>
              <Layers className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <a
                href={getExplorerContractUrl(STELLAR_CONFIG.usdcSacId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-sky-300 hover:underline"
              >
                <span>{shortenAddress(STELLAR_CONFIG.usdcSacId, 10, 8)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy('usdc', STELLAR_CONFIG.usdcSacId)}
                title="Copy USDC SAC ID"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {copiedKey === 'usdc' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-500">7-DECIMAL ASSET CONTRACT</div>
          </div>

          <div className="rounded-xl border border-slate-800/90 bg-slate-950/85 p-4">
            <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>[03] SEP-12/31 ANCHOR RELAYER</span>
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <a
                href={getExplorerAccountUrl(STELLAR_CONFIG.anchorPublicKey)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-amber-300 hover:underline"
              >
                <span>{shortenAddress(STELLAR_CONFIG.anchorPublicKey, 10, 8)}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => handleCopy('anchor', STELLAR_CONFIG.anchorPublicKey)}
                title="Copy Anchor Public Key"
                className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                {copiedKey === 'anchor' ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-slate-500">WHITELISTED KYC ISSUER</div>
          </div>
        </div>
      </section>

      {/* SECTION 01: WALLET SETUP & ONBOARDING PREREQUISITES */}
      <section className="rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
              DOC_01 // WALLET &amp; NETWORK PREREQUISITES
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">
              Step-by-Step Wallet Setup Before Using RemitCredit
            </h2>
          </div>

          {!address ? (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition hover:opacity-95"
            >
              <Wallet className="h-4 w-4" />
              <span>{isConnecting ? 'Connecting Freighter...' : 'Connect Freighter Wallet'}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2 font-mono text-xs font-bold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>WALLET CONNECTED: {shortenAddress(address, 6, 6)}</span>
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 4 Onboarding Steps */}
          <div className="space-y-3 lg:col-span-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="font-mono text-xs font-bold text-cyan-300">
                01. Switch Freighter to Stellar Testnet
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Open Freighter &rarr; Settings &rarr; Network and select{' '}
                <strong className="text-slate-200">Testnet</strong> (
                <code className="text-slate-300">Test SDF Network ; September 2015</code>). Fund
                your account with Testnet XLM via Friendbot for gas (~0.0001 XLM/tx).
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="font-mono text-xs font-bold text-emerald-300">
                02. Add USDC Trustline &amp; Testnet USDC
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Ensure your Stellar address holds a trustline to Testnet USDC (SAC{' '}
                <code className="text-slate-300">
                  {shortenAddress(STELLAR_CONFIG.usdcSacId, 6, 6)}
                </code>
                ) before sending remittances, supplying LP liquidity, or repaying loans.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="font-mono text-xs font-bold text-amber-300">
                03. Bind One-Time SEP-12 Identity Nullifier
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Complete{' '}
                <button
                  type="button"
                  onClick={() => setActivePage('kyc')}
                  className="font-semibold text-amber-300 underline hover:text-amber-200"
                >
                  SEP-12 KYC
                </button>{' '}
                to bind a salted SHA-256 hash of your ID to your wallet (1 human = 1 credit vault).
                Receiving remittances works without KYC, but borrowing requires KYC verification.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
              <div className="font-mono text-xs font-bold text-sky-300">
                04. Choose Role: Borrower or Liquidity Provider
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Wallets with active LP shares cannot borrow simultaneously, and borrowers with an
                open loan cannot deposit into the LP vault until their loan is settled.
              </p>
            </div>
          </div>

          {/* Copyable Soroban CLI Reference */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:col-span-6">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 font-mono text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-slate-200">
                  <Terminal className="h-4 w-4 text-cyan-400" />
                  <span>STELLAR CLI // WALLET &amp; CONTRACT INVOKE</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy('cli', cliSetupSnippet)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:border-cyan-500/40"
                >
                  {copiedKey === 'cli' ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy CLI</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-3 overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-300">
                <code>{cliSetupSnippet}</code>
              </pre>
            </div>

            <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/70 px-3 py-2 font-mono text-[10px] text-slate-400">
              NOTE: All smart contract amounts use 7-decimal Stellar stroops (1.00 USDC =
              10,000,000 stroops).
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 02: 4-TIER CREDIT SCORING & 50% LTV UNDERWRITING */}
      <section className="rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
              DOC_02 // CASH-FLOW CREDIT TIERS &amp; BORROW LIMITS
            </span>
            <h2 className="mt-1 text-lg font-bold text-white">
              4-Tier Progressive Credit Caps &amp; Rolling 8-Inflow Formula
            </h2>
          </div>
          <span className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1 font-mono text-xs font-bold text-amber-300">
            LIMIT = MIN(ROLLING_8_AVG × 50%, TIER_CAP)
          </span>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-400">
          RemitCredit maintains an on-chain sliding window of up to your last{' '}
          <strong className="text-white">8 verified net remittances</strong> (
          <code className="text-cyan-300">recent_inflows</code>). Your drawable credit limit is{' '}
          <strong className="text-emerald-400">50%</strong> of that rolling average, capped by your
          unlocked Tier ceiling and available idle LP liquidity. Borrowers choose their own loan
          maturity between <strong className="text-white">2 minutes (120s)</strong> and{' '}
          <strong className="text-white">30 days (2,592,000s)</strong> at a flat{' '}
          <strong className="text-amber-300">{formatBps(config.loanFeeBps)}</strong> period fee.
        </p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950 text-[11px] uppercase text-cyan-300">
                <th className="px-4 py-3">Credit Tier</th>
                <th className="px-4 py-3">Min Verified Cycles</th>
                <th className="px-4 py-3">Loans Repaid</th>
                <th className="px-4 py-3">Min 8-Inflow Avg</th>
                <th className="px-4 py-3 text-right">Max Tier Cap (USDC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/50">
              <tr>
                <td className="px-4 py-3 font-bold text-slate-400">Tier 0 (Locked)</td>
                <td className="px-4 py-3 text-slate-400">&lt; {config.minCyclesRequired} cycles</td>
                <td className="px-4 py-3 text-slate-400">0</td>
                <td className="px-4 py-3 text-slate-400">Any</td>
                <td className="px-4 py-3 text-right font-bold text-slate-400">$0.00 USDC</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-sky-300">Tier 1 (Starter)</td>
                <td className="px-4 py-3 text-white">&ge; {config.minCyclesRequired} cycles</td>
                <td className="px-4 py-3 text-slate-300">0+</td>
                <td className="px-4 py-3 text-slate-300">&gt; $0.00</td>
                <td className="px-4 py-3 text-right font-bold text-sky-300">
                  ${formatUsdc(config.tier1Cap)} USDC
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-cyan-300">Tier 2 (Growth)</td>
                <td className="px-4 py-3 text-white">&ge; 6 cycles</td>
                <td className="px-4 py-3 text-white">&ge; 1 loan</td>
                <td className="px-4 py-3 text-white">&ge; ${formatUsdc(config.tier2Cap, 0)}</td>
                <td className="px-4 py-3 text-right font-bold text-cyan-300">
                  ${formatUsdc(config.tier2Cap)} USDC
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-emerald-300">Tier 3 (Prime)</td>
                <td className="px-4 py-3 text-white">&ge; 10 cycles</td>
                <td className="px-4 py-3 text-white">&ge; 2 loans</td>
                <td className="px-4 py-3 text-white">&ge; ${formatUsdc(config.tier3Cap, 0)}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-300">
                  ${formatUsdc(config.tier3Cap)} USDC
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-amber-300">Tier 4 (Sovereign Max)</td>
                <td className="px-4 py-3 text-white">&ge; 15 cycles</td>
                <td className="px-4 py-3 text-white">&ge; 4 loans</td>
                <td className="px-4 py-3 text-white">&ge; ${formatUsdc(config.tier4Cap, 0)}</td>
                <td className="px-4 py-3 text-right font-bold text-amber-300">
                  ${formatUsdc(config.tier4Cap)} USDC
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 03: REMITTANCE FEES, LIQUIDITY POOL & DEFAULT REHABILITATION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Card 1: Remittance Fees & Waterfall */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-cyan-300">
            <SplitSquareVertical className="h-4 w-4 text-cyan-400" />
            <span>DOC_03 // REMITTANCE &amp; WATERFALL</span>
          </div>
          <h3 className="mt-2 text-base font-bold text-white">
            Fee Structure &amp; Automated Repayment Split
          </h3>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-white">Remittance Protocol Fee:</strong>{' '}
              <span className="font-mono text-cyan-300">{formatBps(config.remitFeeBps)}</span> per
              wire, strictly capped at{' '}
              <span className="font-mono text-emerald-300">
                ${formatUsdc(config.remitFeeCap, 0)} USDC
              </span>
              . 100% flows into the First-Loss Backstop Reserve.
            </li>
            <li>
              <strong className="text-white">Exact Recipient Delivery:</strong> The sender UI
              pre-calculates gross debit so the recipient always receives 100% of their intended
              net remittance.
            </li>
            <li>
              <strong className="text-white">On-Time Waterfall:</strong> When a loan is active and
              on time,{' '}
              <span className="font-mono text-amber-300">
                {formatBps(config.waterfallSplitBps)}
              </span>{' '}
              of total loan debt is deducted and{' '}
              <span className="font-mono text-emerald-300">{formatBps(directSplitBps)}</span> goes
              to the recipient.
            </li>
            <li>
              <strong className="text-white">Overdue Sweep:</strong> If an incoming wire arrives
              past <code className="text-slate-200">due_at</code>, <strong>100%</strong> of
              remaining debt is cleared automatically.
            </li>
          </ul>
        </div>

        {/* Card 2: Liquidity Pool & Share Accounting */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-emerald-300">
            <Landmark className="h-4 w-4 text-emerald-400" />
            <span>DOC_04 // LIQUIDITY POOL (LP)</span>
          </div>
          <h3 className="mt-2 text-base font-bold text-white">
            Pro-Rata Share Yield &amp; Withdrawal Rules
          </h3>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-white">ERC-4626 Vault Shares:</strong> Depositing USDC mints
              proportional shares (<code className="text-slate-200">provide_liquidity</code>). Share
              value grows automatically as borrowers repay loan fees.
            </li>
            <li>
              <strong className="text-white">Fee Allocation:</strong>{' '}
              <span className="font-mono text-emerald-300">{formatBps(lpYieldShareBps)}</span> of
              every realized <span className="font-mono">{formatBps(config.loanFeeBps)}</span> loan
              fee goes to LPs;{' '}
              <span className="font-mono text-amber-300">
                {formatBps(config.backstopFeeBps)}
              </span>{' '}
              reinforces the Backstop Reserve.
            </li>
            <li>
              <strong className="text-white">Pro-Rata Idle Cash:</strong> Each LP can withdraw up
              to <code className="text-slate-200">(user_shares × idle_cash) / total_shares</code>{' '}
              so active loan exposure is shared equally across all LPs.
            </li>
            <li>
              <strong className="text-white">Role Isolation:</strong> Active LPs cannot draw loans,
              and active borrowers cannot supply LP liquidity until settled.
            </li>
          </ul>
        </div>

        {/* Card 3: 6-Strike Default & LP-First Rehabilitation */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
          <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-amber-300">
            <Scale className="h-4 w-4 text-amber-400" />
            <span>DOC_05 // DEFAULT &amp; RECOVERY</span>
          </div>
          <h3 className="mt-2 text-base font-bold text-white">
            6-Strike Enforcement &amp; LP-First Rehabilitation
          </h3>
          <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-400">
            <li>
              <strong className="text-white">Progressive Overdue Strikes:</strong> Each elapsed
              period past <code className="text-slate-200">due_at</code> adds a{' '}
              <span className="font-mono text-rose-300">+{formatBps(config.loanFeeBps)}</span>{' '}
              late fee up to <strong>6 strikes</strong>.
            </li>
            <li>
              <strong className="text-white">Backstop First-Loss Absorption:</strong> At 6 strikes,{' '}
              <code className="text-slate-200">slash_default</code> suspends the account and
              SEP-12 nullifier, covering unpaid principal from{' '}
              <code className="text-slate-200">backstop_reserve</code> first.
            </li>
            <li>
              <strong className="text-white">LP-First Rehabilitation Cure:</strong> Paying{' '}
              <code className="text-slate-200">defaulted_debt + 50% penalty</code> restores any{' '}
              <code className="text-slate-200">uncovered_lp_loss</code> <strong>plus 100% of
              accrued 6-strike fees</strong> directly to LPs first before replenishing the
              Backstop.
            </li>
            <li>
              <strong className="text-white">Credit Reset:</strong> Rehabilitated accounts reset to
              Tier 0 (0 cycles) and must rebuild history from scratch.
            </li>
          </ul>
        </div>
      </div>

      {/* SECTION 04: LIVE ON-CHAIN GOVERNANCE CONSTANTS */}
      <section className="rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            <h2 className="text-base font-bold uppercase tracking-wider text-white">
              Live On-Chain Risk &amp; Governance Constants
            </h2>
          </div>
          <span className="font-mono text-[10px] text-cyan-400">SOURCE: GET_PROTOCOL_CONFIG()</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">
              Min Remittance Cycles
            </div>
            <div className="tabular-nums mt-1 font-mono text-lg font-bold text-white">
              {config.minCyclesRequired} cycles
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">
              Cycle / Repay Cooldown
            </div>
            <div className="tabular-nums mt-1 font-mono text-lg font-bold text-white">
              {Number(config.minCycleIntervalSecs)}s / {Number(config.postRepayCooldownSecs)}s
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">
              Remit Fee &rarr; Backstop
            </div>
            <div className="tabular-nums mt-1 font-mono text-lg font-bold text-emerald-400">
              {formatBps(config.remitFeeBps)} (Max ${formatUsdc(config.remitFeeCap, 0)})
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">
              Auto-Repay Waterfall
            </div>
            <div className="tabular-nums mt-1 font-mono text-lg font-bold text-sky-400">
              {formatBps(config.waterfallSplitBps)} / {formatBps(directSplitBps)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">
              Loan Fee &amp; Strike Limit
            </div>
            <div className="tabular-nums mt-1 font-mono text-lg font-bold text-amber-400">
              {formatBps(config.loanFeeBps)} · 6 Strikes
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">4-Tier Credit Caps</div>
            <div className="tabular-nums mt-1 font-mono text-sm font-bold text-white">
              ${formatUsdc(config.tier1Cap, 0)} / ${formatUsdc(config.tier2Cap, 0)} / $
              {formatUsdc(config.tier3Cap, 0)} / ${formatUsdc(config.tier4Cap, 0)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">
              Default Period Duration
            </div>
            <div className="tabular-nums mt-1 font-mono text-lg font-bold text-white">
              {formatLoanPeriod(config.loanDurationSecs)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="font-mono text-[10px] uppercase text-slate-400">
              Backstop Debt Coverage
            </div>
            <div className="tabular-nums mt-1 font-mono text-lg font-bold text-cyan-400">
              {poolStats.totalLent > 0n
                ? `${((Number(poolStats.backstopReserve) / Number(poolStats.totalLent)) * 100).toFixed(2)}%`
                : '100% (No Debt)'}
            </div>
          </div>
        </div>

        {/* Anti-Sybil Footer Strip */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/90 px-4 py-3 font-mono text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <Fingerprint className="h-4 w-4" />
            <span>SEP-12 SALTED SHA-256 NULLIFIER · ZERO RAW PII ON-CHAIN</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-300">
            <ShieldAlert className="h-4 w-4" />
            <span>50% ROLLING 8-REMITTANCE LTV UNDERWRITING</span>
          </span>
        </div>
      </section>
    </div>
  );
};