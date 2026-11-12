'use client';

import React from 'react';
import { Users, UserPlus, UserCheck, Percent } from 'lucide-react';
import { formatINR, formatIndianNumber } from '@/lib/analytics-utils';
import { AnalyticsEmpty } from './AnalyticsSkeleton';

export interface RepeatCustomersData {
  total_orders: number;
  has_enough_data: boolean;
  is_phone_masked?: boolean;
  kpis: {
    unique_customers: number;
    new_customers: number;
    returning_customers: number;
    repeat_rate_pct: number;
  };
  top_customers: Array<{
    phone: string;
    name: string;
    orders: number;
    total_spent: number;
    last_order_date: string;
    avg_days_between: number | null;
  }>;
}

export function RepeatCustomersTab({ data }: { data: RepeatCustomersData }) {
  if (!data.has_enough_data) {
    return (
      <AnalyticsEmpty
        title="Not enough orders yet."
        subtitle={`Found ${data.total_orders} paid ${
          data.total_orders === 1 ? 'order' : 'orders'
        } in this range. At least 20 paid orders are required to show customer retention metrics.`}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Unique customers
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] mt-1 block">
              {formatIndianNumber(data.kpis.unique_customers)}
            </span>
            <span className="text-[11px] font-semibold text-[#75604F] mt-1 block">
              By 10-digit phone
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F4E7CC] text-[#2B1A12] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              New customers
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] mt-1 block">
              {formatIndianNumber(data.kpis.new_customers)}
            </span>
            <span className="text-[11px] font-semibold text-[#75604F] mt-1 block">
              First paid order in range
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shrink-0">
            <UserPlus className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Returning customers
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] mt-1 block">
              {formatIndianNumber(data.kpis.returning_customers)}
            </span>
            <span className="text-[11px] font-semibold text-[#2F7A3E] mt-1 block">
              Prior order or 2+ in range
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#2F7A3E]/10 text-[#2F7A3E] flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Repeat rate
            </span>
            <span className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B1A12] mt-1 block">
              {Number(data.kpis.repeat_rate_pct || 0).toFixed(1)}%
            </span>
            <span className="text-[11px] font-semibold text-[#75604F] mt-1 block">
              Share of returning buyers
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F4E7CC] text-[#CE5535] flex items-center justify-center shrink-0">
            <Percent className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Top Customers Table */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
              Top customers
            </h2>
            <p className="text-xs text-[#75604F]">
              Top 20 customers sorted by order count then total spend
              {data.is_phone_masked ? ' · Phone numbers masked for manager privacy' : ''}
            </p>
          </div>
        </div>

        {data.top_customers.length === 0 ? (
          <p className="text-xs text-[#75604F] py-6 text-center">
            No customer records found for this date range.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#EADFC7]">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#F4E7CC]/40 border-b border-[#EADFC7] text-[11px] font-black uppercase tracking-wider text-[#75604F]">
                <tr>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4 text-right">Orders</th>
                  <th className="py-3 px-4 text-right">Total spent</th>
                  <th className="py-3 px-4">Last order date</th>
                  <th className="py-3 px-4 text-right">Avg days between</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EADFC7]/60">
                {data.top_customers.map((cust, idx) => (
                  <tr key={`${cust.phone}-${idx}`} className="hover:bg-[#F4E7CC]/20">
                    <td className="py-3 px-4 font-mono font-bold text-[#2B1A12] whitespace-nowrap">
                      {cust.phone}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#2B1A12] whitespace-nowrap">
                      {cust.name || 'Guest Customer'}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-[#2B1A12]">
                      {formatIndianNumber(cust.orders)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-[#2B1A12]">
                      {formatINR(cust.total_spent)}
                    </td>
                    <td className="py-3 px-4 text-[#75604F] whitespace-nowrap">
                      {cust.last_order_date}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#75604F] whitespace-nowrap">
                      {cust.avg_days_between !== null && cust.avg_days_between !== undefined
                        ? `${cust.avg_days_between} d`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
