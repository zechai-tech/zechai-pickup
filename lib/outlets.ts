export const PICKUP_ETA_TEXT = 'Ready in 15-20 min';
export const PICKUP_ETA_SHORT = '15-20 min';

/**
 * Parses "HH:MM:SS" or "HH:MM" into minutes since midnight [0..1439].
 */
export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return (((h % 24) + 24) % 24) * 60 + Math.max(0, Math.min(59, m));
}

/**
 * Formats "HH:MM:SS" or "HH:MM" into compact 12-hour format like "12 AM", "3 PM", "11:30 PM".
 */
export function formatTime12Compact(timeStr?: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  const hRaw = parseInt(parts[0] || '', 10);
  const mRaw = parseInt(parts[1] || '0', 10);
  if (Number.isNaN(hRaw)) return timeStr;

  const h24 = ((hRaw % 24) + 24) % 24;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  if (!mRaw) {
    return `${h12} ${ampm}`;
  }
  return `${h12}:${String(mRaw).padStart(2, '0')} ${ampm}`;
}

/**
 * Returns current time in Asia/Kolkata (IST) as minutes since midnight [0..1439].
 */
export function getCurrentISTMinutes(now: Date = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(now);

    const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
    const minStr = parts.find((p) => p.type === 'minute')?.value || '0';
    const h = parseInt(hourStr, 10) % 24;
    const m = parseInt(minStr, 10);
    return h * 60 + m;
  } catch {
    // Fallback using fixed UTC+5:30 offset
    const istMs = now.getTime() + 330 * 60 * 1000;
    const d = new Date(istMs);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

export interface OutletAvailability {
  isOpen: boolean;
  statusText: string;
  openingFormatted: string;
  closingFormatted: string;
}

/**
 * Computes whether an active outlet is currently open based on IST (Asia/Kolkata) clock,
 * handling overnight closing times after midnight (e.g. 15:00 -> 00:00 or 02:00).
 */
export function getOutletAvailability(
  openingTime?: string | null,
  closingTime?: string | null,
  isActive: boolean = true,
  now: Date = new Date()
): OutletAvailability {
  const openMin = parseTimeToMinutes(openingTime);
  const closeMin = parseTimeToMinutes(closingTime);
  const openingFormatted = formatTime12Compact(openingTime) || '9 AM';
  const closingFormatted = formatTime12Compact(closingTime) || '11 PM';

  if (!isActive) {
    return {
      isOpen: false,
      statusText: `Closed · opens ${openingFormatted}`,
      openingFormatted,
      closingFormatted,
    };
  }

  if (openMin === null || closeMin === null) {
    return {
      isOpen: true,
      statusText: closingTime ? `Open till ${closingFormatted}` : 'Open now',
      openingFormatted,
      closingFormatted,
    };
  }

  if (openMin === closeMin) {
    return {
      isOpen: true,
      statusText: `Open till ${closingFormatted}`,
      openingFormatted,
      closingFormatted,
    };
  }

  const nowMin = getCurrentISTMinutes(now);
  const isOpen =
    closeMin > openMin
      ? nowMin >= openMin && nowMin < closeMin
      : nowMin >= openMin || nowMin < closeMin;

  return {
    isOpen,
    statusText: isOpen
      ? `Open till ${closingFormatted}`
      : `Closed · opens ${openingFormatted}`,
    openingFormatted,
    closingFormatted,
  };
}
