'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  size?: 'sm' | 'md';
}

export function Chip({
  className,
  active = false,
  size = 'md',
  children,
  ...props
}: ChipProps) {
  const sizeStyles = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
  };

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-full transition-all duration-150 whitespace-nowrap active:scale-95 select-none',
        sizeStyles[size],
        active
          ? 'bg-espresso text-cream shadow-sm'
          : 'bg-sand text-espresso hover:bg-[#ebd8b7]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
