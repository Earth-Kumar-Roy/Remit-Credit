import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  Loader2,
  Lock,
  UserCheck,
  X,
} from 'lucide-react';
import { useWallet } from '@/context/WalletContext';
import { KycRegistrationInput } from '@/hooks/useKycStatus';
import { shortenAddress } from '@/utils/stroops';

interface KycRegistrationModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmitKyc: (input: KycRegistrationInput) => Promise<unknown>;
  onSuccess: () => Promise<void>;
}

export const KycRegistrationModal: React.FC<KycRegistrationModalProps> = ({
  isOpen,
  isSubmitting,
  onClose,
  onSubmitKyc,
  onSuccess,
}) => {
  const { address } = useWallet();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [idType, setIdType] = useState('AADHAAR');
  const [idNumber, setIdNumber] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!isOpen || !address) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !email.trim() || !idNumber.trim()) {
      setErrorMsg('Complete all required SEP-12 identity fields.');
      return;
    }

    try {
      await onSubmitKyc({
        full_name: fullName,
        email,
        country_code: countryCode,
        id_type: idType,
        id_number: idNumber,
      });
      setDone(true);
      await onSuccess();
      setTimeout(() => {
        setDone(false);
        setIdNumber('');
        onClose();
      }, 1100);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'SEP-12 verification failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-[#080e1a] p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
        <span className="pointer-events-none absolute left-4 top-2 select-none font-mono text-[9px] text-cyan-400/70">
          ⌜ SEP-12_ATTESTATION // NULLIFIER_BIND ⌝
        </span>

        <div className="mt-2 flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/15">
              <Fingerprint className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Quick SEP-12 KYC Verification</h3>
              <p className="font-mono text-xs text-slate-400">
                1 human = 1 wallet · Bound to{' '}
                <span className="text-emerald-300">{shortenAddress(address, 5, 4)}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase text-slate-300">
                Full Legal Name
              </label>
              <input
                type="text"
                required
                placeholder="Aarav Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="aarav@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase text-slate-300">
                Country
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="IN">IN · India</option>
                <option value="PH">PH · Philippines</option>
                <option value="MX">MX · Mexico</option>
                <option value="NG">NG · Nigeria</option>
                <option value="US">US · United States</option>
                <option value="AE">AE · UAE</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-mono text-[11px] uppercase text-slate-300">
                ID Type
              </label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
              >
                <option value="AADHAAR">National ID / Aadhaar</option>
                <option value="PASSPORT">International Passport</option>
                <option value="PAN">Tax ID / PAN / SSN</option>
                <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase text-slate-300">
              Government ID Number
            </label>
            <input
              type="text"
              required
              placeholder="Enter unique ID number"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              disabled={isSubmitting || done}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/85 px-3 py-2 font-mono text-[11px] text-slate-400">
            <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Zero-PII guarantee: only a 32-byte salted SHA-256 digest is stored on Soroban.</span>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-950/60 p-3 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/60 p-3 font-mono text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>SEP-12 Identity Bound On-Chain!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || done}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition hover:opacity-95 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Binding Identity On-Chain...</span>
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                <span>[ ✓ Verify &amp; Bind Wallet ]</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};