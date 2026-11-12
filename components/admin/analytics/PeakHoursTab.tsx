'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Clock, CalendarDays, Flame } from 'lucide-react';
import { formatINR, formatHourSlotRange } from '@/lib/analytics-utils';
import { AnalyticsEmpty } from './AnalyticsSkeleton';

const HourlyOrdersBarChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.HourlyOrdersBarChart),
  {
    ssr: false,
    loading: () => <div className="h-52 w-full rounded-xl bg-[#F4E7CC]/30 animate-pulse" />,
  }
);

export interface PeakGridCell {
  day_of_week: number; // 1=Mon .. 7=Sun
  day_name: string;
  hour: number; // 0..23
  hour_label: string;
  orders: number;
  revenue: number;
}

export interface PeakHoursData {
  grid: PeakGridCell[];
  hourly: Array<{
    hour: number;
    hour_label: string;
    orders: number;
    revenue: number;
  }>;
}

const FULL_DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function PeakHoursTab({ data }: { data: PeakHoursData }) {
  const [selectedCell, setSelectedCell] = useState<PeakGridCell | null>(null);

  const summary = useMemo(() => {
    const totalOrders = data.grid.reduce((sum, c) => sum + Number(c.orders || 0), 0);
    const maxCellOrders = Math.max(...data.grid.map((c) => Number(c.orders || 0)), 0);

    // Busiest hour combined across all days
    const busiestHourObj = data.hourly.reduce(
      (best, cur) => (Number(cur.orders) > Number(best.orders) ? cur : best),
      { hour: 0, hour_label: '12 AM', orders: -1, revenue: 0 }
    );

    // Busiest day combined across all hours
    const dayTotals = new Map<number, { orders: number; revenue: number }>();
    for (const c of data.grid) {
      const prev = dayTotals.get(c.day_of_week) || { orders: 0, revenue: 0 };
      dayTotals.set(c.day_of_week, {
        orders: prev.orders + Number(c.orders || 0),
        revenue: prev.revenue + Number(c.revenue || 0),
      });
    }
    let busiestDow = 1;
    let busiestDayOrders = -1;
    dayTotals.forEach((v, dow) => {
      if (v.orders > busiestDayOrders) {
        busiestDayOrders = v.orders;
        busiestDow = dow;
      }
    });

    // Top 3 peak slots
    const top3 = [...data.grid]
      .filter((c) => Number(c.orders) > 0)
      .sort((a, b) => Number(b.orders) - Number(a.orders) || Number(b.revenue) - Number(a.revenue))
      .slice(0, 3);

    return {
      totalOrders,
      maxCellOrders,
      busiestHourObj,
      busiestDayName: FULL_DAY_NAMES[busiestDow],
      busiestDayOrders,
      top3,
    };
  }, [data]);

  const cellMap = useMemo(() => {
    const map = new Map<string, PeakGridCell>();
    for (const c of data.grid) {
      map.set(`${c.day_of_week}_${c.hour}`, c);
    }
    return map;
  }, [data.grid]);

  if (summary.totalOrders === 0) {
    return (
      <AnalyticsEmpty
        title="No order traffic in this range"
        subtitle="Peak hours heat grid will appear once paid orders arrive in the selected dates."
      />
    );
  }

  const getCellBg = (orders: number) => {
    if (orders <= 0 || summary.maxCellOrders <= 0) return '#F9F3E3';
    const ratio = orders / summary.maxCellOrders;
    if (ratio >= 0.8) return '#CE5535';
    if (ratio >= 0.55) return '#DC7B5E';
    if (ratio >= 0.3) return '#EAA88E';
    return '#F7D8CB';
  };

  return (
    <div className="space-y-6">
      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Busiest hour
            </span>
            <span className="font-display text-2xl font-extrabold text-[#2B1A12] mt-1 block">
              {formatHourSlotRange(summary.busiestHourObj.hour)}
            </span>
            <span className="text-xs text-[#75604F] font-semibold mt-1 block">
              {summary.busiestHourObj.orders} orders · {formatINR(summary.busiestHourObj.revenue)}
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#FBEDE3] text-[#CE5535] flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Busiest day
            </span>
            <span className="font-display text-2xl font-extrabold text-[#2B1A12] mt-1 block">
              {summary.busiestDayName}
            </span>
            <span className="text-xs text-[#75604F] font-semibold mt-1 block">
              {summary.busiestDayOrders} paid orders
            </span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#F4E7CC] text-[#2B1A12] flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-[#75604F] block">
              Top 3 peak slots
            </span>
            <div className="mt-1.5 space-y-1">
              {summary.top3.map((slot, idx) => (
                <div key={`${slot.day_of_week}-${slot.hour}`} className="text-xs font-bold text-[#2B1A12] truncate">
                  {idx + 1}. {slot.day_name} {formatHourSlotRange(slot.hour)}{' '}
                  <span className="text-[#75604F] font-semibold">({slot.orders})</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-[#2F7A3E]/10 text-[#2F7A3E] flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 7 x 24 Heat Grid */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
              Orders by weekday & hour (IST)
            </h2>
            <p className="text-xs text-[#75604F]">
              Tap or hover any cell to inspect orders and revenue
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#75604F]">
            <span>Less</span>
            <span className="w-3.5 h-3.5 rounded bg-[#F9F3E3] border border-[#EADFC7]" />
            <span className="w-3.5 h-3.5 rounded bg-[#F7D8CB]" />
            <span className="w-3.5 h-3.5 rounded bg-[#EAA88E]" />
            <span className="w-3.5 h-3.5 rounded bg-[#DC7B5E]" />
            <span className="w-3.5 h-3.5 rounded bg-[#CE5535]" />
            <span>More</span>
          </div>
        </div>

        {/* Tooltip Strip */}
        <div className="min-h-[36px] px-3 py-2 rounded-xl bg-[#F4E7CC]/50 border border-[#EADFC7] text-xs font-bold text-[#2B1A12] flex items-center justify-between">
          {selectedCell ? (
            <span>
              {selectedCell.day_name} {formatHourSlotRange(selectedCell.hour)}: {selectedCell.orders}{' '}
              {selectedCell.orders === 1 ? 'order' : 'orders'} · {formatINR(selectedCell.revenue)}
            </span>
          ) : (
            <span className="text-[#75604F] font-medium">
              Hover or tap a cell in the grid to view exact slot numbers
            </span>
          )}
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[760px]">
            {/* Hour Header Row */}
            <div className="grid grid-cols-[52px_repeat(24,minmax(26px,1fr))] gap-1 mb-1">
              <div />
              {HOURS.map((h) => {
                const shortLabel =
                  h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;
                return (
                  <div
                    key={h}
                    className="text-[10px] font-bold text-[#75604F] text-center"
                    title={formatHourSlotRange(h)}
                  >
                    {shortLabel}
                  </div>
                );
              })}
            </div>

            {/* 7 Day Rows */}
            <div className="space-y-1">
              {DAYS.map((dow) => {
                const dayShort = FULL_DAY_NAMES[dow].slice(0, 3);
                return (
                  <div
                    key={dow}
                    className="grid grid-cols-[52px_repeat(24,minmax(26px,1fr))] gap-1 items-center"
                  >
                    <div className="text-xs font-bold text-[#2B1A12] pr-2">
                      {dayShort}
                    </div>
                    {HOURS.map((h) => {
                      const cell = cellMap.get(`${dow}_${h}`) || {
                        day_of_week: dow,
                        day_name: dayShort,
                        hour: h,
                        hour_label: formatHourSlotRange(h),
                        orders: 0,
                        revenue: 0,
                      };
                      const isSelected =
                        selectedCell?.day_of_week === dow && selectedCell?.hour === h;
                      const ordersCount = Number(cell.orders || 0);
                      const bg = getCellBg(ordersCount);
                      const textWhite =
                        ordersCount > 0 && ordersCount / Math.max(summary.maxCellOrders, 1) >= 0.55;

                      return (
                        <button
                          key={h}
                          type="button"
                          onMouseEnter={() => setSelectedCell(cell)}
                          onClick={() => setSelectedCell(cell)}
                          aria-label={`${dayShort} ${formatHourSlotRange(h)}: ${ordersCount} orders, ${formatINR(cell.revenue)}`}
                          style={{ backgroundColor: bg }}
                          className={`h-8 rounded-md text-[10px] font-bold flex items-center justify-center transition-transform duration-150 motion-reduce:transition-none ${
                            textWhite ? 'text-[#FDFBEA]' : 'text-[#2B1A12]/80'
                          } ${isSelected ? 'ring-2 ring-[#2B1A12] scale-105 z-10' : 'hover:ring-1 hover:ring-[#2B1A12]/40'}`}
                        >
                          {ordersCount > 0 ? ordersCount : ''}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Combined Bar Chart */}
      <div className="bg-[#FFFEF7] border border-[#EADFC7] rounded-[20px] p-5 space-y-4">
        <div>
          <h2 className="font-display text-base sm:text-lg font-extrabold text-[#2B1A12]">
            Orders by hour (all days combined)
          </h2>
          <p className="text-xs text-[#75604F]">
            Total pickup orders per IST hour across the selected date range
          </p>
        </div>
        <HourlyOrdersBarChart hourly={data.hourly} />
      </div>
    </div>
  );
}
