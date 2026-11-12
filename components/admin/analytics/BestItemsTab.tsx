'use client';

import React, { useMemo, useState } from 'react';
import { Award, TrendingDown } from 'lucide-react';
import { formatINR, formatIndianNumber } from '@/lib/analytics-utils';
import { AnalyticsEmpty } from './AnalyticsSkeleton';

export interface BestItemsData {
  items: Array<{
    rank: number;
    name: string;
    qty_sold: number;
    revenue: number;
    share_pct: number;
  }>;
  slow_movers: Array<{
    name: string;
    qty_sold: number;
  }>;
  total_revenue: number;
}

export function BestItemsTab({ data }: { data: BestItemsData }) {
  const [sortBy, setSortBy] = useState<'qty' | 'revenue'>('qty');

  const sortedItems = useMemo(() => {
    const copy = [...(data.items || [])];
    copy.sort((a, b) => {
      if (sortBy === 'revenue') {
        return Number(b.revenue) - Number(a.revenue) || Number(b.qty_sold) - Number(a.qty_sold);
      }
      return Number(b.qty_sold) - Number(a.qty_sold) || Number(b.revenue) - Number(a.revenue);
    });
    return copy.map((item, idx) => ({
      ...item,
      displayRank: idx + 1,
    }));
  }, [data.items, sortBy]);

  const totals = useMemo(() => {
    const qty = sortedItems.reduce((s, r) => s + Number(r.qty_sold || 0), 0);
    const rev = sortedItems.reduce((s, r) => s + Number(r.revenue || 0), 0);
    return { qty, rev };
  }, [sortedItems]);

  if (sortedItems.length === 0 && (!data.slow_movers || data.slow_movers.length === 0)) {
    return (
      <AnalyticsEmpty
        title="No items sold in this range"
        subtitle="Item rankings and slow movers will populate once paid orders exist."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Best Items Card */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
                Best selling items
              </h2>
              <p className="text-xs text-[#75604F]">
                Grouped by item across all paid pickup orders
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-xl bg-[#F4E7CC]/60 p-1 border border-[#EADFC7]">
            <button
              type="button"
              onClick={() => setSortBy('qty')}
              className={`px-3.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                sortBy === 'qty'
                  ? 'bg-[#2B1A12] text-[#FDFBEA]'
                  : 'text-[#75604F] hover:text-[#2B1A12]'
              }`}
            >
              Sort by qty
            </button>
            <button
              type="button"
              onClick={() => setSortBy('revenue')}
              className={`px-3.5 min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                sortBy === 'revenue'
                  ? 'bg-[#2B1A12] text-[#FDFBEA]'
                  : 'text-[#75604F] hover:text-[#2B1A12]'
              }`}
            >
              Sort by revenue
            </button>
          </div>
        </div>

        {sortedItems.length === 0 ? (
          <p className="text-xs text-[#75604F] py-6 text-center">
            No items sold in the selected date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#EADFC7]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F4E7CC]/40 border-b border-[#EADFC7] text-[11px] font-black uppercase tracking-wider text-[#75604F]">
                <tr>
                  <th className="py-3 px-4 w-16">Rank</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4 text-right">Qty sold</th>
                  <th className="py-3 px-4 text-right">Revenue</th>
                  <th className="py-3 px-4 text-right">% of revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADFC7]/60">
                {sortedItems.map((item) => (
                  <tr key={item.name} className="hover:bg-[#F4E7CC]/20">
                    <td className="py-3 px-4 font-extrabold text-[#75604F]">
                      #{item.displayRank}
                    </td>
                    <td className="py-3 px-4 font-bold text-[#2B1A12] whitespace-nowrap">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#2B1A12]">
                      {formatIndianNumber(item.qty_sold)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#2B1A12]">
                      {formatINR(item.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#75604F]">
                      {Number(item.share_pct || 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F4E7CC]/50 border-t-2 border-[#EADFC7] font-extrabold text-[#2B1A12]">
                  <td className="py-3 px-4" colSpan={2}>
                    Total
                  </td>
                  <td className="py-3 px-4 text-right">{formatIndianNumber(totals.qty)}</td>
                  <td className="py-3 px-4 text-right">{formatINR(totals.rev)}</td>
                  <td className="py-3 px-4 text-right">
                    {data.total_revenue > 0
                      ? `${((totals.rev / data.total_revenue) * 100).toFixed(1)}%`
                      : '0.0%'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Slow Movers Card */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#F4E7CC] text-[#75604F] flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
              Slow movers
            </h2>
            <p className="text-xs text-[#75604F]">
              5 lowest-selling active menu items in this date range (including 0 sales)
            </p>
          </div>
        </div>

        {!data.slow_movers || data.slow_movers.length === 0 ? (
          <p className="text-xs text-[#75604F] py-3">No active menu items found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
            {data.slow_movers.map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="rounded-2xl bg-[#FDFBEA] border border-[#EADFC7] p-4 flex flex-col justify-between gap-2"
              >
                <span className="text-xs font-extrabold text-[#2B1A12] leading-snug">
                  {item.name}
                </span>
                <span className="text-xs font-bold text-[#75604F]">
                  {formatIndianNumber(item.qty_sold)}{' '}
                  {Number(item.qty_sold) === 1 ? 'unit' : 'units'} sold
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
