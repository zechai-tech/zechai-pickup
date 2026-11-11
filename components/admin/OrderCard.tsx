'use client';

import React, { useMemo, useState } from 'react';
import { Order, OrderStatus } from '@/types/supabase';
import { StatusBadge } from './StatusBadge';
import { formatPrice } from '@/lib/utils';
import { normalizeOrderStatus } from '@/lib/order-flow';
import { useToast } from '@/components/ui/Toast';
import {
  Phone,
  Clock,
  Check,
  Ban,
  Copy,
  AlertCircle,
  Package,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onRequestCancel: (order: Order) => void;
  onGiveToCustomer?: (order: Order) => void;
  isSaving?: boolean;
  isNew?: boolean;
}

export function OrderCard({
  order,
  onUpdateStatus,
  onRequestCancel,
  onGiveToCustomer,
  isSaving = false,
  isNew = false,
}: OrderCardProps) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  const canonicalStatus = normalizeOrderStatus(order.status);

  // Compute elapsed time in minutes
  const elapsedMinutes = useMemo(() => {
    const elapsedMs = Date.now() - new Date(order.created_at).getTime();
    return Math.floor(elapsedMs / (60 * 1000));
  }, [order.created_at]);

  const timeSince = useMemo(() => {
    if (elapsedMinutes < 1) return 'Just now';
    if (elapsedMinutes === 1) return '1 min ago';
    if (elapsedMinutes < 60) return `${elapsedMinutes} mins ago`;
    const hours = Math.floor(elapsedMinutes / 60);
    return `${hours}h ${elapsedMinutes % 60}m ago`;
  }, [elapsedMinutes]);

  // Urgency check: Pending orders older than 2 minutes
  const isUrgentPending = canonicalStatus === 'pending' && elapsedMinutes >= 2;

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (order.customer_phone) {
      navigator.clipboard.writeText(order.customer_phone);
      setCopied(true);
      showToast('Phone number copied to clipboard', 'info');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const itemsList = Array.isArray(order.items) ? order.items : [];

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border p-4 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden',
        isUrgentPending
          ? 'border-2 border-brandRed ring-2 ring-brandRed/20 bg-[#FFFDFD]'
          : 'border-border',
        isNew && 'ring-2 ring-orange animate-pulse shadow-orange',
        canonicalStatus === 'ready' && 'border-brandGreen/40 bg-[#FCFDF9]'
      )}
    >
      <div>
        {/* Top row: Status Badge + Urgency / Elapsed Time */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={order.status} size="sm" />
            {isUrgentPending && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brandRed text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                <AlertCircle className="w-3 h-3" />
                <span>Waiting 2+ min</span>
              </span>
            )}
            {order.refund_required && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange text-white text-[10px] font-bold">
                Refund needs manual processing
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-semibold text-espresso/60 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>{timeSince}</span>
          </div>
        </div>

        {/* Pickup Code & Price Hero row */}
        <div className="flex items-center justify-between py-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-orange block">
              PICKUP CODE
            </span>
            <span className="font-display text-3xl font-black tracking-widest text-espresso select-all">
              {order.pickup_code}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-espresso/50 uppercase block">
              TOTAL
            </span>
            <span className="font-display text-xl font-black text-espresso">
              {formatPrice(Number(order.total))}
            </span>
          </div>
        </div>

        {/* Customer Details: selectable text, copy button, tel link */}
        <div className="bg-sand/30 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-espresso block">{order.customer_name}</span>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="select-text text-espresso font-semibold">
                {order.customer_phone}
              </span>
              <button
                type="button"
                onClick={handleCopyPhone}
                className="p-1 rounded-md hover:bg-sand/70 text-espresso/60 hover:text-espresso transition-colors"
                title="Copy phone number"
              >
                <Copy className="w-3 h-3" />
              </button>
              <a
                href={`tel:${order.customer_phone}`}
                className="p-1 rounded-md hover:bg-sand/70 text-orange hover:text-orange-dark transition-colors"
                title="Call customer"
              >
                <Phone className="w-3 h-3" />
              </a>
            </div>
          </div>

          {order.outlet && (
            <span className="text-[10px] font-semibold text-espresso/60 max-w-[120px] text-right truncate">
              {order.outlet.name}
            </span>
          )}
        </div>

        {/* Order Items List */}
        <div className="space-y-1.5 py-1 mb-3">
          <span className="text-[10px] font-black uppercase tracking-wider text-espresso/50 block">
            ORDER ITEMS ({itemsList.reduce((acc, i) => acc + (i.qty || 1), 0)})
          </span>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1 scrollbar-none">
            {itemsList.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-espresso font-medium truncate pr-2">
                  <span className="font-bold text-orange">{item.qty || 1}x</span> {item.name}
                  {item.size ? ` (${item.size})` : ''}
                </span>
                <span className="font-bold text-espresso/70 shrink-0">
                  {formatPrice(Number(item.price || item.unitPrice || 0) * (item.qty || 1))}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Kitchen Note */}
        {order.kitchen_note && (
          <div className="bg-[#FBEDE3]/50 border border-orange/20 rounded-xl p-2 mb-3 text-[11px] text-espresso/80">
            <span className="font-bold text-orange block">Note:</span>
            {order.kitchen_note}
          </div>
        )}

        {/* Cancellation Reason if cancelled by staff */}
        {canonicalStatus === 'cancelled' && order.cancel_reason && (
          <div className="bg-[#FDF0F0] border border-brandRed/20 rounded-xl p-2.5 mb-3 text-xs text-brandRed">
            <span className="font-bold block">Reason:</span>
            {order.cancel_reason}
            {order.cancelled_by && (
              <span className="text-[10px] opacity-80 block mt-0.5">
                Cancelled by: {order.cancelled_by}
              </span>
            )}
          </div>
        )}

        {/* Payment Cancellation Reason for unpaid orders */}
        {(canonicalStatus === 'payment_cancelled' ||
          order.status === 'payment_cancelled' ||
          order.status === 'payment_failed') && (
          <div className="bg-[#F3F4F6] border border-[#D1D5DB] rounded-xl p-2.5 mb-3 text-xs text-[#4B5563]">
            <span className="font-bold block text-espresso/70">Payment Reason:</span>
            <span className="font-medium">
              {order.payment_status === 'dropped'
                ? 'Payment dropped / cancelled by customer'
                : order.payment_status === 'failed'
                ? 'Payment failed at gateway'
                : order.payment_status === 'expired'
                ? 'Checkout session expired (20 min)'
                : order.payment_status === 'abandoned'
                ? 'Customer abandoned checkout'
                : order.payment_status === 'amount_mismatch'
                ? 'Payment amount mismatch'
                : order.payment_status || 'Payment not completed'}
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons Section */}
      <div className="pt-2 border-t border-border/60 flex items-center gap-2">
        {/* Pending Stage: Green tick "Confirm Order" moves to preparing + Cancel */}
        {canonicalStatus === 'pending' && (
          <>
            <button
              onClick={() => onUpdateStatus(order.id, 'preparing')}
              disabled={isSaving}
              className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-[#2F7A3E] text-white hover:bg-[#256332] active:scale-95 disabled:opacity-50 transition-all shadow-xs"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirm Order</span>
            </button>
            <button
              onClick={() => onRequestCancel(order)}
              disabled={isSaving}
              className="py-2.5 px-3 rounded-xl border border-border text-xs font-bold text-espresso/60 hover:text-brandRed hover:border-brandRed/40 hover:bg-[#FDF0F0] disabled:opacity-50 transition-colors"
            >
              Cancel Order
            </button>
          </>
        )}

        {/* Making Stage (preparing): Green tick "Done Making" moves to packaging + Cancel */}
        {canonicalStatus === 'preparing' && (
          <>
            <button
              onClick={() => onUpdateStatus(order.id, 'packaging')}
              disabled={isSaving}
              className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-[#2F7A3E] text-white hover:bg-[#256332] active:scale-95 disabled:opacity-50 transition-all shadow-xs"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Done Making</span>
            </button>
            <button
              onClick={() => onRequestCancel(order)}
              disabled={isSaving}
              className="p-2.5 rounded-xl border border-border text-espresso/50 hover:text-brandRed hover:border-brandRed/40 hover:bg-[#FDF0F0] disabled:opacity-50 transition-colors"
              title="Cancel order"
            >
              <Ban className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Packaging Stage: Green tick "Done Packaging" moves to ready + Cancel */}
        {canonicalStatus === 'packaging' && (
          <>
            <button
              onClick={() => onUpdateStatus(order.id, 'ready')}
              disabled={isSaving}
              className="flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 bg-[#2F7A3E] text-white hover:bg-[#256332] active:scale-95 disabled:opacity-50 transition-all shadow-xs"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Done Packaging</span>
            </button>
            <button
              onClick={() => onRequestCancel(order)}
              disabled={isSaving}
              className="p-2.5 rounded-xl border border-border text-espresso/50 hover:text-brandRed hover:border-brandRed/40 hover:bg-[#FDF0F0] disabled:opacity-50 transition-colors"
              title="Cancel order"
            >
              <Ban className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Completed Stage (ready): Prominent GREEN "Give to Customer" (5s undo toast) + Cancel */}
        {canonicalStatus === 'ready' && (
          <>
            <button
              onClick={() => (onGiveToCustomer ? onGiveToCustomer(order) : onUpdateStatus(order.id, 'received'))}
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 bg-[#2F7A3E] text-white hover:bg-[#256332] active:scale-95 disabled:opacity-50 transition-all shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Give to Customer</span>
            </button>
            <button
              onClick={() => onRequestCancel(order)}
              disabled={isSaving}
              className="p-3 rounded-xl border border-border text-espresso/50 hover:text-brandRed hover:border-brandRed/40 hover:bg-[#FDF0F0] disabled:opacity-50 transition-colors"
              title="Cancel order"
            >
              <Ban className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
