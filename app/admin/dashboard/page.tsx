'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAdminStore, getUserScope } from '@/stores/admin-store';
import { RoleGuard } from '@/components/admin/RoleGuard';
import { Outlet, Order } from '@/types/supabase';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { formatPrice, cn } from '@/lib/utils';
import { normalizeOrderStatus } from '@/lib/order-flow';
import { useToast } from '@/components/ui/Toast';
import {
  Store,
  ShoppingBag,
  TrendingUp,
  UtensilsCrossed,
  Users,
  Clock,
  ArrowRight,
  CalendarCheck,
  Receipt,
  CheckCircle2,
  Package,
  Flame,
  Phone,
  Copy,
  Check,
  CreditCard,
  Search,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { currentUser, syncTrigger } = useAdminStore();
  const { isAdmin, isManager } = getUserScope(currentUser);
  const { showToast } = useToast();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Table filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Admin fetches all outlets; manager only fetches/uses their own outlet
      if (isAdmin) {
        const resOutlets = await fetch('/api/admin/outlets', { cache: 'no-store' });
        const dataOutlets = await resOutlets.json();
        setOutlets(dataOutlets.outlets || []);
      }

      // Query orders with scope
      const outletParam = isManager && currentUser?.outlet_id ? `?outlet_id=${currentUser.outlet_id}` : '';
      const resOrders = await fetch(`/api/admin/orders${outletParam}`, { cache: 'no-store' });
      const dataOrders = await resOrders.json();
      setOrders(dataOrders.orders || []);

      if (isManager && currentUser?.outlet_id) {
        setSelectedOutletId(currentUser.outlet_id);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.outlet_id, isAdmin, isManager]);

  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser, loadData, syncTrigger]);

  // Filter orders by outlet
  const filteredOrders = useMemo(() => {
    if (isManager && currentUser?.outlet_id) {
      return orders.filter((o) => o.outlet_id === currentUser.outlet_id);
    }
    if (selectedOutletId === 'all') {
      return orders;
    }
    return orders.filter((o) => o.outlet_id === selectedOutletId);
  }, [orders, selectedOutletId, isManager, currentUser?.outlet_id]);

  // Metrics computation: Count ONLY orders with payment_status === 'success' and not cancelled-with-refund_required
  const metrics = useMemo(() => {
    const isPaidAndValid = (o: Order) => {
      const isPaid = o.payment_status === 'success';
      const isCancelledRefund = o.status === 'cancelled' && !!o.refund_required;
      return isPaid && !isCancelledRefund;
    };

    const validPaidOrders = filteredOrders.filter(isPaidAndValid);
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayPaidOrders = validPaidOrders.filter(
      (o) => new Date(o.created_at).toISOString().slice(0, 10) === todayStr
    );

    const revenueToday = todayPaidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
    const totalRevenue = validPaidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const pendingOrders = filteredOrders.filter(
      (o) => normalizeOrderStatus(o.status) === 'pending'
    ).length;

    // Two distinct cards: Making and Packaging
    const makingOrders = filteredOrders.filter(
      (o) => normalizeOrderStatus(o.status) === 'preparing'
    ).length;

    const packagingOrders = filteredOrders.filter(
      (o) => normalizeOrderStatus(o.status) === 'packaging'
    ).length;

    return {
      ordersToday: todayPaidOrders.length,
      revenueToday,
      totalOrders: validPaidOrders.length,
      totalRevenue,
      pendingOrders,
      makingOrders,
      packagingOrders,
    };
  }, [filteredOrders]);

  const selectedOutletName = useMemo(() => {
    if (isManager) {
      return currentUser?.outlet?.name || currentUser?.outlet_name || 'Your Assigned Outlet';
    }
    if (selectedOutletId === 'all') return 'All Outlets';
    const found = outlets.find((o) => o.id === selectedOutletId);
    return found ? found.name : 'Selected Outlet';
  }, [outlets, selectedOutletId, isManager, currentUser]);

  // Filtered orders for the Table
  const tableOrders = useMemo(() => {
    return filteredOrders.filter((o) => {
      // Status filter
      if (statusFilter !== 'all') {
        const canon = normalizeOrderStatus(o.status);
        if (statusFilter === 'pending_payment' && o.status !== 'pending_payment') return false;
        if (statusFilter !== 'pending_payment' && canon !== statusFilter) return false;
      }

      // Payment filter
      if (paymentFilter === 'paid') {
        if (o.payment_status !== 'success') return false;
      } else if (paymentFilter === 'unpaid') {
        if (o.payment_status === 'success') return false;
      }

      // Search filter (pickup code or phone)
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase().trim();
        const codeMatch = (o.pickup_code || '').toLowerCase().includes(q);
        const phoneMatch = (o.customer_phone || '').includes(q);
        const nameMatch = (o.customer_name || '').toLowerCase().includes(q);
        if (!codeMatch && !phoneMatch && !nameMatch) return false;
      }

      return true;
    });
  }, [filteredOrders, statusFilter, paymentFilter, tableSearch]);

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    showToast('Phone number copied to clipboard', 'info');
  };

  return (
    <RoleGuard allowedRoles={['admin', 'manager']}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Welcome Banner */}
        <div className="bg-espresso text-cream rounded-[28px] p-6 sm:p-8 relative overflow-hidden shadow-lg border border-espresso-dark">
          <div className="relative z-10 max-w-xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-mustard bg-white/10 px-2.5 py-1 rounded-full inline-block mb-2">
              {isAdmin ? 'System Overview' : `Outlet: ${currentUser?.outlet?.name || currentUser?.outlet_name || 'Assigned Branch'}`}
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-cream tracking-tight mb-2">
              Welcome back, {currentUser?.name}!
            </h1>
            <p className="text-xs sm:text-sm text-cream/75 leading-relaxed">
              {isAdmin
                ? 'System-wide operational summary for Zécha! pickup orders across all branches.'
                : `Live operational summary for ${currentUser?.outlet?.name || currentUser?.outlet_name || 'your outlet'}. Manage orders, kitchen queues, and staff.`}
            </p>
          </div>
        </div>

        {/* Outlet Selector (Pills) - ADMIN ONLY */}
        {isAdmin && (
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
        )}

        {/* Stats Metric Cards Grid (Paid Orders Today, Revenue Today, Total Paid Orders, Total Revenue) */}
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
                <span>Paid orders today</span>
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
                <span>Settled revenue today</span>
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
                <span>Paid orders settled</span>
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
                <span>All-time net revenue</span>
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#EBF7EE] text-brandGreen flex items-center justify-center">
              <TrendingUp className="w-6 h-6 stroke-[2]" />
            </div>
          </div>
        </div>

        {/* Live Kitchen Queue Stats: Making & Packaging Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Making Stat Card */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider">
                  Making
                </span>
                <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
              </div>
              <span className="font-display text-3xl font-black text-espresso mt-1 block">
                {metrics.makingOrders}
              </span>
              <span className="text-[11px] text-espresso/60 font-medium">
                Orders actively being prepared in the kitchen
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-orange-soft text-orange-dark flex items-center justify-center">
              <Flame className="w-6 h-6" />
            </div>
          </div>

          {/* Packaging Stat Card */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-xs flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-espresso/60 uppercase tracking-wider">
                  Packaging
                </span>
                <span className="w-2 h-2 rounded-full bg-[#1D4ED8] animate-pulse" />
              </div>
              <span className="font-display text-3xl font-black text-espresso mt-1 block">
                {metrics.packagingOrders}
              </span>
              <span className="text-[11px] text-espresso/60 font-medium">
                Orders being packed and checked for handover
              </span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Table of ALL Orders (Any Status) */}
        <div className="bg-card rounded-3xl border border-border p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display font-black text-lg text-espresso tracking-tight">
                All Orders Overview
              </h2>
              <p className="text-xs text-espresso/60">
                Full order book with payment status from Cashfree data
              </p>
            </div>

            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange text-white text-xs font-bold hover:bg-orange-dark transition-colors self-start sm:self-auto"
            >
              <span>Manage in Orders</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Filters Bar: Search, Status, Payment */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-espresso/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pickup code, phone, or name..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-sand/20 border border-border text-xs text-espresso focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-sand/20 px-3 py-1.5 rounded-xl border border-border">
              <span className="text-[11px] font-bold text-espresso/50 uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-espresso focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="pending_payment">Awaiting Payment</option>
                <option value="pending">Pending (Paid)</option>
                <option value="preparing">Making</option>
                <option value="packaging">Packaging</option>
                <option value="ready">Completed (Ready)</option>
                <option value="received">Customer Received</option>
                <option value="cancelled">Cancelled</option>
                <option value="payment_cancelled">Payment Cancelled</option>
              </select>
            </div>

            {/* Payment Filter */}
            <div className="flex items-center gap-1.5 bg-sand/20 px-3 py-1.5 rounded-xl border border-border">
              <span className="text-[11px] font-bold text-espresso/50 uppercase">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-espresso focus:outline-none cursor-pointer"
              >
                <option value="all">All Payments</option>
                <option value="paid">Payment Processed</option>
                <option value="unpaid">Not Paid</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-border/80">
            <table className="w-full text-left text-xs">
              <thead className="bg-sand/30 border-b border-border text-[10px] font-black uppercase tracking-wider text-espresso/60">
                <tr>
                  <th className="py-3 px-4">Pickup Code</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tableOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-espresso/50">
                      No orders found matching the filters.
                    </td>
                  </tr>
                ) : (
                  tableOrders.map((order) => {
                    const itemsList = Array.isArray(order.items) ? order.items : [];
                    const isPaid = order.payment_status === 'success';
                    const shortPaymentId = order.cf_payment_id
                      ? `...${String(order.cf_payment_id).slice(-6)}`
                      : '';

                    return (
                      <tr key={order.id} className="hover:bg-sand/20 transition-colors">
                        {/* Pickup Code */}
                        <td className="py-3.5 px-4 font-display font-black text-sm text-espresso select-all">
                          #{order.pickup_code}
                        </td>

                        {/* Customer Phone & Name */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-espresso block">{order.customer_name}</span>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="select-text text-espresso/80 font-medium">
                              {order.customer_phone}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(order.customer_phone)}
                              className="text-espresso/40 hover:text-espresso p-0.5"
                              title="Copy phone"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <a
                              href={`tel:${order.customer_phone}`}
                              className="text-orange hover:text-orange-dark p-0.5"
                              title="Call"
                            >
                              <Phone className="w-3 h-3" />
                            </a>
                          </div>
                        </td>

                        {/* Items */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <span className="text-espresso/80 line-clamp-2">
                            {itemsList.map((i) => `${i.qty || 1}x ${i.name}`).join(', ')}
                          </span>
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 font-bold text-espresso">
                          {formatPrice(Number(order.total))}
                        </td>

                        {/* Order Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={order.status} size="sm" />
                        </td>

                        {/* Payment Column */}
                        <td className="py-3.5 px-4">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EBF7EE] text-brandGreen border border-brandGreen/30 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 shrink-0" />
                              <span>Payment processed</span>
                              {order.payment_method && (
                                <span className="opacity-80 uppercase text-[9px] font-black">
                                  ({order.payment_method}
                                  {shortPaymentId ? ` ${shortPaymentId}` : ''})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sand/40 text-espresso/60 border border-border text-[10px] font-bold">
                              <span>Not paid</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}
