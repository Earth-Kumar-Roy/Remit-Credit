import React from 'react';
import { ArrowRight, Ban, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { KycCustomerRecord, KycStanding } from '@/hooks/useKycStatus';
import { shortenAddress } from '@/utils/stroops';

interface KycBannerProps {
  kycStatus: KycStanding;
  kycRecord: KycCustomerRecord | null;
  onOpenQuickVerify?: () => void;
}

export const KycBanner: React.FC<KycBannerProps> = ({
  kycStatus,
  kycRecord,
  onOpenQuickVerify,
}) => {
  const { address, setActivePage } = useWallet();

  if (!address) return null;

  if (kycStatus === 'BANNED') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900 px-5 py-3.5 shadow-lg">
        <div className="flex items-center gap-3 text-xs text-rose-200">
          <Ban className="h-5 w-5 shrink-0 text-rose-400" />
          <span>
            <strong>SEP-12 Account Suspended:</strong> An overdue loan default is recorded on this
            identity nullifier. Repay your remaining debt to restore borrowing eligibility.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setActivePage('dashboard')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-rose-400"
        >
          Resolve Balance
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (kycStatus === 'UNVERIFIED') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-900 px-5 py-3.5 shadow-lg">
        <div className="flex items-center gap-3 text-xs text-amber-200">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
          <span>
            <strong>SEP-12 KYC Required for Borrowing:</strong> Complete your one-time salted ID
            binding (1 human = 1 wallet) to unlock instant USDC credit draws.
          </span>
        </div>
        <button
          type="button"
          onClick={() => (onOpenQuickVerify ? onOpenQuickVerify() : setActivePage('kyc'))}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300"
        >
          Verify Identity
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 px-5 py-3 text-xs text-emerald-200">
      <div className="flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
        <span>
          SEP-12 Verified:{' '}
          <strong className="text-white">{kycRecord?.full_name || 'Verified Beneficiary'}</strong> (
          {kycRecord?.id_type || 'ID'} {kycRecord?.masked_id || ''}) · Bound to{' '}
          <span className="font-mono text-emerald-300">{shortenAddress(address, 5, 4)}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => setActivePage('kyc')}
        className="font-semibold text-emerald-300 transition hover:text-white"
      >
        View Credential →
      </button>
    </div>
  );
};