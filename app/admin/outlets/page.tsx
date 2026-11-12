'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { Outlet } from '@/types/supabase';
import { OutletForm } from '@/components/admin/OutletForm';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { Store, Plus, Edit2, Power, Trash2, MapPin, Clock, AlertTriangle, X, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminOutletsPage() {
  const { showToast } = useToast();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [outletToEdit, setOutletToEdit] = useState<Outlet | null>(null);

  // Delete confirmation modal state
  const [outletToDelete, setOutletToDelete] = useState<Outlet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/outlets', { cache: 'no-store' });
      const data = await res.json();
      setOutlets(data.outlets || []);
    } catch (e) {
      console.error('Error fetching outlets:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  // Activate / Deactivate Toggle with optimistic update & rollback
  const handleToggleActive = async (outlet: Outlet) => {
    const nextActive = !outlet.is_active;
    const prevOutlets = outlets;
    setOutlets((curr) =>
      curr.map((o) => (o.id === outlet.id ? { ...o, is_active: nextActive } : o))
    );

    try {
      const res = await fetch('/api/admin/outlets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: outlet.id,
          is_active: nextActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update outlet status');
      }
      showToast(
        `${outlet.name} is now ${nextActive ? 'active' : 'inactive'}`,
        'success'
      );
      fetchOutlets();
    } catch (e: any) {
      setOutlets(prevOutlets);
      showToast(e?.message || 'Failed to toggle outlet status', 'error');
    }
  };

  // Confirm and execute hard deletion with optimistic UI removal & rollback
  const handleConfirmDelete = async () => {
    if (!outletToDelete) return;
    const target = outletToDelete;
    const prevOutlets = outlets;

    setIsDeleting(true);
    setOutlets((curr) => curr.filter((o) => o.id !== target.id));
    setOutletToDelete(null);

    try {
      const res = await fetch(`/api/admin/outlets?id=${encodeURIComponent(target.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete outlet');
      }
      showToast(`Deleted "${target.name}"`, 'success');
      fetchOutlets();
    } catch (e: any) {
      setOutlets(prevOutlets);
      showToast(e?.message || 'Failed to delete outlet', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenAdd = () => {
    setOutletToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (outlet: Outlet) => {
    setOutletToEdit(outlet);
    setIsModalOpen(true);
  };

  return (
    <RoleGuard allowedRoles={['admin']}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
              Outlet Locations
            </h1>
            <p className="text-xs text-espresso/60 mt-0.5">
              Manage physical branches, operational hours, and active pickup availability
            </p>
          </div>

          <Button
            onClick={handleOpenAdd}
            className="h-11 px-5 text-sm font-bold shadow-orange self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            <span>Add Outlet</span>
          </Button>
        </div>

        {/* Content View: Desktop Data Table / Mobile Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <Store className="w-12 h-12 text-espresso/30 mx-auto mb-3" />
            <h3 className="font-display font-black text-lg text-espresso mb-1">No outlets configured</h3>
            <p className="text-xs text-espresso/60 max-w-xs mx-auto mb-4">
              Create your first branch to start accepting pickup orders.
            </p>
            <Button onClick={handleOpenAdd} className="h-10 px-5 text-xs font-bold shadow-orange">
              <Plus className="w-4 h-4 mr-2" />
              <span>Add First Outlet</span>
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-[24px] border border-border shadow-xs overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-sand/30 border-b border-border/80 text-[11px] font-black uppercase tracking-wider text-espresso/60">
                    <th className="py-3.5 px-5">Outlet</th>
                    <th className="py-3.5 px-4">Address</th>
                    <th className="py-3.5 px-4">Phone</th>
                    <th className="py-3.5 px-4">Hours</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {outlets.map((o) => (
                    <tr key={o.id} className="hover:bg-sand/20 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-espresso">{o.name}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs text-espresso/70 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-orange shrink-0" />
                          <span>{o.address || 'Address not set'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {o.phone ? (
                          <a
                            href={`tel:+91${o.phone}`}
                            className="text-xs font-semibold text-espresso hover:text-orange flex items-center gap-1.5 font-mono"
                          >
                            <Phone className="w-3.5 h-3.5 text-espresso/50" />
                            <span>+91 {o.phone}</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => handleOpenEdit(o)}
                            className="text-xs text-espresso/40 hover:text-orange font-medium underline flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5 opacity-40" />
                            <span>Add phone</span>
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold text-espresso flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-espresso/50 shrink-0" />
                          <span>
                            {o.opening_time.slice(0, 5)} - {o.closing_time.slice(0, 5)}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {o.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brandGreen">
                            <span className="w-2 h-2 rounded-full bg-brandGreen" />
                            <span>Active / Open</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brandRed">
                            <span className="w-2 h-2 rounded-full bg-brandRed" />
                            <span>Inactive / Closed</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right space-x-1.5">
                        {/* 1. Edit */}
                        <button
                          onClick={() => handleOpenEdit(o)}
                          className="p-2 rounded-xl hover:bg-sand/60 text-espresso/70 hover:text-espresso transition-colors"
                          title="Edit outlet"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {/* 2. Activate/Deactivate Toggle */}
                        <button
                          onClick={() => handleToggleActive(o)}
                          className={cn(
                            'p-2 rounded-xl transition-colors',
                            o.is_active
                              ? 'text-brandGreen hover:bg-[#EBF7EE]'
                              : 'text-brandRed hover:bg-[#FDF0F0]'
                          )}
                          title={o.is_active ? 'Click to deactivate outlet' : 'Click to activate outlet'}
                        >
                          <Power className="w-4 h-4" />
                        </button>

                        {/* 3. Delete Button */}
                        <button
                          onClick={() => setOutletToDelete(o)}
                          className="p-2 rounded-xl hover:bg-[#FDF0F0] text-espresso/50 hover:text-brandRed transition-colors"
                          title="Delete outlet"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {outlets.map((o) => (
                <div key={o.id} className="bg-card rounded-2xl border border-border p-4 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-espresso">{o.name}</h3>
                      <p className="text-xs text-espresso/60 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-orange shrink-0" />
                        <span>{o.address || 'Address not set'}</span>
                      </p>
                      {o.phone ? (
                        <p className="text-xs text-espresso/70 flex items-center gap-1 mt-0.5 font-mono">
                          <Phone className="w-3 h-3 text-espresso/40 shrink-0" />
                          <span>+91 {o.phone}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-espresso/40 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 opacity-40 shrink-0" />
                          <button
                            onClick={() => handleOpenEdit(o)}
                            className="underline hover:text-orange"
                          >
                            Add phone
                          </button>
                        </p>
                      )}
                    </div>
                    {o.is_active ? (
                      <span className="px-2 py-0.5 rounded-full bg-[#EBF7EE] text-brandGreen text-[10px] font-bold border border-brandGreen/20">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#FDF0F0] text-brandRed text-[10px] font-bold border border-brandRed/20">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                    <span className="text-espresso/70 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-espresso/50" />
                      <span>{o.opening_time.slice(0, 5)} - {o.closing_time.slice(0, 5)}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(o)}
                        className="px-3 py-1.5 rounded-lg bg-sand/40 hover:bg-sand text-xs font-bold text-espresso"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(o)}
                        className={cn(
                          'px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-colors',
                          o.is_active
                            ? 'border-brandGreen/30 text-brandGreen hover:bg-[#EBF7EE]'
                            : 'border-brandRed/30 text-brandRed hover:bg-[#FDF0F0]'
                        )}
                        title={o.is_active ? 'Deactivate' : 'Activate'}
                      >
                        <Power className="w-3.5 h-3.5 inline mr-1" />
                        <span>{o.is_active ? 'Disable' : 'Enable'}</span>
                      </button>
                      <button
                        onClick={() => setOutletToDelete(o)}
                        className="p-1.5 rounded-lg border border-border text-espresso/50 hover:text-brandRed hover:bg-[#FDF0F0] transition-colors"
                        title="Delete outlet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Outlet Form Modal */}
        <OutletForm
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchOutlets}
          outletToEdit={outletToEdit}
        />

        {/* Delete Confirmation Modal */}
        {outletToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-espresso/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-card rounded-[28px] border border-border shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-border/70 mb-4">
                <div className="flex items-center gap-2 text-brandRed font-bold text-base">
                  <div className="w-9 h-9 rounded-xl bg-[#FDF0F0] flex items-center justify-center text-brandRed">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span>Delete Outlet</span>
                </div>
                <button
                  onClick={() => setOutletToDelete(null)}
                  className="p-1.5 rounded-full hover:bg-sand/60 text-espresso/60 hover:text-espresso transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-espresso/80 leading-relaxed mb-6 font-medium">
                Permanently delete <strong className="text-espresso font-bold">{outletToDelete.name}</strong>? This cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setOutletToDelete(null)}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-full bg-sand text-espresso font-bold text-xs hover:bg-sand/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2.5 rounded-full bg-brandRed text-white font-bold text-xs hover:bg-[#9B1515] transition-colors shadow-sm disabled:opacity-50"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Outlet'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
