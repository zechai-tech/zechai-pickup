import React from 'react';
import { OrderStatus } from '@/types/supabase';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, Flame, PackageCheck, Check, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const isSmall = size === 'sm';

  const config: Record<
    OrderStatus,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    pending: {
      label: 'Pending',
      bg: 'bg-mustard/15',
      text: 'text-[#8A6700]',
      border: 'border-mustard/30',
      icon: <Clock className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    accepted: {
      label: 'Accepted',
      bg: 'bg-sand/70',
      text: 'text-espresso',
      border: 'border-border',
      icon: <Check className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    preparing: {
      label: 'Preparing',
      bg: 'bg-orange-soft',
      text: 'text-orange-dark',
      border: 'border-orange/30',
      icon: <Flame className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    ready: {
      label: 'Ready for Pickup',
      bg: 'bg-[#EBF7EE]',
      text: 'text-brandGreen',
      border: 'border-brandGreen/30',
      icon: <PackageCheck className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    picked_up: {
      label: 'Picked Up',
      bg: 'bg-sand/40',
      text: 'text-espresso/70',
      border: 'border-border/60',
      icon: <CheckCircle2 className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    cancelled: {
      label: 'Cancelled',
      bg: 'bg-[#FDF0F0]',
      text: 'text-brandRed',
      border: 'border-brandRed/30',
      icon: <XCircle className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    pending_payment: {
      label: 'Awaiting Payment',
      bg: 'bg-mustard/15',
      text: 'text-[#8A6700]',
      border: 'border-mustard/30',
      icon: <Clock className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    confirmed: {
      label: 'Confirmed',
      bg: 'bg-sand/70',
      text: 'text-espresso',
      border: 'border-border',
      icon: <Check className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    completed: {
      label: 'Completed',
      bg: 'bg-sand/40',
      text: 'text-espresso/70',
      border: 'border-border/60',
      icon: <CheckCircle2 className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    payment_failed: {
      label: 'Payment Failed',
      bg: 'bg-[#FDF0F0]',
      text: 'text-brandRed',
      border: 'border-brandRed/30',
      icon: <XCircle className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
  };

  const item = config[status] || config.pending;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-bold uppercase tracking-wider rounded-full border',
        item.bg,
        item.text,
        item.border,
        isSmall ? 'text-[10px] px-2.5 py-0.5' : 'text-xs px-3 py-1',
        className
      )}
    >
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
}
