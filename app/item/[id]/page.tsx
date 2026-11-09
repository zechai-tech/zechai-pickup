'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Heart, Check } from 'lucide-react';
import { getMenuItemById } from '@/lib/api';
import { MenuItem, MenuItemSize, CartItemAddon } from '@/types';
import { useZechaStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { VegBadge } from '@/components/ui/VegBadge';
import { Stepper } from '@/components/ui/Stepper';
import { Button } from '@/components/ui/Button';
import { cn, formatPrice } from '@/lib/utils';

export default function ItemCustomisePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const { addToCart } = useZechaStore();
  const { showToast } = useToast();

  const [item, setItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Customization state
  const [selectedSize, setSelectedSize] = useState<MenuItemSize | null>(null);
  const [selectedSugar, setSelectedSugar] = useState<'No sugar' | 'Less' | 'Regular'>('Less');
  const [selectedAddons, setSelectedAddons] = useState<CartItemAddon[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (!id) return;
    getMenuItemById(id).then((data) => {
      if (!data) {
        router.push('/menu');
        return;
      }
      setItem(data);
      if (data.sizes && data.sizes.length > 0) {
        const defaultSize = data.sizes.find((s) => s.id === 'large') || data.sizes[0];
        setSelectedSize(defaultSize);
      }
      if (data.sugarLevels && data.sugarLevels.length > 0) {
        setSelectedSugar('Less');
      }
      setLoading(false);
    });
  }, [id, router]);

  // Unit price calculation
  const unitPrice = useMemo(() => {
    if (!item) return 0;
    let base = selectedSize ? selectedSize.price : item.price;
    const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.priceDelta, 0);
    return base + addonsTotal;
  }, [item, selectedSize, selectedAddons]);

  const totalPrice = unitPrice * quantity;

  const handleToggleAddon = (addon: { id: string; name: string; priceDelta: number }) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      } else {
        return [...prev, addon];
      }
    });
  };

  const handleAddToCart = () => {
    if (!item) return;

    const addonKey = selectedAddons
      .map((a) => a.id)
      .sort()
      .join('-');
    const lineId = `${item.id}-${selectedSize?.id || 'default'}-${selectedSugar}-${addonKey}`;

    addToCart({
      lineId,
      itemId: item.id,
      name: item.name,
      image: item.image,
      isVeg: item.isVeg,
      size: selectedSize?.name,
      sugar: item.sugarLevels ? selectedSugar : undefined,
      addons: selectedAddons,
      unitPrice,
      qty: quantity,
    });

    showToast(`Added ${item.name} (${quantity}) to cart`, 'success');
    router.push('/menu');
  };

  if (loading || !item) {
    return (
      <div className="flex-1 flex items-center justify-center bg-cream min-h-full">
        <div className="w-8 h-8 rounded-full border-2 border-orange border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-cream page-transition overflow-hidden relative">
      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24 scrollbar-none">
        {/* Hero Image Container with floating buttons */}
        <div className="relative w-full h-[250px] bg-sand/30 overflow-hidden rounded-b-[28px] shadow-sm">
          <Image
            src={item.image}
            alt={item.name}
            fill
            className="object-cover"
            priority
          />

          {/* Floating Back Button */}
          <button
            onClick={() => router.back()}
            className="absolute top-4 left-4 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-md flex items-center justify-center text-espresso hover:bg-card transition-all active:scale-95 z-20"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.2]" />
          </button>

          {/* Floating Favorite Button */}
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-md flex items-center justify-center text-espresso hover:bg-card transition-all active:scale-95 z-20"
            aria-label="Favorite item"
          >
            <Heart
              className={cn(
                'w-5 h-5 transition-colors',
                isFavorite ? 'fill-orange text-orange' : 'text-espresso/70'
              )}
            />
          </button>
        </div>

        {/* Item Header Details */}
        <div className="p-4 pt-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <VegBadge isVeg={item.isVeg} size="sm" />
            {item.isBestseller && (
              <span className="bg-mustard text-espresso text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                BESTSELLER
              </span>
            )}
          </div>

          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h1 className="font-display text-2xl font-black text-espresso leading-tight">
              {item.name}
            </h1>
            <span className="font-display text-2xl font-black text-espresso tabular-nums">
              {formatPrice(unitPrice)}
            </span>
          </div>

          <p className="text-xs font-medium text-espresso/70 leading-relaxed mb-5">
            {item.description}
          </p>

          {/* Customization: Cup Size */}
          {item.sizes && item.sizes.length > 0 && (
            <div className="mb-5">
              <h3 className="font-display text-sm font-bold text-espresso mb-2.5">
                Cup size
              </h3>
              <div className="grid grid-cols-2 gap-2.5">
                {item.sizes.map((s) => {
                  const isSelected = selectedSize?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSize(s)}
                      className={cn(
                        'p-3 rounded-card border transition-all cursor-pointer relative flex flex-col justify-between',
                        isSelected
                          ? 'border-orange ring-2 ring-orange/15 bg-card shadow-orange-sm'
                          : 'border-border bg-card hover:border-orange/30'
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-orange flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5 text-cream stroke-[3]" />
                        </div>
                      )}
                      <div className="font-bold text-[14px] text-espresso">{s.name}</div>
                      <div className="text-xs text-espresso/60 font-medium mt-0.5">
                        {s.volume} · {formatPrice(s.price)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customization: Sugar Level */}
          {item.sugarLevels && (
            <div className="mb-5">
              <h3 className="font-display text-sm font-bold text-espresso mb-2.5">
                Sugar level
              </h3>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-sand/60 rounded-full border border-border/60">
                {item.sugarLevels.map((lvl) => {
                  const isSelected = selectedSugar === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedSugar(lvl)}
                      className={cn(
                        'py-1.5 px-2 rounded-full text-xs font-bold transition-all duration-150 text-center select-none',
                        isSelected
                          ? 'bg-espresso text-cream shadow-sm'
                          : 'text-espresso/80 hover:text-espresso'
                      )}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customization: Add-ons */}
          {item.addons && item.addons.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-2.5">
                <h3 className="font-display text-sm font-bold text-espresso">
                  Add-ons
                </h3>
                <span className="text-xs text-espresso/60 font-medium">· optional</span>
              </div>

              <div className="space-y-2">
                {item.addons.map((addon) => {
                  const isChecked = selectedAddons.some((a) => a.id === addon.id);
                  return (
                    <div
                      key={addon.id}
                      onClick={() => handleToggleAddon(addon)}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-xl border bg-card cursor-pointer transition-all',
                        isChecked
                          ? 'border-orange ring-1 ring-orange/20 shadow-xs'
                          : 'border-border hover:border-orange/30'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'w-4 h-4 rounded-md border-2 flex items-center justify-center transition-colors',
                            isChecked ? 'bg-orange border-orange' : 'border-border bg-card'
                          )}
                        >
                          {isChecked && <Check className="w-3 h-3 text-cream stroke-[3]" />}
                        </div>
                        <span className="font-bold text-xs text-espresso">{addon.name}</span>
                      </div>
                      <span className="text-xs font-bold text-espresso/70">
                        +{formatPrice(addon.priceDelta)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Actions Bar pinned inside 390x844 frame */}
      <div className="absolute bottom-0 left-0 right-0 p-3.5 bg-cream/95 backdrop-blur-md border-t border-border flex items-center gap-3 z-30 safe-bottom">
        <Stepper
          size="md"
          value={quantity}
          onIncrement={() => setQuantity((q) => q + 1)}
          onDecrement={() => setQuantity((q) => Math.max(1, q - 1))}
          variant="light"
        />

        <Button
          onClick={handleAddToCart}
          className="flex-1 h-12 text-[15px] font-bold shadow-orange"
        >
          Add to cart · {formatPrice(totalPrice)}
        </Button>
      </div>
    </div>
  );
}
