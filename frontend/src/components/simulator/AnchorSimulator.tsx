import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Send,
  ShieldCheck,
} from 'lucide-react';
import {
  Address,
  Contract,
  Horizon,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, getExplorerTxUrl } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';
import { parseUsdcToStroops } from '@/utils/stroops';

interface AnchorSimulatorProps {
  keeperOnline: boolean;
  onSettled: () => Promise<void>;
}

const FEE_CAP_STROOPS = 150_000_000n; // 15.00 USDC max fee cap in v3 contract

/**
 * Computes the exact gross stroops to pass into `send_remittance` so that after the contract
 * deducts `min(floor(gross * 200 / 10_000), 15_0000000)`, the recipient receives the full
 * `targetNetStroops` entered by the sender.
 */
function calculateGrossForExactNet(targetNetStroops: bigint): {
  grossStroops: bigint;
  feeStroops: bigint;
  actualNetStroops: bigint;
} {
  if (targetNetStroops <= 0n) {
    return { grossStroops: 0n, feeStroops: 0n, actualNetStroops: 0n };
  }

  // Case A: Fee hits the 15.00 USDC (150_000_000 stroops) cap
  const cappedGross = targetNetStroops + FEE_CAP_STROOPS;
  if ((cappedGross * 200n) / 10_000n >= FEE_CAP_STROOPS) {
    return {
      grossStroops: cappedGross,
      feeStroops: FEE_CAP_STROOPS,
      actualNetStroops: targetNetStroops,
    };
  }

  // Case B: Uncapped 2% fee (gross = ceil(targetNet * 10_000 / 9_800))
  let gross = (targetNetStroops * 10_000n + 9_799n) / 9_800n;
  let fee = (gross * 200n) / 10_000n;
  while (gross - fee < targetNetStroops) {
    gross += 1n;
    fee = (gross * 200n) / 10_000n;
  }

  return {
    grossStroops: gross,
    feeStroops: fee,
    actualNetStroops: gross - fee,
  };
}

export const AnchorSimulator: React.FC<AnchorSimulatorProps> = ({
  keeperOnline,
  onSettled,
}) => {
  const { address, signTx } = useWallet();
  const [beneficiary, setBeneficiary] = useState<string>('');
  const [amountUsdc, setAmountUsdc] = useState<string>('100');
  const [stepLabel, setStepLabel] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [receipt, setReceipt] = useState<{
    txHash: string;
    totalDebitedUsdc: number;
    feeUsdc: number;
    netDeliveredUsdc: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Clear recipient field if it matches the connected sender wallet
  useEffect(() => {
    if (address && beneficiary.trim().toUpperCase() === address.trim().toUpperCase()) {
      setBeneficiary('');
    }
  }, [address, beneficiary]);

  const cleanBeneficiary = beneficiary.trim().toUpperCase();
  const isSelfTransfer =
    Boolean(address) &&
    cleanBeneficiary.length > 0 &&
    cleanBeneficiary === address!.trim().toUpperCase();

  const parsedNetAmount = Number(amountUsdc);
  const validPreview = Number.isFinite(parsedNetAmount) && parsedNetAmount > 0;

  let previewGross = 0;
  let previewFee = 0;
  let previewNet = 0;
  if (validPreview) {
    try {
      const targetNetStroops = parseUsdcToStroops(amountUsdc);
      const calc = calculateGrossForExactNet(targetNetStroops);
      previewGross = Number(calc.grossStroops) / 10_000_000;
      previewFee = Number(calc.feeStroops) / 10_000_000;
      previewNet = Number(calc.actualNetStroops) / 10_000_000;
    } catch {
      // Ignore partial decimal typing
    }
  }

  const handleAtomicRemittance = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setReceipt(null);

    if (!address) {
      setErrorMsg('Connect your Freighter wallet to send a cross-border remittance.');
      return;
    }

    if (!cleanBeneficiary || cleanBeneficiary.length !== 56 || !cleanBeneficiary.startsWith('G')) {
      setErrorMsg('Enter a valid 56-character Stellar recipient address (G...).');
      return;
    }

    if (cleanBeneficiary === address.trim().toUpperCase()) {
      setErrorMsg('Self-remittance is not allowed. Enter a different recipient Stellar address.');
      return;
    }

    if (!Number.isFinite(parsedNetAmount) || parsedNetAmount <= 0) {
      setErrorMsg('Enter a valid USDC amount greater than 0.');
      return;
    }

    setIsSending(true);
    try {
      const targetNetStroops = parseUsdcToStroops(amountUsdc);
      const { grossStroops, feeStroops, actualNetStroops } =
        calculateGrossForExactNet(targetNetStroops);

      setStepLabel('Sign atomic remittance in Freighter...');
      const horizon = new Horizon.Server(STELLAR_CONFIG.horizonUrl);
      const sorobanServer = new rpc.Server(STELLAR_CONFIG.rpcUrl);
      const sourceAccount = await horizon.loadAccount(address);

      const remitContract = new Contract(STELLAR_CONFIG.remitContractId);
      const sendOp = remitContract.call(
        'send_remittance',
        new Address(address).toScVal(),
        new Address(cleanBeneficiary).toScVal(),
        nativeToScVal(grossStroops, { type: 'i128' })
      );

      const rawTx = new TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
      })
        .addOperation(sendOp)
        .setTimeout(120)
        .build();

      const preparedTx = await sorobanServer.prepareTransaction(rawTx);
      const signResult = await signTx(preparedTx.toXDR());
      const signedXdr =
        typeof signResult === 'string' ? signResult : signResult?.signedTxXdr;

      if (!signedXdr) {
        throw new Error('Freighter signature rejected or cancelled.');
      }

      const signedTx = TransactionBuilder.fromXDR(signedXdr, STELLAR_CONFIG.networkPassphrase);
      const sendResult = await sorobanServer.sendTransaction(signedTx);

      if (sendResult.status === 'ERROR') {
        throw new Error('Failed broadcasting remittance transaction to Stellar.');
      }

      const txHash = sendResult.hash;

      setStepLabel('Confirming atomic settlement on Stellar...');
      let confirmed = false;
      for (let i = 0; i < 20; i++) {
        const txCheck = await sorobanServer.getTransaction(txHash);
        if (txCheck.status === rpc.Api.GetTransactionStatus.SUCCESS) {
          confirmed = true;
          break;
        }
        if (txCheck.status === rpc.Api.GetTransactionStatus.FAILED) {
          throw new Error('Remittance transaction failed on-chain.');
        }
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (!confirmed) {
        throw new Error('Timed out waiting for Stellar confirmation.');
      }

      if (keeperOnline) {
        fetch(`${STELLAR_CONFIG.keeperApiUrl}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: cleanBeneficiary, check_overdue: false }),
        }).catch(() => {});
      }

      setReceipt({
        txHash,
        totalDebitedUsdc: Number(grossStroops) / 10_000_000,
        feeUsdc: Number(feeStroops) / 10_000_000,
        netDeliveredUsdc: Number(actualNetStroops) / 10_000_000,
      });

      await onSettled();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to complete cross-border remittance.'
      );
    } finally {
      setIsSending(false);
      setStepLabel('');
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">
              SEP-31 Cross-Border Remittance Corridor
            </h2>
            <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-300 ring-1 ring-cyan-500/30">
              Exact Recipient Delivery · +2% Backstop Fee (Max $15)
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Recipient receives 100% of the entered amount (or 40%/60% waterfall when a loan is
            active), while the 2% fee (capped at 15.00 USDC) is added on top and routed to the
            First-Loss Backstop Reserve.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {[100, 250, 500, 1000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmountUsdc(String(preset))}
              className="rounded-lg border border-cyan-500/25 bg-slate-950/70 px-2.5 py-1 text-[11px] font-medium text-cyan-200 transition hover:border-cyan-400 hover:bg-cyan-500/10"
            >
              ${preset}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleAtomicRemittance} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="md:col-span-6">
          <label className="mb-1 block text-[11px] font-medium text-slate-400">
            Recipient Beneficiary Address (External Wallet / Family Member)
          </label>
          <input
            type="text"
            placeholder="Enter recipient Stellar address (G...)"
            value={beneficiary}
            onChange={(e) => {
              setBeneficiary(e.target.value);
              setErrorMsg(null);
            }}
            disabled={isSending}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-200 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <label className="mb-1 block text-[11px] font-medium text-slate-400">
            Recipient Receives (USDC)
          </label>
          <input
            type="number"
            step="any"
            min="1"
            value={amountUsdc}
            onChange={(e) => setAmountUsdc(e.target.value)}
            disabled={isSending}
            className="tabular-nums w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="flex items-end md:col-span-3">
          <button
            type="submit"
            disabled={!address || isSending || isSelfTransfer}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {stepLabel || 'Processing...'}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send {validPreview ? `${previewNet.toFixed(0)} USDC` : 'Remittance'}
              </>
            )}
          </button>
        </div>
      </form>

      {isSelfTransfer && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/60 px-3.5 py-2 text-xs text-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            You cannot send a remittance to your own connected wallet. Enter a different recipient
            Stellar address.
          </span>
        </div>
      )}

      {validPreview && previewGross > 0 && !isSelfTransfer && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2 text-[11px] text-slate-300">
          <span>
            Recipient Gets: <strong className="text-white">{previewNet.toFixed(2)} USDC</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>
              + Backstop Fee (2%, max $15):{' '}
              <strong className="text-emerald-300">{previewFee.toFixed(2)} USDC</strong>
            </span>
          </div>
          <span>
            Total Debited: <strong className="text-cyan-300">{previewGross.toFixed(2)} USDC</strong>
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/60 px-3.5 py-2.5 text-xs text-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {receipt && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/60 px-3.5 py-2.5 text-xs text-emerald-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Delivered full {receipt.netDeliveredUsdc.toFixed(2)} USDC to recipient (
              {receipt.totalDebitedUsdc.toFixed(2)} USDC total debited incl.{' '}
              {receipt.feeUsdc.toFixed(2)} USDC Backstop fee).
            </span>
          </div>
          <a
            href={getExplorerTxUrl(receipt.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-emerald-300 underline hover:text-white"
          >
            View Atomic Tx <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
};