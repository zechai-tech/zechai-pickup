import React from 'react';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div className="min-h-screen bg-[#EFE5D0] flex justify-center items-center md:py-6 selection:bg-orange/20 overflow-x-hidden">
      {/* 
        On desktop: exactly 390px wide by 844px tall, centred, rounded 44px, soft shadow, overflow hidden.
        On mobile (<= 430px): 100% width, 100dvh with safe-area padding.
      */}
      <div className="w-full h-[100dvh] md:w-[390px] md:h-[844px] md:max-h-[844px] md:rounded-[44px] bg-cream shadow-2xl relative flex flex-col overflow-hidden border-border/70 md:border">
        {children}
      </div>
    </div>
  );
}
