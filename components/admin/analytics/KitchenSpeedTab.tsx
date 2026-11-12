'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Clock, AlertTriangle, CheckCircle2, Gauge, Info, X, Loader2 } from 'lucide-react';
import { formatDurationSeconds, formatINR } from '@/lib/analytics-utils';
import { AnalyticsEmpty } from './AnalyticsSkeleton';
import { supabase } from '@/lib/supabase';
import { useAdminStore } from '@/stores/admin-store';

const KitchenSpeedTrendChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.KitchenSpeedTrendChart),
  {
    ssr: false,
    loading: () => <div className="h-52 w-full rounded-xl bg-[#F4E7CC]/30 animate-pulse" />,
  }
);

export interface KitchenSpeedData {
  kpis: {
    total_paid_orders: number;
    measured_orders: number;
    excluded_orders: number;
    avg_paid_to_ready_sec: number;
    avg_paid_to_ready_min: number;
    pct_within_20: number;
    avg_making_sec: number;
    avg_packaging_sec: number;
    slowest_order_id: string | null;
    slowest_order_code: string | null;
    slowest_order_min: number | null;
  };
  daily_trend: Array<{
    date: string;
    formatted_date: string;
    avg_minutes: number;
    measured_orders: number;
  }>;
  slowest_orders: Array<{
    id: string;
    order_number: string;
    outlet_name: string;
    ordered_at: string;
    total_minutes: number;
    total_seconds: number;
  }>;
}

interface OrderDetailModalData {
  id: string;
  pickup_code: string;
  outlet_name: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  kitchen_note?: string | null;
  items: Array<{ name: string; qty?: number; quantity?: number; price?: number; unitPrice?: number }>;
  paid_at?: string | null;
  making_at?: string | null;
  packaging_at?: string | null;
  ready_at?: string | null;
  received_at?: string | null;
}

function fmtTimeIST(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function KitchenSpeedTab({ data }: { data: KitchenSpeedData }) {
  const { sessionToken } = useAdminStore();
  const [inspectingOrder, setInspectingOrder] = useState<OrderDetailModalData | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const openOrderModal = async (orderId: string | null) => {
    if (!orderId) return;
    setLoadingOrder(true);
    setOrderError(null);
    setInspectingOrder(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || sessionToken;
      const res = await fetch(`/api/admin/analytics/order?id=${encodeURIComponent(orderId)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load order');
      setInspectingOrder(json.order);
    } catch (err: any) {
      setOrderError(err?.message || 'Failed to load order details');
    } finally {
      setLoadingOrder(false);
    }
  };

  if (data.kpis.measured_orders === 0 && data.kpis.total_paid_orders === 0) {
    return (
      <AnalyticsEmpty
        title="No kitchen speed data yet"
        subtitle="Orders need both paid_at and ready_at timestamps to compute preparation speed."
      />
    );
  }

  const makingSec = Number(data.kpis.avg_making_sec || 0);
  const packagingSec = Number(data.kpis.avg_packaging_sec || 0);
  const stageTotal = makingSec + packagingSec;
  const makingPct = stageTotal > 0 ? Math.round((makingSec / stageTotal) * 100) : 50;
  const packagingPct = stageTotal > 0 ? 100 - makingPct : 50;

  return (
    <div className="space-y-6">
      {/* Excluded Orders Notice */}
      {data.kpis.excluded_orders > 0 && (
        <div className="bg-[#F4E7CC]/60 border border-[#EADFC7] rounded-2xl px-4 py-3 flex items-center gap-2.5 text-xs font-semibold text-[#2B1A12]">
          <Info className="w-4 h-4 text-[#CE5535] shrink-0" />
          <span>
            <strong>{data.kpis.excluded_orders}</strong>{' '}
            {data.kpis.excluded_orders === 1 ? 'order was' : 'orders were'} excluded because{' '}
            <code className="font-mono text-[11px]">paid_at</code> or{' '}
            <code className="font-mono text-[11px]">ready_at</code> timestamp is missing.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Avg time paid → ready
            </span>
            <span className="font-display text-2xl font-extrabold text-[#2B1A12] mt-1 block">
              {formatDurationSeconds(data.kpis.avg_paid_to_ready_sec)}
            </span>
            <span className="text-[11px] font-semibold text-[#75604F] mt-1 block">
              Promise: 15–20 min
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <button
          type="button"
          onClick={() => openOrderModal(data.kpis.slowest_order_id)}
          disabled={!data.kpis.slowest_order_id}
          className="text-left bg-[#FFFEF7] border border-[#EADFC7] hover:border-[#CE5535] rounded-[20px] p-5 flex items-start justify-between gap-3 transition-colors disabled:cursor-default disabled:hover:border-[#EADFC7]"
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Slowest order
            </span>
            <span className="font-display text-2xl font-extrabold text-[#2B1A12] mt-1 block">
              {data.kpis.slowest_order_min !== null
                ? formatDurationSeconds(Math.round(Number(data.kpis.slowest_order_min) * 60))
                : '—'}
            </span>
            {data.kpis.slowest_order_code && (
              <span className="text-xs font-bold text-[#CE5535] underline mt-1 inline-block">
                Order #{data.kpis.slowest_order_code} · Tap to view
              </span>
            )}
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#BA1A1A]/10 text-[#BA1A1A] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </button>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Ready within 20 min
            </span>
            <span className="font-display text-2xl font-extrabold text-[#2B1A12] mt-1 block">
              {Number(data.kpis.pct_within_20 || 0).toFixed(1)}%
            </span>
            <span className="text-[11px] font-semibold text-[#2F7A3E] mt-1 block">
              Target SLA compliance
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#2F7A3E]/10 text-[#2F7A3E] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Orders measured
            </span>
            <span className="font-display text-2xl font-extrabold text-[#2B1A12] mt-1 block">
              {data.kpis.measured_orders}
            </span>
            <span className="text-[11px] font-semibold text-[#75604F] mt-1 block">
              Out of {data.kpis.total_paid_orders} paid orders
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F4E7CC] text-[#2B1A12] flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Stage Breakdown Horizontal Bar */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-4">
        <div>
          <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
            Stage breakdown
          </h2>
          <p className="text-xs text-[#75604F]">
            Average time spent in kitchen making vs packaging handover
          </p>
        </div>

        <div className="w-full h-10 rounded-2xl overflow-hidden flex border border-[#EADFC7] text-xs font-bold">
          <div
            style={{ width: `${makingPct}%` }}
            className="bg-[#CE5535] text-[#FDFBEA] flex items-center justify-center px-2 truncate"
            title={`Making: ${formatDurationSeconds(makingSec)}`}
          >
            Making ({makingPct}%)
          </div>
          <div
            style={{ width: `${packagingPct}%` }}
            className="bg-[#2B1A12] text-[#FDFBEA] flex items-center justify-center px-2 truncate"
            title={`Packaging: ${formatDurationSeconds(packagingSec)}`}
          >
            Packaging ({packagingPct}%)
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#FBEDE3]/70 border border-[#EADFC7]">
            <span className="flex items-center gap-2 font-bold text-[#2B1A12]">
              <span className="w-3 h-3 rounded-full bg-[#CE5535]" />
              Making (paid / making → packaging)
            </span>
            <span className="font-extrabold text-[#2B1A12]">
              {formatDurationSeconds(makingSec)}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F4E7CC]/50 border border-[#EADFC7]">
            <span className="flex items-center gap-2 font-bold text-[#2B1A12]">
              <span className="w-3 h-3 rounded-full bg-[#2B1A12]" />
              Packaging (packaging → ready)
            </span>
            <span className="font-extrabold text-[#2B1A12]">
              {formatDurationSeconds(packagingSec)}
            </span>
          </div>
        </div>
      </div>

      {/* Daily Trend Chart with 20 min line */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-4">
        <div>
          <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
            Daily average prep speed
          </h2>
          <p className="text-xs text-[#75604F]">
            Average paid-to-ready time per day compared against the 20 min pickup promise
          </p>
        </div>
        <KitchenSpeedTrendChart data={data.daily_trend} />
      </div>

      {/* Top 10 Slowest Orders Table */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-3">
        <div>
          <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
            10 slowest orders
          </h2>
          <p className="text-xs text-[#75604F]">Tap any row to inspect order timestamps</p>
        </div>

        {data.slowest_orders.length === 0 ? (
          <p className="text-xs text-[#75604F] py-4">No measured orders in this range.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#EADFC7]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F4E7CC]/40 border-b border-[#EADFC7] text-[11px] font-black uppercase tracking-wider text-[#75604F]">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Outlet</th>
                  <th className="py-3 px-4">Ordered at (IST)</th>
                  <th className="py-3 px-4 text-right">Total time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADFC7]/60">
                {data.slowest_orders.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => openOrderModal(row.id)}
                    className="hover:bg-[#F4E7CC]/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-extrabold text-[#CE5535] underline whitespace-nowrap">
                      #{row.order_number}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#2B1A12] whitespace-nowrap">
                      {row.outlet_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-[#75604F] whitespace-nowrap">
                      {row.ordered_at}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-[#2B1A12] whitespace-nowrap">
                      {formatDurationSeconds(row.total_seconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Inspection Modal */}
      {(loadingOrder || inspectingOrder || orderError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B1A12]/60 backdrop-blur-xs p-4"
          onClick={() => {
            setInspectingOrder(null);
            setOrderError(null);
          }}
        >
          <div
            className="bg-[#FFFEF7] w-full max-w-md rounded-[24px] border border-[#EADFC7] p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#EADFC7] pb-3">
              <h3 className="font-display text-lg font-extrabold text-[#2B1A12]">
                {inspectingOrder ? `Order #${inspectingOrder.pickup_code}` : 'Order Details'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setInspectingOrder(null);
                  setOrderError(null);
                }}
                className="w-9 h-9 rounded-full bg-[#F4E7CC]/60 flex items-center justify-center text-[#2B1A12]"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingOrder && (
              <div className="py-10 flex flex-col items-center justify-center gap-2 text-xs text-[#75604F]">
                <Loader2 className="w-6 h-6 animate-spin text-[#CE5535]" />
                <span>Loading order details...</span>
              </div>
            )}

            {orderError && (
              <p className="text-xs font-bold text-[#BA1A1A] py-4">{orderError}</p>
            )}

            {inspectingOrder && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-[#FDFBEA] p-3.5 rounded-2xl border border-[#EADFC7]">
                  <div>
                    <span className="text-[#75604F] block">Outlet</span>
                    <strong className="text-[#2B1A12]">{inspectingOrder.outlet_name}</strong>
                  </div>
                  <div>
                    <span className="text-[#75604F] block">Total paid</span>
                    <strong className="text-[#2B1A12]">{formatINR(inspectingOrder.total)}</strong>
                  </div>
                  <div>
                    <span className="text-[#75604F] block">Customer</span>
                    <strong className="text-[#2B1A12]">
                      {inspectingOrder.customer_name || 'Guest'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#75604F] block">Phone</span>
                    <strong className="text-[#2B1A12]">{inspectingOrder.customer_phone}</strong>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-[#2B1A12] uppercase tracking-wider text-[11px] mb-2">
                    Items
                  </h4>
                  <ul className="space-y-1.5 bg-[#FDFBEA] p-3.5 rounded-2xl border border-[#EADFC7]">
                    {(Array.isArray(inspectingOrder.items) ? inspectingOrder.items : []).map(
                      (item, i) => (
                        <li key={i} className="flex justify-between font-semibold text-[#2B1A12]">
                          <span>
                            {item.quantity || item.qty || 1} × {item.name}
                          </span>
                          <span>
                            {formatINR(
                              (item.quantity || item.qty || 1) *
                                (item.unitPrice || item.price || 0)
                            )}
                          </span>
                        </li>
                      )
                    )}
                  </ul>
                </div>

                <div>
                  <h4 className="font-bold text-[#2B1A12] uppercase tracking-wider text-[11px] mb-2">
                    Kitchen Timestamps (IST)
                  </h4>
                  <div className="space-y-1.5 bg-[#FDFBEA] p-3.5 rounded-2xl border border-[#EADFC7]">
                    <div className="flex justify-between">
                      <span className="text-[#75604F]">Paid</span>
                      <span className="font-bold text-[#2B1A12]">{fmtTimeIST(inspectingOrder.paid_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#75604F]">Making</span>
                      <span className="font-bold text-[#2B1A12]">{fmtTimeIST(inspectingOrder.making_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#75604F]">Packaging</span>
                      <span className="font-bold text-[#2B1A12]">{fmtTimeIST(inspectingOrder.packaging_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#75604F]">Ready</span>
                      <span className="font-bold text-[#2B1A12]">{fmtTimeIST(inspectingOrder.ready_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#75604F]">Received</span>
                      <span className="font-bold text-[#2B1A12]">{fmtTimeIST(inspectingOrder.received_at)}</span>
                    </div>
                  </div>
                </div>

                <Link
                  href="/admin/orders"
                  className="w-full min-h-[44px] rounded-xl bg-[#2B1A12] text-[#FDFBEA] font-bold flex items-center justify-center hover:bg-[#1C100A] transition-colors"
                >
                  Open Orders Manager
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
