'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAdminStore } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { Order, OrderStatus, Outlet } from '@/types/supabase';
import { OrderCard } from '@/components/admin/OrderCard';
import { supabase } from '@/lib/supabase';
import { playNewOrderSound } from '@/components/admin/NotificationSound';
import { useToast } from '@/components/ui/Toast';
import {
  ShoppingBag,
  Store,
  RefreshCw,
  Bell,
  Clock,
  Flame,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type FilterTab = 'all' | 'pending' | 'active' | 'completed';

export default function AdminOrdersPage() {
  const { currentUser, selectedOutletId, setSelectedOutletId, soundEnabled, syncTrigger } = useAdminStore();
  const isAdmin = currentUser?.role === 'admin';
  const { showToast } = useToast();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [newOrderId, setNewOrderId] = useState<string | null>(null);

  const activeOutletId = isAdmin
    ? selectedOutletId
    : currentUser?.outlet_id || '';

  // Sound ref to prevent race condition
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Fetch Outlets
  useEffect(() => {
    async function loadOutlets() {
      try {
        const res = await fetch('/api/admin/outlets');
        const data = await res.json();
        setOutlets(data.outlets || []);
      } catch (e) {
        console.error('Error loading outlets:', e);
      }
    }
    if (isAdmin) {
      loadOutlets();
    }
  }, [isAdmin]);

  // Fetch Orders
  const fetchOrders = useCallback(async () => {
    try {
      const outletQuery = activeOutletId ? `?outlet_id=${activeOutletId}` : '';
      const res = await fetch(`/api/admin/orders${outletQuery}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error('Error fetching orders:', e);
    } finally {
      setLoading(false);
    }
  }, [activeOutletId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, syncTrigger]);

  // REAL-TIME SUPABASE SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          // Check if event is INSERT (new order)
          if (payload.eventType === 'INSERT') {
            const newOrder = payload.new as Order;

            // Check if matches active outlet filter
            if (!activeOutletId || newOrder.outlet_id === activeOutletId) {
              setNewOrderId(newOrder.id);

              // Sound alert
              if (soundEnabledRef.current) {
                playNewOrderSound();
              }

              // In-app toast banner
              showToast(
                `🔔 New Order #${newOrder.pickup_code} received from ${newOrder.customer_name}!`,
                'success'
              );

              // Reset glow highlight after 6 seconds
              setTimeout(() => {
                setNewOrderId((prev) => (prev === newOrder.id ? null : prev));
              }, 6000);
            }
          }

          // Refresh full orders list
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeOutletId, fetchOrders, showToast]);

  // Status Action handler
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );

      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: nextStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      showToast(`Order status updated to ${nextStatus}`, 'info');
      fetchOrders();
    } catch (e: any) {
      showToast(e.message || 'Status update failed', 'error');
      fetchOrders();
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'pending') return o.status === 'pending';
    if (activeTab === 'active') return o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready';
    if (activeTab === 'completed') return o.status === 'picked_up' || o.status === 'cancelled';
    return true;
  });

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    active: orders.filter((o) => ['accepted', 'preparing', 'ready'].includes(o.status)).length,
    completed: orders.filter((o) => ['picked_up', 'cancelled'].includes(o.status)).length,
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'staff', 'ordering_staff']}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
                Live Kitchen Dispatch
              </h1>
              {!isAdmin && (
                <span className="text-[11px] font-bold bg-sand px-2.5 py-0.5 rounded-full text-espresso/80">
                  {currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Branch'}
                </span>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-brandGreen animate-pulse" title="Realtime active" />
            </div>
            <p className="text-xs text-espresso/60 mt-0.5">
              Instant real-time order processing with sound alerts and status tracking
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Admin Outlet Selector */}
            {isAdmin && outlets.length > 0 && (
              <div className="flex items-center gap-2 bg-card p-1.5 px-3 rounded-2xl border border-border">
                <Store className="w-4 h-4 text-orange shrink-0" />
                <select
                  value={activeOutletId || ''}
                  onChange={(e) => setSelectedOutletId(e.target.value || null)}
                  className="bg-transparent text-xs font-bold text-espresso focus:outline-none cursor-pointer"
                >
                  <option value="">All Outlets</option>
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => fetchOrders()}
              className="p-2.5 rounded-2xl bg-card border border-border hover:bg-sand/40 text-espresso transition-colors"
              title="Manual refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all' as const, label: 'All Orders', count: counts.all, alert: false },
            { id: 'pending' as const, label: 'Pending', count: counts.pending, alert: counts.pending > 0 },
            { id: 'active' as const, label: 'In Progress / Ready', count: counts.active, alert: false },
            { id: 'completed' as const, label: 'Completed', count: counts.completed, alert: false },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-150 flex items-center gap-2',
                  isActive
                    ? 'bg-espresso text-cream shadow-sm'
                    : 'bg-card text-espresso border border-border hover:bg-sand/40'
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    'px-2 py-0.2 rounded-full text-[10px] font-black',
                    isActive
                      ? 'bg-cream/20 text-cream'
                      : tab.alert
                      ? 'bg-mustard text-espresso'
                      : 'bg-sand text-espresso'
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Order Cards Grid: Desktop 2-3 cols | Mobile single col */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-64 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-espresso/30 mx-auto mb-3" />
            <h3 className="font-display font-black text-lg text-espresso mb-1">
              No orders in this queue
            </h3>
            <p className="text-xs text-espresso/60 max-w-xs mx-auto">
              {activeTab === 'pending'
                ? 'Great job! All customer orders have been accepted.'
                : 'New incoming orders from the customer app will show up here automatically.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                isNew={newOrderId === order.id}
              />
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
