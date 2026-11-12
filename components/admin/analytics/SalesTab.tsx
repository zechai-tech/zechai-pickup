'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { TrendingUp, ShoppingBag, Receipt, PackageCheck, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatINR, formatIndianNumber, computeDeltaPct } from '@/lib/analytics-utils';
import { AnalyticsEmpty } from './AnalyticsSkeleton';

const RevenuePerDayChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.RevenuePerDayChart),
  {
    ssr: false,
    loading: () => <div className="h-56 w-full rounded-xl bg-[#F4E7CC]/30 animate-pulse" />,
  }
);

export interface SalesData {
  kpis: {
    revenue: number;
    revenue_prev: number;
    orders: number;
    orders_prev: number;
    avg_order_value: number;
    avg_order_value_prev: number;
    items_sold: number;
    items_sold_prev: number;
  };
  daily: Array<{
    date: string;
    formatted_date: string;
    orders: number;
    revenue: number;
    avg_order_value: number;
  }>;
  outlets: Array<{
    outlet_id: string;
    outlet_name: string;
    orders: number;
    revenue: number;
    share_percentage: number;
  }>;
  daily_by_outlet?: Array<{
    date: string;
    outlet_id: string;
    revenue: number;
  }>;
}

function DeltaPill({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const delta = computeDeltaPct(current, previous);
  if (delta.direction === 'na') {
    return (
      <span className="text-[11px] font-bold text-[#75604F]">
        vs prev: n/a
      </span>
    );
  }
  const colorClass =
    delta.direction === 'up'
      ? 'text-[#2F7A3E] bg-[#2F7A3E]/10'
      : delta.direction === 'down'
      ? 'text-[#BA1A1A] bg-[#BA1A1A]/10'
      : 'text-[#75604F] bg-[#F4E7CC]/60';
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${colorClass}`}>
      {delta.direction === 'up' && <ArrowUpRight className="w-3 h-3" />}
      {delta.direction === 'down' && <ArrowDownRight className="w-3 h-3" />}
      <span>{delta.label} vs prev</span>
    </span>
  );
}

export function SalesTab({
  data,
  isAllOutlets,
}: {
  data: SalesData;
  isAllOutlets: boolean;
}) {
  const [chartMode, setChartMode] = useState<'total' | 'by_outlet'>('total');

  const dailyTotals = useMemo(() => {
    const orders = data.daily.reduce((s, d) => s + Number(d.orders || 0), 0);
    const revenue = data.daily.reduce((s, d) => s + Number(d.revenue || 0), 0);
    const aov = orders > 0 ? revenue / orders : 0;
    return { orders, revenue, aov };
  }, [data.daily]);

  const outletTotals = useMemo(() => {
    const orders = data.outlets.reduce((s, o) => s + Number(o.orders || 0), 0);
    const revenue = data.outlets.reduce((s, o) => s + Number(o.revenue || 0), 0);
    return { orders, revenue };
  }, [data.outlets]);

  if (data.daily.length === 0 && data.kpis.orders === 0) {
    return (
      <AnalyticsEmpty
        title="No paid orders in this range"
        subtitle="Try selecting a wider date range or another outlet."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Total revenue
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] block">
              {formatINR(data.kpis.revenue)}
            </span>
            <DeltaPill current={data.kpis.revenue} previous={data.kpis.revenue_prev} />
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Orders
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] block">
              {formatIndianNumber(data.kpis.orders)}
            </span>
            <DeltaPill current={data.kpis.orders} previous={data.kpis.orders_prev} />
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F4E7CC] text-[#2B1A12] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Average order value
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] block">
              {formatINR(data.kpis.avg_order_value)}
            </span>
            <DeltaPill
              current={data.kpis.avg_order_value}
              previous={data.kpis.avg_order_value_prev}
            />
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#2F7A3E]/10 text-[#2F7A3E] flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Items sold
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] block">
              {formatIndianNumber(data.kpis.items_sold)}
            </span>
            <DeltaPill
              current={data.kpis.items_sold}
              previous={data.kpis.items_sold_prev}
            />
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F4E7CC] text-[#75604F] flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Revenue per Day Chart */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
              Revenue per day
            </h2>
            <p className="text-xs text-[#75604F]">
              Paid pickup app orders · IST calendar days
            </p>
          </div>

          {isAllOutlets && data.outlets.length > 0 && (
            <div className="inline-flex rounded-xl bg-[#F4E7CC]/60 p-1 border border-[#EADFC7]">
              <button
                type="button"
                onClick={() => setChartMode('total')}
                className={`px-3.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                  chartMode === 'total'
                    ? 'bg-[#2B1A12] text-[#FDFBEA]'
                    : 'text-[#75604F] hover:text-[#2B1A12]'
                }`}
              >
                Total
              </button>
              <button
                type="button"
                onClick={() => setChartMode('by_outlet')}
                className={`px-3.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                  chartMode === 'by_outlet'
                    ? 'bg-[#2B1A12] text-[#FDFBEA]'
                    : 'text-[#75604F] hover:text-[#2B1A12]'
                }`}
              >
                By outlet
              </button>
            </div>
          )}
        </div>

        <RevenuePerDayChart
          daily={data.daily}
          dailyByOutlet={data.daily_by_outlet || []}
          outlets={data.outlets}
          mode={isAllOutlets ? chartMode : 'total'}
        />
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-3">
        <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
          Daily breakdown
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[#EADFC7]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#F4E7CC]/40 border-b border-[#EADFC7] text-[11px] font-black uppercase tracking-wider text-[#75604F]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Orders</th>
                <th className="py-3 px-4 text-right">Revenue</th>
                <th className="py-3 px-4 text-right">Avg order value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADFC7]/60">
              {data.daily.map((row) => (
                <tr key={row.date} className="hover:bg-[#F4E7CC]/20">
                  <td className="py-3 px-4 font-semibold text-[#2B1A12] whitespace-nowrap">
                    {row.formatted_date}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[#2B1A12]">
                    {formatIndianNumber(row.orders)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#2B1A12]">
                    {formatINR(row.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right text-[#75604F]">
                    {row.orders > 0 ? formatINR(row.avg_order_value) : '₹0'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#F4E7CC]/50 border-t-2 border-[#EADFC7] font-extrabold text-[#2B1A12]">
                <td className="py-3 px-4">Total</td>
                <td className="py-3 px-4 text-right">{formatIndianNumber(dailyTotals.orders)}</td>
                <td className="py-3 px-4 text-right">{formatINR(dailyTotals.revenue)}</td>
                <td className="py-3 px-4 text-right">{formatINR(dailyTotals.aov)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Outlet Breakdown Table (All Outlets only) */}
      {isAllOutlets && data.outlets.length > 0 && (
        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-3">
          <div>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
              Outlet breakdown
            </h2>
            <p className="text-xs text-[#75604F]">
              Share of pickup app orders across branches
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-[#EADFC7]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F4E7CC]/40 border-b border-[#EADFC7] text-[11px] font-black uppercase tracking-wider text-[#75604F]">
                <tr>
                  <th className="py-3 px-4">Outlet</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-right">Share %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADFC7]/60">
                {data.outlets.map((row) => (
                  <tr key={row.outlet_id} className="hover:bg-[#F4E7CC]/20">
                    <td className="py-3 px-4 font-bold text-[#2B1A12] whitespace-nowrap">
                      {row.outlet_name}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#2B1A12]">
                      {formatIndianNumber(row.orders)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#2B1A12]">
                      {formatINR(row.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#75604F]">
                      {Number(row.share_percentage || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F4E7CC]/50 border-t-2 border-[#EADFC7] font-extrabold text-[#2B1A12]">
                  <td className="py-3 px-4">Total</td>
                  <td className="py-3 px-4 text-right">
                    {formatIndianNumber(outletTotals.orders)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatINR(outletTotals.revenue)}
                  </td>
                  <td className="py-3 px-4 text-right">100.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
