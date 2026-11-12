'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRouter } from 'next/navigation';
import { Check, ArrowRight, Printer } from 'lucide-react';
import { useZechaStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { formatPrice, formatTime, getEstimatedReadyTime } from '@/lib/utils';

export default function ConfirmedPage() {
  const router = useRouter();
  const { activeOrder, clearCart } = useZechaStore();

  // Route guard: /confirmed redirects to / only when there is no order
  useEffect(() => {
    if (!activeOrder) {
      router.push('/');
    } else {
      // Clear the cart only AFTER /confirmed has mounted
      clearCart();
    }
  }, [activeOrder, clearCart, router]);

  if (!activeOrder) return null;

  const digits = activeOrder.code ? activeOrder.code.split('') : ['7', '3', '0', '9'];
  const placedTimeStr = formatTime(new Date(activeOrder.placedAt));
  const readyByStr = getEstimatedReadyTime(new Date(activeOrder.placedAt), 15);

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-cream page-transition overflow-hidden relative">
      {/* Pattern overlay at top 300px */}
      <div className="absolute inset-x-0 top-0 h-[280px] pointer-events-none opacity-22 overflow-hidden print:hidden">
        <SafeImage
          src="/assets/pattern.v1.webp"
          alt=""
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cream/80 to-cream" />
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 pt-3 pb-36 space-y-4 relative z-10 scrollbar-none print:hidden">
        {/* Large orange tick circle with nested soft-orange rings & scale-in */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="relative w-20 h-20 mb-2 flex items-center justify-center animate-in zoom-in-75 duration-300">
            {/* Outer soft ring */}
            <div className="w-20 h-20 rounded-full bg-[#FBEDE3] flex items-center justify-center">
              {/* Middle soft ring */}
              <div className="w-15 h-15 w-16 h-16 rounded-full bg-[#F5D5C6] flex items-center justify-center">
                {/* Inner solid orange circle */}
                <div className="w-12 h-12 rounded-full bg-orange flex items-center justify-center shadow-orange">
                  <Check className="w-6 h-6 text-cream stroke-[3.2]" />
                </div>
              </div>
            </div>
          </div>

          <h1 className="font-display text-2xl font-black text-espresso mb-0.5">
            Payment successful
          </h1>
          <p className="text-xs font-semibold text-espresso/60">
            {formatPrice(activeOrder.paidAmount)} paid via {activeOrder.paymentMethod} · {placedTimeStr}
          </p>
        </div>

        {/* Ticket-Style Card */}
        <div className="bg-card rounded-[24px] border border-border shadow-sm overflow-hidden relative">
          {/* Top ticket section: Order number and Ready by */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-espresso/60 block uppercase">
                Order number
              </span>
              <span className="font-display text-lg font-black text-espresso tracking-tight">
                #{activeOrder.id}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-espresso/60 block uppercase">
                Ready by
              </span>
              <span className="font-display text-lg font-black text-espresso tracking-tight">
                {readyByStr}
              </span>
            </div>
          </div>

          {/* Ticket Dashed Cutout Divider with two notch circles */}
          <div className="relative flex items-center justify-center w-full my-0.5">
            {/* Left cutout circle */}
            <div className="absolute -left-3 w-6 h-6 rounded-full bg-cream border-r border-border shadow-inner" />
            {/* Dashed line */}
            <div className="w-full mx-5 border-t-2 border-dashed border-border" />
            {/* Right cutout circle */}
            <div className="absolute -right-3 w-6 h-6 rounded-full bg-cream border-l border-border shadow-inner" />
          </div>

          {/* Bottom ticket section: Pickup Code */}
          <div className="p-4 pt-3 flex flex-col items-center text-center">
            <span className="text-[10px] font-black tracking-widest uppercase text-orange mb-2.5">
              YOUR PICKUP CODE
            </span>

            {/* 4 large espresso digit boxes */}
            <div className="flex items-center gap-2 mb-2.5">
              {digits.map((digit, idx) => (
                <div
                  key={idx}
                  className="w-12 h-13 rounded-2xl bg-espresso text-cream flex items-center justify-center font-display text-2xl font-black shadow-md tabular-nums"
                >
                  {digit}
                </div>
              ))}
            </div>

            <p className="text-[11px] font-medium text-espresso/65 max-w-[240px]">
              Show this at the counter to collect your order
            </p>
          </div>
        </div>

        {/* Sand info pill with mustard dot */}
        <div className="p-3 px-3.5 rounded-2xl bg-sand/65 border border-border flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-mustard animate-pulse flex-shrink-0 shadow-xs" />
          <p className="text-xs font-semibold text-espresso leading-snug">
            Sent to <span className="font-bold">{activeOrder.outlet?.name || 'Zécha! Outlet'}</span>. Waiting for the outlet to accept your order.
          </p>
        </div>
      </div>

      {/* Sticky Bottom Actions pinned inside 390x844 frame */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-cream/95 backdrop-blur-md border-t border-border space-y-2 z-30 safe-bottom print:hidden">
        <Link href="/track" className="block w-full">
          <Button className="w-full h-12 text-[16px] font-bold shadow-orange group">
            <span>Track my order</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>

        <button
          onClick={handlePrintReceipt}
          className="w-full h-11 rounded-full border border-border bg-card hover:bg-sand/40 font-bold text-xs text-espresso flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
        >
          <Printer className="w-3.5 h-3.5 text-espresso/70" />
          <span>Download receipt</span>
        </button>
      </div>

      {/* Print-only receipt layout */}
      <div className="hidden print:block p-8 bg-white text-black font-sans">
        <div className="text-center border-b pb-4 mb-4">
          <h1 className="text-2xl font-black mb-1">Zécha!</h1>
          <p className="text-sm font-semibold">{activeOrder.outlet.name}</p>
          <p className="text-xs text-gray-600">{activeOrder.outlet.address || 'Kerala, India'}</p>
        </div>

        <div className="flex justify-between text-xs mb-3">
          <span>Order: #{activeOrder.id}</span>
          <span>Date: {placedTimeStr}</span>
        </div>
        <div className="text-xs mb-4">
          <span>Pickup Code: <strong className="text-sm">{activeOrder.code}</strong></span>
        </div>

        <table className="w-full text-xs border-t border-b py-2 mb-4">
          <thead>
            <tr className="border-b text-left">
              <th className="py-1">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {activeOrder.items.map((item) => (
              <tr key={item.lineId} className="border-b border-gray-100">
                <td className="py-1">{item.name} {item.size ? `(${item.size})` : ''}</td>
                <td className="py-1 text-center">{item.qty}</td>
                <td className="py-1 text-right">{formatPrice(item.unitPrice * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="space-y-1 text-xs text-right">
          <div>Item Total: {formatPrice(activeOrder.itemTotal)}</div>
          <div>GST (5%): {formatPrice(activeOrder.gst)}</div>
          <div className="font-bold text-sm pt-1 border-t">Total Paid: {formatPrice(activeOrder.paidAmount)}</div>
        </div>

        <div className="text-center text-[10px] text-gray-500 mt-8">
          Thank you for ordering with Zécha! One cup every day.
        </div>
      </div>
    </div>
  );
}
