'use client';

import React, { useState, useEffect } from 'react';
import { Outlet } from '@/types/supabase';
import { Button } from '@/components/ui/Button';
import { X, Store } from 'lucide-react';

interface OutletFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  outletToEdit?: Outlet | null;
}

export function OutletForm({ isOpen, onClose, onSuccess, outletToEdit }: OutletFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [openingTime, setOpeningTime] = useState('15:00');
  const [closingTime, setClosingTime] = useState('00:00');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (outletToEdit) {
      setName(outletToEdit.name);
      setAddress(outletToEdit.address || '');
      setPhone(outletToEdit.phone || '');
      setOpeningTime(outletToEdit.opening_time ? outletToEdit.opening_time.slice(0, 5) : '15:00');
      setClosingTime(outletToEdit.closing_time ? outletToEdit.closing_time.slice(0, 5) : '00:00');
      setIsActive(outletToEdit.is_active);
    } else {
      setName('');
      setAddress('');
      setPhone('');
      setOpeningTime('15:00');
      setClosingTime('00:00');
      setIsActive(true);
    }
    setError('');
  }, [outletToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Outlet name is required');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) {
      setError('Outlet mobile number is required');
      return;
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Outlet mobile number must be exactly 10 digits starting with 6, 7, 8, or 9');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/outlets', {
        method: outletToEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: outletToEdit?.id,
          name: name.trim(),
          address: address.trim() || null,
          phone: cleanPhone,
          opening_time: openingTime,
          closing_time: closingTime,
          is_active: isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save outlet');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs">
      <div className="bg-card w-full max-w-md rounded-[28px] border border-border shadow-2xl p-6 relative animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border/70 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange/15 text-orange-dark flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-lg text-espresso">
                {outletToEdit ? 'Edit Outlet' : 'Add New Outlet'}
              </h3>
              <p className="text-xs text-espresso/60">Configure store operating details</p>
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
          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              Outlet Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zécha! Kozhikode Beach"
              required
              className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              Address / Location
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Near South Beach, Beach Road, Calicut"
              className="w-full h-11 px-3.5 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
              OUTLET MOBILE NUMBER *
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-bold text-espresso/60 select-none">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                required
                maxLength={10}
                className="w-full h-11 pl-12 pr-3.5 rounded-xl bg-sand/30 border border-border text-sm font-semibold text-espresso focus:outline-none focus:border-orange font-mono"
              />
            </div>
            <p className="text-[11px] text-espresso/60 mt-1">
              Customers will call this number
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Opening Time
              </label>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-sand/30 border border-border text-sm font-bold text-espresso focus:outline-none focus:border-orange"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-espresso uppercase tracking-wider mb-1">
                Closing Time
              </label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-sand/30 border border-border text-sm font-bold text-espresso focus:outline-none focus:border-orange"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between p-3 rounded-xl bg-sand/30 border border-border">
            <div>
              <span className="text-xs font-bold text-espresso block">Active Status</span>
              <span className="text-[11px] text-espresso/60">Customers can order when active</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brandGreen"></div>
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
              {outletToEdit ? 'Save Changes' : 'Create Outlet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
