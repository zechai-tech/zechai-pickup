'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  Zap,
  CreditCard,
  Building2,
  Wallet,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { cn, formatPrice, generateOrderId, generatePickupCode, getEstimatedReadyTime } from '@/lib/utils';
import { Order } from '@/types';

type UpiApp = 'Google Pay' | 'PhonePe' | 'Paytm' | 'BHIM';
type MainMethod = 'upi' | 'card' | 'netbanking' | 'wallet';

export default function PaymentPage() {
  const router = useRouter();
  const {
    outlet,
    cart,
    customer,
    activeOrder,
    setActiveOrder,
  } = useZechaStore();

  const { count, itemTotal, gst, grandTotal } = getCartSummary(cart);

  // Temporary order ID for display on payment screen
  const [orderDisplayId] = useState(() => generateOrderId());

  // Payment method selection
  const [method, setMethod] = useState<MainMethod>('upi');
  const [selectedUpiApp, setSelectedUpiApp] = useState<UpiApp>('Google Pay');
  const [upiIdInput, setUpiIdInput] = useState('');

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Processing & Failure states
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Route guard: /payment redirects to /cart only when cart is empty AND there is no active order
  useEffect(() => {
    if (cart.length === 0 && !activeOrder && !isProcessing) {
      router.push('/cart');
    }
  }, [cart.length, activeOrder, isProcessing, router]);

  // Compute payment method display name
  const getSelectedMethodName = () => {
    if (method === 'upi') {
      return upiIdInput.trim() ? 'UPI' : selectedUpiApp;
    }
    if (method === 'card') return 'Credit / Debit Card';
    if (method === 'netbanking') return 'Netbanking';
    return 'Wallet';
  };

  // Compute button text based on selection
  const getButtonLabel = () => {
    const formattedAmount = formatPrice(grandTotal);
    if (method === 'upi') {
      if (upiIdInput.trim()) {
        return `Pay ${formattedAmount} with UPI ID`;
      }
      return `Pay ${formattedAmount} with ${selectedUpiApp}`;
    }
    if (method === 'card') {
      return `Pay ${formattedAmount} with Card`;
    }
    if (method === 'netbanking') {
      return `Pay ${formattedAmount} with Netbanking`;
    }
    return `Pay ${formattedAmount} with Wallet`;
  };

  const handleProcessPayment = async (shouldFailSimulated = false) => {
    if (!outlet || cart.length === 0) return;

    const methodName = getSelectedMethodName();
    const now = Date.now();
    const pickupCode = generatePickupCode();

    // (a) Build order object and save to store FIRST
    const newOrder: Order = {
      id: orderDisplayId,
      code: pickupCode,
      placedAt: now,
      estimatedReadyTime: getEstimatedReadyTime(new Date(now), 12),
      paidAmount: grandTotal,
      paymentMethod: methodName,
      status: 'placed',
      outlet,
      items: [...cart],
      itemTotal,
      gst,
      grandTotal,
      customer,
      statusHistory: {
        placedAt: now,
      },
    };

    setActiveOrder(newOrder);

    // (b) Show 2-second processing overlay
    setIsProcessing(true);
    setHasFailed(false);
    setErrorMessage('');

    if (shouldFailSimulated) {
      setTimeout(() => {
        setIsProcessing(false);
        setHasFailed(true);
        setErrorMessage('Payment declined by issuing bank or UPI provider. Please try again.');
      }, 2000);
      return;
    }

    setTimeout(() => {
      // (c) Navigate to /confirmed (cart is cleared only after /confirmed mounts)
      router.push('/confirmed');
    }, 2000);
  };

  // Failure state view
  if (hasFailed) {
    return (
      <div className="flex-1 flex flex-col justify-between p-6 bg-cream page-transition h-full text-center overflow-hidden">
        <div className="pt-2 flex justify-start">
          <button
            onClick={() => setHasFailed(false)}
            className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-espresso"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        <div className="my-auto px-4 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-brandRed/10 border-2 border-brandRed flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-brandRed stroke-[2.2]" />
          </div>
          <h2 className="font-display text-2xl font-black text-espresso mb-1.5">
            Payment Unsuccessful
          </h2>
          <p className="text-xs font-medium text-espresso/70 max-w-[280px] mb-6">
            {errorMessage}
          </p>

          <div className="w-full space-y-2.5">
            <Button
              onClick={() => handleProcessPayment(false)}
              className="w-full shadow-orange font-bold h-12 text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try again ({formatPrice(grandTotal)})
            </Button>

            <button
              onClick={() => setHasFailed(false)}
              className="text-xs font-bold text-espresso hover:text-orange transition-colors py-2"
            >
              Change payment method
            </button>
          </div>
        </div>

        <div className="text-[11px] text-espresso/50">Secured mock checkout · Zécha!</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-cream page-transition overflow-hidden relative">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-28 scrollbar-none">
        {/* Dark Header */}
        <div className="relative bg-espresso text-cream pt-4 pb-5 px-5 rounded-b-[28px] overflow-hidden shadow-lg shrink-0">
          {/* Subtle mascot watermark */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-36 h-36 opacity-10 pointer-events-none">
            <Image
              src="/assets/mascot-cream.png"
              alt="Mascot watermark"
              fill
              className="object-contain"
            />
          </div>

          {/* Top bar */}
          <div className="flex items-center justify-between mb-3 relative z-10">
            <Link
              href="/cart"
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-cream hover:bg-white/20 transition-colors"
              aria-label="Back to cart"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
            </Link>
            <div className="relative w-24 h-7">
              <Image
                src="/assets/logo-cream.png"
                alt="Zécha!"
                fill
                className="object-contain"
              />
            </div>
            <div className="w-9" />
          </div>

          {/* Amount and Order Info */}
          <div className="text-center relative z-10">
            <p className="text-xs font-semibold text-cream/70 mb-0.5">
              Paying {outlet?.name || 'Zécha! Thamarassery'}
            </p>
            <h1 className="font-display text-3xl font-black text-cream tracking-tight mb-2">
              {formatPrice(grandTotal)}
            </h1>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cream/15 text-[11px] font-medium text-cream backdrop-blur-sm">
              <span>Order #{orderDisplayId}</span>
              <span>·</span>
              <span>{count} {count === 1 ? 'item' : 'items'}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods Section */}
        <div className="p-4 space-y-3">
          <h2 className="font-display text-base font-bold text-espresso">
            Pay using
          </h2>

          {/* 1. UPI Section (Default & Fastest) */}
          <div
            onClick={() => setMethod('upi')}
            className={cn(
              'bg-card rounded-card border transition-all p-3.5',
              method === 'upi'
                ? 'border-orange ring-1 ring-orange/30 shadow-xs'
                : 'border-border'
            )}
          >
            {/* Header row */}
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-orange/10 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-orange fill-orange" />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-espresso">UPI</h3>
                  <p className="text-[11px] text-espresso/60 font-medium">Pay instantly from any UPI app</p>
                </div>
              </div>
              <span className="bg-mustard text-espresso text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                FASTEST
              </span>
            </div>

            {/* UPI App Icons Grid */}
            <div className="grid grid-cols-4 gap-2 pt-1 pb-2">
              {(
                [
                  { id: 'Google Pay', label: 'Google Pay', letter: 'G', bg: 'bg-black text-white' },
                  { id: 'PhonePe', label: 'PhonePe', letter: 'P', bg: 'bg-[#5f259f] text-white' },
                  { id: 'Paytm', label: 'Paytm', letter: 'P', bg: 'bg-[#002e6e] text-white' },
                  { id: 'BHIM', label: 'BHIM', letter: 'B', bg: 'bg-[#00796B] text-white' },
                ] as const
              ).map((app) => {
                const isAppActive = selectedUpiApp === app.id && !upiIdInput.trim();
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMethod('upi');
                      setSelectedUpiApp(app.id);
                      setUpiIdInput('');
                    }}
                    className={cn(
                      'flex flex-col items-center p-2 rounded-xl border transition-all',
                      isAppActive
                        ? 'border-orange ring-1 ring-orange/20 bg-sand/40 scale-[1.02]'
                        : 'border-border bg-card hover:bg-sand/20'
                    )}
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-2xl flex items-center justify-center font-display font-black text-base shadow-xs mb-1',
                        app.bg
                      )}
                    >
                      {app.letter}
                    </div>
                    <span className="text-[10px] font-bold text-espresso text-center leading-tight truncate w-full">
                      {app.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Or enter UPI ID */}
            <div className="pt-2 border-t border-border/60">
              <input
                type="text"
                value={upiIdInput}
                onChange={(e) => {
                  setMethod('upi');
                  setUpiIdInput(e.target.value);
                }}
                placeholder="Or enter UPI ID (name@bank)"
                className="w-full px-3 py-2 rounded-xl bg-sand/30 border border-border text-xs font-semibold text-espresso placeholder:text-espresso/50 focus:outline-none focus:border-orange"
              />
            </div>
          </div>

          {/* 2. Credit / Debit Card Accordion */}
          <div
            onClick={() => setMethod('card')}
            className={cn(
              'bg-card rounded-card border transition-all p-3.5 cursor-pointer',
              method === 'card'
                ? 'border-orange ring-1 ring-orange/30 shadow-xs'
                : 'border-border'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-sand/60 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5 text-espresso" />
                </div>
                <span className="font-bold text-xs text-espresso">Credit / Debit card</span>
              </div>
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-espresso/50 transition-transform',
                  method === 'card' && 'rotate-90'
                )}
              />
            </div>

            {method === 'card' && (
              <div className="pt-3 space-y-2 border-t border-border/60 mt-2.5 animate-in fade-in duration-150">
                <input
                  type="text"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="Card number (xxxx xxxx xxxx xxxx)"
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-sand/30 border border-border text-espresso focus:outline-none focus:border-orange"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    maxLength={5}
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-sand/30 border border-border text-espresso focus:outline-none focus:border-orange"
                  />
                  <input
                    type="password"
                    maxLength={3}
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    placeholder="CVV"
                    className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl bg-sand/30 border border-border text-espresso focus:outline-none focus:border-orange"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Netbanking */}
          <div
            onClick={() => setMethod('netbanking')}
            className={cn(
              'bg-card rounded-card border transition-all p-3.5 cursor-pointer',
              method === 'netbanking'
                ? 'border-orange ring-1 ring-orange/30 shadow-xs'
                : 'border-border'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-sand/60 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-espresso" />
                </div>
                <span className="font-bold text-xs text-espresso">Netbanking</span>
              </div>
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-espresso/50 transition-transform',
                  method === 'netbanking' && 'rotate-90'
                )}
              />
            </div>

            {method === 'netbanking' && (
              <div className="pt-2.5 border-t border-border/60 mt-2.5 grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                {['HDFC Bank', 'SBI', 'ICICI Bank', 'Axis Bank'].map((bank) => (
                  <div
                    key={bank}
                    className="p-1.5 text-center rounded-xl bg-sand/40 border border-border text-xs font-bold text-espresso"
                  >
                    {bank}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Wallets */}
          <div
            onClick={() => setMethod('wallet')}
            className={cn(
              'bg-card rounded-card border transition-all p-3.5 cursor-pointer',
              method === 'wallet'
                ? 'border-orange ring-1 ring-orange/30 shadow-xs'
                : 'border-border'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-sand/60 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5 text-espresso" />
                </div>
                <span className="font-bold text-xs text-espresso">Wallets</span>
              </div>
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-espresso/50 transition-transform',
                  method === 'wallet' && 'rotate-90'
                )}
              />
            </div>

            {method === 'wallet' && (
              <div className="pt-2.5 border-t border-border/60 mt-2.5 grid grid-cols-2 gap-2 animate-in fade-in duration-150">
                {['Amazon Pay', 'Paytm Wallet', 'Mobikwik', 'PhonePe'].map((w) => (
                  <div
                    key={w}
                    className="p-1.5 text-center rounded-xl bg-sand/40 border border-border text-xs font-bold text-espresso"
                  >
                    {w}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Payment Button pinned inside 390x844 frame */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-cream/95 backdrop-blur-md border-t border-border flex flex-col items-center gap-2 z-30 safe-bottom">
        <Button
          onClick={() => handleProcessPayment(false)}
          isLoading={isProcessing}
          className="w-full text-[16px] font-bold shadow-orange h-12"
        >
          {getButtonLabel()}
        </Button>

        {/* Razorpay Trust Badge */}
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-espresso/60">
          <ShieldCheck className="w-3.5 h-3.5 text-brandGreen stroke-[2.2]" />
          <span>Secured by Razorpay · 100% safe payments</span>
        </div>

        {/* Test simulation link */}
        <button
          type="button"
          onClick={() => handleProcessPayment(true)}
          className="text-[10px] font-semibold text-espresso/45 hover:text-brandRed transition-colors pt-0.5"
        >
          Simulate payment failure
        </button>
      </div>

      {/* Processing Overlay Modal pinned to phone frame */}
      {isProcessing && (
        <div className="absolute inset-0 z-50 bg-espresso/75 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-cream animate-in fade-in duration-150">
          <div className="w-14 h-14 rounded-full bg-cream/15 flex items-center justify-center mb-3">
            <Loader2 className="w-7 h-7 text-mustard animate-spin" />
          </div>
          <h3 className="font-display text-xl font-bold mb-1">
            Processing payment...
          </h3>
          <p className="text-xs text-cream/70 max-w-[240px]">
            Please do not refresh or press back while we confirm with your bank.
          </p>
        </div>
      )}
    </div>
  );
}
