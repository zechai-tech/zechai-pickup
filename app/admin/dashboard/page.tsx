'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAdminStore } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { Outlet, Order } from '@/types/supabase';
import { formatPrice, cn } from '@/lib/utils';
import {
  Store,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  Users,
  Clock,
  ArrowRight,
  Flame,
  CheckCircle2,
  CalendarCheck,
  Receipt,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { currentUser } = useAdminStore();
  const isAdmin = currentUser?.role === 'admin';

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Fetch outlets
        const resOutlets = await fetch('/api/admin/outlets');
        const dataOutlets = await resOutlets.json();
        const outletList: Outlet[] = dataOutlets.outlets || [];
        setOutlets(outletList);

        // Fetch all orders
        const resOrders = await fetch('/api/admin/orders');
        const dataOrders = await resOrders.json();
        const orderList: Order[] = dataOrders.orders || [];
        setOrders(orderList);

        // If manager, default to their assigned outlet
        if (!isAdmin && currentUser?.outlet_id) {
          setSelectedOutletId(currentUser.outlet_id);
        }
      } catch (e) {
        console.error('Error fetching dashboard data:', e);
      } finally {
        setLoading(false);
      }
    }

    if (currentUser) {
      loadData();
    }
  }, [currentUser, isAdmin]);

  // Filter orders by selected outlet
  const filteredOrders = useMemo(() => {
    if (selectedOutletId === 'all') {
      return orders;
    }
    return orders.filter((o) => o.outlet_id === selectedOutletId);
  }, [orders, selectedOutletId]);

  // Metrics computation
  const metrics = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrders = filteredOrders.filter(
      (o) => new Date(o.created_at).toISOString().slice(0, 10) === todayStr
    );

    const revenueToday = todayOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const totalRevenue = filteredOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const pendingOrders = filteredOrders.filter((o) => o.status === 'pending').length;
    const preparingOrders = filteredOrders.filter(
      (o) => o.status === 'preparing' || o.status === 'accepted'
    );

    return {
      ordersToday: todayOrders.length,
      revenueToday,
      totalOrders: filteredOrders.length,
      totalRevenue,
      pendingOrders,
      preparingOrders: preparingOrders.length,
    };
  }, [filteredOrders]);

  const selectedOutletName = useMemo(() => {
    if (selectedOutletId === 'all') return 'All Outlets';
    const found = outlets.find((o) => o.id === selectedOutletId);
    return found ? found.name : 'Selected Outlet';
  }, [outlets, selectedOutletId]);

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Welcome Banner */}
        <div className="bg-espresso text-cream rounded-[28px] p-6 sm:p-8 relative overflow-hidden shadow-lg border border-espresso-dark">
          <div className="relative z-10 max-w-xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-mustard bg-white/10 px-2.5 py-1 rounded-full inline-block mb-2">
              {isAdmin ? 'System Overview' : `Outlet: ${currentUser?.outlet?.name || 'Local Store'}`}
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-cream tracking-tight mb-2">
              Welcome back, {currentUser?.name}!
            </h1>
            <p className="text-xs sm:text-sm text-cream/75 leading-relaxed">
              Real-time operational summary for Zécha! pickup orders. Monitor live queues, manage menu inventory, and keep staff coordinated.
            </p>
          </div>
        </div>

        {/* Outlet Selector (Pills / Chips) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-espresso/70 uppercase tracking-wider">
              Filter by Branch
            </span>
            <span className="text-[11px] font-semibold text-espresso/50">
              Viewing: <strong className="text-espresso">{selectedOutletName}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {/* All Outlets Pill (Default) */}
            <button
              onClick={() => setSelectedOutletId('all')}
              className={cn(
                'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150',
                selectedOutletId === 'all'
                  ? 'bg-orange text-white shadow-orange-sm'
                  : 'bg-sand text-espresso hover:bg-sand/80'
              )}
            >
              All Outlets
            </button>

            {/* Individual Outlet Pills */}
            {outlets.map((outlet) => {
              const isSelected = selectedOutletId === outlet.id;
              return (
                <button
                  key={outlet.id}
                  onClick={() => setSelectedOutletId(outlet.id)}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 flex items-center gap-1.5',
                    isSelected
                      ? 'bg-orange text-white shadow-orange-sm'
                      : 'bg-sand text-espresso hover:bg-sand/80'
                  )}
                >
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      outlet.is_active ? 'bg-brandGreen' : 'bg-brandRed'
                    )}
                  />
                  <span>{outlet.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats Metric Cards Grid (4 Cards: Orders Today, Revenue Today, Total Orders, Total Revenue) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Orders Today */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider block">
                Orders Today
              </span>
              <span className="font-display text-3xl font-black text-espresso mt-1 block">
                {metrics.ordersToday}
              </span>
              <span className="text-[11px] text-brandGreen font-bold flex items-center gap-1 mt-1">
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Today's pickup queue</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange/15 text-orange flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 stroke-[2]" />
            </div>
          </div>

          {/* 2. Revenue Today */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider block">
                Revenue Today
              </span>
              <span className="font-display text-3xl font-black text-espresso mt-1 block">
                {formatPrice(metrics.revenueToday)}
              </span>
              <span className="text-[11px] text-brandGreen font-bold flex items-center gap-1 mt-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Prepaid orders today</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-mustard/20 text-[#8B6400] flex items-center justify-center">
              <TrendingUp className="w-6 h-6 stroke-[2]" />
            </div>
          </div>

          {/* 3. Total Orders */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider block">
                Total Orders
              </span>
              <span className="font-display text-3xl font-black text-espresso mt-1 block">
                {metrics.totalOrders}
              </span>
              <span className="text-[11px] text-espresso/60 font-semibold flex items-center gap-1 mt-1">
                <Receipt className="w-3.5 h-3.5 text-espresso/40" />
                <span>All-time order count</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-sand text-espresso flex items-center justify-center">
              <UtensilsCrossed className="w-6 h-6 stroke-[2]" />
            </div>
          </div>

          {/* 4. Total Revenue */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider block">
                Total Revenue
              </span>
              <span className="font-display text-3xl font-black text-espresso mt-1 block">
                {formatPrice(metrics.totalRevenue)}
              </span>
              <span className="text-[11px] text-brandGreen font-bold flex items-center gap-1 mt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>All-time settled revenue</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#EBF7EE] text-brandGreen flex items-center justify-center">
              <TrendingUp className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
        </div>

        {/* Live Queue Notice (Filtered by Selected Outlet) */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-mustard/20 text-[#8B6400] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-base text-espresso">
                  Live Kitchen Dispatch Queue
                </h3>
                <span className="text-[10px] bg-sand px-2 py-0.5 rounded-full font-bold text-espresso/80">
                  {selectedOutletName}
                </span>
              </div>
              <p className="text-xs text-espresso/70 mt-0.5">
                {metrics.pendingOrders} pending orders awaiting acceptance · {metrics.preparingOrders} in preparation
              </p>
            </div>
          </div>
          <Link
            href="/admin/orders"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-orange text-cream font-bold text-xs shadow-orange hover:bg-orange-dark transition-all active:scale-95"
          >
            <span>Open Order Dispatch Board</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Quick Links Grid */}
        <div>
          <h2 className="font-display font-black text-lg text-espresso mb-3">
            Quick Navigation
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link
              href="/admin/orders"
              className="p-4 rounded-2xl bg-card border border-border hover:border-orange hover:shadow-orange-sm transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-orange/15 text-orange flex items-center justify-center group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <span className="font-display font-black text-sm text-espresso block">
                  Orders
                </span>
                <span className="text-[11px] text-espresso/60">Live status & actions</span>
              </div>
            </Link>

            <Link
              href="/admin/menu"
              className="p-4 rounded-2xl bg-card border border-border hover:border-orange hover:shadow-orange-sm transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-mustard/20 text-[#8B6400] flex items-center justify-center group-hover:scale-105 transition-transform">
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div>
                <span className="font-display font-black text-sm text-espresso block">
                  Menu Items
                </span>
                <span className="text-[11px] text-espresso/60">Prices & availability</span>
              </div>
            </Link>

            <Link
              href="/admin/users"
              className="p-4 rounded-2xl bg-card border border-border hover:border-orange hover:shadow-orange-sm transition-all flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-xl bg-sand text-espresso flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="font-display font-black text-sm text-espresso block">
                  Staff & Users
                </span>
                <span className="text-[11px] text-espresso/60">Accounts & permissions</span>
              </div>
            </Link>

            {isAdmin && (
              <Link
                href="/admin/outlets"
                className="p-4 rounded-2xl bg-card border border-border hover:border-orange hover:shadow-orange-sm transition-all flex items-center gap-3.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EBF7EE] text-brandGreen flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-display font-black text-sm text-espresso block">
                    Outlets
                  </span>
                  <span className="text-[11px] text-espresso/60">Store branches & hours</span>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}