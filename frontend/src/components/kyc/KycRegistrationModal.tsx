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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
              <Fingerprint className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Quick SEP-12 KYC Verification
              </h3>
              <p className="text-xs text-slate-400">
                1 human = 1 wallet · Salted SHA-256 nullifier bound to{' '}
                <span className="font-mono text-emerald-300">{shortenAddress(address, 5, 4)}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Full Legal Name
              </label>
              <input
                type="text"
                required
                placeholder="Aarav Sharma"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Email</label>
              <input
                type="email"
                required
                placeholder="aarav@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Country</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
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
              <label className="mb-1 block text-xs font-medium text-slate-300">ID Type</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                disabled={isSubmitting || done}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="AADHAAR">National ID / Aadhaar</option>
                <option value="PASSPORT">International Passport</option>
                <option value="PAN">Tax ID / PAN / SSN</option>
                <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">
              Government ID Number
            </label>
            <input
              type="text"
              required
              placeholder="Enter unique ID number"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              disabled={isSubmitting || done}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-400">
            <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>
              Zero-PII guarantee: only a 32-byte salted SHA-256 digest is stored on Soroban.
            </span>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-950/60 p-3 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {done && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/60 p-3 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>SEP-12 Identity Bound On-Chain!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || done}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Binding Identity On-Chain...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4" />
                Verify &amp; Bind Wallet
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};