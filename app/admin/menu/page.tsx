'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { SafeImage } from '@/components/ui/SafeImage';
import { DEFAULT_MENU_IMAGE } from '@/lib/images';
import { FIXED_MENU_CATEGORIES } from '@/lib/menu-categories';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { MenuItem, MenuTheme, Outlet } from '@/types/supabase';
import { Combo } from '@/types';
import { MenuItemForm } from '@/components/admin/MenuItemForm';
import { ComboForm } from '@/components/admin/ComboForm';
import { DeleteMenuConfirmModal, AffectedCombo } from '@/components/admin/DeleteMenuConfirmModal';
import { Button } from '@/components/ui/Button';
import { VegBadge } from '@/components/ui/VegBadge';
import { useToast } from '@/components/ui/Toast';
import { formatPrice, cn } from '@/lib/utils';
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Store,
  AlertTriangle,
  Palette,
  Eye,
  X,
  Check,
  ChevronDown,
  Sparkles,
  Package,
} from 'lucide-react';

type CategoryFilter = 'all' | 'no-category' | string;

export default function AdminMenuPage() {
  const router = useRouter();
  const { currentUser, sessionToken, selectedOutletId, setSelectedOutletId, syncTrigger } =
    useAdminStore();
  const { showToast } = useToast();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const canManageTheme = isAdmin || currentUser?.role === 'manager';

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || sessionToken || null;
  }, [sessionToken]);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<MenuItem | null>(null);
  const [isComboModalOpen, setIsComboModalOpen] = useState(false);
  const [comboToEdit, setComboToEdit] = useState<Combo | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // Menu Theme picker & preview state
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const [applyThemeToAll, setApplyThemeToAll] = useState(false);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const themePickerRef = useRef<HTMLDivElement>(null);

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: 'item' | 'combo';
    scope: 'all' | 'single';
    outletsCount: number;
    outletName?: string;
    affectedCombos: AffectedCombo[];
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAllOutlets = isAdmin && selectedOutletId === 'all';
  const activeOutletId = isAdmin
    ? selectedOutletId || 'all'
    : currentUser?.outlet_id || '';

  const activeOutlet = useMemo(
    () => (isAllOutlets ? null : outlets.find((o) => o.id === activeOutletId) || null),
    [outlets, activeOutletId, isAllOutlets]
  );
  const activeMenuTheme: MenuTheme = activeOutlet?.menu_theme === 'grid' ? 'grid' : 'classic';

  useEffect(() => {
    async function loadOutlets() {
      try {
        const res = await fetch('/api/admin/outlets', { cache: 'no-store' });
        const data = await res.json();
        const list = data.outlets || [];
        setOutlets(list);
        if (isAdmin && !selectedOutletId) {
          setSelectedOutletId('all');
        }
      } catch (e) {
        console.error('Error fetching outlets:', e);
      }
    }
    loadOutlets();
  }, [isAdmin, selectedOutletId, setSelectedOutletId]);

  const fetchMenuItems = useCallback(async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/menu?outlet_id=${encodeURIComponent(activeOutletId)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error('Error fetching menu items:', e);
    } finally {
      setLoading(false);
    }
  }, [activeOutletId]);

  const fetchCombos = useCallback(async () => {
    if (!activeOutletId) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/combos?outlet_id=${encodeURIComponent(activeOutletId)}`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setCombos(data.combos || []);
    } catch (e) {
      console.error('Error fetching combos:', e);
    }
  }, [activeOutletId, getToken]);

  useEffect(() => {
    if (activeOutletId) {
      fetchMenuItems();
      fetchCombos();
    }
  }, [activeOutletId, fetchMenuItems, fetchCombos, syncTrigger]);

  const noCategoryCount = useMemo(
    () => items.filter((item) => !item.category).length,
    [items]
  );

  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return items;
    if (categoryFilter === 'no-category') {
      return items.filter((item) => !item.category);
    }
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  const handleToggleAvailability = async (item: MenuItem) => {
    const prevItems = items;
    const nextAvailable = !item.is_available;
    setItems((curr) =>
      curr.map((i) => (i.id === item.id ? { ...i, is_available: nextAvailable } : i))
    );

    try {
      const res = await fetch('/api/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          is_available: nextAvailable,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to update availability');
      }
      showToast(
        `${item.name} marked ${nextAvailable ? 'In Stock' : 'Out of Stock'}`,
        'success'
      );
    } catch (e: any) {
      setItems(prevItems);
      showToast(e?.message || 'Could not update availability', 'error');
    }
  };

  const handleInlineCategoryChange = async (item: MenuItem, nextCategory: string) => {
    if (!nextCategory || nextCategory === item.category) return;
    const prevItems = items;
    setItems((curr) =>
      curr.map((i) => (i.id === item.id ? { ...i, category: nextCategory } : i))
    );

    try {
      const res = await fetch('/api/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          category: nextCategory,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update category');
      }
      showToast(`Assigned "${item.name}" to ${nextCategory}`, 'success');
    } catch (e: any) {
      setItems(prevItems);
      showToast(e?.message || 'Failed to assign category', 'error');
    }
  };

  const handleDelete = async (item: MenuItem) => {
    const scope = isAllOutlets ? 'all' : 'single';

    try {
      const token = await getToken();
      const res = await fetch(
        `/api/admin/menu/delete-impact?id=${encodeURIComponent(item.id)}&scope=${scope}&outlet_id=${encodeURIComponent(activeOutletId || '')}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Failed to check delete impact', 'error');
        return;
      }

      setDeleteTarget({
        id: item.id,
        name: data.itemName || item.name,
        type: 'item',
        scope: data.scope,
        outletsCount: data.outletsCount || 1,
        outletName: data.outletName || activeOutlet?.name,
        affectedCombos: data.affectedCombos || [],
      });
      setDeleteModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || 'Error checking delete impact', 'error');
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

  const handleOpenAddCombo = () => {
    setComboToEdit(null);
    setIsComboModalOpen(true);
  };

  const handleOpenEditCombo = (combo: Combo) => {
    setComboToEdit(combo);
    setIsComboModalOpen(true);
  };

  const handleDeleteCombo = async (combo: Combo) => {
    const scope = isAllOutlets ? 'all' : 'single';

    try {
      const token = await getToken();
      const res = await fetch(
        `/api/admin/combos/delete-impact?id=${encodeURIComponent(combo.id)}&scope=${scope}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Failed to check delete impact', 'error');
        return;
      }

      setDeleteTarget({
        id: combo.id,
        name: data.comboName || combo.name,
        type: 'combo',
        scope: data.scope,
        outletsCount: data.outletsCount || 1,
        outletName: data.outletName || activeOutlet?.name,
        affectedCombos: [],
      });
      setDeleteModalOpen(true);
    } catch (err: any) {
      showToast(err?.message || 'Error checking delete impact', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const token = await getToken();
      const endpoint = deleteTarget.type === 'combo' ? '/api/admin/combos' : '/api/admin/menu';
      const res = await fetch(
        `${endpoint}?id=${encodeURIComponent(deleteTarget.id)}&scope=${deleteTarget.scope}&outlet_id=${encodeURIComponent(activeOutletId || '')}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to delete');
      }

      showToast(data.message || `Deleted "${deleteTarget.name}"`, 'success');
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      await fetchMenuItems();
      await fetchCombos();
    } catch (err: any) {
      showToast(err?.message || 'Delete failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setIsThemePickerOpen(false);
      }
    };
    if (isThemePickerOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isThemePickerOpen]);

  const handleSelectMenuTheme = async (nextTheme: MenuTheme) => {
    if (!canManageTheme || isSavingTheme) return;
    if (!applyThemeToAll && !activeOutletId) return;

    const prevOutlets = outlets;
    // Optimistic update
    setOutlets((curr) =>
      curr.map((o) =>
        applyThemeToAll || o.id === activeOutletId ? { ...o, menu_theme: nextTheme } : o
      )
    );
    setPreviewRefreshKey((k) => k + 1);
    setIsSavingTheme(true);

    try {
      const token = await getToken();
      if (!token) {
        setOutlets(prevOutlets);
        setPreviewRefreshKey((k) => k + 1);
        showToast('Session expired, please log in again', 'error');
        router.push('/admin/login');
        return;
      }

      const res = await fetch('/api/admin/outlets/menu-theme', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          outlet_id: activeOutletId,
          menu_theme: nextTheme,
          apply_to_all: isAdmin ? applyThemeToAll : false,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        setOutlets(prevOutlets);
        setPreviewRefreshKey((k) => k + 1);
        showToast('Session expired, please log in again', 'error');
        router.push('/admin/login');
        return;
      }

      if (res.status === 403) {
        setOutlets(prevOutlets);
        setPreviewRefreshKey((k) => k + 1);
        showToast(data.error || "You don't have permission to perform this action", 'error');
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update menu theme');
      }

      showToast('Menu theme updated. Customers will see it within a few seconds.', 'success');
    } catch (err: any) {
      setOutlets(prevOutlets);
      setPreviewRefreshKey((k) => k + 1);
      showToast(err?.message || 'Could not update menu theme', 'error');
    } finally {
      setIsSavingTheme(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header & Outlet Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
                Menu Items
              </h1>
              {!isAdmin && (
                <span className="text-[11px] font-bold bg-sand px-2.5 py-0.5 rounded-full text-espresso/80">
                  {currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Branch'}
                </span>
              )}
            </div>
            <p className="text-xs text-espresso/60 mt-0.5">
              Assign fixed categories, update pricing, and toggle availability in the Portal
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
                  <option value="all">All Outlets</option>
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

            {isAdmin && (
              <Button
                onClick={handleOpenAddCombo}
                disabled={!activeOutletId}
                className="h-11 px-5 text-sm font-bold bg-[#2B1A12] text-[#FDFBEA] hover:bg-[#2B1A12]/90 shadow-xs"
              >
                <Sparkles className="w-4 h-4 mr-2 text-orange" />
                <span>Add Combo</span>
              </Button>
            )}
          </div>
        </div>

        {/* Category Filter Bar ("All", "No category", and fixed category dropdown) */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs font-bold transition-colors',
              categoryFilter === 'all'
                ? 'bg-espresso text-cream'
                : 'bg-card border border-border text-espresso hover:bg-sand/40'
            )}
          >
            All ({items.length})
          </button>

          <button
            type="button"
            onClick={() => setCategoryFilter('no-category')}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs font-bold transition-colors flex items-center gap-1.5',
              categoryFilter === 'no-category'
                ? 'bg-amber-600 text-white'
                : noCategoryCount > 0
                ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200/70'
                : 'bg-card border border-border text-espresso/70 hover:bg-sand/40'
            )}
          >
            {noCategoryCount > 0 && <AlertTriangle className="w-3.5 h-3.5" />}
            <span>No category ({noCategoryCount})</span>
          </button>

          <select
            value={categoryFilter !== 'all' && categoryFilter !== 'no-category' ? categoryFilter : ''}
            onChange={(e) => setCategoryFilter(e.target.value || 'all')}
            aria-label="Filter by category"
            className="h-9 px-3 rounded-full bg-card border border-border text-xs font-bold text-espresso focus:outline-none focus:border-orange"
          >
            <option value="">Filter by category…</option>
            {FIXED_MENU_CATEGORIES.map((cat) => (
              <option key={cat.slug} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>

          {canManageTheme && (
            <div className="relative" ref={themePickerRef}>
              <button
                type="button"
                data-testid="menu-theme-button"
                onClick={() => setIsThemePickerOpen((o) => !o)}
                className={cn(
                  'h-9 px-3.5 rounded-full border text-xs font-bold flex items-center gap-1.5 transition-colors',
                  isThemePickerOpen
                    ? 'bg-espresso text-cream border-espresso'
                    : 'bg-card border-border text-espresso hover:bg-sand/40'
                )}
              >
                <Palette className="w-3.5 h-3.5 text-orange" />
                <span>Menu Theme: {activeMenuTheme === 'grid' ? 'Grid' : 'Classic'}</span>
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 transition-transform',
                    isThemePickerOpen && 'rotate-180'
                  )}
                />
              </button>

              {isThemePickerOpen && (
                <div
                  data-testid="menu-theme-picker"
                  className="absolute left-0 top-11 z-40 w-[300px] sm:w-[320px] bg-card rounded-2xl border border-border shadow-xl p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-espresso">
                      Customer Menu Theme
                    </span>
                    <button
                      type="button"
                      data-testid="menu-theme-preview-btn"
                      onClick={() => {
                        setIsThemePickerOpen(false);
                        setIsPreviewOpen(true);
                      }}
                      disabled={!activeOutletId}
                      className="px-2.5 py-1 rounded-full bg-sand/70 hover:bg-sand text-[11px] font-extrabold text-espresso flex items-center gap-1 transition-colors disabled:opacity-50"
                    >
                      <Eye className="w-3 h-3 text-orange" />
                      <span>Preview</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Classic Option Card */}
                    <button
                      type="button"
                      data-testid="menu-theme-option-classic"
                      onClick={() => handleSelectMenuTheme('classic')}
                      disabled={isSavingTheme}
                      className={cn(
                        'text-left rounded-xl border-2 p-2.5 transition-all relative',
                        activeMenuTheme === 'classic'
                          ? 'border-orange bg-[#FBEDE3]/50'
                          : 'border-border bg-white hover:border-espresso/30'
                      )}
                    >
                      {activeMenuTheme === 'classic' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                      {/* Mini wireframe: photo-row cards */}
                      <div className="h-16 rounded-lg bg-white border border-border/80 p-1.5 space-y-1.5 mb-2">
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="space-y-1 flex-1">
                            <div className="h-1.5 w-10 bg-espresso/70 rounded" />
                            <div className="h-1 w-6 bg-espresso/35 rounded" />
                          </div>
                          <div className="w-6 h-5 rounded bg-sand" />
                        </div>
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="space-y-1 flex-1">
                            <div className="h-1.5 w-12 bg-espresso/70 rounded" />
                            <div className="h-1 w-7 bg-espresso/35 rounded" />
                          </div>
                          <div className="w-6 h-5 rounded bg-sand" />
                        </div>
                      </div>
                      <span className="block text-xs font-extrabold text-espresso">Classic</span>
                      <span className="block text-[10px] text-espresso/60">Photo-row cards</span>
                    </button>

                    {/* Grid Option Card */}
                    <button
                      type="button"
                      data-testid="menu-theme-option-grid"
                      onClick={() => handleSelectMenuTheme('grid')}
                      disabled={isSavingTheme}
                      className={cn(
                        'text-left rounded-xl border-2 p-2.5 transition-all relative',
                        activeMenuTheme === 'grid'
                          ? 'border-orange bg-[#FBEDE3]/50'
                          : 'border-border bg-white hover:border-espresso/30'
                      )}
                    >
                      {activeMenuTheme === 'grid' && (
                        <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-orange text-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                      {/* Mini wireframe: 2-column photo grid + yellow tag */}
                      <div className="h-16 rounded-lg bg-white border border-border/80 p-1.5 grid grid-cols-2 gap-1.5 mb-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex-1 rounded bg-sand" />
                          <div className="h-1.5 w-6 bg-[#FFD23F] rounded-xs" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex-1 rounded bg-sand" />
                          <div className="h-1.5 w-6 bg-[#FFD23F] rounded-xs" />
                        </div>
                      </div>
                      <span className="block text-xs font-extrabold text-espresso">Grid</span>
                      <span className="block text-[10px] text-espresso/60">2-col photo grid</span>
                    </button>
                  </div>

                  {isAdmin && (
                    <label className="flex items-center gap-2 pt-1 border-t border-border/60 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={applyThemeToAll}
                        onChange={(e) => setApplyThemeToAll(e.target.checked)}
                        className="w-3.5 h-3.5 accent-orange rounded"
                      />
                      <span className="text-[11px] font-bold text-espresso">
                        Apply to all outlets
                      </span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Uncategorized warning banner */}
        {noCategoryCount > 0 && categoryFilter !== 'no-category' && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700" />
              <span>
                {noCategoryCount} {noCategoryCount === 1 ? 'item has' : 'items have'} No category and
                stay hidden from customers until assigned.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCategoryFilter('no-category')}
              className="px-3 py-1 rounded-full bg-amber-900 text-white text-[11px] font-bold shrink-0"
            >
              Show unassigned
            </button>
          </div>
        )}

        {/* COMBOS SECTION AT THE TOP OF MENU LIST */}
        {categoryFilter === 'all' && (
          <div className="space-y-3 pb-4 border-b border-border/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange/15 text-orange flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display font-black text-xl text-espresso tracking-tight">
                      Combos
                    </h2>
                    <span className="text-[11px] font-bold bg-orange/15 text-orange px-2.5 py-0.5 rounded-full">
                      {combos.length} {combos.length === 1 ? 'combo' : 'combos'}
                    </span>
                    {!isAdmin && (
                      <span className="text-[10px] font-bold text-espresso/50 bg-sand/60 px-2 py-0.5 rounded-full">
                        View only
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-espresso/60">
                    Bundled meals appearing as the first section on customer menu
                  </p>
                </div>
              </div>

              {isAdmin && (
                <Button
                  onClick={handleOpenAddCombo}
                  disabled={!activeOutletId}
                  className="h-9 px-4 text-xs font-bold bg-espresso hover:bg-espresso/90 text-cream"
                >
                  <Plus className="w-3.5 h-3.5 mr-1 text-orange" />
                  <span>Add Combo</span>
                </Button>
              )}
            </div>

            {combos.length === 0 ? (
              <div className="bg-sand/20 rounded-2xl border border-dashed border-border p-6 text-center">
                <Package className="w-8 h-8 text-espresso/30 mx-auto mb-2" />
                <p className="text-xs font-bold text-espresso/70">
                  No combos configured for this outlet yet.
                </p>
                {isAdmin ? (
                  <p className="text-[11px] text-espresso/50 mt-1">
                    Click &quot;Add Combo&quot; above to select 2 or more menu items and set a combo price.
                  </p>
                ) : (
                  <p className="text-[11px] text-espresso/50 mt-1">
                    Only administrators can create and edit combos.
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {combos.map((combo) => {
                  return (
                    <div
                      key={combo.id}
                      className={cn(
                        'bg-card rounded-2xl border border-border overflow-hidden flex flex-col justify-between shadow-xs transition-all hover:border-orange/40',
                        !combo.is_available && 'opacity-65 grayscale-[30%]'
                      )}
                    >
                      {/* Image & Badges */}
                      <div className="relative w-full h-36 bg-sand/30 overflow-hidden">
                        <SafeImage
                          src={combo.image_url || DEFAULT_MENU_IMAGE}
                          alt={combo.name}
                          variant="tile"
                          fill
                          sizes="(max-width: 1024px) 50vw, 25vw"
                          className="object-cover"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap max-w-[70%]">
                          <VegBadge isVeg={combo.is_veg} size="sm" />
                          <span className="bg-orange text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                            Combo
                          </span>
                          {isAllOutlets && (
                            <span className="bg-espresso text-cream text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                              {combo.is_shared ? `All ${combo.outlets_count || outlets.length} Outlets` : `Only at ${combo.outlet_name || 'outlet'}`}
                            </span>
                          )}
                        </div>

                        <div className="absolute top-2 right-2">
                          <span
                            className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs',
                              combo.is_available
                                ? 'bg-[#EBF7EE] text-brandGreen border border-brandGreen/30'
                                : 'bg-[#FDF0F0] text-brandRed border border-brandRed/30'
                            )}
                          >
                            {combo.is_available ? 'In Stock' : 'Sold Out'}
                          </span>
                        </div>
                      </div>

                      {/* Combo Details */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <h3 className="font-bold text-sm text-espresso line-clamp-1">
                              {combo.name}
                            </h3>
                            <div className="text-right shrink-0">
                              <span className="font-display font-black text-sm text-espresso block">
                                {formatPrice(Number(combo.price))}
                              </span>
                              {combo.savings > 0 && (
                                <span className="text-[10px] font-black text-[#2F7A3E] bg-[#2F7A3E]/10 px-1.5 py-0.2 rounded-full">
                                  Save ₹{combo.savings}
                                </span>
                              )}
                            </div>
                          </div>

                          {combo.description && (
                            <p className="text-xs text-espresso/60 line-clamp-2 leading-relaxed mb-2">
                              {combo.description}
                            </p>
                          )}

                          {/* Included Items Short List */}
                          <div className="bg-sand/30 rounded-xl p-2 space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-espresso/50 block">
                              Includes ({combo.items?.length || 0} items):
                            </span>
                            <div className="space-y-0.5 max-h-20 overflow-y-auto pr-0.5">
                              {combo.items?.map((ci, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[11px] text-espresso"
                                >
                                  <span className="truncate pr-1">
                                    <span className="font-bold text-orange">{ci.quantity}x</span>{' '}
                                    {ci.name}
                                  </span>
                                  {!ci.is_available && (
                                    <span className="text-[9px] font-bold text-brandRed shrink-0">
                                      Sold out
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Footer / Admin Actions */}
                        <div className="pt-2 border-t border-border/70 flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-espresso/60">
                            {combo.is_available
                              ? 'All items available'
                              : 'Sold out (item unavailable)'}
                          </span>

                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleOpenEditCombo(combo)}
                                className="p-1.5 rounded-lg hover:bg-sand/60 text-espresso/70 hover:text-espresso transition-colors"
                                title="Edit combo"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCombo(combo)}
                                className="p-1.5 rounded-lg hover:bg-[#FDF0F0] text-espresso/70 hover:text-brandRed transition-colors"
                                title="Delete combo"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* NORMAL ITEMS HEADING */}
        <div className="flex items-center justify-between pt-1">
          <h2 className="font-display font-black text-xl text-espresso tracking-tight">
            Menu Items
          </h2>
          <span className="text-xs font-bold text-espresso/60">
            {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Content View: Desktop Grid Cards / Mobile Compact List */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-64 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <UtensilsCrossed className="w-12 h-12 text-espresso/30 mx-auto mb-3" />
            <h3 className="font-display font-black text-lg text-espresso mb-1">
              {items.length === 0 ? 'No menu items for this outlet' : 'No items in this filter'}
            </h3>
            <p className="text-xs text-espresso/60 max-w-xs mx-auto mb-4">
              {items.length === 0
                ? 'Add burgers, rolls, loaded fries, shakes, and boba to start serving customers.'
                : 'Try selecting a different category filter above.'}
            </p>
            {items.length === 0 && (
              <Button onClick={handleOpenAdd} className="h-10 px-5 text-xs font-bold shadow-orange">
                <Plus className="w-4 h-4 mr-2" />
                <span>Add First Item</span>
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Grid Cards */}
            <div className="hidden sm:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const hasNoCategory = !item.category;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'bg-card rounded-2xl border border-border overflow-hidden flex flex-col justify-between shadow-xs transition-all hover:border-orange/40',
                      !item.is_available && 'opacity-65 grayscale-[30%]',
                      hasNoCategory && 'border-amber-300'
                    )}
                  >
                    <div className="relative w-full h-36 bg-sand/30 overflow-hidden">
                      <SafeImage
                        src={item.image_url || DEFAULT_MENU_IMAGE}
                        alt={item.name}
                        variant="tile"
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap max-w-[70%]">
                        <VegBadge isVeg={item.is_veg} size="sm" />
                        {isAllOutlets && (
                          <span className="bg-espresso text-cream text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                            {item.is_shared ? `All ${item.outlets_count || outlets.length} Outlets` : `Only at ${item.outlet_name || 'outlet'}`}
                          </span>
                        )}
                        {hasNoCategory && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                            No category
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

                    <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <h3 className="font-bold text-sm text-espresso line-clamp-1">{item.name}</h3>
                          <span className="font-display font-black text-sm text-espresso shrink-0">
                            {formatPrice(Number(item.price))}
                          </span>
                        </div>
                        <p className="text-xs text-espresso/60 line-clamp-2 leading-relaxed">
                          {item.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Inline Quick Category Selector */}
                      <div>
                        <select
                          value={item.category || ''}
                          onChange={(e) => handleInlineCategoryChange(item, e.target.value)}
                          aria-label={`Category for ${item.name}`}
                          className={cn(
                            'w-full h-8 px-2.5 rounded-lg border text-[11px] font-bold focus:outline-none focus:border-orange cursor-pointer',
                            hasNoCategory
                              ? 'bg-amber-50 border-amber-300 text-amber-900'
                              : 'bg-sand/30 border-border text-espresso'
                          )}
                        >
                          <option value="" disabled>
                            No category — assign…
                          </option>
                          {FIXED_MENU_CATEGORIES.map((c) => (
                            <option key={c.slug} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="pt-2 border-t border-border/70 flex items-center justify-between">
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
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-sand/60 text-espresso/70 hover:text-espresso transition-colors"
                            title="Edit item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg hover:bg-[#FDF0F0] text-espresso/40 hover:text-brandRed transition-colors"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile Compact List */}
            <div className="sm:hidden space-y-2.5">
              {filteredItems.map((item) => {
                const hasNoCategory = !item.category;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'bg-card rounded-2xl border p-3 space-y-2.5 shadow-xs',
                      hasNoCategory ? 'border-amber-300' : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-sand/30 shrink-0">
                        <SafeImage
                          src={item.image_url || DEFAULT_MENU_IMAGE}
                          alt={item.name}
                          variant="thumb"
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <VegBadge isVeg={item.is_veg} size="sm" />
                          <h3 className="font-bold text-xs text-espresso truncate">{item.name}</h3>
                          {isAllOutlets && (
                            <span className="bg-espresso text-cream text-[9px] font-black px-1.5 py-0.5 rounded-full">
                              {item.is_shared ? `All ${item.outlets_count || outlets.length} Outlets` : `Only at ${item.outlet_name || 'outlet'}`}
                            </span>
                          )}
                          {hasNoCategory && (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                              No category
                            </span>
                          )}
                        </div>
                        <span className="font-extrabold text-xs text-espresso mt-1 block">
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
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 rounded bg-sand/40 text-espresso"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="p-1 rounded bg-sand/40 text-brandRed"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inline quick category selector on mobile */}
                    <select
                      value={item.category || ''}
                      onChange={(e) => handleInlineCategoryChange(item, e.target.value)}
                      aria-label={`Category for ${item.name}`}
                      className={cn(
                        'w-full h-8 px-2.5 rounded-lg border text-[11px] font-bold focus:outline-none focus:border-orange',
                        hasNoCategory
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-sand/30 border-border text-espresso'
                      )}
                    >
                      <option value="" disabled>
                        No category — assign…
                      </option>
                      {FIXED_MENU_CATEGORIES.map((c) => (
                        <option key={c.slug} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <MenuItemForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchMenuItems}
          itemToEdit={itemToEdit}
          outletId={activeOutletId}
        />

        <ComboForm
          isOpen={isComboModalOpen}
          onClose={() => setIsComboModalOpen(false)}
          onSuccess={() => {
            fetchCombos();
            fetchMenuItems();
          }}
          outletId={activeOutletId}
          availableMenuItems={items}
          comboToEdit={comboToEdit}
        />

        {/* Phone-sized Customer Menu Preview Modal */}
        {isPreviewOpen && activeOutletId && (
          <div
            data-testid="menu-theme-preview-modal"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs"
            onClick={() => setIsPreviewOpen(false)}
          >
            <div
              className="bg-card rounded-[28px] border border-border shadow-2xl p-4 flex flex-col items-center gap-3 max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-espresso">
                    Preview ({activeOutlet?.name || 'Outlet'})
                  </span>
                  <div className="inline-flex rounded-full bg-sand/70 p-0.5 border border-border">
                    <button
                      type="button"
                      onClick={() => handleSelectMenuTheme('classic')}
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-colors',
                        activeMenuTheme === 'classic'
                          ? 'bg-espresso text-cream'
                          : 'text-espresso/70 hover:text-espresso'
                      )}
                    >
                      Classic
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectMenuTheme('grid')}
                      className={cn(
                        'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold transition-colors',
                        activeMenuTheme === 'grid'
                          ? 'bg-espresso text-cream'
                          : 'text-espresso/70 hover:text-espresso'
                      )}
                    >
                      Grid
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  aria-label="Close preview"
                  className="w-8 h-8 rounded-full bg-sand/60 hover:bg-sand flex items-center justify-center text-espresso"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="w-[390px] max-w-[88vw] h-[720px] max-h-[78vh] rounded-[24px] overflow-hidden border-2 border-espresso/15 bg-white shadow-inner">
                <iframe
                  key={`${activeOutletId}-${activeMenuTheme}-${previewRefreshKey}`}
                  src={`/menu?outlet=${encodeURIComponent(activeOutletId)}&preview_theme=${activeMenuTheme}&preview=1`}
                  title="Customer Menu Preview"
                  className="w-full h-full border-0 bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteMenuConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }}
          onConfirm={handleConfirmDelete}
          isDeleting={isDeleting}
          itemName={deleteTarget?.name || ''}
          itemType={deleteTarget?.type || 'item'}
          scope={deleteTarget?.scope || 'single'}
          outletsCount={deleteTarget?.outletsCount || 1}
          outletName={deleteTarget?.outletName || activeOutlet?.name}
          affectedCombos={deleteTarget?.affectedCombos || []}
        />
      </div>
    </RoleGuard>
  );
}
