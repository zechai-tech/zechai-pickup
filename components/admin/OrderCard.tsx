'use client';

import React, { useMemo } from 'react';
import { Order, OrderStatus } from '@/types/supabase';
import { StatusBadge } from './StatusBadge';
import { formatPrice } from '@/lib/utils';
import { Phone, Clock, ArrowRight, Ban, CheckCircle2, Flame, PackageCheck, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderCardProps {
  order: Order;
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  isNew?: boolean;
}

export function OrderCard({ order, onUpdateStatus, isNew = false }: OrderCardProps) {
  // Compute time since order
  const timeSince = useMemo(() => {
    const elapsedMs = Date.now() - new Date(order.created_at).getTime();
    const minutes = Math.floor(elapsedMs / (60 * 1000));
    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  }, [order.created_at]);

  const itemsList = Array.isArray(order.items) ? order.items : [];

  const getActionConfig = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return {
          nextStatus: 'accepted' as OrderStatus,
          label: 'Accept Order',
          color: 'bg-espresso text-cream hover:bg-espresso-dark',
          icon: Check,
        };
      case 'accepted':
        return {
          nextStatus: 'preparing' as OrderStatus,
          label: 'Start Preparing',
          color: 'bg-orange text-cream hover:bg-orange-dark shadow-orange-sm',
          icon: Flame,
        };
      case 'preparing':
        return {
          nextStatus: 'ready' as OrderStatus,
          label: 'Mark as Ready',
          color: 'bg-brandGreen text-cream hover:bg-[#256332]',
          icon: PackageCheck,
        };
      case 'ready':
        return {
          nextStatus: 'picked_up' as OrderStatus,
          label: 'Complete Pickup',
          color: 'bg-sand text-espresso hover:bg-[#ebd9b8] border border-border',
          icon: CheckCircle2,
        };
      default:
        return null;
    }
  };

  const action = getActionConfig(order.status);

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-border p-4 flex flex-col justify-between shadow-xs transition-all relative overflow-hidden',
        isNew && 'ring-2 ring-orange animate-pulse shadow-orange',
        order.status === 'ready' && 'border-brandGreen/40 bg-[#FCFDF9]'
      )}
    >
      {/* Top row: Status Badge + Time elapsed */}
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/60">
          <StatusBadge status={order.status} size="sm" />
          <div className="flex items-center gap-1 text-[11px] font-semibold text-espresso/60">
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
            <span className="font-display text-3xl font-black tracking-widest text-espresso">
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

        {/* Customer details */}
        <div className="bg-sand/30 rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-espresso block">{order.customer_name}</span>
            <a
              href={`tel:${order.customer_phone}`}
              className="text-espresso/70 flex items-center gap-1 hover:text-orange transition-colors"
            >
              <Phone className="w-3 h-3 text-orange" />
              <span>{order.customer_phone}</span>
            </a>
          </div>
          {order.outlet && (
            <span className="text-[10px] font-semibold text-espresso/60 max-w-[120px] text-right truncate">
              {order.outlet.name}
            </span>
          )}
        </div>

        {/* Items List */}
        <div className="space-y-1.5 py-1 mb-4">
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
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-border/60 flex items-center gap-2">
        {action && (
          <button
            onClick={() => onUpdateStatus(order.id, action.nextStatus)}
            className={cn(
              'flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95',
              action.color
            )}
          >
            <action.icon className="w-4 h-4" />
            <span>{action.label}</span>
          </button>
        )}

        {order.status !== 'cancelled' && order.status !== 'picked_up' && (
          <button
            onClick={() => {
              if (confirm('Are you sure you want to cancel this order?')) {
                onUpdateStatus(order.id, 'cancelled');
              }
            }}
            className="p-2.5 rounded-xl border border-border text-espresso/50 hover:text-brandRed hover:border-brandRed/40 hover:bg-[#FDF0F0] transition-colors"
            title="Cancel order"
            aria-label="Cancel order"
          >
            <Ban className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
