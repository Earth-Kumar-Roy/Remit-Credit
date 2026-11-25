import React, { useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  ExternalLink,
  Fingerprint,
  Loader2,
  Lock,
  ShieldCheck,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { getExplorerTxUrl } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { KycCustomerRecord, KycRegistrationInput, KycStanding } from '@/hooks/useKycStatus';
import { shortenAddress } from '@/utils/stroops';

interface KycVerificationPageProps {
  kycStatus: KycStanding;
  kycRecord: KycCustomerRecord | null;
  isKycLoading: boolean;
  kycError: string | null;
  onSubmitKyc: (input: KycRegistrationInput) => Promise<unknown>;
  onRefreshAll: () => Promise<void>;
}

export const KycVerificationPage: React.FC<KycVerificationPageProps> = ({
  kycStatus,
  kycRecord,
  isKycLoading,
  kycError,
  onSubmitKyc,
  onRefreshAll,
}) => {
  const { address, connect, setActivePage } = useWallet();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [idType, setIdType] = useState('AADHAAR');
  const [idNumber, setIdNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessTxHash(null);

    if (!fullName.trim() || !email.trim() || !idNumber.trim()) {
      setFormError('Please complete all required SEP-12 identity fields.');
      return;
    }

    try {
      const res = (await onSubmitKyc({
        full_name: fullName,
        email,
        country_code: countryCode,
        id_type: idType,
        id_number: idNumber,
      })) as { tx_hash?: string };

      if (res?.tx_hash) {
        setSuccessTxHash(res.tx_hash);
      }
      await onRefreshAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'SEP-12 KYC verification failed.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      {/* Page Header */}
      <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/25 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
              <Fingerprint className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">SEP-12 Identity &amp; Sybil Shield</h1>
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  1 Human = 1 Wallet
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Anchor verifies your government ID off-chain and binds a salted SHA-256 nullifier
                on-chain so raw PII never touches the public ledger.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!address ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-10 text-center">
          <Wallet className="mx-auto h-10 w-10 text-emerald-400" />
          <h2 className="mt-3 text-lg font-semibold text-white">Connect Your Freighter Wallet</h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
            Connect the Stellar wallet you want to bind to your SEP-12 identity credential.
          </p>
          <button
            type="button"
            onClick={connect}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            <Wallet className="h-4 w-4" />
            Connect Freighter
          </button>
        </div>
      ) : kycStatus === 'BANNED' ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 shadow-xl">
          <div className="flex items-start gap-3.5">
            <Ban className="mt-0.5 h-6 w-6 shrink-0 text-rose-400" />
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-rose-200">
                Identity &amp; Wallet Suspended (Unresolved Loan Default)
              </h2>
              <p className="text-xs leading-relaxed text-rose-200/80">
                This wallet and its bound SEP-12 identity nullifier are flagged as{' '}
                <strong>BANNED</strong> due to an overdue loan default. New credit draws and
                multi-wallet re-registrations are blocked until the remaining balance is repaid.
              </p>
              <button
                type="button"
                onClick={() => setActivePage('dashboard')}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400"
              >
                Go to Credit Vault to Repay Balance
              </button>
            </div>
          </div>
        </div>
      ) : kycStatus === 'VERIFIED' && kycRecord ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/25 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <h2 className="text-base font-bold text-white">
                  SEP-12 Identity Verified &amp; Bound On-Chain
                </h2>
                <p className="text-xs text-slate-400">
                  Registered on {kycRecord.registered_at_ist} IST
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('dashboard')}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Open Credit Vault →
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
              <div className="text-[11px] text-slate-400">Legal Name</div>
              <div className="mt-1 text-sm font-semibold text-white">{kycRecord.full_name}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
              <div className="text-[11px] text-slate-400">Verified Document</div>
              <div className="mt-1 text-sm font-semibold text-slate-200">
                {kycRecord.country_code} · {kycRecord.id_type} ({kycRecord.masked_id})
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
              <div className="text-[11px] text-slate-400">Bound Stellar Wallet</div>
              <div className="mt-1 font-mono text-xs font-semibold text-emerald-300">
                {shortenAddress(kycRecord.wallet_address, 8, 8)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 sm:col-span-2">
              <div className="text-[11px] text-slate-400">
                On-Chain Salted SHA-256 Nullifier (Zero-PII Sybil Hash)
              </div>
              <div className="mt-1 truncate font-mono text-xs text-cyan-300">
                0x{kycRecord.kyc_nullifier}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
              <div className="text-[11px] text-slate-400">Soroban Attestation Tx</div>
              {kycRecord.onchain_tx_hash ? (
                <a
                  href={getExplorerTxUrl(kycRecord.onchain_tx_hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400 hover:underline"
                >
                  {shortenAddress(kycRecord.onchain_tx_hash, 8, 6)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <div className="mt-1 text-xs text-slate-400">Confirmed</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Registration Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-xl lg:col-span-8"
          >
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-semibold text-white">Submit SEP-12 Customer KYC</h2>
              <p className="text-xs text-slate-400">
                Wallet to bind: <span className="font-mono text-emerald-300">{address}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  disabled={isKycLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Contact Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="aarav@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isKycLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Country Code (ISO)
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={isKycLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="IN">IN · India</option>
                  <option value="PH">PH · Philippines</option>
                  <option value="MX">MX · Mexico</option>
                  <option value="NG">NG · Nigeria</option>
                  <option value="US">US · United States</option>
                  <option value="AE">AE · United Arab Emirates</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Government ID Type
                </label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  disabled={isKycLoading}
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
                Government ID Number (Hashed via Salted SHA-256)
              </label>
              <input
                type="text"
                required
                placeholder="Enter unique ID number (e.g., 482910492811)"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                disabled={isKycLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {(formError || kycError) && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/35 bg-rose-950/60 p-3 text-xs text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <span>{formError || kycError}</span>
              </div>
            )}

            {successTxHash && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/35 bg-emerald-950/60 p-3 text-xs text-emerald-200">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Identity verified and bound on Stellar Testnet!
                </span>
                <a
                  href={getExplorerTxUrl(successTxHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold underline"
                >
                  View Tx ↗
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={isKycLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-60"
            >
              {isKycLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying &amp; Binding On-Chain...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Verify Identity &amp; Bind Wallet
                </>
              )}
            </button>
          </form>

          {/* Privacy & Anti-Sybil Sidebar */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Lock className="h-4 w-4 text-emerald-400" />
                Zero-PII On-Chain Architecture
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Your raw government ID number is never written to Google Sheets or Stellar. The
                Anchor computes{' '}
                <code className="text-slate-200">SHA256(salt + country + type + id)</code> and
                stores only the 32-byte nullifier on-chain.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/75 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                Why One Wallet Per Person?
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Because RemitCredit offers <strong>0% collateral</strong> credit lines, enforcing a
                1-to-1 human-to-wallet binding prevents Sybil attacks and ensures defaults cannot be
                evaded by spinning up a fresh Freighter wallet.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};