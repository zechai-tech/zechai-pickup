'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { Outlet } from '@/types/supabase';
import { OutletForm } from '@/components/admin/OutletForm';
import { Button } from '@/components/ui/Button';
import { Store, Plus, Edit2, PowerOff, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminOutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [outletToEdit, setOutletToEdit] = useState<Outlet | null>(null);

  const fetchOutlets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/outlets');
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

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to deactivate ${name}? Customers won't be able to order from this outlet.`)) return;

    try {
      const res = await fetch(`/api/admin/outlets?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchOutlets();
      }
    } catch (e) {
      console.error('Error deactivating outlet:', e);
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
                        <button
                          onClick={() => handleOpenEdit(o)}
                          className="p-2 rounded-xl hover:bg-sand/60 text-espresso/70 hover:text-espresso transition-colors"
                          title="Edit outlet"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {o.is_active && (
                          <button
                            onClick={() => handleDeactivate(o.id, o.name)}
                            className="p-2 rounded-xl hover:bg-[#FDF0F0] text-espresso/50 hover:text-brandRed transition-colors"
                            title="Deactivate outlet"
                          >
                            <PowerOff className="w-4 h-4" />
                          </button>
                        )}
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
                      {o.is_active && (
                        <button
                          onClick={() => handleDeactivate(o.id, o.name)}
                          className="px-3 py-1.5 rounded-lg border border-border text-xs font-bold text-brandRed hover:bg-[#FDF0F0]"
                        >
                          Deactivate
                        </button>
                      )}
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
      </div>
    </RoleGuard>
  );
}
