'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, Check, Save, Loader2, Lock, Server } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentGatewayConfig {
  active: 'cashfree' | 'razorpay';
  cashfree: {
    enabled: boolean;
    mode: 'sandbox' | 'production';
  };
  razorpay: {
    enabled: boolean;
    mode: 'test' | 'live';
  };
}

export default function PaymentGatewaySettingsPage() {
  const router = useRouter();
  const { currentUser, isAuthInitialized, sessionToken } = useAdminStore();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states (Non-secret only)
  const [selectedGateway, setSelectedGateway] = useState<'cashfree' | 'razorpay'>('cashfree');
  const [cashfreeEnabled, setCashfreeEnabled] = useState(true);
  const [cashfreeMode, setCashfreeMode] = useState<'sandbox' | 'production'>('production');
  const [razorpayEnabled, setRazorpayEnabled] = useState(true);
  const [razorpayMode, setRazorpayMode] = useState<'test' | 'live'>('test');

  // Metadata states
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedBy, setUpdatedBy] = useState<string | null>(null);

  // Access Control Guard
  useEffect(() => {
    if (!isAuthInitialized) return;

    const isSuperAdmin =
      currentUser?.role === 'super_admin' || currentUser?.role === 'admin';

    if (!isSuperAdmin) {
      showToast("You don't have permission to access this page", 'error');
      router.replace('/admin/dashboard');
    }
  }, [currentUser, isAuthInitialized, router, showToast]);

  // Load gateway settings from secure server API
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const res = await fetch('/api/admin/settings/gateway');
        const data = await res.json();
        if (data.settings && isMounted) {
          const val = data.settings.value as PaymentGatewayConfig;
          if (val) {
            if (val.active === 'razorpay' || val.active === 'cashfree') {
              setSelectedGateway(val.active);
            }
            if (val.cashfree) {
              setCashfreeEnabled(val.cashfree.enabled ?? true);
              setCashfreeMode(val.cashfree.mode === 'sandbox' ? 'sandbox' : 'production');
            }
            if (val.razorpay) {
              setRazorpayEnabled(val.razorpay.enabled ?? true);
              setRazorpayMode(val.razorpay.mode === 'live' ? 'live' : 'test');
            }
          }
          setUpdatedAt(data.settings.updated_at || null);
          setUpdatedBy(data.settings.updated_by || null);
        }
      } catch (err) {
        console.error('Failed to load payment gateway settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (isAuthInitialized) {
      loadSettings();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthInitialized]);

  const handleSave = async () => {
    setIsSaving(true);

    const updatedConfig: PaymentGatewayConfig = {
      active: selectedGateway,
      cashfree: {
        enabled: cashfreeEnabled,
        mode: cashfreeMode,
      },
      razorpay: {
        enabled: razorpayEnabled,
        mode: razorpayMode,
      },
    };

    try {
      // Get current auth token for server validation
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || sessionToken;

      const res = await fetch('/api/admin/settings/gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ value: updatedConfig }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      showToast('Payment gateway configuration saved!', 'success');
      setUpdatedAt(data.settings?.updated_at || new Date().toISOString());
      setUpdatedBy(data.settings?.updated_by || currentUser?.email || 'Admin');
    } catch (err: any) {
      console.error('Error saving payment settings:', err);
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  if (!isAuthInitialized || isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#CE5535] animate-spin mb-3" />
        <p className="text-xs font-bold text-[#75604F]">Loading payment gateway settings...</p>
      </div>
    );
  }

  const isCashfreeActive = selectedGateway === 'cashfree';
  const isRazorpayActive = selectedGateway === 'razorpay';

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 font-sans">
      {/* Title & Subtitle */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-black text-[#2B1A12] tracking-tight">
          Payment Gateway Settings
        </h1>
        <p className="text-sm text-[#75604F] font-medium mt-1">
          Switch between payment providers. API credentials are encrypted and stored strictly in server environment variables.
        </p>
      </div>

      {/* Security Status Card */}
      <div className="bg-[#EBF7EE] border border-brandGreen/30 text-[#1B4D27] rounded-2xl p-4 flex items-start gap-3 shadow-xs">
        <ShieldCheck className="w-5 h-5 text-brandGreen shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-sm text-[#1B4D27]">
            Server-Side Environment Security Enforced
          </p>
          <p className="leading-relaxed opacity-90">
            Payment secrets (App IDs, Secret Keys, and API Secrets) are never stored in the database.
            They are loaded exclusively by the server runtime via environment variables (<code className="font-mono bg-white/60 px-1 py-0.5 rounded">CASHFREE_APP_ID</code>, <code className="font-mono bg-white/60 px-1 py-0.5 rounded">CASHFREE_SECRET_KEY</code>, <code className="font-mono bg-white/60 px-1 py-0.5 rounded">RAZORPAY_KEY_ID</code>, <code className="font-mono bg-white/60 px-1 py-0.5 rounded">RAZORPAY_KEY_SECRET</code>).
          </p>
        </div>
      </div>

      {/* Gateway Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* =========================================
            CASHFREE CARD
           ========================================= */}
        <div
          onClick={() => setSelectedGateway('cashfree')}
          className={cn(
            'bg-[#FFFEF7] rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between cursor-pointer border',
            isCashfreeActive
              ? 'border-2 border-[#CE5535] shadow-md ring-1 ring-[#CE5535]/10'
              : 'border-[#EADFC7] hover:border-[#CE5535]/50'
          )}
        >
          <div>
            {/* Header Row */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EADFC7]/60">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#2B1A12]">Cashfree Payments</h2>
                {isCashfreeActive ? (
                  <span className="bg-green-100 text-green-800 text-[11px] font-black tracking-wide px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#75604F]/70 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#75604F]/40" />
                    Inactive
                  </span>
                )}
              </div>

              {/* Radio Indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  isCashfreeActive ? 'border-[#CE5535]' : 'border-[#EADFC7]'
                )}
              >
                {isCashfreeActive && <div className="w-2.5 h-2.5 rounded-full bg-[#CE5535]" />}
              </div>
            </div>

            <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* Mode Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  Environment Mode
                </label>
                <select
                  value={cashfreeMode}
                  onChange={(e) => setCashfreeMode(e.target.value as 'sandbox' | 'production')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm text-[#2B1A12] focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] cursor-pointer"
                >
                  <option value="production">Production (Live)</option>
                  <option value="sandbox">Sandbox (Testing)</option>
                </select>
              </div>

              {/* Server Env Info Card */}
              <div className="p-3 rounded-xl bg-[#F4E7CC]/30 border border-[#EADFC7] text-xs text-[#75604F] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[#2B1A12]">
                  <Server className="w-3.5 h-3.5 text-orange" />
                  <span>Configured via Server Environment</span>
                </div>
                <div className="font-mono text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>App ID:</span>
                    <span className="font-bold text-[#2F7A3E]">CASHFREE_APP_ID</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Secret Key:</span>
                    <span className="font-bold text-[#2F7A3E]">CASHFREE_SECRET_KEY</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enable Checkbox */}
          <div className="pt-5 mt-6 border-t border-[#EADFC7]/60" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={cashfreeEnabled}
                onChange={(e) => setCashfreeEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-[#CE5535] border-[#EADFC7] focus:ring-[#CE5535]"
              />
              <span className="text-xs font-bold text-[#2B1A12]">
                Enable Cashfree Gateway
              </span>
            </label>
          </div>
        </div>

        {/* =========================================
            RAZORPAY CARD
           ========================================= */}
        <div
          onClick={() => setSelectedGateway('razorpay')}
          className={cn(
            'bg-[#FFFEF7] rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between cursor-pointer border',
            isRazorpayActive
              ? 'border-2 border-[#CE5535] shadow-md ring-1 ring-[#CE5535]/10'
              : 'border-[#EADFC7] hover:border-[#CE5535]/50'
          )}
        >
          <div>
            {/* Header Row */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EADFC7]/60">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#2B1A12]">Razorpay</h2>
                {isRazorpayActive ? (
                  <span className="bg-green-100 text-green-800 text-[11px] font-black tracking-wide px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#75604F]/70 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#75604F]/40" />
                    Inactive
                  </span>
                )}
              </div>

              {/* Radio Indicator */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  isRazorpayActive ? 'border-[#CE5535]' : 'border-[#EADFC7]'
                )}
              >
                {isRazorpayActive && <div className="w-2.5 h-2.5 rounded-full bg-[#CE5535]" />}
              </div>
            </div>

            <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* Mode Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  Environment Mode
                </label>
                <select
                  value={razorpayMode}
                  onChange={(e) => setRazorpayMode(e.target.value as 'test' | 'live')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm text-[#2B1A12] focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] cursor-pointer"
                >
                  <option value="live">Live</option>
                  <option value="test">Test</option>
                </select>
              </div>

              {/* Server Env Info Card */}
              <div className="p-3 rounded-xl bg-[#F4E7CC]/30 border border-[#EADFC7] text-xs text-[#75604F] space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-[#2B1A12]">
                  <Server className="w-3.5 h-3.5 text-orange" />
                  <span>Configured via Server Environment</span>
                </div>
                <div className="font-mono text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>Key ID:</span>
                    <span className="font-bold text-[#2F7A3E]">RAZORPAY_KEY_ID</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Key Secret:</span>
                    <span className="font-bold text-[#2F7A3E]">RAZORPAY_KEY_SECRET</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enable Checkbox */}
          <div className="pt-5 mt-6 border-t border-[#EADFC7]/60" onClick={(e) => e.stopPropagation()}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={razorpayEnabled}
                onChange={(e) => setRazorpayEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-[#CE5535] border-[#EADFC7] focus:ring-[#CE5535]"
              />
              <span className="text-xs font-bold text-[#2B1A12]">
                Enable Razorpay Gateway
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button Row & Last Modified Info */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#EADFC7]/60">
        <div>
          {updatedAt && (
            <p className="text-xs text-[#75604F] font-medium">
              Last saved: <strong>{formatDate(updatedAt)}</strong> by{' '}
              <strong>{updatedBy || 'Admin'}</strong>
            </p>
          )}
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#CE5535] hover:bg-[#A8401F] text-white font-bold text-sm shadow-orange flex items-center justify-center gap-2 transition-all duration-150 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
