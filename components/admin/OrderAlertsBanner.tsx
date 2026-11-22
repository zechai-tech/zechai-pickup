'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing, Check, Send, AlertTriangle, Share2, Loader2 } from 'lucide-react';
import { useAdminStore } from '@/stores/admin-store';
import { useToast } from '@/components/ui/Toast';
import {
  isIOS,
  isStandalone,
  getNotificationPermissionState,
  requestNotificationPermission,
} from '@/lib/onesignal-client';

export function OrderAlertsBanner() {
  const { sessionToken } = useAdminStore();
  const { showToast } = useToast();

  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [isIPhoneBrowser, setIsIPhoneBrowser] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [mounted, setMounted] = useState(false);

  const checkState = useCallback(() => {
    const currentPermission = getNotificationPermissionState();
    setPermission(currentPermission);

    const ios = isIOS();
    const standalone = isStandalone();
    setIsIPhoneBrowser(ios && !standalone);
  }, []);

  useEffect(() => {
    setMounted(true);
    checkState();

    // Listen for OneSignal permission changes if available
    if (typeof window !== 'undefined') {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push((OneSignal: any) => {
        try {
          if (OneSignal?.Notifications?.addEventListener) {
            OneSignal.Notifications.addEventListener('permissionChange', () => {
              checkState();
            });
          }
        } catch {}
      });
    }

    // Also check on window focus
    window.addEventListener('focus', checkState);
    return () => {
      window.removeEventListener('focus', checkState);
    };
  }, [checkState]);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      checkState();
      if (granted) {
        showToast('Order alerts enabled successfully!', 'success');
      } else if (Notification.permission === 'denied') {
        showToast('Notifications blocked in browser settings', 'error');
      }
    } catch (err: any) {
      console.warn('Error enabling notifications:', err);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleSendTest = async () => {
    if (!sessionToken) {
      showToast('Session expired. Please log in again.', 'error');
      return;
    }

    setIsSendingTest(true);
    try {
      const res = await fetch('/api/admin/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        showToast('Test alert sent! Check your notification center.', 'success');
      } else {
        showToast(data.message || 'Failed to send test push notification', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error sending test push', 'error');
    } finally {
      setIsSendingTest(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] p-4 shadow-2xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Icon, Title & Status */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              permission === 'granted'
                ? 'bg-[#EBF7EE] text-[#2F7A3E]'
                : permission === 'denied'
                ? 'bg-[#FDF0F0] text-[#BA1A1A]'
                : 'bg-[#FBEDE3] text-[#CE5535]'
            }`}
          >
            {permission === 'granted' ? (
              <BellRing className="w-5 h-5" />
            ) : permission === 'denied' ? (
              <BellOff className="w-5 h-5" />
            ) : (
              <Bell className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-extrabold text-[15px] text-[#2B1A12] leading-tight">
                Order alerts
              </h2>

              {/* Status Badge */}
              {permission === 'granted' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#EBF7EE] text-[#2F7A3E] border border-[#2F7A3E]/30">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Enabled</span>
                </span>
              )}

              {permission === 'denied' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FDF0F0] text-[#BA1A1A] border border-[#BA1A1A]/30">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Blocked</span>
                </span>
              )}

              {permission === 'default' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#F4E7CC] text-[#75604F]">
                  <span>Not enabled</span>
                </span>
              )}
            </div>

            {/* Description Text */}
            <div className="mt-1">
              {isIPhoneBrowser ? (
                <p className="text-xs text-[#CE5535] font-semibold flex items-center gap-1 leading-snug">
                  <Share2 className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    On iPhone: tap Share → Add to Home Screen, then open the Portal from the Home Screen icon and enable alerts.
                  </span>
                </p>
              ) : permission === 'granted' ? (
                <p className="text-xs text-[#75604F]">
                  Instant sound and push notification when a customer places an order.
                </p>
              ) : permission === 'denied' ? (
                <p className="text-xs text-[#BA1A1A] font-medium">
                  Notifications are blocked. Please enable them in your browser or site settings.
                </p>
              ) : (
                <p className="text-xs text-[#75604F]">
                  Receive notifications on your device whenever a customer places an order.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 pt-1 sm:pt-0 self-end sm:self-center shrink-0">
          {/* Enable Button (only when default and NOT iPhone Safari browser) */}
          {permission === 'default' && !isIPhoneBrowser && (
            <button
              type="button"
              onClick={handleEnable}
              disabled={isRequesting}
              className="h-9 px-4 rounded-xl bg-[#CE5535] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs hover:bg-[#A8401F] active:scale-95 transition-all disabled:opacity-50"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enabling...</span>
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Enable order alerts</span>
                </>
              )}
            </button>
          )}

          {/* Send Test Alert Button */}
          <button
            type="button"
            onClick={handleSendTest}
            disabled={isSendingTest}
            className="h-9 px-3 rounded-xl border border-[#EADFC7] bg-white text-[#2B1A12] hover:bg-[#FAF4E6] font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Send test push to this device"
          >
            {isSendingTest ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3 h-3 text-orange" />
            )}
            <span>Send test alert</span>
          </button>
        </div>
      </div>
    </div>
  );
}
