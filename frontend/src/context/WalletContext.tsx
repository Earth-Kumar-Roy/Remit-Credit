import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetworkDetails,
  signTransaction as freighterSignTransaction,
} from '@stellar/freighter-api';
import { STELLAR_CONFIG } from '@/config/stellar';

export type ActiveRole = 'borrower' | 'lp';
export type AppPage = 'landing' | 'remit' | 'dashboard' | 'pool' | 'history' | 'kyc' | 'status';

interface WalletContextValue {
  address: string | null;
  isWalletInstalled: boolean;
  isConnecting: boolean;
  networkError: string | null;
  activeRole: ActiveRole;
  setActiveRole: (role: ActiveRole) => void;
  activePage: AppPage;
  setActivePage: (page: AppPage) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  signTx: (xdr: string) => Promise<{ signedTxXdr: string; signerAddress?: string }>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [address, setAddress] = useState<string | null>(null);
  const [isWalletInstalled, setIsWalletInstalled] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<ActiveRole>('borrower');
  const [activePage, setActivePage] = useState<AppPage>('landing');

  const verifyNetwork = useCallback(async () => {
    try {
      const details = await getNetworkDetails();
      if (details.error) {
        setNetworkError(details.error);
        return false;
      }
      if (details.networkPassphrase !== STELLAR_CONFIG.networkPassphrase) {
        setNetworkError(
          `Wrong Freighter network (${details.network}). Switch Freighter to Stellar Testnet.`
        );
        return false;
      }
      setNetworkError(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const conn = await isConnected();
        if (!mounted) return;
        setIsWalletInstalled(Boolean(conn.isConnected));

        if (conn.isConnected) {
          const allowed = await isAllowed();
          if (allowed.isAllowed) {
            const addrResp = await getAddress();
            if (mounted && addrResp.address) {
              setAddress(addrResp.address);
              await verifyNetwork();
            }
          }
        }
      } catch {
        if (mounted) setIsWalletInstalled(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [verifyNetwork]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setNetworkError(null);
    try {
      const conn = await isConnected();
      if (!conn.isConnected) {
        setIsWalletInstalled(false);
        setNetworkError('Freighter extension not detected. Install Freighter and refresh.');
        return;
      }
      setIsWalletInstalled(true);

      const access = await requestAccess();
      if (access.error) {
        setNetworkError(access.error);
        return;
      }
      if (access.address) {
        setAddress(access.address);
        await verifyNetwork();
        setActivePage((prev) => (prev === 'landing' ? 'dashboard' : prev));
      }
    } finally {
      setIsConnecting(false);
    }
  }, [verifyNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetworkError(null);
    setActivePage('landing');
  }, []);

  const signTx = useCallback(
    async (xdr: string) => {
      if (!address) {
        throw new Error('Connect your Freighter wallet before signing.');
      }
      const okNetwork = await verifyNetwork();
      if (!okNetwork) {
        throw new Error('Switch Freighter wallet to Stellar Testnet first.');
      }

      const res = await freighterSignTransaction(xdr, {
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        address,
      });

      if (res.error) {
        throw new Error(res.error);
      }
      return {
        signedTxXdr: res.signedTxXdr,
        signerAddress: res.signerAddress,
      };
    },
    [address, verifyNetwork]
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        isWalletInstalled,
        isConnecting,
        networkError,
        activeRole,
        setActiveRole,
        activePage,
        setActivePage,
        connect,
        disconnect,
        signTx,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error('useWallet must be used inside <WalletProvider>');
  }
  return ctx;
}