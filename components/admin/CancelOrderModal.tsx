'use client';

import React, { useState } from 'react';
import { Order } from '@/types/supabase';
import { X, AlertTriangle, AlertCircle } from 'lucide-react';

interface CancelOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (orderId: string, reason: string) => Promise<void>;
}

const PRESET_CHIPS = [
  'Out of stock',
  'Customer request',
  'Outlet closing',
  'Other',
];

export function CancelOrderModal({
  order,
  isOpen,
  onClose,
  onConfirmCancel,
}: CancelOrderModalProps) {
  const [selectedChip, setSelectedChip] = useState<string>('Out of stock');
  const [customReason, setCustomReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  if (!isOpen || !order) return null;

  const isPaid = order.payment_status === 'success';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalReason = selectedChip === 'Other' ? customReason.trim() : selectedChip;
    if (!finalReason) {
      setError('Please provide a cancellation reason.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirmCancel(order.id, finalReason);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-3xl border border-border p-6 shadow-xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#FDF0F0] text-brandRed flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display font-black text-lg text-espresso leading-tight">
                Cancel Order #{order.pickup_code}
              </h2>
              <span className="text-[11px] text-espresso/60 font-medium">
                Customer: {order.customer_name} ({order.customer_phone})
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full hover:bg-sand/60 text-espresso/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Preset Reason Chips */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-espresso/70 mb-2">
              Reason for Cancellation <span className="text-brandRed">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_CHIPS.map((chip) => {
                const isSelected = selectedChip === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => {
                      setSelectedChip(chip);
                      setError('');
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-espresso text-cream border-espresso shadow-xs'
                        : 'bg-sand/30 text-espresso/80 border-border hover:bg-sand/60'
                    }`}
                  >
                    {chip}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom text input if "Other" */}
          {selectedChip === 'Other' && (
            <div>
              <input
                type="text"
                placeholder="Enter custom cancellation reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-2xl bg-sand/20 border border-border text-xs text-espresso focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
          )}

          {/* Refund Notice / Policy Box */}
          <div className="bg-[#FBEDE3] border border-orange/30 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-orange">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Cancellation & Refund Policy</span>
            </div>
            <p className="text-[11px] text-espresso/80 leading-relaxed">
              No automatic refund. If the kitchen cancels a paid order, refund manually in Cashfree.
            </p>
            {isPaid && (
              <div className="pt-1.5 border-t border-orange/20">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange text-white text-[10px] font-bold">
                  Refund needs manual processing
                </span>
              </div>
            )}
          </div>

          {error && <p className="text-xs font-semibold text-brandRed">{error}</p>}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-espresso/70 hover:bg-sand/50 transition-colors"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brandRed text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
