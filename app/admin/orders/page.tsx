'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAdminStore } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { Order, OrderStatus, Outlet } from '@/types/supabase';
import { OrderCard } from '@/components/admin/OrderCard';
import { CancelOrderModal } from '@/components/admin/CancelOrderModal';
import { supabase } from '@/lib/supabase';
import { playNewOrderSound } from '@/components/admin/NotificationSound';
import { useToast } from '@/components/ui/Toast';
import { normalizeOrderStatus, CanonicalStatus } from '@/lib/order-flow';
import {
  Store,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Package,
  Flame,
  Clock,
  RotateCcw,
  Ban,
  Calendar,
  Undo2,
} from 'lucide-react';

type TabKey = 'pending' | 'making' | 'packaging' | 'completed' | 'cancelled' | 'all';
type DateFilter = 'today' | 'yesterday' | '7days' | 'custom';

export default function AdminOrdersPage() {
  const {
    currentUser,
    selectedOutletId,
    setSelectedOutletId,
    soundEnabled,
    sessionToken,
    syncTrigger,
  } = useAdminStore();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const { showToast } = useToast();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [newOrderId, setNewOrderId] = useState<string | null>(null);
  const [isSavingStatus, setIsSavingStatus] = useState<string | null>(null);

  // Cancel modal state
  const [cancellingOrder, setCancellingOrder] = useState<Order | null>(null);

  // Undo Handover Toast state
  const [undoHandover, setUndoHandover] = useState<{
    orderId: string;
    pickupCode: string;
    timeoutId: NodeJS.Timeout;
    timeLeft: number;
  } | null>(null);

  // All Orders Tab Filters
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const activeOutletId = isAdmin ? selectedOutletId : currentUser?.outlet_id || '';

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

  // Realtime Supabase Subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-lifecycle')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newOrder = payload.new as Order;
          if (!newOrder) return;

          // Check if matches active outlet filter
          if (!activeOutletId || newOrder.outlet_id === activeOutletId) {
            // Check if freshly paid order in Pending stage
            if (newOrder.status === 'pending') {
              setNewOrderId(newOrder.id);
              if (soundEnabledRef.current) {
                playNewOrderSound();
              }
              showToast(
                `🔔 New Order #${newOrder.pickup_code} received from ${newOrder.customer_name}!`,
                'success'
              );
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

  // Server-side Status Update Action
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const previousOrders = [...orders];
    setIsSavingStatus(orderId);

    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          status: nextStatus,
          caller_role: currentUser?.role,
          caller_outlet_id: currentUser?.outlet_id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to update order');
      }

      showToast(`Order status updated to ${nextStatus}`, 'success');
      fetchOrders();
    } catch (err: any) {
      console.error('Status update failed:', err);
      // Rollback
      setOrders(previousOrders);
      showToast(err.message || 'Status update failed', 'error');
    } finally {
      setIsSavingStatus(null);
    }
  };

  // Give to Customer with 5-second Undo Toast
  const handleGiveToCustomer = (order: Order) => {
    // If an existing undo is active, finalize it immediately
    if (undoHandover) {
      clearTimeout(undoHandover.timeoutId);
    }

    const orderId = order.id;
    const pickupCode = order.pickup_code;

    // Optimistically update status to 'received'
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'received' } : o))
    );

    // Set 5-second timer before committing server update
    const timeoutId = setTimeout(async () => {
      setUndoHandover(null);
      try {
        await fetch(`/api/admin/orders/${orderId}/status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({
            status: 'received',
            caller_role: currentUser?.role,
            caller_outlet_id: currentUser?.outlet_id,
          }),
        });
        fetchOrders();
      } catch (err) {
        console.error('Finalizing handover error:', err);
      }
    }, 5000);

    setUndoHandover({
      orderId,
      pickupCode,
      timeoutId,
      timeLeft: 5,
    });
  };

  const handleUndoHandover = () => {
    if (!undoHandover) return;
    clearTimeout(undoHandover.timeoutId);

    // Revert local state to 'ready'
    setOrders((prev) =>
      prev.map((o) => (o.id === undoHandover.orderId ? { ...o, status: 'ready' } : o))
    );

    showToast(`Handover of #${undoHandover.pickupCode} cancelled`, 'info');
    setUndoHandover(null);
  };

  // Confirm Cancellation via Modal
  const handleConfirmCancel = async (orderId: string, reason: string) => {
    setIsSavingStatus(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          status: 'cancelled',
          cancel_reason: reason,
          cancelled_by: currentUser?.email || 'staff',
          caller_role: currentUser?.role,
          caller_outlet_id: currentUser?.outlet_id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to cancel order');
      }

      showToast(`Order #${data.order?.pickup_code || ''} cancelled`, 'info');
      fetchOrders();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel order', 'error');
      throw err;
    } finally {
      setIsSavingStatus(null);
    }
  };

  // Sync Cashfree Payments Button
  const handleSyncPayments = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId: activeOutletId }),
      });
      const data = await res.json();
      if (data.message) {
        showToast(data.message, 'info');
      }
      fetchOrders();
    } catch (err: any) {
      showToast(err.message || 'Sync failed', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Compute Live Counts (NEVER show pending_payment in operational tabs)
  const counts = useMemo(() => {
    const pending = orders.filter((o) => normalizeOrderStatus(o.status) === 'pending').length;
    const making = orders.filter((o) => normalizeOrderStatus(o.status) === 'preparing').length;
    const packaging = orders.filter((o) => normalizeOrderStatus(o.status) === 'packaging').length;
    const completed = orders.filter((o) => normalizeOrderStatus(o.status) === 'ready').length;
    const cancelled = orders.filter(
      (o) =>
        normalizeOrderStatus(o.status) === 'cancelled' ||
        normalizeOrderStatus(o.status) === 'payment_cancelled'
    ).length;

    // All Orders count depends on filters
    const all = orders.filter((o) => {
      const canon = normalizeOrderStatus(o.status);
      return canon === 'received' || canon === 'cancelled' || canon === 'payment_cancelled';
    }).length;

    return { pending, making, packaging, completed, cancelled, all };
  }, [orders]);

  // Tab Filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const canon = normalizeOrderStatus(o.status);

      if (activeTab === 'pending') {
        return canon === 'pending';
      }
      if (activeTab === 'making') {
        return canon === 'preparing';
      }
      if (activeTab === 'packaging') {
        return canon === 'packaging';
      }
      if (activeTab === 'completed') {
        return canon === 'ready';
      }
      if (activeTab === 'cancelled') {
        return canon === 'cancelled' || canon === 'payment_cancelled';
      }
      if (activeTab === 'all') {
        // Default shows Customer Received orders; toggle includes cancelled
        if (!includeCancelled && canon !== 'received') {
          return false;
        }
        if (includeCancelled && canon !== 'received' && canon !== 'cancelled' && canon !== 'payment_cancelled') {
          return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesCode = (o.pickup_code || '').toLowerCase().includes(q);
          const matchesPhone = (o.customer_phone || '').includes(q);
          if (!matchesCode && !matchesPhone) return false;
        }

        // Date Filter
        const orderDate = new Date(o.created_at);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          if (orderDate < today) return false;
        } else if (dateFilter === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          if (orderDate < yesterday || orderDate >= today) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (orderDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'custom') {
          if (customDateFrom) {
            const from = new Date(customDateFrom);
            from.setHours(0, 0, 0, 0);
            if (orderDate < from) return false;
          }
          if (customDateTo) {
            const to = new Date(customDateTo);
            to.setHours(23, 59, 59, 999);
            if (orderDate > to) return false;
          }
        }

        return true;
      }
      return false;
    });
  }, [
    orders,
    activeTab,
    includeCancelled,
    searchQuery,
    dateFilter,
    customDateFrom,
    customDateTo,
  ]);

  const tabs: Array<{ id: TabKey; label: string; count: number; alert?: boolean }> = [
    { id: 'pending', label: 'Pending', count: counts.pending, alert: counts.pending > 0 },
    { id: 'making', label: 'Making', count: counts.making },
    { id: 'packaging', label: 'Packaging', count: counts.packaging },
    { id: 'completed', label: 'Completed', count: counts.completed },
    { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
    { id: 'all', label: 'All Orders', count: counts.all },
  ];

  return (
    <RoleGuard allowedRoles={['admin', 'manager', 'staff', 'ordering_staff']}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
                Orders
              </h1>
              {!isAdmin && (
                <span className="text-[11px] font-bold bg-sand px-2.5 py-0.5 rounded-full text-espresso/80">
                  {currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Branch'}
                </span>
              )}
              <span className="w-2.5 h-2.5 rounded-full bg-brandGreen animate-pulse" title="Realtime active" />
            </div>
            <p className="text-xs text-espresso/60 mt-0.5">
              Live real-time order queue with instant stage progression
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

            {/* Sync Payments Button */}
            <button
              onClick={handleSyncPayments}
              disabled={isSyncing}
              className="flex items-center gap-1.5 py-2 px-3 rounded-2xl bg-card border border-border hover:bg-sand/40 text-espresso text-xs font-bold transition-colors disabled:opacity-50"
              title="Sync pending Cashfree payments"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-orange ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Payments'}</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchOrders()}
              className="p-2.5 rounded-2xl bg-card border border-border hover:bg-sand/40 text-espresso transition-colors"
              title="Manual refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-espresso text-cream border-espresso shadow-xs'
                    : 'bg-card text-espresso/70 border-border hover:bg-sand/40'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isActive
                      ? 'bg-cream/20 text-cream'
                      : tab.alert
                      ? 'bg-brandRed text-white animate-pulse'
                      : 'bg-sand text-espresso/80'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* All Orders Sub-bar Controls (Search, Toggle, Date Filter) */}
        {activeTab === 'all' && (
          <div className="bg-card rounded-2xl border border-border p-3.5 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search by pickup code or phone */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-espresso/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search code or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-sand/20 border border-border text-xs text-espresso focus:outline-none focus:ring-2 focus:ring-orange"
                />
              </div>

              {/* Include Cancelled Toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-espresso">
                <input
                  type="checkbox"
                  checked={includeCancelled}
                  onChange={(e) => setIncludeCancelled(e.target.checked)}
                  className="rounded text-orange focus:ring-orange w-4 h-4 border-border"
                />
                <span>Include cancelled</span>
              </label>
            </div>

            {/* Date Filters */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50 text-xs">
              <span className="text-[11px] font-bold text-espresso/50 uppercase">Date:</span>
              {(['today', 'yesterday', '7days', 'custom'] as DateFilter[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`px-3 py-1 rounded-full font-bold transition-colors ${
                    dateFilter === d
                      ? 'bg-espresso text-cream'
                      : 'bg-sand/30 text-espresso/70 hover:bg-sand/60'
                  }`}
                >
                  {d === 'today'
                    ? 'Today'
                    : d === 'yesterday'
                    ? 'Yesterday'
                    : d === '7days'
                    ? 'Last 7 days'
                    : 'Custom'}
                </button>
              ))}

              {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 pl-2">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => setCustomDateFrom(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-sand/20 border border-border text-xs"
                  />
                  <span className="text-espresso/50">to</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={(e) => setCustomDateTo(e.target.value)}
                    className="px-2 py-1 rounded-lg bg-sand/20 border border-border text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders Cards Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-10 h-10 border-3 border-orange/20 border-t-orange rounded-full animate-spin" />
            <p className="text-xs font-semibold text-espresso/60">Loading live orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card rounded-3xl border border-border p-12 text-center my-6">
            <CheckCircle2 className="w-10 h-10 text-brandGreen/60 mx-auto mb-2" />
            <h3 className="font-display font-black text-lg text-espresso mb-1">
              No orders in this stage
            </h3>
            <p className="text-xs text-espresso/60 max-w-sm mx-auto">
              {activeTab === 'pending'
                ? 'All incoming orders have been confirmed! Ready for the next order.'
                : 'There are no active orders matching this filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onUpdateStatus={handleUpdateStatus}
                onRequestCancel={(ord) => setCancellingOrder(ord)}
                onGiveToCustomer={handleGiveToCustomer}
                isSaving={isSavingStatus === order.id}
                isNew={newOrderId === order.id}
              />
            ))}
          </div>
        )}

        {/* Cancel Order Modal */}
        <CancelOrderModal
          order={cancellingOrder}
          isOpen={!!cancellingOrder}
          onClose={() => setCancellingOrder(null)}
          onConfirmCancel={handleConfirmCancel}
        />

        {/* 5-Second Undo Toast Bar for Handover */}
        {undoHandover && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
            <div className="bg-espresso text-cream p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 border border-espresso/20 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-brandGreen shrink-0" />
                <div>
                  <p className="text-xs font-bold leading-tight">
                    Order #{undoHandover.pickupCode} given to customer
                  </p>
                  <span className="text-[10px] text-cream/60">
                    Moved to Customer Received
                  </span>
                </div>
              </div>
              <button
                onClick={handleUndoHandover}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cream/15 hover:bg-cream/25 text-cream text-xs font-bold transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
