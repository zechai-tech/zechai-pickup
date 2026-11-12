'use client';

import React, { useState, useEffect } from 'react';
import { MenuItem } from '@/types/supabase';
import { Button } from '@/components/ui/Button';
import { SafeImage } from '@/components/ui/SafeImage';
import { compressAdminImage } from '@/lib/admin-image-compress';
import { DEFAULT_MENU_IMAGE } from '@/lib/images';
import { X, UtensilsCrossed, Upload, Image as ImageIcon } from 'lucide-react';

interface MenuItemFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  itemToEdit?: MenuItem | null;
  outletId: string;
}

export function MenuItemForm({
  isOpen,
  onClose,
  onSuccess,
  itemToEdit,
  outletId,
}: MenuItemFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<number | ''>(49);
  const [category, setCategory] = useState('Chai & Coffee');
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isBestseller, setIsBestseller] = useState(false);
  const [isVeg, setIsVeg] = useState(true);
  const [sortOrder, setSortOrder] = useState<number>(0);

  const [uploading, setUploading] = useState(false);
  const [uploadStats, setUploadStats] = useState<string>('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = ['Chai & Coffee', 'Coolers', 'Chicken', 'Fries', 'Snacks'];

  useEffect(() => {
    if (itemToEdit) {
      setName(itemToEdit.name);
      setDescription(itemToEdit.description || '');
      setPrice(itemToEdit.price);
      setCategory(itemToEdit.category);
      setImageUrl(itemToEdit.image_url || '');
      setIsAvailable(itemToEdit.is_available);
      setIsBestseller(itemToEdit.is_bestseller);
      setIsVeg(itemToEdit.is_veg);
      setSortOrder(itemToEdit.sort_order || 0);
    } else {
      setName('');
      setDescription('');
      setPrice(49);
      setCategory('Chai & Coffee');
      setImageUrl('');
      setIsAvailable(true);
      setIsBestseller(false);
      setIsVeg(true);
      setSortOrder(0);
    }
    setUploadStats('');
    setPreviewObjectUrl(null);
    setError('');
  }, [itemToEdit, isOpen]);

  useEffect(() => {
    return () => {
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
    };
  }, [previewObjectUrl]);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setUploadStats('');

    try {
      // Compress before upload: reject > 5 MB, resize <= 1000px, convert to WebP ~80%
      const compressed = await compressAdminImage(file);
      if (previewObjectUrl) {
        URL.revokeObjectURL(previewObjectUrl);
      }
      setPreviewObjectUrl(compressed.previewUrl);
      setUploadStats(
        `Optimized WebP: ${(compressed.originalBytes / 1024).toFixed(0)} KB → ${(compressed.compressedBytes / 1024).toFixed(1)} KB (${compressed.width}×${compressed.height})`
      );

      const formData = new FormData();
      formData.append('file', compressed.file);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setImageUrl(data.path || data.url);
    } catch (err: any) {
      setError(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || price === '') {
      setError('Name and price are required');
      return;
    }

    if (!outletId) {
      setError('Please select an outlet first');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/menu', {
        method: itemToEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: itemToEdit?.id,
          outlet_id: outletId,
          name: name.trim(),
          description: description.trim() || null,
          price: Number(price),
          category,
          image_url: imageUrl || DEFAULT_MENU_IMAGE,
          is_available: isAvailable,
          is_bestseller: isBestseller,
          is_veg: isVeg,
          sort_order: Number(sortOrder) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save menu item');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-card w-full max-w-lg rounded-[28px] border border-border shadow-2xl p-6 relative my-8 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border/70 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange/15 text-orange-dark flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-espresso">
                {itemToEdit ? 'Edit Menu Item' : 'Add Menu Item'}
              </h3>
              <p className="text-xs text-espresso/60">Configure dish details and pricing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-sand/60 hover:bg-sand flex items-center justify-center text-espresso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FDF0F0] border border-brandRed/20 text-brandRed text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Item Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Masala Chai"
                required
                className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-xs font-bold text-espresso focus:outline-none focus:border-orange"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short appetizing description..."
              className="w-full p-3 rounded-xl bg-sand/30 border border-border text-xs font-medium text-espresso focus:outline-none focus:border-orange"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Price (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-bold text-espresso focus:outline-none focus:border-orange"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Sort Order
              </label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-bold text-espresso focus:outline-none focus:border-orange"
              />
            </div>
          </div>

          {/* Image Upload Row */}
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              Photo
            </label>
            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-sand/60 border border-border shrink-0 flex items-center justify-center">
                {previewObjectUrl || imageUrl ? (
                  <SafeImage
                    src={previewObjectUrl || imageUrl}
                    alt="Preview"
                    variant="thumb"
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                ) : (
                  <ImageIcon className="w-6 h-6 text-espresso/40" />
                )}
              </div>
              <div className="flex-1">
                <label className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sand/40 hover:bg-sand border border-border text-xs font-bold text-espresso transition-colors">
                  <Upload className="w-3.5 h-3.5 text-orange" />
                  <span>{uploading ? 'Compressing & Uploading...' : 'Upload Image (Max 5 MB)'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {uploadStats && (
                  <p className="text-[10px] font-bold text-[#2F7A3E] mt-1">{uploadStats}</p>
                )}
                <input
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Or enter image path (/assets/chai.v1.webp)"
                  className="w-full mt-1.5 px-3 py-1.5 rounded-lg bg-sand/20 border border-border text-[11px] font-medium text-espresso"
                />
              </div>
            </div>
          </div>

          {/* Toggles Row */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-sand/20 cursor-pointer text-xs font-bold text-espresso select-none">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded accent-orange w-4 h-4"
              />
              <span>Available</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-sand/20 cursor-pointer text-xs font-bold text-espresso select-none">
              <input
                type="checkbox"
                checked={isBestseller}
                onChange={(e) => setIsBestseller(e.target.checked)}
                className="rounded accent-orange w-4 h-4"
              />
              <span>Bestseller</span>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-sand/20 cursor-pointer text-xs font-bold text-espresso select-none">
              <input
                type="checkbox"
                checked={isVeg}
                onChange={(e) => setIsVeg(e.target.checked)}
                className="rounded accent-orange w-4 h-4"
              />
              <span>Veg Item</span>
            </label>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full border border-border font-bold text-xs text-espresso hover:bg-sand/40"
            >
              Cancel
            </button>
            <Button type="submit" isLoading={loading} className="h-11 px-6 text-sm font-bold shadow-orange">
              {itemToEdit ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
