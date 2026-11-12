'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  User,
  Plus,
  Minus,
  PenLine,
  X,
  Loader2,
  Check,
} from 'lucide-react';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { SafeImage } from '@/components/ui/SafeImage';
import { CupMarkSvg } from '@/components/ui/CupMarkSvg';
import { DEFAULT_MENU_IMAGE } from '@/lib/images';
import { PICKUP_ETA_SHORT } from '@/lib/outlets';
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

  const { count, toPay } = getCartSummary(cart);
  const { showToast } = useToast();

  const [kitchenNote, setKitchenNote] = useState(customer.note || '');
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isGatewayLoading, setIsGatewayLoading] = useState(false);

  const isNavigatingToSuccessRef = useRef(false);
  const isSubmittingRef = useRef(false);

  // Validate 10-digit Indian phone number
  const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);
  const isPhoneValid = /^[6-9]\d{9}$/.test(cleanPhone);

  // Route guard: if empty cart and not placing order, redirect to /menu
  useEffect(() => {
    if (cart.length === 0 && !submitting && !isNavigatingToSuccessRef.current) {
      router.push('/menu');
    }
  }, [cart.length, submitting, router]);

  // Lock body scroll when phone modal is open
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

  // Dynamically load Cashfree checkout script
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

  // Auto-trigger order creation & payment the moment the 10th digit is valid
  useEffect(() => {
    if (cleanPhone.length === 10 && isPhoneValid && isPhoneModalOpen && !isSubmittingRef.current) {
      handleInitiatePayment(cleanPhone);
    }
  }, [cleanPhone, isPhoneValid, isPhoneModalOpen]);

  const handleInitiatePayment = async (phoneToUse: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    setErrorMsg('');

    try {
      setCustomer({ phone: phoneToUse, note: kitchenNote });

      if (!outlet?.id) {
        showToast('Please select an outlet first.', 'info');
        setSubmitting(false);
        isSubmittingRef.current = false;
        router.push('/outlets');
        return;
      }

      const selectedOutletName = outlet.name;
      const selectedOutletId = outlet.id;

      // 1. Create order on server
      const createRes = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outlet_id: selectedOutletId,
          customer_phone: phoneToUse,
          kitchen_note: kitchenNote.trim() || null,
          items: cart.map((item) => ({
            menu_item_id: item.itemId,
            quantity: item.qty,
          })),
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok || !createData.order_id) {
        setErrorMsg(createData.error || 'Failed to create order. Please try again.');
        setSubmitting(false);
        isSubmittingRef.current = false;
        return;
      }

      const orderId = createData.order_id;
      const verifiedTotal = Number(createData.total);

      sessionStorage.setItem(
        'pendingOrder',
        JSON.stringify({
          orderId,
          outletName: selectedOutletName,
          total: verifiedTotal,
        })
      );

      // 2. Fetch payment gateway configuration
      const { data: settings } = await (supabase.from('app_settings') as any)
        .select('value')
        .eq('key', 'payment_gateway')
        .single();

      const gwConfig = settings?.value;
      const activeGW = gwConfig?.active || 'cashfree';

      setIsGatewayLoading(true);

      if (activeGW === 'cashfree') {
        // ================= CASHFREE FLOW =================
        await loadCashfreeScript();

        const cfResponse = await fetch('/api/create-cashfree-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: orderId,
          }),
        });

        const cfOrder = await cfResponse.json();

        if (!cfOrder.payment_session_id) {
          showToast('Payment initialization failed.', 'error');
          setErrorMsg(cfOrder.error || 'Payment initialization failed.');
          setSubmitting(false);
          setIsGatewayLoading(false);
          isSubmittingRef.current = false;
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
          .then((result: any) => {
            if (result.paymentDetails) {
              isNavigatingToSuccessRef.current = true;
              sessionStorage.removeItem('pendingOrder');
              window.location.href = `/order-success?id=${orderId}&outlet=${encodeURIComponent(
                selectedOutletName
              )}&total=${verifiedTotal}`;
            }
            if (result.error) {
              sessionStorage.removeItem('pendingOrder');
              showToast('Payment failed.', 'error');
              setErrorMsg('Payment failed.');
              setSubmitting(false);
              setIsGatewayLoading(false);
              isSubmittingRef.current = false;
            }
          })
          .catch((err: any) => {
            console.error('Cashfree checkout error:', err);
            sessionStorage.removeItem('pendingOrder');
            showToast('Payment cancelled or failed.', 'info');
            setErrorMsg('Payment cancelled.');
            setSubmitting(false);
            setIsGatewayLoading(false);
            isSubmittingRef.current = false;
          });
      } else if (activeGW === 'razorpay') {
        // ================= RAZORPAY FLOW =================
        await loadRazorpayScript();
        const rzpOrderRes = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        });
        const rzpOrderData = await rzpOrderRes.json();
        if (!rzpOrderRes.ok || !rzpOrderData.order_id) {
          showToast('Payment initialization failed.', 'error');
          setErrorMsg(rzpOrderData.error || 'Payment initialization failed.');
          setSubmitting(false);
          setIsGatewayLoading(false);
          isSubmittingRef.current = false;
          return;
        }

        const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';

        const options = {
          key: razorpayKey,
          order_id: rzpOrderData.order_id,
          amount: Number(rzpOrderData.amount),
          currency: rzpOrderData.currency || 'INR',
          name: 'Zécha!',
          description: 'Pickup Order',
          image: '/assets/logo-orange.v1.webp',
          handler: async function (response: any) {
            isNavigatingToSuccessRef.current = true;
            try {
              await fetch('/api/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id || rzpOrderData.order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  order_id: orderId,
                }),
              });
            } catch (err) {
              console.error('Post-payment error:', err);
            }

            sessionStorage.removeItem('pendingOrder');
            window.location.href = `/order-success?id=${orderId}&outlet=${encodeURIComponent(
              selectedOutletName
            )}&total=${verifiedTotal}`;
          },
          modal: {
            ondismiss: function () {
              sessionStorage.removeItem('pendingOrder');
              setSubmitting(false);
              setIsGatewayLoading(false);
              isSubmittingRef.current = false;
              showToast('Payment cancelled', 'info');
            },
            confirm_close: true,
            escape: false,
          },
          prefill: {
            contact: phoneToUse,
          },
          theme: {
            color: '#CE5535',
          },
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', function () {
          sessionStorage.removeItem('pendingOrder');
          setSubmitting(false);
          setIsGatewayLoading(false);
          isSubmittingRef.current = false;
          showToast('Payment failed. Please try again.', 'error');
          setErrorMsg('Payment failed. Please try again.');
        });

        setIsGatewayLoading(false);
        rzp.open();
      } else {
        showToast('Payment gateway not configured.', 'error');
        setErrorMsg('Payment gateway not configured.');
        setSubmitting(false);
        setIsGatewayLoading(false);
        isSubmittingRef.current = false;
      }
    } catch (err) {
      console.error('Payment error:', err);
      setErrorMsg('Something went wrong. Please try again.');
      setSubmitting(false);
      setIsGatewayLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Screen 6: Gateway loading overlay
  if (isGatewayLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col items-center justify-center p-6 text-center page-transition">
        <div className="relative w-36 h-12 mb-6">
          <SafeImage
            src="/assets/logo-orange.v1.webp"
            alt="Zécha!"
            width={144}
            height={48}
            sizes="144px"
            transparent
            className="object-contain w-full h-full"
          />
        </div>
        <div className="w-12 h-12 rounded-full border-3 border-[#CE5535] border-t-transparent animate-spin mb-4" />
        <h2 className="font-display text-xl font-extrabold text-[#2B1A12]">
          Opening secure payment…
        </h2>
        <p className="text-xs text-[#75604F] mt-1">Please do not refresh or close</p>
      </div>
    );
  }

  // Empty cart fallback
  if (count === 0) {
    return (
      <div className="min-h-screen bg-[#FDFBEA] flex flex-col justify-between p-6 page-transition">
        <header className="flex items-center pt-2">
          <Link
            href="/menu"
            className="w-11 h-11 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12]"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </Link>
          <h1 className="font-display text-xl font-black text-[#2B1A12] ml-4">
            Your cart
          </h1>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 my-auto">
          <h2 className="font-display text-2xl font-black text-[#2B1A12] mb-1">
            Your cart is empty
          </h2>
          <p className="text-sm text-[#75604F] mb-6">
            Add hot tea and crunchy bites from our menu!
          </p>
          <Link
            href="/menu"
            className="h-12 px-8 rounded-full bg-[#CE5535] text-[#FDFBEA] font-bold text-sm flex items-center justify-center shadow-orange"
          >
            Explore Menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBEA] flex flex-col justify-between pb-28 page-transition select-none">
      <div className="p-4 space-y-4">
        {/* Header: Back, "Your cart", "N items" on right */}
        <header className="flex items-center justify-between pt-1 pb-1">
          <div className="flex items-center gap-3">
            <Link
              href="/menu"
              className="w-11 h-11 rounded-full bg-[#FFFEF7] border border-[#EADFC7] flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC]/50 transition-colors shadow-2xs"
              aria-label="Back to menu"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </Link>
            <h1 className="font-display text-[24px] font-extrabold text-[#2B1A12] tracking-tight">
              Your cart
            </h1>
          </div>
          <span className="text-sm font-bold text-[#75604F]">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
        </header>

        {/* Item Cards: Each item is its OWN card (14px padding, 20px radius, 12px gap between cards) */}
        <div className="space-y-3">
          {cart.map((item) => (
            <div
              key={item.lineId}
              className="bg-[#FFFEF7] rounded-[20px] border border-[#EADFC7] p-3.5 flex items-center justify-between gap-3 shadow-2xs hover:border-[#E3D7BC] transition-all"
            >
              {/* Left: 68px photo */}
              <div className="w-[68px] h-[68px] rounded-[14px] overflow-hidden shrink-0 relative border border-[#EADFC7]/50">
                <SafeImage
                  src={item.image || DEFAULT_MENU_IMAGE}
                  alt={item.name}
                  variant="thumb"
                  fill
                  sizes="68px"
                  className="object-cover"
                />
              </div>

              {/* Middle: Name, small note line, price */}
              <div className="flex-1 min-w-0 pr-1">
                <h3 className="font-extrabold text-[16px] text-[#2B1A12] truncate leading-tight">
                  {item.name}
                </h3>
                {item.selectedSize ? (
                  <p className="text-[12px] text-[#75604F] mt-0.5 truncate">
                    {item.selectedSize}
                    {item.selectedSugar ? ` · ${item.selectedSugar}` : ''}
                  </p>
                ) : (
                  <p className="text-[12px] text-[#75604F] mt-0.5 truncate">
                    Standard portion
                  </p>
                )}
                <p className="font-extrabold text-[15px] text-[#2B1A12] mt-1">
                  {formatPrice(item.unitPrice * item.qty)}
                </p>
              </div>

              {/* Right: Stepper (40px tall) */}
              <div className="h-[40px] px-2 rounded-[14px] bg-[#F4E7CC]/60 border border-[#EADFC7] flex items-center gap-2 shrink-0">
                <button
                  onClick={() => updateCartQty(item.lineId, -1)}
                  className="w-7 h-7 flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC] rounded-full active:scale-95 transition-all"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
                <span className="font-extrabold text-sm text-[#2B1A12] w-4 text-center">
                  {item.qty}
                </span>
                <button
                  onClick={() => updateCartQty(item.lineId, 1)}
                  className="w-7 h-7 flex items-center justify-center text-[#2B1A12] hover:bg-[#F4E7CC] rounded-full active:scale-95 transition-all"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pickup Details Card */}
        <div className="space-y-1.5 pt-1">
          <h2 className="text-xs font-black text-[#75604F] uppercase tracking-wider px-1">
            Pickup details
          </h2>
          <div className="bg-[#FFFEF7] rounded-[20px] border border-[#EADFC7] p-4 divide-y divide-[#EADFC7]/70 shadow-2xs space-y-3">
            {/* Outlet Row */}
            <div className="flex items-center justify-between gap-3 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-[46px] h-[46px] rounded-[14px] bg-[#CE5535] flex items-center justify-center shrink-0 shadow-xs">
                  <CupMarkSvg variant="cream" className="w-6 h-6" aria-hidden={true} />
                </div>
                <div>
                  <h3 className="font-extrabold text-[15px] text-[#2B1A12] leading-tight">
                    {outlet?.name || 'Select outlet'}
                  </h3>
                  <p className="text-[12px] text-[#75604F] mt-0.5 font-medium">
                    Pickup now · ready in {PICKUP_ETA_SHORT}
                  </p>
                </div>
              </div>
              <Link
                href="/outlets"
                className="text-xs font-extrabold text-[#CE5535] hover:underline shrink-0"
              >
                Change
              </Link>
            </div>

            {/* Customer WhatsApp Row */}
            <div className="flex items-center gap-3 pt-3">
              <div className="w-[46px] h-[46px] rounded-[14px] bg-[#F4E7CC] flex items-center justify-center shrink-0 text-[#2B1A12]">
                <User className="w-5 h-5 text-[#2B1A12] stroke-[2]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[15px] text-[#2B1A12] leading-tight">
                  {customer.name || 'Express Pickup'}
                </h3>
                <p className="text-[12px] text-[#75604F] mt-0.5 font-medium">
                  {cleanPhone.length === 10 ? `+91 ${cleanPhone} · WhatsApp` : 'Updates on WhatsApp'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashed-border Kitchen Note Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-[#75604F]">
            <PenLine className="w-4 h-4 stroke-[2]" />
          </div>
          <input
            type="text"
            value={kitchenNote}
            onChange={(e) => setKitchenNote(e.target.value)}
            placeholder="Note for the kitchen (optional)"
            className="w-full h-[48px] pl-11 pr-4 rounded-[16px] bg-[#FFFEF7] border border-dashed border-[#EADFC7] text-xs font-semibold text-[#2B1A12] placeholder:text-[#75604F]/60 focus:outline-none focus:border-[#CE5535] focus:border-solid transition-all"
          />
        </div>

        {/* Total Card (Single row: To pay) */}
        <div className="bg-[#FFFEF7] rounded-[20px] border border-[#EADFC7] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="font-display font-extrabold text-[18px] text-[#2B1A12]">
              To pay
            </span>
            <span className="font-display font-black text-[18px] text-[#2B1A12] tabular-nums">
              {formatPrice(toPay)}
            </span>
          </div>
        </div>
      </div>

      {/* Sticky Bottom CTA: "<total> Proceed to pay →" */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto p-4 bg-[#FDFBEA]/95 backdrop-blur-md border-t border-[#EADFC7]/80 z-30">
        <button
          onClick={() => setIsPhoneModalOpen(true)}
          className="w-full h-[56px] rounded-[20px] bg-[#CE5535] text-[#FDFBEA] font-extrabold text-[16px] flex items-center justify-between px-5 shadow-[0_10px_24px_rgba(206,85,53,0.25)] hover:bg-[#A8401F] active:scale-[0.98] transition-all"
        >
          <span className="tabular-nums font-black text-[17px]">
            {formatPrice(toPay)}
          </span>
          <div className="flex items-center gap-1.5">
            <span>Proceed to pay</span>
            <span className="text-xl">→</span>
          </div>
        </button>
      </div>

      {/* SCREEN 5b: Phone Number Bottom Sheet */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#2B1A12]/60 backdrop-blur-xs p-0 animate-in fade-in duration-200">
          <div className="bg-[#FFFEF7] w-full max-w-[430px] rounded-t-[32px] border-t border-[#EADFC7] p-6 shadow-2xl relative animate-in slide-in-from-bottom duration-250">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 rounded-full bg-[#EADFC7] mx-auto mb-4" />

            {/* Top row: Title and close button */}
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h3 className="font-display text-[24px] font-extrabold text-[#2B1A12] leading-tight">
                  Enter your phone<br />number
                </h3>
              </div>
              <button
                onClick={() => {
                  if (!submitting) {
                    setIsPhoneModalOpen(false);
                    setErrorMsg('');
                  }
                }}
                disabled={submitting}
                className="w-9 h-9 rounded-full bg-[#F4E7CC] flex items-center justify-center text-[#2B1A12] hover:bg-[#EBD8B7] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <p className="text-xs text-[#75604F] font-medium leading-relaxed mb-5">
              We'll send order updates and your pickup code on WhatsApp.
            </p>

            {/* Phone Input with +91 prefix block */}
            <div className="mb-3">
              <div className="relative flex items-center h-[56px] rounded-[18px] bg-[#FFFEF7] border-2 border-[#CE5535] overflow-hidden shadow-xs">
                {/* +91 Block */}
                <div className="h-full px-4 bg-[#FBEDE3] border-r border-[#CE5535]/30 flex items-center justify-center text-[18px] font-extrabold text-[#2B1A12] select-none">
                  +91
                </div>

                {/* Numeric Input (max 10 digits) */}
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setPhone(digits);
                    setErrorMsg('');
                  }}
                  disabled={submitting}
                  placeholder="9876543210"
                  autoFocus
                  className="w-full h-full px-4 text-[20px] font-extrabold text-[#2B1A12] placeholder:text-[#75604F]/40 focus:outline-none bg-transparent tracking-wide"
                />
              </div>

              {/* Live Counter underneath */}
              <div className="flex items-center justify-between mt-2 px-1">
                <span
                  className={`text-xs font-bold flex items-center gap-1 ${
                    cleanPhone.length === 10 && isPhoneValid
                      ? 'text-[#2F7A3E]'
                      : 'text-[#75604F]'
                  }`}
                >
                  {cleanPhone.length === 10 && isPhoneValid ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>10/10 digits entered</span>
                    </>
                  ) : (
                    <span>{cleanPhone.length}/10 digits</span>
                  )}
                </span>
              </div>
            </div>

            {/* Inline Error Message if failed */}
            {errorMsg && (
              <div className="p-3 rounded-[14px] bg-[#FDF0F0] border border-[#BA1A1A]/30 text-[#BA1A1A] text-xs font-bold mb-4">
                {errorMsg}
              </div>
            )}

            {/* Spinner button row while submitting */}
            {submitting ? (
              <div className="w-full h-[54px] rounded-[20px] bg-[#F4E7CC] text-[#2B1A12] font-extrabold text-sm flex items-center justify-center gap-2 mb-2">
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                <span>Opening secure payment…</span>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-[11px] text-[#75604F] font-medium">
                  Payment opens automatically once all 10 digits are typed.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
