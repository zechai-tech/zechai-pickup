// Shared formatting, IST date, and CSV utilities for /admin/analytics

export type AnalyticsTab =
  | 'sales'
  | 'peak-hours'
  | 'kitchen-speed'
  | 'best-items'
  | 'bought-together'
  | 'repeat-customers';

export type DatePreset =
  | 'today'
  | 'yesterday'
  | '7days'
  | '30days'
  | 'this_month'
  | 'custom';

export const ANALYTICS_TABS: { key: AnalyticsTab; label: string }[] = [
  { key: 'sales', label: 'Sales' },
  { key: 'peak-hours', label: 'Peak hours' },
  { key: 'kitchen-speed', label: 'Kitchen speed' },
  { key: 'best-items', label: 'Best items' },
  { key: 'bought-together', label: 'Bought together' },
  { key: 'repeat-customers', label: 'Repeat customers' },
];

/**
 * Returns today's date string (YYYY-MM-DD) in Asia/Kolkata (IST)
 */
export function getTodayIST(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Shifts a YYYY-MM-DD date string by N days
 */
export function addDaysYYYYMMDD(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Resolves a preset into { from, to } in YYYY-MM-DD (IST calendar dates)
 */
export function getPresetDateRange(preset: Exclude<DatePreset, 'custom'>): {
  from: string;
  to: string;
} {
  const today = getTodayIST();
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const yest = addDaysYYYYMMDD(today, -1);
      return { from: yest, to: yest };
    }
    case '7days':
      return { from: addDaysYYYYMMDD(today, -6), to: today };
    case '30days':
      return { from: addDaysYYYYMMDD(today, -29), to: today };
    case 'this_month': {
      const monthStart = `${today.slice(0, 7)}-01`;
      return { from: monthStart, to: today };
    }
  }
}

/**
 * Format number using Indian numbering system: ₹1,23,456
 */
export function formatINR(amount: number | string | null | undefined, decimals = 0): string {
  const num = Number(amount ?? 0);
  if (!Number.isFinite(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(decimals === 0 ? Math.round(num) : num);
}

/**
 * Plain Indian number without symbol: 1,23,456
 */
export function formatIndianNumber(val: number | string | null | undefined): string {
  const num = Number(val ?? 0);
  if (!Number.isFinite(num)) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

/**
 * Format duration in seconds to "14 min 20 s"
 */
export function formatDurationSeconds(totalSeconds: number | string | null | undefined): string {
  const sec = Math.max(0, Math.round(Number(totalSeconds ?? 0)));
  if (!Number.isFinite(sec)) return '0 min 0 s';
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${mins} min ${remSec} s`;
}

/**
 * Format minutes (possibly decimal) to "14 min 20 s"
 */
export function formatDurationMinutes(minutes: number | string | null | undefined): string {
  const minsVal = Number(minutes ?? 0);
  if (!Number.isFinite(minsVal) || minsVal < 0) return '0 min 0 s';
  return formatDurationSeconds(Math.round(minsVal * 60));
}

/**
 * Compute % delta vs previous period; returns null ('n/a') when previous <= 0
 */
export function computeDeltaPct(
  current: number | string | null | undefined,
  previous: number | string | null | undefined
): { label: string; direction: 'up' | 'down' | 'flat' | 'na' } {
  const curr = Number(current ?? 0);
  const prev = Number(previous ?? 0);
  if (!Number.isFinite(prev) || prev <= 0) {
    return { label: 'n/a', direction: 'na' };
  }
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { label: `+${pct}%`, direction: 'up' };
  if (pct < 0) return { label: `${pct}%`, direction: 'down' };
  return { label: '0%', direction: 'flat' };
}

/**
 * Mask 10-digit phone number for managers: 98••••3210
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  if (digits.length < 6) return '••••••';
  return `${digits.slice(0, 2)}••••${digits.slice(-4)}`;
}

/**
 * Format IST timestamp nicely for display / PDF metadata
 */
export function getNowISTFormatted(): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date()) + ' IST';
}

/**
 * Convert a 0-23 hour integer to readable slot label like "6-7 PM" or "12-1 AM"
 */
export function formatHourSlotRange(hour: number): string {
  const fmt = (h: number) => {
    const wrapped = ((h % 24) + 24) % 24;
    if (wrapped === 0) return '12 AM';
    if (wrapped < 12) return `${wrapped} AM`;
    if (wrapped === 12) return '12 PM';
    return `${wrapped - 12} PM`;
  };
  const hStart = ((hour % 24) + 24) % 24;
  const hEnd = (hStart + 1) % 24;
  const startLabel = fmt(hStart);
  const endLabel = fmt(hEnd);
  const startPeriod = hStart < 12 ? 'AM' : 'PM';
  const endPeriod = hEnd < 12 ? 'AM' : 'PM';
  if (startPeriod === endPeriod) {
    const startNum = startLabel.replace(/ (AM|PM)$/, '');
    return `${startNum}-${endLabel}`;
  }
  return `${startLabel}-${endLabel}`;
}

/**
 * Slugify outlet name for export filenames
 */
export function slugifyForFilename(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'all-outlets'
  );
}

/**
 * Escape a single CSV cell per RFC 4180
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a UTF-8 with BOM CSV string from sections of tables
 */
export function buildCsvContent(
  sections: Array<{
    title?: string;
    headers: string[];
    rows: Array<Array<unknown>>;
  }>
): string {
  const lines: string[] = [];
  sections.forEach((sec, idx) => {
    if (idx > 0) lines.push('');
    if (sec.title) {
      lines.push(escapeCsvCell(sec.title));
    }
    lines.push(sec.headers.map(escapeCsvCell).join(','));
    for (const row of sec.rows) {
      lines.push(row.map(escapeCsvCell).join(','));
    }
  });
  // UTF-8 BOM so Excel renders ₹ and Malayalam characters cleanly
  return '\uFEFF' + lines.join('\r\n');
}

export function triggerCsvDownload(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
