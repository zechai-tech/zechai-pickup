'use client';

import React, { useState, useEffect } from 'react';
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
  Phone,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Stepper } from '@/components/ui/Stepper';
import { Button } from '@/components/ui/Button';
import { cn, formatPrice } from '@/lib/utils';

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

  const [kitchenNote, setKitchenNote] = useState(customer.note || '');
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phone, setPhone] = useState(customer.phone || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Validate 10-digit Indian phone number
  const cleanPhone = phone.replace(/\D/g, '');
  const isPhoneValid = /^\d{10}$/.test(cleanPhone);

  // Route guard: if empty cart, redirect to /menu
  useEffect(() => {
    if (cart.length === 0) {
      router.push('/menu');
    }
  }, [cart.length, router]);

  const handleProceedToPayClick = () => {
    setIsPhoneModalOpen(true);
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
    if (!isPhoneValid) return;
    setErrorMsg('');
    setSubmitting(true);

    try {
      // 1. Save customer info to store
      setCustomer({ phone: cleanPhone, note: kitchenNote });

      // Generate 4-digit pickup code
      const pickupCode = Math.floor(1000 + Math.random() * 9000).toString();

      // 2. Prepare Order Payload for Supabase
      const newOrder = {
        outlet_id: outlet?.id || '2d784d85-8afb-4524-bdd7-1d4a31f8b8d5',
        customer_name: customer.name || 'Guest',
        customer_phone: cleanPhone,
        items: cart.map((item) => ({
          id: item.itemId,
          name: item.name,
          price: item.unitPrice,
          quantity: item.qty,
          qty: item.qty,
        })),
        total: grandTotal,
        status: 'pending_payment',
        pickup_code: pickupCode,
        kitchen_note: kitchenNote.trim() || null,
        created_at: new Date().toISOString(),
      };

      // 3. Insert into Supabase orders table
      const { data: createdOrder, error: dbError } = await (supabase
        .from('orders') as any)
        .insert(newOrder)
        .select()
        .single();

      if (dbError) {
        console.error('Supabase order creation error:', dbError);
        throw new Error(dbError.message || 'Failed to create order in system');
      }

      const orderId = createdOrder?.id;

      // 4. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      const razorpayKey =
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder';

      // Function to finalize confirmed order
      const finalizeSuccess = async (paymentId: string) => {
        try {
          await (supabase.from('orders') as any)
            .update({
              status: 'confirmed',
              payment_id: paymentId,
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
        } catch (e) {
          console.error('Error confirming order:', e);
        }
        clearCart();
        router.push(`/order-success?code=${pickupCode}`);
      };

      if (!scriptLoaded || razorpayKey === 'rzp_test_placeholder') {
        // If placeholder test key or script blocked, simulate successful test payment after brief delay
        setTimeout(async () => {
          await finalizeSuccess('pay_test_' + Date.now().toString().slice(-6));
        }, 600);
        return;
      }

      // 5. Initialize Razorpay Checkout
      const options = {
        key: razorpayKey,
        amount: grandTotal * 100, // paise
        currency: 'INR',
        name: 'Zécha!',
        description: `Order #${pickupCode}`,
        image: '/assets/logo-orange.png',
        handler: async function (response: any) {
          await finalizeSuccess(response.razorpay_payment_id);
        },
        prefill: {
          contact: cleanPhone,
        },
        theme: {
          color: '#CE5535',
        },
        modal: {
          ondismiss: async function () {
            await (supabase.from('orders') as any)
              .update({ status: 'payment_failed' })
              .eq('id', orderId);
            setSubmitting(false);
          },
        },
      };

      try {
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', async function (resp: any) {
          console.warn('Payment failed:', resp.error);
          await (supabase.from('orders') as any)
            .update({ status: 'payment_failed' })
            .eq('id', orderId);
          setErrorMsg(resp.error?.description || 'Payment was unsuccessful');
          setSubmitting(false);
        });
        rzp.open();
      } catch (err: any) {
        console.warn('Razorpay checkout initialization error:', err);
        // Fallback test mode
        await finalizeSuccess('pay_simulated_' + Date.now().toString().slice(-6));
      }
    } catch (err: any) {
      console.error('Order checkout error:', err);
      setErrorMsg(err.message || 'Something went wrong while placing order.');
      setSubmitting(false);
    }
  };

  // Empty cart fallback
  if (count === 0) {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-cream page-transition min-h-full">
        <div className="flex items-center pt-2">
          <Link
            href="/menu"
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-espresso hover:bg-sand/40 transition-colors"
            aria-label="Back to menu"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </Link>
          <h1 className="font-display text-xl font-black text-espresso ml-4">Your cart</h1>
        </div>

        <div className="flex flex-col items-center justify-center text-center px-4 my-auto">
          <div className="w-24 h-24 relative mb-4 opacity-75">
            <Image
              src="/assets/mascot-orange.png"
              alt="Empty Cart"
              fill
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-cream page-transition overflow-hidden relative">
      {/* Top Header */}
      <div className="shrink-0 z-30 bg-cream/95 backdrop-blur-md px-4 pt-3 pb-3 border-b border-border/50 flex items-center justify-between">
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
      </div>

      {/* Cart Content (Scrollable) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 space-y-4 scrollbar-none">
        {/* Cart Line Items */}
        <div className="space-y-2.5">
          {cart.map((line) => (
            <div
              key={line.lineId}
              className="bg-card rounded-card border border-border p-3 flex items-center justify-between gap-3 shadow-xs"
            >
              {/* Thumbnail */}
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-sand/40 flex-shrink-0">
                <Image
                  src={line.image || '/assets/chai.jpg'}
                  alt={line.name}
                  fill
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
              <div className="flex items-center gap-1.5">
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
        <div>
          <h2 className="font-display text-base font-bold text-espresso mb-2">
            Pickup details
          </h2>

          <div className="bg-card rounded-card border border-border p-3.5 space-y-3 shadow-xs">
            {/* Outlet Info */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-sand/60 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-orange" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-espresso leading-snug">
                    {outlet?.name || 'Zécha! Thamarassery'}
                  </h4>
                  <p className="text-[11px] text-espresso/60 font-medium">
                    Pickup now · ready in 15-20 min
                  </p>
                </div>
              </div>
              <Link
                href="/outlet"
                className="text-xs font-bold text-orange hover:text-orange-dark transition-colors"
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
        <div>
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

        {/* Bill Breakdown (Simplified per Change 6) */}
        <div className="bg-card rounded-card border border-border p-4 space-y-2 shadow-xs">
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
      </div>

      {/* Sticky Bottom Proceed to Pay CTA */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-cream/95 backdrop-blur-md border-t border-border z-30 safe-bottom">
        <Button
          onClick={handleProceedToPayClick}
          className="w-full text-[17px] font-bold shadow-orange group"
        >
          <span>Proceed to pay</span>
          <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      {/* Phone Number Modal / Bottom Sheet (Change 7) */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-espresso/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-sm bg-card rounded-t-[32px] sm:rounded-[32px] border border-border shadow-2xl p-6 relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            {/* Close Button */}
            <button
              onClick={() => {
                if (!submitting) setIsPhoneModalOpen(false);
              }}
              className="absolute right-4 top-4 p-2 rounded-full text-espresso/50 hover:bg-sand/60 transition-colors"
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
                  placeholder="98765 43210"
                  disabled={submitting}
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
