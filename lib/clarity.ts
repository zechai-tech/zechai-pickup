// Safe Microsoft Clarity tagging helpers
// Automatically guarded so nothing breaks if Clarity is blocked or not loaded.

declare global {
  interface Window {
    clarity?: (...args: any[]) => void;
  }
}

export function setClarityTag(
  key: string,
  value: string | number | boolean | null | undefined
): void {
  if (typeof window === 'undefined' || value == null || value === '') return;
  try {
    if (typeof window.clarity === 'function') {
      window.clarity('set', key, String(value));
    }
  } catch {
    // Silently ignore if blocked or unavailable
  }
}

export function setClarityOrder(
  orderId: string | null | undefined,
  pickupCode: string | null | undefined
): void {
  if (typeof window === 'undefined') return;
  try {
    if (orderId) setClarityTag('order_id', orderId);
    if (pickupCode) setClarityTag('pickup_code', pickupCode);
  } catch {
    // Silently ignore
  }
}

export function setClarityUser(
  role: string | null | undefined,
  outletName: string | null | undefined
): void {
  if (typeof window === 'undefined') return;
  try {
    if (role) setClarityTag('role', role);
    if (outletName) setClarityTag('outlet', outletName);
  } catch {
    // Silently ignore
  }
}
