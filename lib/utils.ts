import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  return `₹${Math.round(amount)}`;
}

export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats any ISO date string or Date in Asia/Kolkata (IST) like "10:23 AM".
 */
export function formatTimeIST(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return formatTime(d);
  }
}

export function getEstimatedReadyTime(date: Date = new Date(), minutesAhead = 15): string {
  const readyDate = new Date(date.getTime() + minutesAhead * 60 * 1000);
  return `~${formatTime(readyDate)}`;
}

export function generateOrderId(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ZC-${randomNum}`;
}

export function generatePickupCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}
