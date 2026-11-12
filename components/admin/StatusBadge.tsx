import React from 'react';
import { OrderStatus } from '@/types/supabase';
import { cn } from '@/lib/utils';
import {
  Clock,
  CheckCircle2,
  Flame,
  PackageCheck,
  Check,
  XCircle,
  Package,
} from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const isSmall = size === 'sm';

  const config: Record<
    string,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    pending_payment: {
      label: 'Awaiting Payment',
      bg: 'bg-mustard/15',
      text: 'text-[#8A6700]',
      border: 'border-mustard/30',
      icon: <Clock className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    pending: {
      label: 'Payment Successful',
      bg: 'bg-[#EBF7EE]',
      text: 'text-brandGreen',
      border: 'border-brandGreen/30',
      icon: <Check className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    preparing: {
      label: 'Making',
      bg: 'bg-orange-soft',
      text: 'text-orange-dark',
      border: 'border-orange/30',
      icon: <Flame className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    confirmed: {
      label: 'Making',
      bg: 'bg-orange-soft',
      text: 'text-orange-dark',
      border: 'border-orange/30',
      icon: <Flame className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    accepted: {
      label: 'Making',
      bg: 'bg-orange-soft',
      text: 'text-orange-dark',
      border: 'border-orange/30',
      icon: <Flame className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    packaging: {
      label: 'Packaging',
      bg: 'bg-[#EFF6FF]',
      text: 'text-[#1D4ED8]',
      border: 'border-[#93C5FD]',
      icon: <Package className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    ready: {
      label: 'READY',
      bg: 'bg-[#EBF7EE]',
      text: 'text-brandGreen',
      border: 'border-brandGreen/30',
      icon: <PackageCheck className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    received: {
      label: 'PICKED UP',
      bg: 'bg-sand/40',
      text: 'text-espresso/80',
      border: 'border-border/60',
      icon: <CheckCircle2 className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    completed: {
      label: 'PICKED UP',
      bg: 'bg-sand/40',
      text: 'text-espresso/80',
      border: 'border-border/60',
      icon: <CheckCircle2 className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    picked_up: {
      label: 'PICKED UP',
      bg: 'bg-sand/40',
      text: 'text-espresso/80',
      border: 'border-border/60',
      icon: <CheckCircle2 className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    cancelled: {
      label: 'Order Cancelled',
      bg: 'bg-[#FDF0F0]',
      text: 'text-brandRed',
      border: 'border-brandRed/30',
      icon: <XCircle className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    payment_cancelled: {
      label: 'Payment Cancelled',
      bg: 'bg-[#F3F4F6]',
      text: 'text-[#6B7280]',
      border: 'border-[#D1D5DB]',
      icon: <XCircle className={cn(isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5')} />,
    },
    payment_failed: {
      label: 'Payment Cancelled',
      bg: 'bg-[#F3F4F6]',
      text: 'text-[#6B7280]',
      border: 'border-[#D1D5DB]',
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
