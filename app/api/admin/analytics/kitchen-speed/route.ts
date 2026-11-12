import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  validateAnalyticsRequest,
  getCachedAnalytics,
  setCachedAnalytics,
} from '@/lib/analytics-server';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAnalyticsRequest(req);
    if (!auth.ok) return auth.response;

    const { ctx } = auth;
    const cacheKey = `kitchen-speed:${ctx.effectiveOutletId ?? 'all'}:${ctx.from}:${ctx.to}`;
    const cached = getCachedAnalytics(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    const rpcRes = await query(
      `SELECT get_analytics_kitchen_speed($1::timestamptz, $2::timestamptz, $3::uuid) AS data`,
      [ctx.startTimestamp, ctx.endTimestamp, ctx.effectiveOutletId]
    );

    const payload = rpcRes.rows[0]?.data || {
      kpis: {
        total_paid_orders: 0,
        measured_orders: 0,
        excluded_orders: 0,
        avg_paid_to_ready_sec: 0,
        avg_paid_to_ready_min: 0,
        pct_within_20: 0,
        avg_making_sec: 0,
        avg_packaging_sec: 0,
        slowest_order_id: null,
        slowest_order_code: null,
        slowest_order_min: null,
      },
      daily_trend: [],
      slowest_orders: [],
    };

    const result = {
      ...payload,
      meta: {
        from: ctx.from,
        to: ctx.to,
        outlet_id: ctx.effectiveOutletId,
      },
    };

    setCachedAnalytics(cacheKey, result);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (err: any) {
    console.error('Analytics kitchen-speed route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load kitchen speed analytics' },
      { status: 500 }
    );
  }
}
