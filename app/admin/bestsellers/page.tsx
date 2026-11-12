'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { SafeImage } from '@/components/ui/SafeImage';
import { VegBadge } from '@/components/ui/VegBadge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_MENU_IMAGE } from '@/lib/images';
import { FIXED_MENU_CATEGORIES, MAX_BESTSELLERS } from '@/lib/menu-categories';
import { Outlet } from '@/types/supabase';
import { formatPrice, cn } from '@/lib/utils';
import {
  Star,
  Store,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  Search,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';

interface PortalItemRow {
  id: string;
  outlet_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  image_url: string | null;
  is_available: boolean;
  is_veg: boolean;
}

export default function PortalBestsellersPage() {
  const { currentUser, sessionToken, selectedOutletId, setSelectedOutletId, syncTrigger } =
    useAdminStore();
  const { showToast } = useToast();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [bestsellers, setBestsellers] = useState<PortalItemRow[]>([]);
  const [outletItems, setOutletItems] = useState<PortalItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Picker modal / bottom-sheet state
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerDraftIds, setPickerDraftIds] = useState<string[]>([]);

  const activeOutletId = isAdmin
    ? selectedOutletId || (outlets.length > 0 ? outlets[0].id : '')
    : currentUser?.outlet_id || '';

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || sessionToken || null;
  }, [sessionToken]);

  // Load outlets for Admin selector
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/admin/outlets', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        const list = d.outlets || [];
        setOutlets(list);
        if (!selectedOutletId && list.length > 0) {
          setSelectedOutletId(list[0].id);
        }
      })
      .catch((err) => console.error('Error loading Portal outlets:', err));
  }, [isAdmin, selectedOutletId, setSelectedOutletId]);

  // Load bestsellers and outlet items from server route
  const fetchBestsellersData = useCallback(async () => {
    if (!activeOutletId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Missing Portal session token');

      const res = await fetch(
        `/api/admin/bestsellers?outlet_id=${encodeURIComponent(activeOutletId)}`,
        {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load bestsellers');
      }

      setBestsellers(data.bestsellers || []);
      setOutletItems(data.outlet_items || []);
    } catch (err: any) {
      console.error('Portal bestsellers fetch error:', err);
      showToast(err?.message || 'Failed to load Portal bestsellers', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeOutletId, getToken, showToast]);

  useEffect(() => {
    if (activeOutletId) {
      fetchBestsellersData();
    }
  }, [activeOutletId, fetchBestsellersData, syncTrigger]);

  // Persist ordered list optimistically with rollback & error toast
  const persistOrder = async (nextList: PortalItemRow[], successMessage?: string) => {
    if (!activeOutletId) return false;
    const prevList = bestsellers;
    setBestsellers(nextList);
    setSaving(true);

    try {
      const token = await getToken();
      if (!token) throw new Error('Missing Portal session token');

      const res = await fetch('/api/admin/bestsellers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          outlet_id: activeOutletId,
          item_ids: nextList.map((i) => i.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save bestsellers');
      }

      setBestsellers(data.bestsellers || nextList);
      if (successMessage) {
        showToast(successMessage, 'success');
      }
      return true;
    } catch (err: any) {
      setBestsellers(prevList);
      showToast(err?.message || 'Could not save Portal bestsellers', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleMove = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    if (targetIdx < 0 || targetIdx >= bestsellers.length) return;
    const next = [...bestsellers];
    const [moved] = next.splice(index, 1);
    next.splice(targetIdx, 0, moved);
    persistOrder(next, 'Updated bestseller order');
  };

  const handleRemove = (item: PortalItemRow) => {
    const next = bestsellers.filter((b) => b.id !== item.id);
    persistOrder(next, `Removed "${item.name}" from bestsellers`);
  };

  const handleOpenPicker = () => {
    setPickerDraftIds(bestsellers.map((b) => b.id));
    setPickerSearch('');
    setIsPickerOpen(true);
  };

  const handleTogglePickerItem = (item: PortalItemRow) => {
    if (!item.is_available) return;
    setPickerDraftIds((curr) => {
      if (curr.includes(item.id)) {
        return curr.filter((id) => id !== item.id);
      }
      if (curr.length >= MAX_BESTSELLERS) {
        showToast(`Maximum ${MAX_BESTSELLERS} bestsellers per outlet reached`, 'info');
        return curr;
      }
      return [...curr, item.id];
    });
  };

  const handleConfirmPicker = async () => {
    const itemById = new Map(outletItems.map((i) => [i.id, i]));
    const nextList = pickerDraftIds
      .map((id) => itemById.get(id))
      .filter((item): item is PortalItemRow => Boolean(item && item.is_available))
      .slice(0, MAX_BESTSELLERS);

    setIsPickerOpen(false);
    await persistOrder(nextList, 'Saved Portal bestsellers');
  };

  // Group outlet items by fixed categories (+ uncategorized at bottom if any)
  const groupedPickerSections = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    const matching = outletItems.filter((item) => {
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    });

    const sections: Array<{ title: string; items: PortalItemRow[] }> = [];
    for (const cat of FIXED_MENU_CATEGORIES) {
      const catItems = matching.filter((i) => i.category === cat.name);
      if (catItems.length > 0) {
        sections.push({ title: cat.name, items: catItems });
      }
    }

    const noCatItems = matching.filter((i) => !i.category);
    if (noCatItems.length > 0) {
      sections.push({ title: 'No category', items: noCatItems });
    }

    return sections;
  }, [outletItems, pickerSearch]);

  const atLimit = bestsellers.length >= MAX_BESTSELLERS;
  const draftAtLimit = pickerDraftIds.length >= MAX_BESTSELLERS;

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6 max-w-5xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
                Bestsellers
              </h1>
              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-black tabular-nums border',
                  atLimit
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-sand text-espresso border-border'
                )}
              >
                {bestsellers.length} / {MAX_BESTSELLERS}
              </span>
              {!isAdmin && (
                <span className="text-[11px] font-bold bg-sand px-2.5 py-0.5 rounded-full text-espresso/80">
                  {currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Branch'}
                </span>
              )}
            </div>
            <p className="text-xs text-espresso/60 mt-0.5">
              Curate up to {MAX_BESTSELLERS} per-outlet bestsellers shown first on the customer menu
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
              onClick={handleOpenPicker}
              disabled={!activeOutletId || loading}
              className="h-11 px-5 text-sm font-bold shadow-orange"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span>Add bestsellers</span>
            </Button>
          </div>
        </div>

        {/* Limit Reached Message */}
        {atLimit && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700" />
            <span>
              Maximum of {MAX_BESTSELLERS} bestsellers reached for this outlet. Remove one to add another.
            </span>
          </div>
        )}

        {/* Current Bestsellers List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-20 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : bestsellers.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Star className="w-12 h-12 text-espresso/25 mx-auto mb-3" />
            <h3 className="font-display font-black text-lg text-espresso mb-1">
              No bestsellers selected for this outlet
            </h3>
            <p className="text-xs text-espresso/60 max-w-xs mx-auto mb-4">
              Choose up to {MAX_BESTSELLERS} existing menu items from this branch to feature in the
              Bestsellers carousel.
            </p>
            <Button onClick={handleOpenPicker} className="h-10 px-5 text-xs font-bold shadow-orange">
              <Plus className="w-4 h-4 mr-2" />
              <span>Add bestsellers</span>
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border divide-y divide-border/60 overflow-hidden shadow-xs">
            {bestsellers.map((item, idx) => (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-sand/15 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 text-center font-display font-black text-xs text-espresso/50 shrink-0 tabular-nums">
                    #{idx + 1}
                  </span>
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-sand/40 shrink-0 border border-border/60">
                    <SafeImage
                      src={item.image_url || DEFAULT_MENU_IMAGE}
                      alt={item.name}
                      variant="thumb"
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <VegBadge isVeg={item.is_veg} size="sm" />
                      <h3 className="font-bold text-sm text-espresso truncate">{item.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-extrabold text-xs text-espresso">
                        {formatPrice(Number(item.price))}
                      </span>
                      {item.category ? (
                        <span className="text-[11px] font-bold text-espresso/60">
                          · {item.category}
                        </span>
                      ) : (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full">
                          No category
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reorder + Remove Controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(idx, -1)}
                    disabled={idx === 0 || saving}
                    aria-label={`Move ${item.name} up`}
                    className="p-2 rounded-xl border border-border bg-card hover:bg-sand/50 text-espresso disabled:opacity-35 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(idx, 1)}
                    disabled={idx === bestsellers.length - 1 || saving}
                    aria-label={`Move ${item.name} down`}
                    className="p-2 rounded-xl border border-border bg-card hover:bg-sand/50 text-espresso disabled:opacity-35 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    disabled={saving}
                    aria-label={`Remove ${item.name} from bestsellers`}
                    className="p-2 rounded-xl border border-border bg-card hover:bg-[#FDF0F0] text-espresso/60 hover:text-brandRed disabled:opacity-35 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Picker Modal / Mobile Bottom Sheet */}
        {isPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-espresso/60 backdrop-blur-xs sm:p-4 animate-in fade-in duration-150">
            <div className="bg-card w-full sm:max-w-lg rounded-t-[28px] sm:rounded-[28px] border border-border shadow-2xl flex flex-col max-h-[88dvh] overflow-hidden">
              {/* Sheet Header */}
              <div className="p-5 pb-3 border-b border-border/70 flex items-center justify-between gap-3 shrink-0">
                <div>
                  <h2 className="font-display font-black text-lg text-espresso">
                    Add bestsellers
                  </h2>
                  <p className="text-xs text-espresso/60">
                    Tick existing outlet items ({pickerDraftIds.length} / {MAX_BESTSELLERS})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="w-9 h-9 rounded-full bg-sand/60 hover:bg-sand flex items-center justify-center text-espresso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Input + Limit Warning */}
              <div className="px-5 pt-3 pb-2 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 text-espresso/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search outlet items…"
                    className="w-full h-10 pl-10 pr-3 rounded-xl bg-sand/30 border border-border text-xs font-semibold text-espresso focus:outline-none focus:border-orange"
                  />
                </div>
                {draftAtLimit && (
                  <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                    Limit reached ({MAX_BESTSELLERS} / {MAX_BESTSELLERS}). Untick an item to pick another.
                  </p>
                )}
              </div>

              {/* Grouped Items List */}
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-2 space-y-4">
                {groupedPickerSections.length === 0 ? (
                  <div className="py-10 text-center text-xs text-espresso/60">
                    No matching items in this outlet.
                  </div>
                ) : (
                  groupedPickerSections.map((sec) => (
                    <div key={sec.title} className="space-y-1.5">
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-espresso/60 px-1">
                        {sec.title}
                      </h3>
                      <div className="rounded-2xl border border-border divide-y divide-border/50 overflow-hidden bg-cream/40">
                        {sec.items.map((item) => {
                          const isChecked = pickerDraftIds.includes(item.id);
                          const isDisabled = !item.is_available || (!isChecked && draftAtLimit);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => handleTogglePickerItem(item)}
                              className={cn(
                                'w-full text-left p-3 flex items-center justify-between gap-3 transition-colors',
                                isChecked
                                  ? 'bg-orange/10'
                                  : 'hover:bg-sand/30',
                                isDisabled && 'opacity-50 cursor-not-allowed'
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-sand/40 shrink-0">
                                  <SafeImage
                                    src={item.image_url || DEFAULT_MENU_IMAGE}
                                    alt={item.name}
                                    variant="thumb"
                                    fill
                                    sizes="44px"
                                    className="object-cover"
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <VegBadge isVeg={item.is_veg} size="sm" />
                                    <span className="font-bold text-xs text-espresso truncate">
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-extrabold text-espresso/75">
                                      {formatPrice(Number(item.price))}
                                    </span>
                                    {!item.is_available && (
                                      <span className="text-[10px] font-bold text-brandRed">
                                        Out of stock
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div
                                className={cn(
                                  'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                                  isChecked
                                    ? 'bg-orange border-orange text-white'
                                    : 'border-border bg-card'
                                )}
                              >
                                {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Sticky Sheet Footer */}
              <div className="p-4 border-t border-border bg-card flex items-center gap-2.5 shrink-0 pb-[max(16px,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="flex-1 h-11 rounded-full border border-border font-bold text-xs text-espresso hover:bg-sand/40"
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  onClick={handleConfirmPicker}
                  isLoading={saving}
                  className="flex-1 h-11 text-xs font-bold shadow-orange"
                >
                  Confirm ({pickerDraftIds.length} / {MAX_BESTSELLERS})
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
