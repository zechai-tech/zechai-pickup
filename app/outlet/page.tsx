'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, Check, Zap, ArrowRight } from 'lucide-react';
import { getOutlets } from '@/lib/api';
import { Outlet } from '@/types';
import { useZechaStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { ActiveOrderBanner } from '@/components/ui/ActiveOrderBanner';
import { cn } from '@/lib/utils';

export default function OutletPage() {
  const router = useRouter();
  const { outlet, setOutlet } = useZechaStore();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOutlets().then((data) => {
      setOutlets(data);
      setLoading(false);
      // Default to first open outlet if none selected
      if (!outlet) {
        const firstOpen = data.find((o) => o.isOpen);
        if (firstOpen) {
          setOutlet(firstOpen);
        }
      }
    });
  }, [outlet, setOutlet]);

  const handleProceed = () => {
    if (outlet && outlet.isOpen) {
      router.push('/menu');
    }
  };

  return (
    <div className="min-h-[100dvh] h-full flex flex-col overflow-hidden bg-cream relative w-full max-w-full">
      {/* Active Order Banner if placed recently */}
      <ActiveOrderBanner />

      {/* Fixed Header */}
      <header className="shrink-0 px-5 pt-3 pb-2.5 flex items-center justify-between border-b border-border/40 bg-cream/95 backdrop-blur-xs z-10">
        <div className="relative w-28 h-8">
          <Image
            src="/assets/logo-orange.png"
            alt="Zécha!"
            fill
            sizes="112px"
            className="object-contain object-left"
            priority
          />
        </div>
        <button
          className="w-10 h-10 rounded-full border border-border bg-card flex items-center justify-center text-espresso hover:bg-sand/30 transition-colors"
          aria-label="User Profile"
        >
          <User className="w-5 h-5 text-espresso/80 stroke-[1.8]" />
        </button>
      </header>

      {/* Main Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto overscroll-contain overflow-x-hidden p-5 pb-28 scrollbar-none touch-scroll w-full max-w-full">
        {/* Greeting & Title */}
        <div className="mt-1 mb-4">
          <p className="text-xs font-semibold text-espresso/60 mb-0.5">Good evening</p>
          <h1 className="font-display text-[26px] font-extrabold text-espresso leading-tight tracking-tight">
            Where are you<br />picking up?
          </h1>
        </div>

        {/* Outlet Cards List */}
        <div className="space-y-2.5 mb-5 w-full max-w-full">
          {loading ? (
            [1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-sand/30 rounded-card animate-pulse border border-border w-full" />
            ))
          ) : (
            outlets.map((item) => {
              const isSelected = outlet?.id === item.id;
              const isClosed = !item.isOpen;

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (!isClosed) {
                      setOutlet(item);
                    }
                  }}
                  className={cn(
                    'w-full max-w-full overflow-hidden flex items-center justify-between p-3.5 rounded-card border transition-all duration-150',
                    isClosed
                      ? 'bg-card/50 border-border/50 opacity-60 cursor-not-allowed'
                      : isSelected
                      ? 'bg-[#FFFDF7] border-orange shadow-orange-sm ring-2 ring-orange/15 cursor-pointer'
                      : 'bg-card border-border hover:border-orange/40 cursor-pointer active:scale-[0.99]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Outlet mascot badge */}
                    <div
                      className={cn(
                        'w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors',
                        isClosed
                          ? 'bg-sand/40 opacity-50'
                          : isSelected
                          ? 'bg-orange text-cream shadow-sm'
                          : 'bg-sand text-espresso'
                      )}
                    >
                      <Image
                        src={isSelected ? '/assets/mascot-cream.png' : '/assets/mascot-orange.png'}
                        alt="Outlet"
                        width={22}
                        height={22}
                        className="object-contain"
                      />
                    </div>

                    <div className="min-w-0">
                      <h2
                        className={cn(
                          'font-bold text-[15px] leading-snug truncate',
                          isClosed ? 'text-espresso/50' : 'text-espresso'
                        )}
                      >
                        {item.name}
                      </h2>
                      <p className="text-xs font-medium text-espresso/70 mt-0.5 flex items-center gap-1.5">
                        <span>{item.distance}</span>
                        <span>·</span>
                        {isClosed ? (
                          <span className="text-brandRed font-semibold">{item.statusText}</span>
                        ) : (
                          <span className="text-brandGreen font-semibold">{item.statusText}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Radio / Selection Indicator */}
                  <div className="flex-shrink-0 ml-2">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-orange flex items-center justify-center shadow-sm">
                        <Check className="w-3 h-3 text-cream stroke-[3]" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2',
                          isClosed ? 'border-border/60 bg-transparent' : 'border-border bg-card'
                        )}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Section: Single Full-width Pickup now Card */}
        <div className="mb-5 w-full max-w-full overflow-hidden">
          <h2 className="font-display text-base font-bold text-espresso mb-2.5">
            When do you want it?
          </h2>

          <div className="w-full max-w-full overflow-hidden p-4 rounded-card bg-espresso text-cream shadow-md flex items-center justify-between border border-espresso-dark">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-mustard/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-4 h-4 text-mustard fill-mustard" />
              </div>
              <div>
                <div className="font-bold text-[15px] leading-tight text-cream">
                  Pickup now
                </div>
                <div className="text-xs font-medium text-cream/70 mt-0.5">
                  Ready in 15-20 min
                </div>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-full bg-cream/15 text-[11px] font-bold text-mustard uppercase tracking-wider">
              Express
            </span>
          </div>
        </div>

        {/* Promo Banner: TODAY ONLY */}
        <div className="w-full max-w-full relative overflow-hidden rounded-card bg-[#CE5535] text-cream p-4 shadow-sm mb-2">
          <div className="relative z-10 max-w-[200px]">
            <span className="text-[10px] font-black tracking-widest uppercase text-mustard bg-espresso/30 px-2 py-0.5 rounded-full inline-block mb-1">
              TODAY ONLY
            </span>
            <h3 className="font-display text-lg font-black leading-tight text-cream">
              Coolers at ₹10 off
            </h3>
            <p className="text-xs text-cream/90 font-medium mt-0.5">
              On any iced tea after 4 PM
            </p>
          </div>

          <div className="absolute -right-3 -bottom-4 w-28 h-28 pointer-events-none">
            <Image
              src="/assets/iced.png"
              alt="Promo Iced Tea"
              fill
              sizes="112px"
              loading="lazy"
              className="object-contain"
            />
          </div>
        </div>
      </main>

      {/* Fixed Bottom CTA Button (with Safe Area Padding) */}
      <div className="shrink-0 p-4 bg-cream/95 backdrop-blur-md border-t border-border z-30 pb-[max(16px,env(safe-area-inset-bottom))] w-full">
        <Button
          onClick={handleProceed}
          disabled={!outlet || !outlet.isOpen}
          className="w-full text-[17px] font-bold shadow-orange group"
        >
          <span>View menu</span>
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
