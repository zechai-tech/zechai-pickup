'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { useAdminStore } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { MenuItem, Outlet } from '@/types/supabase';
import { MenuItemForm } from '@/components/admin/MenuItemForm';
import { Button } from '@/components/ui/Button';
import { VegBadge } from '@/components/ui/VegBadge';
import { formatPrice } from '@/lib/utils';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Store,
  Sparkles,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminMenuPage() {
  const { currentUser, selectedOutletId, setSelectedOutletId, syncTrigger } = useAdminStore();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<MenuItem | null>(null);

  // Active outlet id
  const activeOutletId = isAdmin
    ? selectedOutletId || (outlets.length > 0 ? outlets[0].id : '')
    : currentUser?.outlet_id || '';

  // Fetch Outlets
  useEffect(() => {
    async function loadOutlets() {
      try {
        const res = await fetch('/api/admin/outlets');
        const data = await res.json();
        const list = data.outlets || [];
        setOutlets(list);
        if (isAdmin && !selectedOutletId && list.length > 0) {
          setSelectedOutletId(list[0].id);
        }
      } catch (e) {
        console.error('Error fetching outlets:', e);
      }
    }
    loadOutlets();
  }, [isAdmin, selectedOutletId, setSelectedOutletId]);

  // Fetch Menu Items for active outlet
  const fetchMenuItems = useCallback(async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menu?outlet_id=${activeOutletId}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error('Error fetching menu items:', e);
    } finally {
      setLoading(false);
    }
  }, [activeOutletId]);

  useEffect(() => {
    if (activeOutletId) {
      fetchMenuItems();
    }
  }, [activeOutletId, fetchMenuItems, syncTrigger]);

  // Quick toggle availability
  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      const nextAvailable = !item.is_available;
      const res = await fetch('/api/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          is_available: nextAvailable,
        }),
      });
      if (res.ok) {
        fetchMenuItems();
      }
    } catch (e) {
      console.error('Error toggling availability:', e);
    }
  };

  // Quick toggle bestseller
  const handleToggleBestseller = async (item: MenuItem) => {
    try {
      const nextBestseller = !item.is_bestseller;
      const res = await fetch('/api/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          is_bestseller: nextBestseller,
        }),
      });
      if (res.ok) {
        fetchMenuItems();
      }
    } catch (e) {
      console.error('Error toggling bestseller:', e);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`/api/admin/menu?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchMenuItems();
      }
    } catch (e) {
      console.error('Error deleting menu item:', e);
    }
  };

  const handleOpenAdd = () => {
    setItemToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: MenuItem) => {
    setItemToEdit(item);
    setIsModalOpen(true);
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header & Outlet Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
                Menu & Catalog Management
              </h1>
              {!isAdmin && (
                <span className="text-[11px] font-bold bg-sand px-2.5 py-0.5 rounded-full text-espresso/80">
                  {currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Branch'}
                </span>
              )}
            </div>
            <p className="text-xs text-espresso/60 mt-0.5">
              Configure dishes, prices, photos, and instant out-of-stock toggles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Admin Outlet Picker */}
            {isAdmin && outlets.length > 0 && (
              <div className="flex items-center gap-2 bg-card p-1.5 px-3 rounded-2xl border border-border">
                <Store className="w-4 h-4 text-orange shrink-0" />
                <select
                  value={activeOutletId}
                  onChange={(e) => setSelectedOutletId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-espresso focus:outline-none cursor-pointer"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              onClick={handleOpenAdd}
              disabled={!activeOutletId}
              className="h-11 px-5 text-sm font-bold shadow-orange"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Add Item</span>
            </Button>
          </div>
        </div>

        {/* Content View: Desktop Grid Cards / Mobile Compact List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-64 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-espresso/30 mx-auto mb-3" />
            <h3 className="font-display font-black text-lg text-espresso mb-1">
              No menu items for this outlet
            </h3>
            <p className="text-xs text-espresso/60 max-w-xs mx-auto mb-4">
              Add signature chais, coolers, and fried bites to start serving customers.
            </p>
            <Button onClick={handleOpenAdd} className="h-10 px-5 text-xs font-bold shadow-orange">
              <Plus className="w-4 h-4 mr-2" />
              <span>Add First Item</span>
            </Button>
          </div>
        ) : (
          <>
            {/* 1. Desktop Grid Cards (Hidden on mobile) */}
            <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'bg-card rounded-2xl border border-border overflow-hidden flex flex-col justify-between shadow-xs transition-all hover:border-orange/40',
                    !item.is_available && 'opacity-65 grayscale-[30%]'
                  )}
                >
                  {/* Photo with badges */}
                  <div className="relative w-full h-36 bg-sand/30 overflow-hidden">
                    <Image
                      src={item.image_url || '/assets/chai.jpg'}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <VegBadge isVeg={item.is_veg} size="sm" />
                      {item.is_bestseller && (
                        <span className="bg-mustard text-espresso text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs">
                          BESTSELLER
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs',
                          item.is_available
                            ? 'bg-[#EBF7EE] text-brandGreen border border-brandGreen/30'
                            : 'bg-[#FDF0F0] text-brandRed border border-brandRed/30'
                        )}
                      >
                        {item.is_available ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <h3 className="font-bold text-sm text-espresso line-clamp-1">{item.name}</h3>
                        <span className="font-display font-black text-sm text-espresso shrink-0">
                          {formatPrice(Number(item.price))}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange block mb-1">
                        {item.category}
                      </span>
                      <p className="text-xs text-espresso/60 line-clamp-2 leading-relaxed">
                        {item.description || 'No description provided.'}
                      </p>
                    </div>

                    {/* Actions row */}
                    <div className="pt-3 mt-3 border-t border-border/70 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleAvailability(item)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1',
                          item.is_available
                            ? 'bg-sand/40 hover:bg-[#FDF0F0] text-espresso/70 hover:text-brandRed'
                            : 'bg-[#EBF7EE] text-brandGreen hover:bg-[#d8eedc]'
                        )}
                      >
                        {item.is_available ? (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Set Sold Out</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Set In Stock</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleBestseller(item)}
                          className={cn(
                            'p-1.5 rounded-lg transition-colors',
                            item.is_bestseller
                              ? 'bg-mustard/30 text-[#8B6400]'
                              : 'hover:bg-sand/60 text-espresso/40 hover:text-mustard'
                          )}
                          title={item.is_bestseller ? 'Remove from Bestsellers' : 'Mark as Bestseller'}
                        >
                          <Star className={cn('w-3.5 h-3.5', item.is_bestseller ? 'fill-mustard text-[#8B6400]' : '')} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-sand/60 text-espresso/70 hover:text-espresso transition-colors"
                          title="Edit item"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="p-1.5 rounded-lg hover:bg-[#FDF0F0] text-espresso/40 hover:text-brandRed transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 2. Mobile Compact List (Shown on mobile) */}
            <div className="sm:hidden space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="bg-card rounded-2xl border border-border p-3 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-sand/30 shrink-0">
                    <Image
                      src={item.image_url || '/assets/chai.jpg'}
                      alt={item.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <VegBadge isVeg={item.is_veg} size="sm" />
                      <h3 className="font-bold text-xs text-espresso truncate">{item.name}</h3>
                    </div>
                    <span className="text-[10px] text-orange font-bold uppercase block">
                      {item.category}
                    </span>
                    <span className="font-extrabold text-xs text-espresso mt-0.5 block">
                      {formatPrice(Number(item.price))}
                    </span>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      onClick={() => handleToggleAvailability(item)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold',
                        item.is_available
                          ? 'bg-[#EBF7EE] text-brandGreen'
                          : 'bg-[#FDF0F0] text-brandRed'
                      )}
                    >
                      {item.is_available ? 'Available' : 'Sold Out'}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleBestseller(item)}
                        className={cn(
                          'p-1 rounded transition-colors',
                          item.is_bestseller
                            ? 'bg-mustard/30 text-[#8B6400]'
                            : 'bg-sand/40 text-espresso/40'
                        )}
                        title="Toggle Bestseller"
                      >
                        <Star className={cn('w-3 h-3', item.is_bestseller ? 'fill-mustard text-[#8B6400]' : '')} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1 rounded bg-sand/40 text-espresso"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        className="p-1 rounded bg-sand/40 text-brandRed"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Menu Item Form Modal */}
        <MenuItemForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchMenuItems}
          itemToEdit={itemToEdit}
          outletId={activeOutletId}
        />
      </div>
    </RoleGuard>
  );
}
