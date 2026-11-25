export const STELLAR_CONFIG = {
  network: import.meta.env.VITE_STELLAR_NETWORK || 'testnet',
  rpcUrl: import.meta.env.VITE_SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
  horizonUrl: import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org',
  networkPassphrase:
    import.meta.env.VITE_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
  remitContractId:
    import.meta.env.VITE_REMIT_CONTRACT_ID ||
    'CCPRKASCF2M3SQ5XKK323KF4WKJ32IHIDAM6D75D5EMH6S6JM7KKT46P',
  usdcSacId:
    import.meta.env.VITE_USDC_SAC_ID ||
    'CDUIQMEIO3VBVUPJUCI47XRJGNW5D2LX5PJJML23DUALE3B4AC5UZTRK',
  anchorPublicKey:
    import.meta.env.VITE_ANCHOR_PUBLIC_KEY ||
    'GCF4H37C6PDJITN3WCIELT7J625PERUUWZJXYJKYZ6AZ3P3DY3XDR3E6',
  keeperApiUrl: import.meta.env.VITE_KEEPER_API_URL || 'http://localhost:8000',
  explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
  enableTestnetSimulator:
    (import.meta.env.VITE_ENABLE_TESTNET_SIMULATOR ?? 'true').toLowerCase() === 'true',
  simulatorMaxUsdc: Number(import.meta.env.VITE_SIMULATOR_MAX_USDC || 1500),
} as const;

export function getExplorerTxUrl(txHash: string): string {
  return `${STELLAR_CONFIG.explorerBaseUrl}/tx/${txHash}`;
}

export function getExplorerContractUrl(contractId: string = STELLAR_CONFIG.remitContractId): string {
  return `${STELLAR_CONFIG.explorerBaseUrl}/contract/${contractId}`;
}

export function getExplorerAccountUrl(accountId: string): string {
  return `${STELLAR_CONFIG.explorerBaseUrl}/account/${accountId}`;
}