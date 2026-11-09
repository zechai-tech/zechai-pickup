'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  MapPin,
  User,
  PenLine,
  Lock,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import { useZechaStore, getCartSummary } from '@/lib/store';
import { Stepper } from '@/components/ui/Stepper';
import { Button } from '@/components/ui/Button';
import { cn, formatPrice } from '@/lib/utils';

export default function CartPage() {
  const router = useRouter();
  const {
    outlet,
    cart,
    customer,
    activeOrder,
    updateCartQty,
    removeFromCart,
    setCustomer,
  } = useZechaStore();

  const { count, itemTotal, gst, grandTotal } = getCartSummary(cart);

  // Route guard: /cart redirects to /menu only when cart is empty AND there is no active order
  useEffect(() => {
    if (cart.length === 0 && !activeOrder) {
      router.push('/menu');
    }
  }, [cart.length, activeOrder, router]);

  // Editable customer info
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [name, setName] = useState(customer.name || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [note, setNote] = useState(customer.note || '');

  const isPhoneValid = /^\d{10}$/.test(phone.replace(/\D/g, ''));
  const isNameValid = name.trim().length >= 2;
  const isFormValid = isPhoneValid && isNameValid && count > 0;

  const handleSaveContact = () => {
    setCustomer({ name: name.trim(), phone: phone.replace(/\D/g, ''), note });
    setIsEditingContact(false);
  };

  const handleProceedToPay = () => {
    if (!isFormValid) return;
    setCustomer({ name: name.trim(), phone: phone.replace(/\D/g, ''), note });
    router.push('/payment');
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 space-y-4 scrollbar-none">
        {/* Cart Line Items */}
        <div className="space-y-2.5">
          {cart.map((line) => {
            const optionStrings: string[] = [];
            if (line.size) optionStrings.push(line.size);
            if (line.sugar) optionStrings.push(line.sugar === 'No sugar' ? 'No sugar' : `${line.sugar} sugar`);
            if (line.addons && line.addons.length > 0) {
              optionStrings.push(...line.addons.map((a) => a.name));
            }
            const optionsText = optionStrings.join(' · ');

            return (
              <div
                key={line.lineId}
                className="bg-card rounded-card border border-border p-3 flex items-center justify-between gap-3 shadow-xs"
              >
                {/* Thumbnail */}
                <div className="relative w-15 h-15 w-14 h-14 rounded-xl overflow-hidden bg-sand/40 flex-shrink-0">
                  <Image
                    src={line.image}
                    alt={line.name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-xs text-espresso truncate">{line.name}</h3>
                  {optionsText && (
                    <p className="text-[11px] text-espresso/60 font-medium truncate mt-0.5">
                      {optionsText}
                    </p>
                  )}
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
            );
          })}
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
                    Pickup now · ready in ~12 min
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
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-sand/60 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-orange" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-espresso leading-snug">
                    {name || 'Add Name'}
                  </h4>
                  <p className="text-[11px] text-espresso/60 font-medium">
                    {phone ? `+91 ${phone.slice(0, 2)}••• ••${phone.slice(-3)} · updates on WhatsApp` : 'Enter 10-digit mobile number'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingContact(!isEditingContact)}
                className="text-xs font-bold text-orange hover:text-orange-dark transition-colors"
              >
                {isEditingContact ? 'Done' : 'Edit'}
              </button>
            </div>

            {/* Inline contact editor */}
            {isEditingContact && (
              <div className="pt-2 space-y-2 border-t border-dashed border-border">
                <div>
                  <label className="text-[10px] font-bold text-espresso/60 uppercase">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Hadi"
                    className="w-full mt-0.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-sand/30 border border-border text-espresso focus:outline-none focus:border-orange"
                  />
                  {!isNameValid && (
                    <span className="text-[10px] text-brandRed mt-0.5 block">Name must be at least 2 letters</span>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-espresso/60 uppercase">Phone (10 digits)</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9847123210"
                    className="w-full mt-0.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-sand/30 border border-border text-espresso focus:outline-none focus:border-orange"
                  />
                  {!isPhoneValid && (
                    <span className="text-[10px] text-brandRed mt-0.5 block">Enter a valid 10-digit Indian phone number</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveContact}
                  className="w-full py-2 bg-espresso text-cream text-xs font-bold rounded-xl mt-1"
                >
                  Save details
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Note for kitchen */}
        <div className="bg-card rounded-card border border-border p-3 flex items-center gap-2.5">
          <PenLine className="w-4 h-4 text-espresso/50 flex-shrink-0" />
          <input
            type="text"
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setCustomer({ note: e.target.value });
            }}
            placeholder="Note for the kitchen (optional)"
            className="w-full bg-transparent text-xs font-semibold text-espresso placeholder:text-espresso/50 focus:outline-none"
          />
        </div>

        {/* Bill Summary */}
        <div className="bg-card rounded-card border border-border p-3.5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-espresso/70">Item total</span>
            <span className="font-bold text-espresso tabular-nums">{formatPrice(itemTotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-espresso/70">Taxes (GST 5%)</span>
            <span className="font-bold text-espresso tabular-nums">{formatPrice(gst)}</span>
          </div>
          <div className="h-px bg-border/60 my-0.5" />
          <div className="flex items-center justify-between text-sm">
            <span className="font-display font-black text-espresso">To pay</span>
            <span className="font-display font-black text-espresso text-base tabular-nums">
              {formatPrice(grandTotal)}
            </span>
          </div>
        </div>

        {/* Prepaid info chip */}
        <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] font-semibold text-espresso/70">
          <Lock className="w-3.5 h-3.5 text-brandGreen stroke-[2.2]" />
          <span>Prepaid order. No cash needed at the counter.</span>
        </div>
      </div>

      {/* Sticky Bottom Bar pinned inside 390x844 frame */}
      <div className="absolute bottom-0 left-0 right-0 p-3.5 bg-cream/95 backdrop-blur-md border-t border-border flex items-center justify-between gap-3 z-30 safe-bottom">
        <div>
          <span className="text-[10px] font-bold text-espresso/60 block uppercase">Total</span>
          <span className="font-display text-xl font-black text-espresso tabular-nums">
            {formatPrice(grandTotal)}
          </span>
        </div>

        <Button
          onClick={handleProceedToPay}
          disabled={!isFormValid}
          className="flex-1 text-[16px] font-bold shadow-orange group h-12"
        >
          <span>Proceed to pay</span>
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
