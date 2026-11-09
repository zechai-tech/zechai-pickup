import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  interactive?: boolean;
}

export function Card({ className, selected = false, interactive = false, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-card border border-border transition-all duration-150',
        interactive && 'cursor-pointer active:scale-[0.99] hover:border-orange/60',
        selected && 'border-orange ring-2 ring-orange/20 shadow-orange-sm bg-[#FFFDF8]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
