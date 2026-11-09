'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'lg', isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none';

    const variants = {
      primary:
        'bg-orange text-cream hover:bg-orange-dark shadow-orange hover:shadow-orange-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange/50',
      secondary:
        'bg-sand text-espresso hover:bg-[#ebd9b8] active:bg-[#e4cca3]',
      outline:
        'border-2 border-border bg-transparent text-espresso hover:bg-sand/30 active:bg-sand/50',
      ghost:
        'bg-transparent text-espresso hover:bg-sand/40',
      dark:
        'bg-espresso text-cream hover:bg-espresso-dark shadow-md',
    };

    const sizes = {
      sm: 'h-10 px-4 text-sm',
      md: 'h-12 px-6 text-base',
      lg: 'h-14 px-7 text-[17px] tracking-wide',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
