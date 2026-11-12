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
    const cacheKey = `best-items:${ctx.effectiveOutletId ?? 'all'}:${ctx.from}:${ctx.to}`;
    const cached = getCachedAnalytics(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    const rpcRes = await query(
      `SELECT get_analytics_best_items($1::timestamptz, $2::timestamptz, $3::uuid) AS data`,
      [ctx.startTimestamp, ctx.endTimestamp, ctx.effectiveOutletId]
    );

    const payload = rpcRes.rows[0]?.data || {
      items: [],
      slow_movers: [],
      total_revenue: 0,
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
    console.error('Analytics best-items route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load best items analytics' },
      { status: 500 }
    );
  }
}
