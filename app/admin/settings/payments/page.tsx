'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Check, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentGatewayConfig {
  active: 'cashfree' | 'razorpay';
  cashfree: {
    enabled: boolean;
    app_id: string;
    secret_key: string;
    mode: 'sandbox' | 'production';
  };
  razorpay: {
    enabled: boolean;
    key_id: string;
    key_secret: string;
    mode: 'test' | 'live';
  };
}

export default function PaymentGatewaySettingsPage() {
  const router = useRouter();
  const { currentUser, isAuthInitialized } = useAdminStore();
  const { showToast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [selectedGateway, setSelectedGateway] = useState<'cashfree' | 'razorpay'>('cashfree');

  // Cashfree states
  const [cashfreeAppId, setCashfreeAppId] = useState('');
  const [cashfreeSecret, setCashfreeSecret] = useState('');
  const [cashfreeMode, setCashfreeMode] = useState<'sandbox' | 'production'>('sandbox');
  const [showCashfreeAppId, setShowCashfreeAppId] = useState(false);
  const [showCashfreeSecret, setShowCashfreeSecret] = useState(false);

  // Razorpay states
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpaySecret, setRazorpaySecret] = useState('');
  const [razorpayMode, setRazorpayMode] = useState<'test' | 'live'>('test');
  const [showRazorpayKeyId, setShowRazorpayKeyId] = useState(false);
  const [showRazorpaySecret, setShowRazorpaySecret] = useState(false);

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

  // Load gateway settings from Supabase
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const { data, error } = await (supabase.from('app_settings') as any)
          .select('*')
          .eq('key', 'payment_gateway')
          .single();

        if (error) {
          console.error('Error fetching payment settings from Supabase:', error);
          // Fallback to internal API route
          const apiRes = await fetch('/api/admin/settings/payment');
          const apiData = await apiRes.json();
          if (apiData.settings && isMounted) {
            populateForm(apiData.settings);
          }
        } else if (data && isMounted) {
          populateForm(data);
        }
      } catch (err) {
        console.error('Failed to load payment gateway settings:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    function populateForm(data: any) {
      const val = data.value as PaymentGatewayConfig;
      if (val) {
        if (val.active === 'razorpay' || val.active === 'cashfree') {
          setSelectedGateway(val.active);
        }
        if (val.cashfree) {
          setCashfreeAppId(val.cashfree.app_id || '');
          setCashfreeSecret(val.cashfree.secret_key || '');
          setCashfreeMode(val.cashfree.mode === 'production' ? 'production' : 'sandbox');
        }
        if (val.razorpay) {
          setRazorpayKeyId(val.razorpay.key_id || '');
          setRazorpaySecret(val.razorpay.key_secret || '');
          setRazorpayMode(val.razorpay.mode === 'live' ? 'live' : 'test');
        }
      }
      setUpdatedAt(data.updated_at || null);
      setUpdatedBy(data.updated_by || null);
    }

    if (isAuthInitialized) {
      loadSettings();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthInitialized]);

  // Check if active gateway is missing API keys
  const isActiveMissingKeys =
    (selectedGateway === 'cashfree' && (!cashfreeAppId.trim() || !cashfreeSecret.trim())) ||
    (selectedGateway === 'razorpay' && (!razorpayKeyId.trim() || !razorpaySecret.trim()));

  const handleSave = async () => {
    setIsSaving(true);

    const updatedConfig: PaymentGatewayConfig = {
      active: selectedGateway,
      cashfree: {
        enabled: true,
        app_id: cashfreeAppId.trim(),
        secret_key: cashfreeSecret.trim(),
        mode: cashfreeMode,
      },
      razorpay: {
        enabled: true,
        key_id: razorpayKeyId.trim(),
        key_secret: razorpaySecret.trim(),
        mode: razorpayMode,
      },
    };

    const userEmail = currentUser?.email || 'Admin';
    const nowISO = new Date().toISOString();

    try {
      // 1. Try direct Supabase update
      const { error } = await (supabase.from('app_settings') as any)
        .update({
          value: updatedConfig,
          updated_at: nowISO,
          updated_by: userEmail,
        })
        .eq('key', 'payment_gateway');

      if (!error) {
        showToast('Payment gateway updated!', 'success');
        setUpdatedAt(nowISO);
        setUpdatedBy(userEmail);
      } else {
        // 2. Fallback to server API endpoint (uses service role key)
        const apiRes = await fetch('/api/admin/settings/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            value: updatedConfig,
            updated_by: userEmail,
          }),
        });

        if (apiRes.ok) {
          showToast('Payment gateway updated!', 'success');
          setUpdatedAt(nowISO);
          setUpdatedBy(userEmail);
        } else {
          showToast('Failed to save settings', 'error');
        }
      }
    } catch (err) {
      console.error('Error saving payment settings:', err);
      showToast('Failed to save settings', 'error');
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
          Payment Gateway
        </h1>
        <p className="text-sm text-[#75604F] font-medium mt-1">
          Switch between payment providers. Only one can be active at a time.
        </p>
      </div>

      {/* Warning Banner */}
      {isActiveMissingKeys && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-3 shadow-xs animate-in fade-in duration-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold leading-relaxed">
            ⚠️ The active payment gateway has no API keys configured. Customers will not be able to place orders.
          </p>
        </div>
      )}

      {/* Gateway Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* =========================================
            CASHFREE CARD
           ========================================= */}
        <div
          onClick={() => setSelectedGateway('cashfree')}
          className={cn(
            'bg-[#FFFEF7] rounded-xl p-6 transition-all duration-200 flex flex-col justify-between cursor-pointer',
            isCashfreeActive
              ? 'border-2 border-[#CE5535] shadow-md ring-1 ring-[#CE5535]/10'
              : 'border border-[#EADFC7] hover:border-[#CE5535]/50'
          )}
        >
          <div>
            {/* Header Row */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EADFC7]/60">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#2B1A12]">Cashfree</h2>
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

              {/* Radio Button */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  isCashfreeActive ? 'border-[#CE5535]' : 'border-[#EADFC7]'
                )}
              >
                {isCashfreeActive && <div className="w-2.5 h-2.5 rounded-full bg-[#CE5535]" />}
              </div>
            </div>

            {/* Promo Tag */}
            <div className="mt-3 mb-5">
              <span className="bg-green-100 text-green-800 text-xs font-bold px-2.5 py-1 rounded-lg inline-block">
                0% fees on first ₹20L
              </span>
            </div>

            {/* Form Fields */}
            <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* App ID */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  App ID
                </label>
                <div className="relative">
                  <input
                    type={showCashfreeAppId ? 'text' : 'password'}
                    value={cashfreeAppId}
                    onChange={(e) => setCashfreeAppId(e.target.value)}
                    placeholder="Enter Cashfree App ID"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm text-[#2B1A12] placeholder:text-[#75604F]/40 focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCashfreeAppId(!showCashfreeAppId)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#75604F]/60 hover:text-[#2B1A12]"
                    tabIndex={-1}
                  >
                    {showCashfreeAppId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Secret Key */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  Secret Key
                </label>
                <div className="relative">
                  <input
                    type={showCashfreeSecret ? 'text' : 'password'}
                    value={cashfreeSecret}
                    onChange={(e) => setCashfreeSecret(e.target.value)}
                    placeholder="Enter Cashfree Secret Key"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm text-[#2B1A12] placeholder:text-[#75604F]/40 focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCashfreeSecret(!showCashfreeSecret)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#75604F]/60 hover:text-[#2B1A12]"
                    tabIndex={-1}
                  >
                    {showCashfreeSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mode Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  Mode
                </label>
                <select
                  value={cashfreeMode}
                  onChange={(e) => setCashfreeMode(e.target.value as 'sandbox' | 'production')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm font-medium text-[#2B1A12] focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] transition-all"
                >
                  <option value="sandbox">Sandbox (Testing)</option>
                  <option value="production">Production (Live)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================
            RAZORPAY CARD
           ========================================= */}
        <div
          onClick={() => setSelectedGateway('razorpay')}
          className={cn(
            'bg-[#FFFEF7] rounded-xl p-6 transition-all duration-200 flex flex-col justify-between cursor-pointer',
            isRazorpayActive
              ? 'border-2 border-[#CE5535] shadow-md ring-1 ring-[#CE5535]/10'
              : 'border border-[#EADFC7] hover:border-[#CE5535]/50'
          )}
        >
          <div>
            {/* Header Row */}
            <div className="flex items-center justify-between pb-3 border-b border-[#EADFC7]/60">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#2B1A12]">Razorpay</h2>
                {isRazorpayActive ? (
                  <span className="bg-blue-100 text-blue-800 text-[11px] font-black tracking-wide px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                    ACTIVE
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-[#75604F]/70 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#75604F]/40" />
                    Inactive
                  </span>
                )}
              </div>

              {/* Radio Button */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                  isRazorpayActive ? 'border-[#CE5535]' : 'border-[#EADFC7]'
                )}
              >
                {isRazorpayActive && <div className="w-2.5 h-2.5 rounded-full bg-[#CE5535]" />}
              </div>
            </div>

            {/* Info Tag */}
            <div className="mt-3 mb-5">
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-lg inline-block">
                2% + 18% GST per transaction
              </span>
            </div>

            {/* Form Fields */}
            <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
              {/* Key ID */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  Key ID
                </label>
                <div className="relative">
                  <input
                    type={showRazorpayKeyId ? 'text' : 'password'}
                    value={razorpayKeyId}
                    onChange={(e) => setRazorpayKeyId(e.target.value)}
                    placeholder="Enter Razorpay Key ID"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm text-[#2B1A12] placeholder:text-[#75604F]/40 focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRazorpayKeyId(!showRazorpayKeyId)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#75604F]/60 hover:text-[#2B1A12]"
                    tabIndex={-1}
                  >
                    {showRazorpayKeyId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Key Secret */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  Key Secret
                </label>
                <div className="relative">
                  <input
                    type={showRazorpaySecret ? 'text' : 'password'}
                    value={razorpaySecret}
                    onChange={(e) => setRazorpaySecret(e.target.value)}
                    placeholder="Enter Razorpay Key Secret"
                    className="w-full pr-10 pl-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm text-[#2B1A12] placeholder:text-[#75604F]/40 focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRazorpaySecret(!showRazorpaySecret)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#75604F]/60 hover:text-[#2B1A12]"
                    tabIndex={-1}
                  >
                    {showRazorpaySecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Mode Dropdown */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#75604F] mb-1.5">
                  Mode
                </label>
                <select
                  value={razorpayMode}
                  onChange={(e) => setRazorpayMode(e.target.value as 'test' | 'live')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-[#EADFC7] text-sm font-medium text-[#2B1A12] focus:outline-none focus:ring-2 focus:ring-[#CE5535]/30 focus:border-[#CE5535] transition-all"
                >
                  <option value="test">Test</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button & Metadata */}
      <div className="pt-4 space-y-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-[#CE5535] hover:bg-[#A8401F] text-white rounded-xl py-3 font-semibold transition-colors duration-150 shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Payment Settings</span>
            </>
          )}
        </button>

        {/* Last Updated metadata */}
        <p className="text-center text-xs text-[#75604F] font-medium">
          {updatedBy && updatedAt ? (
            <>
              Last updated by <span className="font-semibold text-[#2B1A12]">{updatedBy}</span> on{' '}
              <span className="font-semibold text-[#2B1A12]">{formatDate(updatedAt)}</span>
            </>
          ) : (
            'Configure your active payment provider above and click save.'
          )}
        </p>
      </div>
    </div>
  );
}
