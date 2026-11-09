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

export function getEstimatedReadyTime(date: Date = new Date(), minutesAhead = 12): string {
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
