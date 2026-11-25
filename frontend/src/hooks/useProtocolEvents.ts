import { useCallback, useEffect, useState } from 'react';
import { STELLAR_CONFIG } from '@/config/stellar';

export type TxCategory =
  | 'LP_SUPPLY'
  | 'LP_WITHDRAW'
  | 'REMITTANCE_IN'
  | 'INSTANT_BORROW'
  | 'WATERFALL_REPAY'
  | 'DIRECT_REPAY'
  | 'KYC_VERIFIED'
  | 'LOAN_DEFAULT';

export interface ProtocolEventItem {
  event_id: string;
  tx_hash: string;
  ledger: number;
  timestamp_ist: string;
  wallet_address: string;
  counterparty: string;
  tx_category: TxCategory | string;
  event_type: string;
  gross_amount_usdc: number;
  pool_allocated_usdc: number;
  user_net_usdc: number;
  fee_or_yield_usdc: number;
  remaining_debt_usdc: number;
  credit_tier: number;
  status: string;
}

export function useProtocolEvents(
  walletFilter?: string | null,
  categoryFilter?: string | null,
  limit = 50
) {
  const [events, setEvents] = useState<ProtocolEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [keeperOnline, setKeeperOnline] = useState<boolean>(true);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL(`${STELLAR_CONFIG.keeperApiUrl}/feed`);
      url.searchParams.set('limit', String(limit));
      if (walletFilter) {
        url.searchParams.set('beneficiary', walletFilter);
      }
      if (categoryFilter && categoryFilter !== 'ALL') {
        url.searchParams.set('category', categoryFilter);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Keeper responded with ${res.status}`);

      const json = await res.json();
      setEvents(Array.isArray(json.events) ? json.events : []);
      setKeeperOnline(true);
    } catch {
      setKeeperOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [walletFilter, categoryFilter, limit]);

  useEffect(() => {
    fetchEvents();
    const timer = setInterval(fetchEvents, 10_000);
    return () => clearInterval(timer);
  }, [fetchEvents]);

  return {
    events,
    isLoading,
    keeperOnline,
    refreshEvents: fetchEvents,
  };
}