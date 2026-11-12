'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { PendingOrderSafetyNet } from '@/components/ui/PendingOrderSafetyNet';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  const pathname = usePathname();
  const isPortal =
    pathname?.startsWith('/admin') ||
    pathname === '/login' ||
    pathname?.startsWith('/staff') ||
    pathname === '/orders';

  // Portal login and orders screens are responsive
  if (isPortal) {
    return <div className="min-h-screen bg-cream text-espresso w-full flex flex-col">{children}</div>;
  }

  // Customer app: full height on mobile, centered max-width 430px on desktop
  return (
    <div className="min-h-screen bg-[#FAF4E6] md:bg-[#ECE2CC] flex justify-center selection:bg-orange/20 w-full">
      <div className="w-full max-w-[430px] min-h-screen bg-cream md:shadow-2xl relative flex flex-col overflow-x-hidden border-border/60 md:border-x">
        <PendingOrderSafetyNet />
        {children}
      </div>
    </div>
  );
}
