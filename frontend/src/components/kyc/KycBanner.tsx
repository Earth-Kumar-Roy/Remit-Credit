import React from 'react';
import { ArrowRight, Ban, ShieldAlert } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { KycCustomerRecord, KycStanding } from '@/hooks/useKycStatus';

interface KycBannerProps {
  kycStatus: KycStanding;
  kycRecord?: KycCustomerRecord | null;
  onOpenQuickVerify?: () => void;
}

export const KycBanner: React.FC<KycBannerProps> = ({
  kycStatus,
  onOpenQuickVerify,
}) => {
  const { address, setActivePage } = useWallet();

  // Do not display any banner when wallet is disconnected or already SEP-12 verified
  if (!address || kycStatus === 'VERIFIED') return null;

  if (kycStatus === 'BANNED') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/70 via-[#080e1a] to-[#080e1a] px-5 py-3.5 shadow-lg">
        <div className="flex items-center gap-3 text-xs text-rose-200">
          <Ban className="h-5 w-5 shrink-0 text-rose-400" />
          <span>
            <strong>SEP-12 Account Suspended (6 Overdue Strikes):</strong> Borrowing and multi-wallet
            re-registration are blocked on this identity nullifier until rehabilitated (+50% cure
            penalty).
          </span>
        </div>
        <span className="rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-rose-300">
          NULLIFIER_SUSPENDED
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-[#080e1a] to-[#080e1a] px-5 py-3.5 shadow-lg">
      <div className="flex items-center gap-3 text-xs text-amber-200">
        <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
        <span>
          <strong>SEP-12 KYC Required for Borrowing:</strong> Complete your one-time salted ID
          binding (1 human = 1 wallet) to unlock 50% LTV instant USDC credit draws.
        </span>
      </div>
      <button
        type="button"
        onClick={() => (onOpenQuickVerify ? onOpenQuickVerify() : setActivePage('kyc'))}
        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-300"
      >
        <span>Verify Identity</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};