'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepperProps {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  min?: number;
  max?: number;
  variant?: 'dark' | 'light' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Stepper({
  value,
  onIncrement,
  onDecrement,
  min = 0,
  max = 99,
  variant = 'dark',
  size = 'md',
  className,
}: StepperProps) {
  const isDark = variant === 'dark';

  const sizeStyles = {
    sm: 'h-8 px-2 text-sm gap-2 min-w-[76px]',
    md: 'h-9 px-3 text-base gap-3 min-w-[96px]',
    lg: 'h-11 px-4 text-lg gap-4 min-w-[110px]',
  };

  const btnSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-between rounded-full font-semibold select-none transition-transform active:scale-[0.98]',
        sizeStyles[size],
        isDark ? 'bg-espresso text-cream shadow-sm' : 'bg-sand text-espresso border border-border/80',
        className
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (value > min) onDecrement();
        }}
        aria-label="Decrease quantity"
        className={cn(
          'flex items-center justify-center rounded-full transition-colors active:scale-90',
          btnSizes[size],
          isDark ? 'hover:bg-cream/20 text-cream' : 'hover:bg-espresso/10 text-espresso'
        )}
      >
        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>

      <span className="tabular-nums font-bold min-w-[16px] text-center">{value}</span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (value < max) onIncrement();
        }}
        aria-label="Increase quantity"
        className={cn(
          'flex items-center justify-center rounded-full transition-colors active:scale-90',
          btnSizes[size],
          isDark ? 'hover:bg-cream/20 text-cream' : 'hover:bg-espresso/10 text-espresso'
        )}
      >
        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>
    </div>
  );
}
