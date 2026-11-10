'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminStore } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { formatPrice } from '@/lib/utils';
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
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { currentUser } = useAdminStore();
  const isAdmin = currentUser?.role === 'admin';

  const [metrics, setMetrics] = useState({
    totalOutlets: 0,
    ordersToday: 0,
    revenueToday: 0,
    pendingOrders: 0,
    preparingOrders: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const outletParam = !isAdmin && currentUser?.outlet_id ? `?outlet_id=${currentUser.outlet_id}` : '';

        // Fetch outlets count (for admin)
        let outletsCount = 1;
        if (isAdmin) {
          const resOutlets = await fetch('/api/admin/outlets');
          const dataOutlets = await resOutlets.json();
          outletsCount = dataOutlets.outlets?.length || 1;
        }

        // Fetch orders
        const resOrders = await fetch(`/api/admin/orders${outletParam}`);
        const dataOrders = await resOrders.json();
        const ordersList: any[] = dataOrders.orders || [];

        // Calculate today's stats
        const todayStr = new Date().toISOString().slice(0, 10);
        const todayOrders = ordersList.filter(
          (o) => new Date(o.created_at).toISOString().slice(0, 10) === todayStr
        );

        const revenue = todayOrders
          .filter((o) => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.total || 0), 0);

        const pending = ordersList.filter((o) => o.status === 'pending').length;
        const preparing = ordersList.filter((o) => o.status === 'preparing' || o.status === 'accepted').length;

        setMetrics({
          totalOutlets: outletsCount,
          ordersToday: todayOrders.length,
          revenueToday: revenue,
          pendingOrders: pending,
          preparingOrders: preparing,
        });
      } catch (e) {
        console.error('Error fetching dashboard metrics:', e);
      } finally {
        setLoading(false);
      }
    }

    if (currentUser) {
      fetchStats();
    }
  }, [currentUser, isAdmin]);

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
              Here is your daily operational summary for Zécha! pickup orders. Monitor live queues, manage menu inventory, and keep staff coordinated.
            </p>
          </div>
        </div>

        {/* Stats Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Orders Today */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider block">
                Orders Today
              </span>
              <span className="font-display text-3xl font-black text-espresso mt-1 block">
                {metrics.ordersToday}
              </span>
              <span className="text-[11px] text-brandGreen font-bold flex items-center gap-1 mt-1">
                <span>Active queue running</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange/15 text-orange flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 stroke-[2]" />
            </div>
          </div>

          {/* Revenue Today */}
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
                <span>Prepaid via UPI & Gateway</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-mustard/20 text-[#8B6400] flex items-center justify-center">
              <TrendingUp className="w-6 h-6 stroke-[2]" />
            </div>
          </div>

          {/* Total Outlets (Admin only) or Active Prep Queue (Manager) */}
          {isAdmin ? (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider block">
                  Total Outlets
                </span>
                <span className="font-display text-3xl font-black text-espresso mt-1 block">
                  {metrics.totalOutlets}
                </span>
                <Link
                  href="/admin/outlets"
                  className="text-[11px] text-orange font-bold flex items-center gap-1 mt-1 hover:underline"
                >
                  <span>Manage store locations →</span>
                </Link>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-sand text-espresso flex items-center justify-center">
                <Store className="w-6 h-6 stroke-[2]" />
              </div>
            </div>
          ) : (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider block">
                  Kitchen In-Flight
                </span>
                <span className="font-display text-3xl font-black text-espresso mt-1 block">
                  {metrics.preparingOrders}
                </span>
                <span className="text-[11px] text-orange-dark font-bold flex items-center gap-1 mt-1">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Currently brewing/frying</span>
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-orange-soft text-orange-dark flex items-center justify-center">
                <Flame className="w-6 h-6 stroke-[2]" />
              </div>
            </div>
          )}
        </div>

        {/* Live Queue Notice */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-mustard/20 text-[#8B6400] flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-espresso">
                Live Kitchen Dispatch Queue
              </h3>
              <p className="text-xs text-espresso/70">
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
