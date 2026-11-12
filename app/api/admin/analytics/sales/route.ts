import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  validateAnalyticsRequest,
  getCachedAnalytics,
  setCachedAnalytics,
} from '@/lib/analytics-server';

const VALID_PAID_STATUSES = [
  'pending',
  'preparing',
  'packaging',
  'ready',
  'received',
  'confirmed',
  'completed',
];

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAnalyticsRequest(req);
    if (!auth.ok) return auth.response;

    const { ctx } = auth;
    const cacheKey = `sales:${ctx.effectiveOutletId ?? 'all'}:${ctx.from}:${ctx.to}`;
    const cached = getCachedAnalytics(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    const rpcRes = await query(
      `SELECT get_analytics_sales($1::timestamptz, $2::timestamptz, $3::uuid) AS data`,
      [ctx.startTimestamp, ctx.endTimestamp, ctx.effectiveOutletId]
    );

    const payload = rpcRes.rows[0]?.data || {
      kpis: {
        revenue: 0,
        revenue_prev: 0,
        orders: 0,
        orders_prev: 0,
        avg_order_value: 0,
        avg_order_value_prev: 0,
        items_sold: 0,
        items_sold_prev: 0,
      },
      daily: [],
      outlets: [],
    };

    // When viewing All Outlets, fetch daily revenue per outlet for the "Total | By outlet" chart toggle
    let dailyByOutlet: Array<{ date: string; outlet_id: string; revenue: number }> = [];
    if (!ctx.effectiveOutletId) {
      const byOutletRes = await query(
        `SELECT
           to_char(date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS date,
           outlet_id,
           COALESCE(SUM(total), 0)::numeric AS revenue
         FROM public.orders
         WHERE created_at >= $1::timestamptz
           AND created_at <= $2::timestamptz
           AND status = ANY($3::text[])
         GROUP BY 1, 2
         ORDER BY 1 ASC`,
        [ctx.startTimestamp, ctx.endTimestamp, VALID_PAID_STATUSES]
      );
      dailyByOutlet = byOutletRes.rows
        .filter((r: any) => Boolean(r.outlet_id))
        .map((r: any) => ({
          date: String(r.date),
          outlet_id: String(r.outlet_id),
          revenue: Number(r.revenue || 0),
        }));
    }

    const result = {
      ...payload,
      daily_by_outlet: dailyByOutlet,
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
    console.error('Analytics sales route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load sales analytics' },
      { status: 500 }
    );
  }
}
