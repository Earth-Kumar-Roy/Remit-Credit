import React from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ExternalLink,
  Landmark,
  ShieldCheck,
  Split,
} from 'lucide-react';
import { getExplorerTxUrl } from '@/config/stellar';
import { ProtocolEventItem } from '@/hooks/useProtocolEvents';
import { shortenAddress } from '@/utils/stroops';

interface WaterfallFeedProps {
  events: ProtocolEventItem[];
  isLoading: boolean;
  title?: string;
  subtitle?: string;
}

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

export const WaterfallFeed: React.FC<WaterfallFeedProps> = ({
  events,
  isLoading,
  title = 'Live On-Chain Waterfall & Ledger Feed',
  subtitle = 'Indexed Soroban contract events synced with Google Sheets ledger',
}) => {
  const renderDescription = (ev: ProtocolEventItem) => {
    const gross = Number(ev.gross_amount_usdc || 0).toFixed(2);
    const pool = Math.abs(Number(ev.pool_allocated_usdc || 0)).toFixed(2);
    const net = Number(ev.user_net_usdc || 0).toFixed(2);
    const debt = Number(ev.remaining_debt_usdc || 0).toFixed(2);

    switch (ev.tx_category) {
      case 'WATERFALL_REPAY':
        return (
          <span className="text-xs text-slate-300">
            <strong className="tabular-nums text-cyan-300">{pool} USDC</strong> routed to LP vault ·{' '}
            <strong className="tabular-nums text-emerald-400">{net} USDC</strong> forwarded to
            wallet · Remaining debt: <strong className="tabular-nums text-white">{debt} USDC</strong>
          </span>
        );
      case 'DIRECT_REPAY':
        return (
          <span className="text-xs text-slate-300">
            Paid <strong className="tabular-nums text-sky-300">{gross} USDC</strong> directly to
            vault · Remaining debt: <strong className="tabular-nums text-white">{debt} USDC</strong>
          </span>
        );
      case 'REMITTANCE_IN':
        return (
          <span className="text-xs text-slate-300">
            Verified cross-border wire of{' '}
            <strong className="tabular-nums text-emerald-400">{gross} USDC</strong> credited (Tier{' '}
            {ev.credit_tier})
          </span>
        );
      case 'INSTANT_BORROW':
        return (
          <span className="text-xs text-slate-300">
            Drew <strong className="tabular-nums text-amber-300">{gross} USDC</strong> principal ·
            Total obligation: <strong className="tabular-nums text-white">{debt} USDC</strong>
          </span>
        );
      case 'LP_SUPPLY':
        return (
          <span className="text-xs text-slate-300">
            Supplied <strong className="tabular-nums text-indigo-300">{gross} USDC</strong> into
            liquidity vault
          </span>
        );
      case 'LP_WITHDRAW':
        return (
          <span className="text-xs text-slate-300">
            Withdrew <strong className="tabular-nums text-purple-300">{gross} USDC</strong> from
            liquidity vault
          </span>
        );
      case 'KYC_VERIFIED':
        return (
          <span className="text-xs text-slate-300">
            SEP-12 salted identity nullifier bound on-chain to wallet
          </span>
        );
      case 'LOAN_DEFAULT':
        return (
          <span className="text-xs text-rose-200">
            Overdue principal <strong className="tabular-nums">{gross} USDC</strong> slashed ·
            Backstop covered <strong className="tabular-nums">{pool} USDC</strong>
          </span>
        );
      case 'ACCOUNT_REHABILITATED':
        return (
          <span className="text-xs text-amber-200">
            Settled <strong className="tabular-nums">{gross} USDC</strong> rehabilitation cure · LP
            reimbursed <strong className="tabular-nums text-emerald-300">{pool} USDC</strong>
          </span>
        );
      default:
        return (
          <span className="text-xs text-slate-400">
            Contract event {ev.event_type} at ledger #{ev.ledger}
          </span>
        );
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
      <span className="pointer-events-none absolute left-3 top-2 select-none font-mono text-[9px] text-slate-500">
        ⌜ LEDGER_STREAM // SOROBAN_INDEXER ⌝
      </span>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/90 pb-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
            ◈ ON-CHAIN EVENT TELEMETRY
          </div>
          <h2 className="mt-0.5 text-base font-bold text-white">{title}</h2>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1 font-mono text-[11px] font-semibold text-amber-300">
          {events.length} RECORDS
        </span>
      </div>

      {events.length === 0 ? (
        <div className="py-10 text-center font-mono text-xs text-slate-500">
          {isLoading
            ? 'SYNCING SOROBAN LEDGER & GOOGLE SHEETS EVENTS...'
            : 'NO TRANSACTIONS RECORDED YET.'}
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {events.map((ev) => {
            const meta = CATEGORY_META[ev.tx_category] || {
              label: ev.event_type,
              badgeClass: 'bg-slate-800 text-slate-300 ring-slate-700',
              icon: Activity,
            };
            const Icon = meta.icon;

            return (
              <div
                key={ev.event_id}
                className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800/80 bg-slate-950/75 px-4 py-3 transition hover:border-slate-700 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900">
                    <Icon className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-mono">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider ring-1 ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                      {ev.wallet_address && (
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-cyan-300">
                          {shortenAddress(ev.wallet_address, 5, 4)}
                        </span>
                      )}
                      {ev.timestamp_ist && (
                        <span className="text-[10px] text-slate-500">{ev.timestamp_ist} IST</span>
                      )}
                    </div>
                    <div className="mt-1">{renderDescription(ev)}</div>
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
    </div>
  );
};