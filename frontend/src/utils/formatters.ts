/**
 * Formats a numeric USDC value (from Google Sheets or API responses) with fixed decimals.
 */
export function formatDecimalUsdc(value: number | string | null | undefined, digits = 2): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Formats a signed USDC delta with explicit '+' or '-' prefix.
 */
export function formatSignedUsdc(value: number | string | null | undefined, digits = 2): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num === 0) return `0.${'0'.repeat(digits)}`;
  const prefix = num > 0 ? '+' : '-';
  return `${prefix}${Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

/**
 * Returns current Indian Standard Time formatted as dd-mm-yyyy HH:MM:SS.
 */
export function getCurrentISTString(): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Computes utilization or coverage percentage safely from bigint stroop figures.
 */
export function computeRatioPct(numerator: bigint, denominator: bigint): number {
  if (denominator <= 0n || numerator <= 0n) return 0;
  const pct = Number((numerator * 10_000n) / denominator) / 100;
  return Math.min(100, Math.max(0, Number(pct.toFixed(2))));
}

/**
 * Maps normalized Google Sheets transaction categories to readable UI titles.
 */
export function formatTxCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    LP_SUPPLY: 'Liquidity Supply',
    LP_WITHDRAW: 'Liquidity Withdrawal',
    REMITTANCE_IN: 'Cross-Border Remittance',
    INSTANT_BORROW: 'Instant Credit Draw',
    WATERFALL_REPAY: 'Waterfall Auto-Repayment',
    DIRECT_REPAY: 'Direct Wallet Repayment',
    KYC_VERIFIED: 'SEP-12 KYC Attestation',
    LOAN_DEFAULT: 'Overdue Default Slashed',
  };
  return labels[category.toUpperCase()] || category;
}