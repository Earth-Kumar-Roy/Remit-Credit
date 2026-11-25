import { useCallback, useEffect, useState } from 'react';
import { STELLAR_CONFIG } from '@/config/stellar';
import { ProtocolEventItem } from '@/hooks/useProtocolEvents';

export function useAccountHistory(
  walletAddress: string | null,
  categoryFilter: string = 'ALL',
  limit = 100
) {
  const [transactions, setTransactions] = useState<ProtocolEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    if (!walletAddress) {
      setTransactions([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const url = new URL(
        `${STELLAR_CONFIG.keeperApiUrl}/history/${encodeURIComponent(walletAddress)}`
      );
      url.searchParams.set('limit', String(limit));
      if (categoryFilter && categoryFilter !== 'ALL') {
        url.searchParams.set('category', categoryFilter);
      }

      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.detail || `History lookup failed (${res.status})`);
      }

      setTransactions(Array.isArray(json.transactions) ? json.transactions : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load account transaction history.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, categoryFilter, limit]);

  useEffect(() => {
    refreshHistory();
    if (!walletAddress) return;
    const timer = setInterval(refreshHistory, 15_000);
    return () => clearInterval(timer);
  }, [refreshHistory, walletAddress]);

  return {
    transactions,
    isLoading,
    error,
    refreshHistory,
  };
}