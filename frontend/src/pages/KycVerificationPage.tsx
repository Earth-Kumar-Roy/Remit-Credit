import React, { useState } from 'react';
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Copy,
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
  const { address, isConnecting, connect, setActivePage } = useWallet();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('IN');
  const [idType, setIdType] = useState('AADHAAR');
  const [idNumber, setIdNumber] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const [copiedNullifier, setCopiedNullifier] = useState(false);

  const handleCopyNullifier = (val: string) => {
    navigator.clipboard.writeText(`0x${val}`);
    setCopiedNullifier(true);
    setTimeout(() => setCopiedNullifier(false), 1800);
  };

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
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      {/* Architectural Header Monolith */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black_45%,transparent_90%)]">
          <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="kycCadGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.85" />
                <circle cx="40" cy="40" r="1" fill="#22d3ee" opacity="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#kycCadGrid)" />
          </svg>
        </div>

        <div className="pointer-events-none absolute -top-20 right-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-cyan-500/10 blur-[120px]" />
        <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-cyan-400/70">
          ⌜ SEC_04 // SEP-12_SYBIL_SHIELD ⌝
        </span>
        <span className="pointer-events-none absolute right-4 top-3 select-none font-mono text-[10px] text-amber-400/70">
          [+]
        </span>

        <div className="relative z-10 mt-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
              <Fingerprint className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
                <span className="font-bold text-emerald-400">◈ ZERO-PII IDENTITY ATTESTATION</span>
                <span className="text-slate-600">//</span>
                <span className="text-amber-300">1 HUMAN = 1 WALLET</span>
              </div>
              <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                SEP-12 Identity &amp; Sybil Shield
              </h1>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400 sm:text-sm">
                Whitelisted Anchors verify government IDs off-chain and bind a salted SHA-256
                nullifier on-chain so raw personal data never touches the public Stellar ledger.
              </p>
            </div>
          </div>

          <span className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs font-bold text-emerald-300">
            SHA-256 NULLIFIER
          </span>
        </div>
      </section>

      {!address ? (
        <div className="relative overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-12 text-center shadow-xl">
          <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-slate-600">
            ⌜ WALLET_AUTH // REQUIRED ⌝
          </span>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/10">
            <Wallet className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-white">Connect Your Freighter Wallet</h2>
          <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">
            Connect the Stellar wallet you want to bind to your one-time SEP-12 identity
            credential.
          </p>
          <button
            type="button"
            onClick={connect}
            disabled={isConnecting}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg transition hover:opacity-95 disabled:opacity-60"
          >
            <Wallet className="h-4 w-4" />
            <span>{isConnecting ? 'Connecting Freighter...' : '[ ⬡ Connect Freighter ]'}</span>
          </button>
        </div>
      ) : kycStatus === 'BANNED' ? (
        <div className="relative overflow-hidden rounded-3xl border border-rose-500/40 bg-gradient-to-br from-rose-950/50 via-[#080e1a] to-[#080e1a] p-6 shadow-xl sm:p-8">
          <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-rose-400/80">
            ⌜ COMPLIANCE_LOCK // 6_STRIKE_DEFAULT ⌝
          </span>
          <div className="mt-2 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-500/15">
              <Ban className="h-6 w-6 text-rose-400" />
            </div>
            <div className="space-y-2">
              <div className="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-400">
                ● IDENTITY NULLIFIER SUSPENDED
              </div>
              <h2 className="text-lg font-bold text-white">
                Identity &amp; Wallet Suspended (6 Overdue Strikes)
              </h2>
              <p className="text-xs leading-relaxed text-rose-200/85">
                This wallet and its bound SEP-12 identity nullifier are flagged as{' '}
                <strong>BANNED</strong> due to reaching 6 overdue loan periods. New credit draws
                and multi-wallet re-registrations with this government ID are blocked across the
                protocol until the defaulted debt plus the 50% rehabilitation penalty is settled
                on-chain.
              </p>
            </div>
          </div>
        </div>
      ) : kycStatus === 'VERIFIED' && kycRecord ? (
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/35 bg-[#080e1a] p-6 shadow-xl sm:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          <span className="pointer-events-none absolute left-4 top-3 select-none font-mono text-[10px] text-emerald-400/80">
            ⌜ CREDENTIAL_ACTIVE // BOUND_ON_CHAIN ⌝
          </span>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/35 bg-emerald-500/15">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  SEP-12 Identity Verified &amp; Bound On-Chain
                </h2>
                <p className="font-mono text-xs text-slate-400">
                  ATTESTED ON {kycRecord.registered_at_ist} IST
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('dashboard')}
              className="rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:opacity-95"
            >
              Open Credit Vault →
            </button>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
              <div className="font-mono text-[10px] uppercase text-slate-400">Legal Name</div>
              <div className="mt-1 text-sm font-bold text-white">{kycRecord.full_name}</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
              <div className="font-mono text-[10px] uppercase text-slate-400">
                Verified Document
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-slate-200">
                {kycRecord.country_code} · {kycRecord.id_type} ({kycRecord.masked_id})
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
              <div className="font-mono text-[10px] uppercase text-slate-400">
                Bound Stellar Wallet
              </div>
              <div className="mt-1 font-mono text-xs font-bold text-emerald-300">
                {shortenAddress(kycRecord.wallet_address, 8, 8)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4 sm:col-span-2">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase text-slate-400">
                <span>On-Chain Salted SHA-256 Nullifier (Zero-PII Sybil Hash)</span>
                <button
                  type="button"
                  onClick={() => handleCopyNullifier(kycRecord.kyc_nullifier)}
                  className="inline-flex items-center gap-1 text-cyan-300 hover:text-white"
                >
                  {copiedNullifier ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="mt-1 truncate font-mono text-xs text-cyan-300">
                0x{kycRecord.kyc_nullifier}
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/85 p-4">
              <div className="font-mono text-[10px] uppercase text-slate-400">
                Soroban Attestation Tx
              </div>
              {kycRecord.onchain_tx_hash ? (
                <a
                  href={getExplorerTxUrl(kycRecord.onchain_tx_hash)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-mono text-xs font-bold text-emerald-400 hover:underline"
                >
                  <span>{shortenAddress(kycRecord.onchain_tx_hash, 8, 6)}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <div className="mt-1 font-mono text-xs text-slate-400">CONFIRMED</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Registration Form */}
          <form
            onSubmit={handleSubmit}
            className="relative space-y-4 overflow-hidden rounded-3xl border border-slate-800/90 bg-[#080e1a] p-6 shadow-xl lg:col-span-8"
          >
            <span className="pointer-events-none absolute left-4 top-2.5 select-none font-mono text-[9px] text-slate-500">
              ⌜ CUSTOMER_ATTESTATION_FORM ⌝
            </span>

            <div className="mt-2 border-b border-slate-800 pb-3.5">
              <h2 className="text-base font-bold text-white">Submit SEP-12 Customer KYC</h2>
              <p className="mt-0.5 font-mono text-xs text-slate-400">
                WALLET TO BIND: <span className="text-emerald-300">{address}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-300">
                  01 // Full Legal Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Aarav Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isKycLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-300">
                  02 // Contact Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="aarav@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isKycLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-300">
                  03 // Country Code (ISO)
                </label>
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  disabled={isKycLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-cyan-400 focus:outline-none"
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
                <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-300">
                  04 // Government ID Type
                </label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  disabled={isKycLoading}
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
              <label className="mb-1 block font-mono text-[11px] uppercase tracking-wider text-slate-300">
                05 // Government ID Number (Hashed via Salted SHA-256)
              </label>
              <input
                type="text"
                required
                placeholder="Enter unique ID number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                disabled={isKycLoading}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-sm text-white placeholder-slate-600 focus:border-amber-400 focus:outline-none"
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
                  className="font-mono font-bold underline"
                >
                  View Tx ↗
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={isKycLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 px-5 py-3 font-mono text-xs font-bold uppercase tracking-wider text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:opacity-95 disabled:opacity-60"
            >
              {isKycLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying &amp; Binding On-Chain...</span>
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  <span>[ ✓ Verify Identity &amp; Bind Wallet ]</span>
                </>
              )}
            </button>
          </form>

          {/* Privacy & Anti-Sybil Sidebar */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-slate-800/90 bg-[#080e1a] p-5 shadow-lg">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-emerald-400">
                <Lock className="h-4 w-4" />
                <span>Zero-PII On-Chain</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Your raw government ID number is never written to Google Sheets or Stellar. The
                Anchor computes{' '}
                <code className="text-cyan-300">SHA256(salt + country + type + id)</code> and
                stores only the 32-byte nullifier on-chain.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800/90 bg-[#080e1a] p-5 shadow-lg">
              <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-cyan-400">
                <ShieldCheck className="h-4 w-4" />
                <span>One Wallet Per Human</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Because RemitCredit offers <strong>0% collateral</strong> credit lines at 50%
                rolling 8-inflow LTV, enforcing a 1-to-1 human-to-wallet binding prevents Sybil
                attacks and multi-wallet default evasion.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};