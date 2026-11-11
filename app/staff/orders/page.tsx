'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAdminStore } from '@/stores/admin-store';
import { supabase } from '@/lib/supabase';
import { Order, OrderStatus } from '@/types/supabase';
import { playNewOrderSound } from '@/components/admin/NotificationSound';
import { formatPrice, formatTime, cn } from '@/lib/utils';
import {
  LogOut,
  Store,
  User,
  ShoppingBag,
  Clock,
  CheckCircle2,
  Phone,
  Flame,
  Volume2,
  VolumeX,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export default function StaffOrdersPage() {
  const router = useRouter();
  const { currentUser, logout, soundEnabled, setSoundEnabled } = useAdminStore();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed'>('all');
  const [newOrderId, setNewOrderId] = useState<string | null>(null);

  const outletId = currentUser?.outlet_id || '';
  const outletName = currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Branch';

  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;

  // Fetch orders for this outlet
  const fetchOrders = useCallback(async () => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/admin/orders?outlet_id=${outletId}`);
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {
      console.error('Error fetching staff orders:', e);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Supabase Realtime Listener
  useEffect(() => {
    if (!outletId) return;

    const channel = supabase
      .channel(`staff-orders-${outletId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newOrder = payload.new as Order;
          if (newOrder && newOrder.outlet_id === outletId) {
            if (payload.eventType === 'INSERT') {
              setNewOrderId(newOrder.id);
              if (soundRef.current) {
                playNewOrderSound();
              }
              setTimeout(() => {
                setNewOrderId((prev) => (prev === newOrder.id ? null : prev));
              }, 6000);
            }
            fetchOrders();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [outletId, fetchOrders]);

  // Status transitions
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser ? { Authorization: `Bearer ${currentUser.id}` } : {}),
        },
        body: JSON.stringify({
          status: nextStatus,
          caller_role: currentUser?.role,
          caller_outlet_id: currentUser?.outlet_id,
        }),
      });
      if (!res.ok) {
        throw new Error('Failed to update status');
      }
      fetchOrders();
    } catch (e) {
      console.error('Error updating status:', e);
      fetchOrders();
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out notice:', e);
    }
    logout();
    router.push('/login');
  };

  if (!currentUser) return null;

  // Filter tabs
  const filteredOrders = orders.filter((o) => {
    if (activeTab === 'pending') return o.status === 'pending';
    if (activeTab === 'preparing') return o.status === 'accepted' || o.status === 'preparing';
    if (activeTab === 'ready') return o.status === 'ready';
    if (activeTab === 'completed') return o.status === 'picked_up' || o.status === 'cancelled';
    return true;
  });

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'accepted' || o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    completed: orders.filter((o) => ['picked_up', 'cancelled'].includes(o.status)).length,
  };

  return (
    <div className="min-h-screen bg-cream text-espresso flex flex-col font-sans">
      {/* Staff Top Navigation Bar */}
      <header className="bg-card border-b border-border sticky top-0 z-40 px-4 sm:px-6 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-28 h-8">
              <Image
                src="/assets/logo-orange.png"
                alt="Zécha!"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-orange-soft text-orange-dark text-[11px] font-black tracking-wide">
              TERMINAL
            </span>
          </div>

          {/* Center: Assigned Outlet Name */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-sand/60 border border-border">
            <Store className="w-4 h-4 text-orange" />
            <span className="font-display font-black text-xs sm:text-sm text-espresso uppercase tracking-wider">
              {outletName}
            </span>
          </div>

          {/* Right: User Profile & Actions */}
          <div className="flex items-center gap-2.5">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'p-2 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5',
                soundEnabled
                  ? 'bg-mustard/20 border-mustard/40 text-[#8B6400]'
                  : 'bg-sand/40 border-border text-espresso/50'
              )}
              title={soundEnabled ? 'Mute chimes' : 'Enable order chimes'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Manual Sync */}
            <button
              onClick={() => fetchOrders()}
              className="p-2 rounded-xl bg-card border border-border hover:bg-sand/40 text-espresso transition-colors"
              title="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* User Pill */}
            <div className="hidden md:flex items-center gap-2 pl-2 pr-3 py-1 rounded-xl bg-sand/40 border border-border/80">
              <div className="w-6 h-6 rounded-lg bg-orange text-cream flex items-center justify-center text-[10px] font-black uppercase">
                {currentUser.name.slice(0, 1)}
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-espresso block leading-tight">
                  {currentUser.name}
                </span>
                <span className="text-[9px] uppercase font-black text-espresso/50 tracking-wider">
                  {currentUser.role.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Logout CTA */}
            <button
              onClick={handleLogout}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-sand/40 hover:bg-brandRed/10 hover:text-brandRed border border-border text-espresso/70 transition-colors flex items-center gap-1.5 text-xs font-bold"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Order Queue Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Subheader & Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-black text-2xl text-espresso tracking-tight">
                Live Kitchen Dispatch Queue
              </h1>
              <span className="w-2.5 h-2.5 rounded-full bg-brandGreen animate-pulse" title="Realtime active" />
            </div>
            <p className="text-xs text-espresso/60 mt-0.5">
              Tap status buttons to progress orders from Pending ➔ Preparing ➔ Ready ➔ Picked Up
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: 'all' as const, label: 'All', count: counts.all, alert: false },
              { id: 'pending' as const, label: 'Pending', count: counts.pending, alert: counts.pending > 0 },
              { id: 'preparing' as const, label: 'Preparing', count: counts.preparing, alert: false },
              { id: 'ready' as const, label: 'Ready', count: counts.ready, alert: false },
              { id: 'completed' as const, label: 'Completed', count: counts.completed, alert: false },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap',
                    isActive
                      ? 'bg-espresso text-cream shadow-sm'
                      : 'bg-sand/60 text-espresso/70 hover:bg-sand hover:text-espresso'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.2 rounded-full font-black',
                      tab.alert
                        ? 'bg-mustard text-espresso animate-pulse'
                        : isActive
                        ? 'bg-white/20 text-cream'
                        : 'bg-espresso/10 text-espresso/70'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Orders Grid / Empty State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div key={n} className="h-56 bg-card rounded-2xl border border-border animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card rounded-3xl border border-border p-12 text-center max-w-lg mx-auto mt-8">
            <div className="w-14 h-14 rounded-2xl bg-orange/15 text-orange flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h3 className="font-display font-black text-xl text-espresso mb-1">
              No orders in this queue
            </h3>
            <p className="text-xs text-espresso/60 leading-relaxed">
              When customers order through the Zécha! pickup app, they will instantly chime and pop up here in real time.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => {
              const isNew = order.id === newOrderId;
              return (
                <div
                  key={order.id}
                  className={cn(
                    'bg-card rounded-2xl border transition-all duration-300 p-5 flex flex-col justify-between shadow-xs',
                    isNew
                      ? 'border-orange ring-4 ring-orange/30 animate-pulse'
                      : 'border-border hover:border-orange/60'
                  )}
                >
                  {/* Top Bar: Pickup Code & Status Badge */}
                  <div>
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-border/70">
                      <div>
                        <span className="font-display font-black text-lg text-espresso tracking-tight">
                          {order.pickup_code || `#${order.id.slice(0, 6)}`}
                        </span>
                        <span className="text-[11px] text-espresso/50 font-medium block">
                          {formatTime(new Date(order.created_at))}
                        </span>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider',
                          order.status === 'pending' && 'bg-[#E8B125] text-espresso',
                          order.status === 'accepted' && 'bg-[#CE5535] text-white',
                          order.status === 'preparing' && 'bg-[#FBEDE3] text-[#CE5535] border border-[#CE5535]/30',
                          order.status === 'ready' && 'bg-[#2F7A3E] text-white',
                          order.status === 'picked_up' && 'bg-[#75604F] text-cream',
                          order.status === 'cancelled' && 'bg-[#BA1A1A] text-white'
                        )}
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="py-2.5 flex items-center justify-between text-xs">
                      <div className="font-bold text-espresso flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-orange" />
                        <span>{order.customer_name || 'Walk-in / Online Guest'}</span>
                      </div>
                      {order.customer_phone && (
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="text-[11px] font-bold text-espresso/70 hover:text-orange flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{order.customer_phone}</span>
                        </a>
                      )}
                    </div>

                    {/* Item list */}
                    <div className="bg-sand/30 rounded-xl p-3 space-y-1.5 my-2">
                      {(order.items || []).map((item, idx) => {
                        const quantity = item.qty || 1;
                        const itemPrice = item.price || item.unitPrice || 0;
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs">
                            <span className="text-espresso/90 font-medium">
                              <strong className="text-espresso font-black mr-1">{quantity}×</strong>
                              {item.name}
                            </span>
                            <span className="font-bold text-espresso text-[11px]">
                              {formatPrice(itemPrice * quantity)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total Amount */}
                    <div className="flex items-center justify-between pt-1 pb-3 text-xs">
                      <span className="text-espresso/60 font-semibold">Total Amount</span>
                      <strong className="font-display font-black text-sm text-espresso">
                        {formatPrice(order.total)}
                      </strong>
                    </div>
                  </div>

                  {/* Status Action Buttons */}
                  <div className="pt-3 border-t border-border flex items-center gap-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'accepted')}
                        className="flex-1 py-2.5 rounded-xl bg-[#CE5535] text-white font-bold text-xs shadow-sm hover:bg-[#A8401F] transition-colors"
                      >
                        Accept Order
                      </button>
                    )}

                    {order.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'preparing')}
                        className="flex-1 py-2.5 rounded-xl bg-orange text-cream font-bold text-xs shadow-orange hover:bg-orange-dark transition-colors"
                      >
                        Start Preparing
                      </button>
                    )}

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                        className="flex-1 py-2.5 rounded-xl bg-[#2F7A3E] text-white font-bold text-xs shadow-sm hover:bg-[#2F7A3E]/90 transition-colors"
                      >
                        Mark Ready for Pickup
                      </button>
                    )}

                    {order.status === 'ready' && (
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'picked_up')}
                        className="flex-1 py-2.5 rounded-xl bg-espresso text-cream font-bold text-xs hover:bg-espresso/90 transition-colors"
                      >
                        Mark Picked Up
                      </button>
                    )}

                    {['picked_up', 'cancelled'].includes(order.status) && (
                      <div className="w-full py-2 text-center text-xs font-bold text-espresso/40 italic">
                        Order finalized ({order.status.replace('_', ' ')})
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
