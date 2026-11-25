import { useCallback, useEffect, useState } from 'react';
import { STELLAR_CONFIG } from '@/config/stellar';
import { useWallet } from '@/context/WalletContext';

export type KycStanding = 'UNVERIFIED' | 'VERIFIED' | 'BANNED';

export interface KycCustomerRecord {
  wallet_address: string;
  kyc_nullifier: string;
  full_name: string;
  email: string;
  country_code: string;
  id_type: string;
  masked_id: string;
  kyc_status: KycStanding;
  credit_tier: number;
  default_count: number;
  onchain_tx_hash: string;
  registered_at_ist: string;
  updated_at_ist: string;
}

export interface KycRegistrationInput {
  full_name: string;
  email: string;
  country_code: string;
  id_type: string;
  id_number: string;
}

export function useKycStatus() {
  const { address } = useWallet();
  const [status, setStatus] = useState<KycStanding>('UNVERIFIED');
  const [record, setRecord] = useState<KycCustomerRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!address) {
      setStatus('UNVERIFIED');
      setRecord(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(`${STELLAR_CONFIG.keeperApiUrl}/sep12/customer`);
      url.searchParams.set('wallet', address);

      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || `KYC check failed (${res.status})`);
      }

      const standing = (json.kyc_status || 'UNVERIFIED') as KycStanding;
      setStatus(standing);
      setRecord(json.record || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify SEP-12 KYC status.');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const submitKycRegistration = useCallback(
    async (input: KycRegistrationInput) => {
      if (!address) {
        throw new Error('Connect your Freighter wallet before completing SEP-12 KYC.');
      }

      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${STELLAR_CONFIG.keeperApiUrl}/sep12/customer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet_address: address,
            full_name: input.full_name.trim(),
            email: input.email.trim(),
            country_code: input.country_code.trim().toUpperCase(),
            id_type: input.id_type.trim().toUpperCase(),
            id_number: input.id_number.trim(),
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.detail || 'SEP-12 KYC verification failed.');
        }

        await checkStatus();
        return json;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'SEP-12 KYC registration failed.';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [address, checkStatus]
  );

  return {
    kycStatus: status,
    kycRecord: record,
    isKycLoading: isLoading,
    kycError: error,
    refreshKycStatus: checkStatus,
    submitKycRegistration,
  };
}