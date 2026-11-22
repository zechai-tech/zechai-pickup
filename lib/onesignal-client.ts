// Client-side helper for OneSignal Web SDK v16 (Portal only)
// Safely wrapped so the app never crashes if OneSignal is blocked or fails to load.

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => Promise<void> | void>;
    OneSignal?: any;
    __onesignal_initialized?: boolean;
  }
}

export const ONESIGNAL_APP_ID =
  process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ||
  '77b04d4e-a7a3-47a0-8f73-88be997913a6';

/**
 * Initializes OneSignal Web SDK v16 with custom code integration.
 * Safe against double-initialization.
 */
export function initOneSignal(): void {
  if (typeof window === 'undefined') return;

  if (window.__onesignal_initialized) return;
  window.__onesignal_initialized = true;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
    } catch (err) {
      console.warn('[OneSignal] Initialization error:', err);
    }
  });
}

/**
 * Associates the signed-in Portal user ID with OneSignal external ID.
 */
export function loginOneSignalUser(portalUserId: string): void {
  if (typeof window === 'undefined' || !portalUserId) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      if (typeof OneSignal.login === 'function') {
        await OneSignal.login(portalUserId);
      }
    } catch (err) {
      console.warn('[OneSignal] Login error:', err);
    }
  });
}

/**
 * Clears the OneSignal external ID on Portal sign out.
 */
export function logoutOneSignalUser(): void {
  if (typeof window === 'undefined') return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal: any) => {
    try {
      if (typeof OneSignal.logout === 'function') {
        await OneSignal.logout();
      }
    } catch (err) {
      console.warn('[OneSignal] Logout error:', err);
    }
  });
}

/**
 * Detects whether the current device is iPhone / iPad.
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const platform = window.navigator.platform || '';
  const isApple = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  return isApple;
}

/**
 * Detects whether the web app is running as an installed PWA (standalone mode).
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Returns the current notification permission state:
 * - 'granted': Enabled
 * - 'denied': Blocked
 * - 'default': Not enabled (promptable)
 * - 'unsupported': Browser doesn't support notifications
 */
export function getNotificationPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Requests notification permission from user gesture (button click).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (window.OneSignal?.Notifications?.requestPermission) {
      await window.OneSignal.Notifications.requestPermission();
      return Notification.permission === 'granted';
    } else if (typeof Notification !== 'undefined') {
      const res = await Notification.requestPermission();
      return res === 'granted';
    }
  } catch (err) {
    console.warn('[OneSignal] Permission request error:', err);
  }
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}
