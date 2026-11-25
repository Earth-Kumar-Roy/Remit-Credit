const STROOP_DECIMALS = 7;
const STROOPS_PER_UNIT = 10_000_000n;

/**
 * Converts a 7-decimal stroop amount (bigint | number | string) into a formatted USDC string.
 */
export function formatUsdc(
  stroops: bigint | number | string | null | undefined,
  fractionDigits = 2
): string {
  if (stroops === null || stroops === undefined) return '0.00';

  const raw = typeof stroops === 'bigint' ? stroops : BigInt(stroops.toString());
  const isNegative = raw < 0n;
  const abs = isNegative ? -raw : raw;

  const whole = abs / STROOPS_PER_UNIT;
  const remainder = abs % STROOPS_PER_UNIT;

  const paddedFraction = remainder.toString().padStart(STROOP_DECIMALS, '0');
  const slicedFraction = paddedFraction.slice(0, fractionDigits).padEnd(fractionDigits, '0');

  const formattedWhole = whole.toLocaleString('en-US');
  return `${isNegative ? '-' : ''}${formattedWhole}${fractionDigits > 0 ? `.${slicedFraction}` : ''}`;
}

/**
 * Parses a decimal USDC string (e.g., "250.75") into exact 7-decimal stroops (bigint).
 * Throws an error if the input is invalid or <= 0.
 */
export function parseUsdcToStroops(input: string): bigint {
  const cleaned = input.trim();
  if (!cleaned || !/^\d+(\.\d{1,7})?$/.test(cleaned)) {
    throw new Error('Enter a valid positive USDC amount (up to 7 decimals).');
  }

  const [wholePart, fracPart = ''] = cleaned.split('.');
  const paddedFrac = fracPart.padEnd(STROOP_DECIMALS, '0');
  const stroops = BigInt(wholePart) * STROOPS_PER_UNIT + BigInt(paddedFrac);

  if (stroops <= 0n) {
    throw new Error('Amount must be greater than 0 USDC.');
  }
  return stroops;
}

/**
 * Formats basis points (e.g., 4000 -> "40.0%", 250 -> "2.5%").
 */
export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

/**
 * Shortens a 56-character Stellar public key or contract ID (e.g., "GCF4...R3E6").
 */
export function shortenAddress(addr: string, prefixLen = 5, suffixLen = 4): string {
  if (!addr || addr.length <= prefixLen + suffixLen + 3) return addr;
  return `${addr.slice(0, prefixLen)}...${addr.slice(-suffixLen)}`;
}

/**
 * Formats a Unix epoch timestamp (seconds) into Indian Standard Time (dd-mm-yyyy HH:MM:SS).
 */
export function formatUnixToIST(unixSecs: bigint | number): string {
  const secs = Number(unixSecs || 0);
  if (secs <= 0) return 'N/A';

  const date = new Date(secs * 1000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

/**
 * Returns remaining time before a loan's `due_at` deadline (or "OVERDUE").
 */
export function formatDueCountdown(dueAtSecs: bigint | number): {
  label: string;
  isOverdue: boolean;
} {
  const due = Number(dueAtSecs || 0);
  if (due <= 0) return { label: 'No Active Term', isOverdue: false };

  const nowSecs = Math.floor(Date.now() / 1000);
  const diff = due - nowSecs;
  if (diff <= 0) {
    return { label: 'OVERDUE', isOverdue: true };
  }

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) {
    return { label: `${days}d ${hours}h left`, isOverdue: false };
  }

  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  if (hours > 0) {
    return { label: `${hours}h ${mins}m left`, isOverdue: false };
  }
  if (mins > 0) {
    return { label: `${mins}m ${secs}s left`, isOverdue: false };
  }
  return { label: `${secs}s left`, isOverdue: false };
}