'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/stores/admin-store';
import { SafeImage } from '@/components/ui/SafeImage';
import { DEFAULT_MENU_IMAGE } from '@/lib/images';
import { compressAdminImage } from '@/lib/admin-image-compress';
import { VegBadge } from '@/components/ui/VegBadge';
import { Button } from '@/components/ui/Button';
import { formatPrice } from '@/lib/utils';
import { MenuItem } from '@/types/supabase';
import { Combo } from '@/types';
import {
  X,
  Upload,
  Search,
  Plus,
  Minus,
  Sparkles,
  AlertTriangle,
  Check,
  Package,
} from 'lucide-react';

interface ComboFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  outletId: string;
  availableMenuItems: MenuItem[];
  comboToEdit?: Combo | null;
}

export function ComboForm({
  isOpen,
  onClose,
  onSuccess,
  outletId,
  availableMenuItems,
  comboToEdit,
}: ComboFormProps) {
  const { sessionToken } = useAdminStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('/assets/chai.v1.webp');
  const [price, setPrice] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [searchFilter, setSearchFilter] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or reset form on open or comboToEdit change
  useEffect(() => {
    if (comboToEdit) {
      setName(comboToEdit.name);
      setDescription(comboToEdit.description || '');
      setImageUrl(comboToEdit.image_url || '/assets/chai.v1.webp');
      setPrice(String(comboToEdit.price));
      const map = new Map<string, number>();
      if (Array.isArray(comboToEdit.items)) {
        for (const it of comboToEdit.items) {
          map.set(it.menu_item_id, Math.max(1, it.quantity || 1));
        }
      }
      setSelectedItems(map);
    } else {
      setName('');
      setDescription('');
      setImageUrl('/assets/chai.v1.webp');
      setPrice('');
      setSelectedItems(new Map());
    }
    setPreviewObjectUrl(null);
    setUploadStats('');
    setError(null);
    setSearchFilter('');
  }, [comboToEdit, isOpen]);

  const itemsMap = useMemo(() => {
    const map = new Map<string, MenuItem>();
    for (const item of availableMenuItems) {
      map.set(item.id, item);
    }
    return map;
  }, [availableMenuItems]);

  // Filter available items for search
  const filteredAvailableItems = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return availableMenuItems;
    return availableMenuItems.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.category || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
    );
  }, [availableMenuItems, searchFilter]);

  // Calculate live items total and veg status
  const { itemsSeparately, isAutoVeg } = useMemo(() => {
    let total = 0;
    let allVeg = true;

    for (const [itemId, qty] of selectedItems.entries()) {
      const item = itemsMap.get(itemId);
      if (item) {
        total += (Number(item.price) || 0) * qty;
        if (!item.is_veg) {
          allVeg = false;
        }
      }
    }

    return {
      itemsSeparately: Math.round(total),
      isAutoVeg: allVeg,
    };
  }, [selectedItems, itemsMap]);

  const typedPrice = Math.max(0, Math.round(Number(price) || 0));
  const customerSaves = Math.round(itemsSeparately - typedPrice);
  const selectedDistinctCount = selectedItems.size;

  // Toggle item selection
  const handleToggleItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.set(itemId, 1);
      }
      return next;
    });
  };

  // Update item quantity
  const handleUpdateQty = (itemId: string, delta: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) || 1;
      const updated = current + delta;
      if (updated <= 0) {
        next.delete(itemId);
      } else {
        next.set(itemId, updated);
      }
      return next;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, WebP)');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const compressed = await compressAdminImage(file);

      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
      setPreviewObjectUrl(compressed.previewUrl);
      setUploadStats(
        `Optimized WebP: ${(compressed.originalBytes / 1024).toFixed(0)} KB → ${(
          compressed.compressedBytes / 1024
        ).toFixed(1)} KB`
      );

      const formData = new FormData();
      formData.append('file', compressed.file);
      formData.append('bucket', 'menu-images');

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setImageUrl(data.url);
    } catch (err: any) {
      setError(`Image upload error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outletId) {
      setError('Please select an active outlet first.');
      return;
    }

    if (!name.trim()) {
      setError('Combo name is required.');
      return;
    }

    if (price === '' || isNaN(Number(price)) || Number(price) < 0) {
      setError('Please enter a valid price for the combo.');
      return;
    }

    if (selectedDistinctCount < 2) {
      setError('A combo must include at least 2 distinct menu items.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Get fresh session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || sessionToken;

      const itemsPayload = Array.from(selectedItems.entries()).map(([itemId, qty]) => ({
        menu_item_id: itemId,
        quantity: qty,
      }));

      const payload = {
        id: comboToEdit?.id,
        outlet_id: outletId,
        name: name.trim(),
        description: description.trim() || null,
        image_url: imageUrl,
        price: Number(price),
        items: itemsPayload,
      };

      const res = await fetch('/api/admin/combos', {
        method: comboToEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save combo');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save combo');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-card w-full max-w-xl rounded-[28px] border border-border shadow-2xl p-6 relative my-8 animate-in zoom-in-95 duration-150 max-h-[92dvh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/70 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-orange/15 text-orange flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-lg text-espresso">
                  {comboToEdit ? 'Edit Combo' : 'Add New Combo'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange text-white">
                  Combo
                </span>
              </div>
              <p className="text-xs text-espresso/60">
                Bundle 2+ menu items into an exclusive combo meal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-sand/60 hover:bg-sand flex items-center justify-center text-espresso transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FDF0F0] border border-brandRed/20 text-brandRed text-xs font-semibold shrink-0">
            {error}
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4">
          {/* Combo Name & Fixed Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Combo Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Masala Chai & Maska Bun Combo"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Fixed Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 99"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-extrabold text-espresso focus:outline-none focus:border-orange"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider">
                Description
              </label>
              <span className="text-[11px] font-bold text-espresso/60 tabular-nums">
                {description.length}/200
              </span>
            </div>
            <textarea
              rows={2}
              maxLength={200}
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="Appetizing description of the combo pairing..."
              className="w-full p-3 rounded-xl bg-sand/30 border border-border text-xs font-medium text-espresso focus:outline-none focus:border-orange"
            />
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              Combo Photo
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-sand/60 border border-border shrink-0 flex items-center justify-center">
                <SafeImage
                  src={previewObjectUrl || imageUrl || DEFAULT_MENU_IMAGE}
                  alt="Combo Preview"
                  variant="thumb"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>

              <div className="flex-1 min-w-0">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sand/40 hover:bg-sand border border-border text-xs font-bold text-espresso transition-colors">
                  <Upload className="w-3.5 h-3.5 text-orange" />
                  <span>{uploading ? 'Compressing & Uploading...' : 'Upload Image (Max 5 MB)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                {uploadStats && (
                  <p className="text-[10px] font-bold text-[#2F7A3E] mt-1">{uploadStats}</p>
                )}
              </div>
            </div>
          </div>

          {/* Automatic Veg Indicator */}
          <div className="p-2.5 rounded-xl bg-sand/20 border border-border flex items-center justify-between">
            <span className="text-xs font-bold text-espresso/70">Automatic Dietary Badge</span>
            <div className="flex items-center gap-2">
              <VegBadge isVeg={isAutoVeg} size="sm" />
              <span className="text-xs font-extrabold text-espresso">
                {isAutoVeg ? 'Pure Veg' : 'Non-Veg (includes non-veg item)'}
              </span>
            </div>
          </div>

          {/* Item Picker (Select 2 or more existing items) */}
          <div className="space-y-2 pt-1 border-t border-border/70">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider">
                Select Included Menu Items * (Minimum 2)
              </label>
              <span className="text-[11px] font-extrabold text-orange">
                {selectedDistinctCount} selected
              </span>
            </div>

            {/* Selected Items Chips / List with Quantities */}
            {selectedDistinctCount > 0 && (
              <div className="space-y-1.5 p-2.5 rounded-2xl bg-sand/30 border border-border max-h-40 overflow-y-auto">
                <span className="text-[10px] font-black uppercase tracking-wider text-espresso/60 block">
                  Included in this combo:
                </span>
                {Array.from(selectedItems.entries()).map(([itemId, qty]) => {
                  const item = itemsMap.get(itemId);
                  if (!item) return null;

                  return (
                    <div
                      key={itemId}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-border/80 shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <VegBadge isVeg={item.is_veg} size="sm" />
                        <span className="text-xs font-bold text-espresso truncate">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-semibold text-espresso/50">
                          {formatPrice(item.price)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(itemId, -1)}
                          className="w-6 h-6 rounded-md bg-sand/50 hover:bg-sand flex items-center justify-center text-espresso"
                        >
                          <Minus className="w-3 h-3 stroke-[3]" />
                        </button>
                        <span className="text-xs font-black text-espresso w-4 text-center">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(itemId, 1)}
                          className="w-6 h-6 rounded-md bg-sand/50 hover:bg-sand flex items-center justify-center text-espresso"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleItem(itemId)}
                          className="w-6 h-6 ml-1 rounded-md text-brandRed hover:bg-[#FDF0F0] flex items-center justify-center"
                          title="Remove item"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Search items to add */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-espresso/40" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search menu items to add to combo..."
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-sand/20 border border-border text-xs font-semibold text-espresso focus:outline-none focus:border-orange"
              />
            </div>

            {/* Available Items List to click & select */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-border/60 rounded-xl bg-sand/10">
              {filteredAvailableItems.length === 0 ? (
                <p className="text-xs text-espresso/50 p-4 text-center sm:col-span-2">
                  No menu items found.
                </p>
              ) : (
                filteredAvailableItems.map((item) => {
                  const isSelected = selectedItems.has(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleToggleItem(item.id)}
                      className={`text-left p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                        isSelected
                          ? 'bg-[#FBEDE3] border-orange shadow-2xs'
                          : 'bg-white border-border hover:border-espresso/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <VegBadge isVeg={item.is_veg} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-espresso truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] font-semibold text-espresso/60">
                            {formatPrice(item.price)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-orange border-orange text-white'
                            : 'border-border bg-sand/30'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Under Picker: Live Helper Text */}
          <div className="p-3.5 rounded-2xl bg-[#FBEDE3]/60 border border-orange/30 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-orange">
              <Sparkles className="w-4 h-4" />
              <span>Live Pricing Helper</span>
            </div>
            <p className="text-xs font-bold text-espresso">
              Items separately:{' '}
              <span className="font-extrabold text-espresso">{formatPrice(itemsSeparately)}</span>,
              Combo price:{' '}
              <span className="font-extrabold text-orange">{formatPrice(typedPrice)}</span>,
              Customer saves:{' '}
              <span
                className={`font-black ${
                  customerSaves > 0 ? 'text-[#2F7A3E]' : 'text-espresso/70'
                }`}
              >
                {formatPrice(Math.max(0, customerSaves))}
              </span>
            </p>

            {/* Warning if combo price is not lower than items total */}
            {selectedDistinctCount >= 2 && typedPrice > 0 && customerSaves <= 0 && (
              <div className="p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-950 text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <span>
                  Warning: The combo price (₹{typedPrice}) is not lower than items separately (₹
                  {itemsSeparately}). Customers will not save on this combo, but you can still save
                  it.
                </span>
              </div>
            )}

            {/* Error helper if fewer than 2 distinct items selected */}
            {selectedDistinctCount < 2 && (
              <p className="text-[11px] font-bold text-brandRed">
                * Please select at least 2 distinct menu items to form a combo.
              </p>
            )}
          </div>

          {/* Modal Footer CTA */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-border text-xs font-bold text-espresso hover:bg-sand/40 transition-colors"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={
                submitting ||
                uploading ||
                selectedDistinctCount < 2 ||
                !name.trim() ||
                price === '' ||
                Number(price) < 0
              }
              className="h-10 px-6 text-xs font-bold shadow-orange"
            >
              {submitting
                ? 'Saving...'
                : comboToEdit
                ? 'Update Combo'
                : 'Create Combo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
