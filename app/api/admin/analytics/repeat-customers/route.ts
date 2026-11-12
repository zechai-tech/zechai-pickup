import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  validateAnalyticsRequest,
  getCachedAnalytics,
  setCachedAnalytics,
} from '@/lib/analytics-server';
import { maskPhoneNumber } from '@/lib/analytics-utils';

export async function GET(req: NextRequest) {
  try {
    const auth = await validateAnalyticsRequest(req);
    if (!auth.ok) return auth.response;

    const { ctx } = auth;
    const roleScope = ctx.isAdmin ? 'admin' : 'manager';
    const cacheKey = `repeat-customers:${roleScope}:${ctx.effectiveOutletId ?? 'all'}:${ctx.from}:${ctx.to}`;
    const cached = getCachedAnalytics(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'Cache-Control': 'private, max-age=60' },
      });
    }

    const rpcRes = await query(
      `SELECT get_analytics_repeat_customers($1::timestamptz, $2::timestamptz, $3::uuid) AS data`,
      [ctx.startTimestamp, ctx.endTimestamp, ctx.effectiveOutletId]
    );

    const raw = rpcRes.rows[0]?.data || {
      total_orders: 0,
      has_enough_data: false,
      kpis: {
        unique_customers: 0,
        new_customers: 0,
        returning_customers: 0,
        repeat_rate_pct: 0,
      },
      top_customers: [],
    };

    // Enforce server-side phone masking for managers; full phone only for admin
    const topCustomers = Array.isArray(raw.top_customers)
      ? raw.top_customers.map((c: any) => ({
          ...c,
          phone: ctx.isAdmin ? String(c.phone || '') : maskPhoneNumber(c.phone),
        }))
      : [];

    const result = {
      ...raw,
      top_customers: topCustomers,
      is_phone_masked: !ctx.isAdmin,
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
    console.error('Analytics repeat-customers route error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load repeat customers analytics' },
      { status: 500 }
    );
  }
}
