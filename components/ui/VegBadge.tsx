import React from 'react';
import { cn } from '@/lib/utils';

interface VegBadgeProps {
  isVeg: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function VegBadge({ isVeg, size = 'sm', className }: VegBadgeProps) {
  const isSmall = size === 'sm';

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center border flex-shrink-0 bg-white/90',
        isSmall ? 'w-4 h-4 rounded-[4px] border-[1.5px]' : 'w-5 h-5 rounded-[5px] border-2',
        isVeg ? 'border-brandGreen' : 'border-brandRed',
        className
      )}
      title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
      aria-label={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
    >
      <span
        className={cn(
          'rounded-full',
          isSmall ? 'w-2 h-2' : 'w-2.5 h-2.5',
          isVeg ? 'bg-brandGreen' : 'bg-brandRed'
        )}
      />
    </span>
  );
}
