'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MapPin,
  User,
  Trash2,
  ArrowRight,
  PenLine,
  X,
  AlertCircle,
} from 'lucide-react';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Stepper } from '@/components/ui/Stepper';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';

export default function CartPage() {
  const router = useRouter();
  const {
    outlet,
    cart,
    customer,
    updateCartQty,
    removeFromCart,
    clearCart,
    setCustomer,
  } = useZechaStore();

  const { count, grandTotal } = getCartSummary(cart);
  const { showToast } = useToast();

  const [kitchenNote, setKitchenNote] = useState(customer.note || '');
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const isNavigatingToSuccessRef = useRef(false);

  // Validate 10-digit Indian phone number
  const cleanPhone = phone.replace(/\D/g, '');
  const isPhoneValid = /^\d{10}$/.test(cleanPhone);

  // Route guard: if empty cart and not placing order, redirect to /menu
  useEffect(() => {
    if (cart.length === 0 && !submitting && !isNavigatingToSuccessRef.current) {
      router.push('/menu');
    }
  }, [cart.length, submitting, router]);

  // Lock body scroll when phone modal is open (Fix 7)
  useEffect(() => {
    if (isPhoneModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isPhoneModalOpen]);

  const handleProceedToPayClick = () => {
    setIsPhoneModalOpen(true);
  };

  // Dynamically load Cashfree checkout script if not ready
  const loadCashfreeScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Cashfree) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Dynamically load Razorpay checkout script
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePlaceOrder = async () => {
    if (!isPhoneValid) {
      setErrorMsg('Please enter a valid 10-digit phone number');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);

    try {
      // 1. Save customer info to store
      setCustomer({ phone: cleanPhone, note: kitchenNote });

      // Step 1: Generate 4-digit pickup code FIRST
      const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
      const selectedOutletName = outlet?.name || 'Zécha! Thamarassery';
      const selectedOutletId = outlet?.id || '2d784d85-8afb-4524-bdd7-1d4a31f8b8d5';

      // Step 2: Insert order into Supabase with status 'pending_payment'
      const { data: order, error: insertError } = await (supabase
        .from('orders') as any)
        .insert({
          outlet_id: selectedOutletId,
          customer_name: customer.name || 'Customer',
          customer_phone: cleanPhone,
          items: cart.map((item) => ({
            id: item.itemId,
            name: item.name,
            price: item.unitPrice,
            quantity: item.qty,
            qty: item.qty,
            ...(item.image ? { image: item.image } : {}),
          })),
          total: grandTotal,
          status: 'pending_payment',
          pickup_code: pickupCode,
          kitchen_note: kitchenNote.trim() || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Order insert error:', insertError);
        setErrorMsg('Failed to create order. Please try again.');
        setSubmitting(false);
        return;
      }

      const orderId = order.id;

      // Step 3: CRITICAL: Save to sessionStorage BEFORE opening gateway
      sessionStorage.setItem(
        'pendingOrder',
        JSON.stringify({
          orderId: order.id,
          pickupCode: pickupCode,
          outletName: selectedOutletName,
          total: grandTotal,
        })
      );

      // Step 4: Fetch which payment gateway is active from app_settings
      const { data: settings } = await (supabase.from('app_settings') as any)
        .select('value')
        .eq('key', 'payment_gateway')
        .single();

      const gwConfig = settings?.value;
      const activeGW = gwConfig?.active;

      if (activeGW === 'cashfree') {
        // ==========================================
        // CASHFREE FLOW
        // ==========================================
        await loadCashfreeScript();

        const cfResponse = await fetch('/api/create-cashfree-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: `zc_${order.id.replace(/-/g, '').slice(0, 16)}_${Date.now()}`,
            orderAmount: grandTotal,
            customerPhone: cleanPhone,
            customerName: customer.name || 'Customer',
          }),
        });

        const cfOrder = await cfResponse.json();

        if (!cfOrder.payment_session_id) {
          showToast('Payment initialization failed.', 'error');
          setErrorMsg(cfOrder.error || 'Payment initialization failed.');
          await (supabase.from('orders') as any)
            .update({ status: 'payment_failed' })
            .eq('id', order.id);
          setSubmitting(false);
          return;
        }

        const cashfree = (window as any).Cashfree({
          mode: gwConfig?.cashfree?.mode === 'production' ? 'production' : 'sandbox',
        });

        cashfree
          .checkout({
            paymentSessionId: cfOrder.payment_session_id,
            redirectTarget: '_self',
          })
          .then(async (result: any) => {
            if (result.paymentDetails) {
              isNavigatingToSuccessRef.current = true;
              await (supabase.from('orders') as any)
                .update({
                  status: 'confirmed',
                  payment_id: result.paymentDetails.cf_payment_id || 'cf_payment',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', order.id);

              localStorage.setItem('activeOrderCode', pickupCode);
              localStorage.setItem('activeOrderTime', Date.now().toString());
              localStorage.setItem('activeOrderOutlet', selectedOutletName);

              clearCart();
              sessionStorage.removeItem('pendingOrder');
              window.location.href = `/order-success?code=${pickupCode}&outlet=${encodeURIComponent(
                selectedOutletName
              )}&total=${grandTotal}`;
            }
            if (result.error) {
              await (supabase.from('orders') as any)
                .update({ status: 'payment_failed' })
                .eq('id', order.id);
              sessionStorage.removeItem('pendingOrder');
              showToast('Payment failed.', 'error');
              setErrorMsg('Payment failed.');
              setSubmitting(false);
            }
          })
          .catch(async (err: any) => {
            console.error('Cashfree checkout error:', err);
            await (supabase.from('orders') as any)
              .update({ status: 'payment_failed' })
              .eq('id', order.id);
            sessionStorage.removeItem('pendingOrder');
            showToast('Payment failed.', 'error');
            setErrorMsg('Payment failed.');
            setSubmitting(false);
          });
      } else if (activeGW === 'razorpay') {
        // ==========================================
        // RAZORPAY FLOW
        // ==========================================
        await loadRazorpayScript();
        const razorpayKey =
          gwConfig?.razorpay?.key_id ||
          process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
          'rzp_test_TyW3SbL5Pf7xZ5';

        const options = {
          key: razorpayKey,
          amount: Math.round(grandTotal * 100), // paise — Math.round to avoid decimals
          currency: 'INR',
          name: 'Zécha!',
          description: `Order #${pickupCode}`,
          image: '/assets/logo-orange.png',
          handler: async function (response: any) {
            // Payment SUCCESS
            isNavigatingToSuccessRef.current = true;
            try {
              const { error: updateError } = await (supabase.from('orders') as any)
                .update({
                  status: 'confirmed',
                  payment_id: response.razorpay_payment_id,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', orderId);

              if (updateError) {
                console.error('Order update error:', updateError);
              }

              // Save active order details in localStorage for persistent banner tracking
              localStorage.setItem('activeOrderCode', pickupCode);
              localStorage.setItem('activeOrderTime', Date.now().toString());
              localStorage.setItem('activeOrderOutlet', selectedOutletName);

              // Clear cart from Zustand store
              clearCart();

              // Clear pending order state
              sessionStorage.removeItem('pendingOrder');

              // FORCE navigation — use window.location instead of router.push
              window.location.href = `/order-success?code=${pickupCode}&outlet=${encodeURIComponent(
                selectedOutletName
              )}&total=${grandTotal}`;
            } catch (err) {
              console.error('Post-payment error:', err);
              window.location.href = `/order-success?code=${pickupCode}&outlet=${encodeURIComponent(
                selectedOutletName
              )}&total=${grandTotal}`;
            }
          },
          modal: {
            ondismiss: async function () {
              // User closed Razorpay without paying
              await (supabase.from('orders') as any)
                .update({
                  status: 'payment_failed',
                })
                .eq('id', orderId);
              sessionStorage.removeItem('pendingOrder');
              setSubmitting(false);
              setErrorMsg('Payment cancelled');
            },
            confirm_close: true,
            escape: false,
          },
          prefill: {
            contact: cleanPhone,
          },
          theme: {
            color: '#CE5535',
          },
        };

        const rzp = new (window as any).Razorpay(options);

        rzp.on('payment.failed', async function () {
          await (supabase.from('orders') as any)
            .update({
              status: 'payment_failed',
            })
            .eq('id', orderId);
          sessionStorage.removeItem('pendingOrder');
          setSubmitting(false);
          showToast('Payment failed. Please try again.', 'error');
          setErrorMsg('Payment failed. Please try again.');
        });

        rzp.open();
      } else {
        showToast('Payment not configured. Please contact support.', 'error');
        setErrorMsg('Payment not configured. Please contact support.');
        setSubmitting(false);
      }
    } catch (err) {
      console.error('Payment flow error:', err);
      setErrorMsg('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  // Empty cart fallback
  if (count === 0) {
    return (
      <div className="min-h-[100dvh] h-full flex flex-col justify-between p-6 bg-cream page-transition overflow-hidden w-full max-w-full">
        <header className="shrink-0 flex items-center pt-2">
          <Link
            href="/menu"
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-espresso hover:bg-sand/40 transition-colors"
            aria-label="Back to menu"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </Link>
          <h1 className="font-display text-xl font-black text-espresso ml-4">Your cart</h1>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center text-center px-4 my-auto">
          <div className="w-24 h-24 relative mb-4 opacity-75">
            <Image
              src="/assets/mascot-orange.png"
              alt="Empty Cart"
              fill
              sizes="96px"
              priority
              className="object-contain"
            />
          </div>
          <h2 className="font-display text-2xl font-black text-espresso mb-1">
            Your cart is empty
          </h2>
          <p className="text-xs font-medium text-espresso/60 max-w-[240px] mb-6">
            Looks like you haven&apos;t added any chai or bites to your order yet.
          </p>
          <Link href="/menu">
            <Button className="px-8 shadow-orange font-bold">Browse menu</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] h-full flex flex-col bg-cream page-transition overflow-hidden relative w-full max-w-full">
      {/* Top Header */}
      <header className="shrink-0 z-30 bg-cream/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-border/50 flex items-center justify-between w-full">
        <div className="flex items-center gap-3">
          <Link
            href="/menu"
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-espresso hover:bg-sand/40 transition-colors"
            aria-label="Back to menu"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </Link>
          <h1 className="font-display text-2xl font-black text-espresso">Your cart</h1>
        </div>
        <span className="text-xs font-bold text-espresso/60">
          {count} {count === 1 ? 'item' : 'items'}
        </span>
      </header>

      {/* Cart Content (Scrollable with mobile overscroll containment) */}
      <main className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden p-4 pb-32 space-y-4 scrollbar-none touch-scroll w-full max-w-full">
        {/* Cart Line Items */}
        <div className="space-y-2.5 w-full max-w-full">
          {cart.map((line) => (
            <div
              key={line.lineId}
              className="bg-card rounded-card border border-border p-3 flex items-center justify-between gap-3 shadow-xs w-full max-w-full overflow-hidden"
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-sand/40 flex-shrink-0">
                <Image
                  src={line.image || '/assets/chai.jpg'}
                  alt={line.name}
                  fill
                  sizes="56px"
                  loading="lazy"
                  className="object-cover"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-xs text-espresso truncate">{line.name}</h3>
                <span className="font-extrabold text-[14px] text-espresso mt-0.5 block">
                  {formatPrice(line.unitPrice * line.qty)}
                </span>
              </div>

              {/* Stepper & Delete */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Stepper
                  size="sm"
                  value={line.qty}
                  onIncrement={() => updateCartQty(line.lineId, 1)}
                  onDecrement={() => updateCartQty(line.lineId, -1)}
                  variant="light"
                />
                <button
                  onClick={() => removeFromCart(line.lineId)}
                  className="p-1 text-espresso/40 hover:text-brandRed transition-colors"
                  aria-label={`Remove ${line.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pickup Details Card */}
        <div className="w-full max-w-full overflow-hidden">
          <h2 className="font-display text-base font-bold text-espresso mb-2">
            Pickup details
          </h2>

          <div className="bg-card rounded-card border border-border p-3.5 space-y-3 shadow-xs w-full max-w-full">
            {/* Outlet Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <div className="w-8 h-8 rounded-full bg-sand/60 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-orange" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-espresso leading-snug truncate">
                    {outlet?.name || 'Zécha! Thamarassery'}
                  </h4>
                  <p className="text-[11px] text-espresso/60 font-medium">
                    Pickup now · ready in 15-20 min
                  </p>
                </div>
              </div>
              <Link
                href="/outlet"
                className="text-xs font-bold text-orange hover:text-orange-dark transition-colors shrink-0"
              >
                Change
              </Link>
            </div>

            <div className="h-px bg-border/60" />

            {/* Customer Info */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sand/60 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-espresso/60" />
              </div>
              <div>
                <p className="text-xs font-bold text-espresso">
                  {cleanPhone ? `+91 ${cleanPhone}` : 'Phone number will be requested before payment'}
                </p>
                <p className="text-[11px] text-espresso/50 font-medium">
                  We&apos;ll send pickup alerts via WhatsApp
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Note for kitchen input field */}
        <div className="w-full max-w-full">
          <label className="font-display text-base font-bold text-espresso mb-2 flex items-center gap-1.5">
            <PenLine className="w-4 h-4 text-orange" />
            <span>Note for the kitchen (optional)</span>
          </label>
          <input
            type="text"
            value={kitchenNote}
            onChange={(e) => setKitchenNote(e.target.value)}
            placeholder="e.g. Extra hot chai, pack chicken separate"
            className="w-full px-3.5 py-2.5 rounded-card bg-card border border-border text-xs font-semibold text-espresso placeholder:text-espresso/40 focus:outline-none focus:border-orange transition-colors"
          />
        </div>

        {/* Bill Breakdown */}
        <div className="bg-card rounded-card border border-border p-4 space-y-2 shadow-xs w-full max-w-full">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-espresso/70">Item total</span>
            <span className="font-bold text-espresso">{formatPrice(grandTotal)}</span>
          </div>

          <div className="h-px bg-border my-2" />

          <div className="flex items-center justify-between">
            <span className="font-display font-black text-sm text-espresso uppercase tracking-wider">
              TOTAL
            </span>
            <span className="font-display font-black text-lg text-espresso">
              {formatPrice(grandTotal)}
            </span>
          </div>
        </div>
      </main>

      {/* Fixed Bottom Proceed to Pay CTA */}
      <div className="shrink-0 p-4 bg-cream/95 backdrop-blur-md border-t border-border z-30 pb-[max(16px,env(safe-area-inset-bottom))] w-full">
        <Button
          onClick={handleProceedToPayClick}
          className="w-full text-[17px] font-bold shadow-orange group"
        >
          <span>Proceed to pay</span>
          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* Phone Number Modal / Bottom Sheet (Fix 7) */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-espresso/60 backdrop-blur-xs overscroll-contain animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-card rounded-t-[32px] sm:rounded-[32px] border border-border shadow-2xl p-6 relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            {/* Close Button */}
            <button
              onClick={() => {
                if (!submitting) setIsPhoneModalOpen(false);
              }}
              className="absolute right-4 top-4 p-2 rounded-full text-espresso/50 hover:bg-sand/60 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & Description */}
            <div className="text-left mb-5 pr-8">
              <h3 className="font-display font-black text-xl text-espresso tracking-tight">
                Enter your phone number
              </h3>
              <p className="text-xs text-espresso/65 font-medium mt-1">
                We&apos;ll send order updates and your pickup code via WhatsApp
              </p>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-[#FDF0F0] border border-brandRed/20 text-brandRed text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Phone Input with Non-Editable +91 Prefix */}
            <div className="mb-5">
              <label className="text-[10px] font-black uppercase tracking-wider text-espresso/60 block mb-1.5">
                Mobile Number *
              </label>
              <div className="flex items-center h-12 rounded-2xl bg-sand/30 border border-border overflow-hidden focus-within:border-orange focus-within:ring-2 focus-within:ring-orange/20 transition-all">
                <span className="px-3.5 bg-sand/60 h-full flex items-center text-xs font-black text-espresso border-r border-border select-none">
                  🇮🇳 +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder=""
                  disabled={submitting}
                  style={{ fontSize: '16px' }}
                  className="w-full h-full px-3.5 text-base font-bold text-espresso bg-transparent focus:outline-none placeholder:text-espresso/35 tracking-wider"
                />
              </div>
              <span className="text-[11px] text-espresso/50 mt-1 block">
                {cleanPhone.length}/10 digits entered
              </span>
            </div>

            {/* Submit Place Order Button */}
            <Button
              onClick={handlePlaceOrder}
              disabled={!isPhoneValid || submitting}
              className="w-full h-12 text-base font-bold shadow-orange"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Preparing Checkout...</span>
                </div>
              ) : (
                <span>Place order · {formatPrice(grandTotal)} →</span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
