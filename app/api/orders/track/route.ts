import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAndSyncOrder } from '@/lib/order-sync';

// Simple in-memory sliding window rate limiter per IP
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // Max 60 requests per minute per IP (polling every 4s = 15 req/min)

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);

  // Periodically clean up expired entries if map gets large
  if (ipRateLimitMap.size > 5000) {
    for (const [key, val] of ipRateLimitMap.entries()) {
      if (val.resetAt < now) ipRateLimitMap.delete(key);
    }
  }

  if (!record || record.resetAt < now) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

export async function GET(req: NextRequest) {
  try {
    // 1. IP extraction and Rate Limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const clientIp = (forwardedFor ? forwardedFor.split(',')[0].trim() : null) || realIp || '127.0.0.1';

    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': '10' } }
      );
    }

    // 2. Query param validation
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('id') || searchParams.get('order_id');
    const pickupCode = searchParams.get('code');

    if (!orderId && !pickupCode) {
      return NextResponse.json(
        { error: 'Order id or pickup code is required' },
        { status: 400 }
      );
    }

    let sql = `
      SELECT o.id, o.status, o.pickup_code, o.items, o.total, o.cancel_reason, o.created_at,
             o.paid_at, o.making_at, o.packaging_at, o.ready_at, o.received_at,
             COALESCE(ot.name, NULLIF(o.outlet_name, ''), 'Deleted outlet') as outlet_name,
             ot.phone as outlet_phone, ot.address as outlet_address
      FROM public.orders o
      LEFT JOIN public.outlets ot ON o.outlet_id = ot.id
    `;
    const params: unknown[] = [];

    if (orderId) {
      params.push(orderId);
      if (isUuid(orderId)) {
        sql += ' WHERE o.id = $1 LIMIT 1';
      } else {
        sql += ' WHERE o.cf_order_id = $1 LIMIT 1';
      }
    } else {
      params.push(pickupCode);
      sql += ' WHERE o.pickup_code = $1 ORDER BY o.created_at DESC LIMIT 1';
    }

    let res = await query(sql, params);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    let row = res.rows[0];

    // If order is pending_payment, trigger a fallback sync with Cashfree
    if (row.status === 'pending_payment') {
      try {
        const syncRes = await verifyAndSyncOrder(row.id);
        if (syncRes.updated && syncRes.status) {
          const refreshedRes = await query(sql, params);
          if (refreshedRes.rows.length > 0) {
            row = refreshedRes.rows[0];
          } else {
            row.status = syncRes.status;
          }
        }
      } catch (syncErr) {
        console.warn('Fallback sync notice during track:', syncErr);
      }
    }

    const rowStatus = String(row.status || '').toLowerCase();
    const effectivePaidAt =
      row.paid_at ||
      (['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'].includes(rowStatus)
        ? row.created_at
        : null);

    // Strictly return ONLY permitted public tracking fields (NEVER return customer_phone)
    const sanitizedOrder = {
      id: row.id,
      status: row.status,
      pickup_code: row.pickup_code,
      items: Array.isArray(row.items) ? row.items : [],
      total: Number(row.total),
      outlet_name: row.outlet_name || 'Deleted outlet',
      outlet_phone: row.outlet_phone || null,
      outlet_address: row.outlet_address || null,
      cancel_reason: row.cancel_reason || null,
      paid_at: effectivePaidAt,
      making_at: row.making_at || null,
      packaging_at: row.packaging_at || null,
      ready_at: row.ready_at || null,
      received_at: row.received_at || null,
      created_at: row.created_at,
    };

    return NextResponse.json(
      { order: sanitizedOrder },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Order tracking error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch order status' },
      { status: 500 }
    );
  }
}
