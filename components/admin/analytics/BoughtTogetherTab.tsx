'use client';

import React from 'react';
import { Layers } from 'lucide-react';
import { formatIndianNumber } from '@/lib/analytics-utils';
import { AnalyticsEmpty } from './AnalyticsSkeleton';

export interface BoughtTogetherData {
  total_orders: number;
  has_enough_data: boolean;
  pairs: Array<{
    item_a: string;
    item_b: string;
    times_together: number;
    pct_of_a: number;
  }>;
}

export function BoughtTogetherTab({ data }: { data: BoughtTogetherData }) {
  if (!data.has_enough_data) {
    return (
      <AnalyticsEmpty
        title="Not enough orders yet to show patterns."
        subtitle={`Found ${data.total_orders} paid ${
          data.total_orders === 1 ? 'order' : 'orders'
        } in this range. At least 20 paid orders are required to identify reliable item combinations.`}
      />
    );
  }

  if (!data.pairs || data.pairs.length === 0) {
    return (
      <AnalyticsEmpty
        title="No repeat item combinations found"
        subtitle="No two items were ordered together at least 2 times in this date range."
      />
    );
  }

  return (
    <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-2xl bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
            Frequently bought together
          </h2>
          <p className="text-xs text-[#75604F]">
            Top {data.pairs.length} item pairs appearing together in 2+ orders (across{' '}
            {formatIndianNumber(data.total_orders)} paid orders)
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[#EADFC7]">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-[#F4E7CC]/40 border-b border-[#EADFC7] text-[11px] font-black uppercase tracking-wider text-[#75604F]">
            <tr>
              <th className="py-3 px-4">Item A + Item B</th>
              <th className="py-3 px-4 text-right">Times together</th>
              <th className="py-3 px-4 text-right">% of orders containing A</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EADFC7]/60">
            {data.pairs.map((pair, idx) => (
              <tr
                key={`${pair.item_a}-${pair.item_b}-${idx}`}
                className="hover:bg-[#F4E7CC]/20"
              >
                <td className="py-3 px-4 font-bold text-[#2B1A12] whitespace-nowrap">
                  <span>{pair.item_a}</span>
                  <span className="mx-2 text-[#CE5535] font-black">+</span>
                  <span>{pair.item_b}</span>
                </td>
                <td className="py-3 px-4 text-right font-extrabold text-[#2B1A12]">
                  {formatIndianNumber(pair.times_together)}
                </td>
                <td className="py-3 px-4 text-right font-semibold text-[#75604F]">
                  {Number(pair.pct_of_a || 0).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
