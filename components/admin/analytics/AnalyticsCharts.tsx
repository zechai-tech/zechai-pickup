'use client';

import React, { useState, useMemo } from 'react';
import { formatINR } from '@/lib/analytics-utils';

const OUTLET_COLORS = [
  '#CE5535', // Zécha Accent
  '#2F7A3E', // Green
  '#2B1A12', // Espresso Ink
  '#D97706', // Amber
  '#1D4ED8', // Blue
  '#7C3AED', // Purple
];

export interface DailySalesPoint {
  date: string;
  formatted_date: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
}

export interface DailyByOutletPoint {
  date: string;
  outlet_id: string;
  revenue: number;
}

export interface OutletMeta {
  outlet_id: string;
  outlet_name: string;
}

export function RevenuePerDayChart({
  daily,
  dailyByOutlet = [],
  outlets = [],
  mode,
}: {
  daily: DailySalesPoint[];
  dailyByOutlet?: DailyByOutletPoint[];
  outlets?: OutletMeta[];
  mode: 'total' | 'by_outlet';
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 760;
  const height = 250;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const outletSeries = useMemo(() => {
    if (mode !== 'by_outlet' || outlets.length === 0) return [];
    const lookup = new Map<string, number>();
    for (const row of dailyByOutlet) {
      lookup.set(`${row.date}__${row.outlet_id}`, Number(row.revenue || 0));
    }
    return outlets.map((o, idx) => ({
      outlet_id: o.outlet_id,
      outlet_name: o.outlet_name,
      color: OUTLET_COLORS[idx % OUTLET_COLORS.length],
      values: daily.map((d) => lookup.get(`${d.date}__${o.outlet_id}`) || 0),
    }));
  }, [mode, outlets, dailyByOutlet, daily]);

  const maxVal = useMemo(() => {
    if (mode === 'by_outlet' && outletSeries.length > 0) {
      let max = 0;
      for (const s of outletSeries) {
        for (const v of s.values) {
          if (v > max) max = v;
        }
      }
      return max > 0 ? max : 100;
    }
    const maxRev = Math.max(...daily.map((d) => Number(d.revenue || 0)), 0);
    return maxRev > 0 ? maxRev : 100;
  }, [daily, mode, outletSeries]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(maxVal * r));

  if (daily.length === 0) return null;

  const stepX = daily.length > 1 ? plotW / daily.length : plotW;
  const barW = Math.min(34, Math.max(6, stepX * 0.62));
  const labelStride = Math.max(1, Math.ceil(daily.length / 8));

  return (
    <div className="space-y-3">
      {mode === 'by_outlet' && outletSeries.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {outletSeries.map((s) => (
            <span key={s.outlet_id} className="inline-flex items-center gap-1.5 font-semibold text-[#2B1A12]">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span>{s.outlet_name}</span>
            </span>
          ))}
        </div>
      )}

      <div className="relative w-full overflow-x-auto scrollbar-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[460px] select-none"
          role="img"
          aria-label="Revenue per day chart"
        >
          {/* Y-Axis gridlines */}
          {yTicks.map((tickVal, idx) => {
            const y = padTop + plotH - (tickVal / maxVal) * plotH;
            return (
              <g key={idx}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#EADFC7"
                  strokeDasharray={idx === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#75604F] text-[10px] font-semibold"
                >
                  {tickVal >= 1000 ? `₹${(tickVal / 1000).toFixed(tickVal % 1000 === 0 ? 0 : 1)}k` : `₹${tickVal}`}
                </text>
              </g>
            );
          })}

          {/* Total mode: Bars */}
          {mode === 'total' &&
            daily.map((d, idx) => {
              const rev = Number(d.revenue || 0);
              const barH = rev > 0 ? Math.max(2, (rev / maxVal) * plotH) : 0;
              const cx = padLeft + idx * stepX + stepX / 2;
              const x = cx - barW / 2;
              const y = padTop + plotH - barH;
              const isHovered = hoveredIdx === idx;
              return (
                <g
                  key={d.date}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => setHoveredIdx(isHovered ? null : idx)}
                  className="cursor-pointer"
                >
                  <rect
                    x={padLeft + idx * stepX}
                    y={padTop}
                    width={stepX}
                    height={plotH}
                    fill="transparent"
                  />
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={Math.min(6, barW / 2)}
                    fill={isHovered ? '#A8401F' : '#CE5535'}
                    className="transition-colors duration-200 motion-reduce:transition-none"
                  />
                  {rev === 0 && (
                    <circle
                      cx={cx}
                      cy={padTop + plotH}
                      r={2}
                      fill="#E3D7BC"
                    />
                  )}
                </g>
              );
            })}

          {/* By outlet mode: Multi-line */}
          {mode === 'by_outlet' &&
            outletSeries.map((series) => {
              const points = series.values
                .map((v, idx) => {
                  const cx =
                    daily.length === 1
                      ? padLeft + plotW / 2
                      : padLeft + idx * stepX + stepX / 2;
                  const cy = padTop + plotH - (v / maxVal) * plotH;
                  return `${cx},${cy}`;
                })
                .join(' ');
              return (
                <g key={series.outlet_id}>
                  <polyline
                    fill="none"
                    stroke={series.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                  {series.values.map((v, idx) => {
                    const cx =
                      daily.length === 1
                        ? padLeft + plotW / 2
                        : padLeft + idx * stepX + stepX / 2;
                    const cy = padTop + plotH - (v / maxVal) * plotH;
                    return (
                      <circle
                        key={idx}
                        cx={cx}
                        cy={cy}
                        r={hoveredIdx === idx ? 5 : 3}
                        fill={series.color}
                        stroke="#FFFEF7"
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </g>
              );
            })}

          {/* Hover hit columns for by_outlet */}
          {mode === 'by_outlet' &&
            daily.map((d, idx) => (
              <rect
                key={d.date}
                x={padLeft + idx * stepX}
                y={padTop}
                width={stepX}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
                className="cursor-pointer"
              />
            ))}

          {/* X-Axis labels */}
          {daily.map((d, idx) => {
            if (idx % labelStride !== 0 && idx !== daily.length - 1) return null;
            const cx = padLeft + idx * stepX + stepX / 2;
            const shortLabel = d.formatted_date.replace(/ \d{4}$/, '');
            return (
              <text
                key={d.date}
                x={cx}
                y={height - 12}
                textAnchor="middle"
                className="fill-[#75604F] text-[10px] font-semibold"
              >
                {shortLabel}
              </text>
            );
          })}
        </svg>

        {hoveredIdx !== null && daily[hoveredIdx] && (
          <div className="mt-2 px-3 py-2 rounded-xl bg-[#2B1A12] text-[#FDFBEA] text-xs font-semibold flex flex-wrap items-center justify-between gap-2">
            <span>{daily[hoveredIdx].formatted_date}</span>
            {mode === 'total' ? (
              <span>
                {formatINR(daily[hoveredIdx].revenue)} · {daily[hoveredIdx].orders}{' '}
                {daily[hoveredIdx].orders === 1 ? 'order' : 'orders'}
              </span>
            ) : (
              <div className="flex flex-wrap gap-3">
                {outletSeries.map((s) => (
                  <span key={s.outlet_id}>
                    {s.outlet_name}: {formatINR(s.values[hoveredIdx] || 0)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export interface HourlyBarPoint {
  hour: number;
  hour_label: string;
  orders: number;
  revenue: number;
}

export function HourlyOrdersBarChart({ hourly }: { hourly: HourlyBarPoint[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const width = 760;
  const height = 220;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 36;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxOrders = Math.max(...hourly.map((h) => Number(h.orders || 0)), 1);
  const stepX = plotW / Math.max(hourly.length, 1);
  const barW = Math.max(8, stepX * 0.65);

  const yTicks = Array.from(
    new Set([0, Math.round(maxOrders / 2), maxOrders])
  );

  return (
    <div className="space-y-2">
      <div className="w-full overflow-x-auto scrollbar-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[520px] select-none"
          role="img"
          aria-label="Orders by hour chart"
        >
          {yTicks.map((t, i) => {
            const y = padTop + plotH - (t / maxOrders) * plotH;
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#EADFC7"
                  strokeDasharray={t === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#75604F] text-[10px] font-semibold"
                >
                  {t}
                </text>
              </g>
            );
          })}

          {hourly.map((h, idx) => {
            const ord = Number(h.orders || 0);
            const barH = ord > 0 ? Math.max(3, (ord / maxOrders) * plotH) : 0;
            const cx = padLeft + idx * stepX + stepX / 2;
            const isHovered = hoveredIdx === idx;
            return (
              <g
                key={h.hour}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(isHovered ? null : idx)}
                className="cursor-pointer"
              >
                <rect
                  x={padLeft + idx * stepX}
                  y={padTop}
                  width={stepX}
                  height={plotH}
                  fill="transparent"
                />
                <rect
                  x={cx - barW / 2}
                  y={padTop + plotH - barH}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={isHovered ? '#A8401F' : '#CE5535'}
                  className="transition-colors duration-200 motion-reduce:transition-none"
                />
                {idx % 3 === 0 && (
                  <text
                    x={cx}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-[#75604F] text-[10px] font-semibold"
                  >
                    {h.hour_label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredIdx !== null && hourly[hoveredIdx] && (
        <div className="px-3 py-2 rounded-xl bg-[#2B1A12] text-[#FDFBEA] text-xs font-semibold flex items-center justify-between">
          <span>{hourly[hoveredIdx].hour_label}</span>
          <span>
            {hourly[hoveredIdx].orders} {hourly[hoveredIdx].orders === 1 ? 'order' : 'orders'} ·{' '}
            {formatINR(hourly[hoveredIdx].revenue)}
          </span>
        </div>
      )}
    </div>
  );
}

export interface KitchenSpeedDayPoint {
  date: string;
  formatted_date: string;
  avg_minutes: number;
  measured_orders: number;
}

export function KitchenSpeedTrendChart({
  data,
}: {
  data: KitchenSpeedDayPoint[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  if (data.length === 0) return null;

  const width = 760;
  const height = 230;
  const padLeft = 48;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 36;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxMin = Math.max(
    25,
    ...data.map((d) => Number(d.avg_minutes || 0))
  );
  const targetY = padTop + plotH - (20 / maxMin) * plotH;
  const stepX = data.length > 1 ? plotW / data.length : plotW;
  const labelStride = Math.max(1, Math.ceil(data.length / 8));

  const yTicks = [0, 10, 20, Math.ceil(maxMin)];

  const measuredPoints = data
    .map((d, idx) => {
      if (d.measured_orders === 0) return null;
      const cx = padLeft + idx * stepX + stepX / 2;
      const cy = padTop + plotH - (Number(d.avg_minutes) / maxMin) * plotH;
      return `${cx},${cy}`;
    })
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-2">
      <div className="w-full overflow-x-auto scrollbar-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto min-w-[460px] select-none"
          role="img"
          aria-label="Average paid-to-ready time per day"
        >
          {yTicks.map((t, i) => {
            const y = padTop + plotH - (t / maxMin) * plotH;
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#EADFC7"
                  strokeDasharray={t === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-[#75604F] text-[10px] font-semibold"
                >
                  {t}m
                </text>
              </g>
            );
          })}

          {/* 20 min Reference Line */}
          <line
            x1={padLeft}
            y1={targetY}
            x2={width - padRight}
            y2={targetY}
            stroke="#2F7A3E"
            strokeWidth={1.5}
            strokeDasharray="6 4"
          />
          <text
            x={width - padRight}
            y={targetY - 5}
            textAnchor="end"
            className="fill-[#2F7A3E] text-[10px] font-bold"
          >
            20 min promise
          </text>

          {measuredPoints && (
            <polyline
              fill="none"
              stroke="#CE5535"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={measuredPoints}
            />
          )}

          {data.map((d, idx) => {
            const cx = padLeft + idx * stepX + stepX / 2;
            const cy = padTop + plotH - (Number(d.avg_minutes || 0) / maxMin) * plotH;
            const isOver20 = Number(d.avg_minutes) > 20;
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(hoveredIdx === idx ? null : idx)}
                className="cursor-pointer"
              >
                <rect
                  x={padLeft + idx * stepX}
                  y={padTop}
                  width={stepX}
                  height={plotH}
                  fill="transparent"
                />
                {d.measured_orders > 0 ? (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={hoveredIdx === idx ? 5.5 : 4}
                    fill={isOver20 ? '#BA1A1A' : '#CE5535'}
                    stroke="#FFFEF7"
                    strokeWidth={1.5}
                  />
                ) : (
                  <circle cx={cx} cy={padTop + plotH} r={2} fill="#E3D7BC" />
                )}
                {(idx % labelStride === 0 || idx === data.length - 1) && (
                  <text
                    x={cx}
                    y={height - 12}
                    textAnchor="middle"
                    className="fill-[#75604F] text-[10px] font-semibold"
                  >
                    {d.formatted_date}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="px-3 py-2 rounded-xl bg-[#2B1A12] text-[#FDFBEA] text-xs font-semibold flex items-center justify-between">
          <span>{data[hoveredIdx].formatted_date}</span>
          <span>
            {data[hoveredIdx].measured_orders > 0
              ? `${data[hoveredIdx].avg_minutes} min avg · ${data[hoveredIdx].measured_orders} measured`
              : 'No measured orders'}
          </span>
        </div>
      )}
    </div>
  );
}
