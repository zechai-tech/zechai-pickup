import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getPresetDateRange } from '@/lib/analytics-utils';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;

interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

// Module-level 60s server cache for identical analytics queries
const analyticsCache = new Map<string, CacheEntry>();

export function getCachedAnalytics<T>(key: string): T | null {
  const entry = analyticsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    analyticsCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedAnalytics<T>(key: string, value: T): void {
  if (analyticsCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = analyticsCache.keys().next().value;
    if (oldestKey) analyticsCache.delete(oldestKey);
  }
  analyticsCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export interface AnalyticsAuthContext {
  userId: string;
  email: string;
  role: 'admin' | 'super_admin' | 'manager';
  isAdmin: boolean;
  isManager: boolean;
  userOutletId: string | null;
  effectiveOutletId: string | null;
  from: string;
  to: string;
  startTimestamp: string;
  endTimestamp: string;
}

type ValidateResult =
  | { ok: true; ctx: AnalyticsAuthContext }
  | { ok: false; response: NextResponse };

export async function validateAnalyticsRequest(
  req: NextRequest,
  options: { requireDates?: boolean } = { requireDates: true }
): Promise<ValidateResult> {
  // 1. Verify Bearer token via Supabase Auth (server-side)
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized: missing session token' },
        { status: 401 }
      ),
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized: empty token' }, { status: 401 }),
    };
  }

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authUser?.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized: invalid session' }, { status: 401 }),
    };
  }

  // 2. Verify role and active flag in public.users
  const userRes = await query(
    `SELECT id, email, role, outlet_id, is_active
     FROM public.users
     WHERE lower(email) = $1 OR id = $2
     LIMIT 1`,
    [authUser.email.toLowerCase().trim(), authUser.id]
  );

  if (userRes.rows.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden: user profile not found' }, { status: 403 }),
    };
  }

  const profile = userRes.rows[0];
  if (!profile.is_active) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden: account is inactive' }, { status: 403 }),
    };
  }

  const role = String(profile.role || '');
  if (role !== 'admin' && role !== 'super_admin' && role !== 'manager') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: Analytics is restricted to admin and manager roles' },
        { status: 403 }
      ),
    };
  }

  const isAdmin = role === 'admin' || role === 'super_admin';
  const isManager = role === 'manager';

  if (isManager && !profile.outlet_id) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden: manager is not assigned to an outlet' },
        { status: 403 }
      ),
    };
  }

  // 3. Validate outlet_id query parameter
  const { searchParams } = new URL(req.url);
  const rawOutlet = searchParams.get('outlet_id');

  let effectiveOutletId: string | null = null;
  if (isManager) {
    // Managers are strictly locked to their own outlet
    if (rawOutlet && rawOutlet !== 'all' && rawOutlet !== profile.outlet_id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Forbidden: managers can only access analytics for their assigned outlet' },
          { status: 403 }
        ),
      };
    }
    effectiveOutletId = profile.outlet_id;
  } else if (rawOutlet && rawOutlet !== 'all') {
    if (!UUID_REGEX.test(rawOutlet)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid outlet_id UUID' }, { status: 400 }),
      };
    }
    effectiveOutletId = rawOutlet;
  }

  // 4. Validate dates (default Last 7 days in IST if omitted)
  const defaultRange = getPresetDateRange('7days');
  const from = (searchParams.get('from') || defaultRange.from).trim();
  const to = (searchParams.get('to') || defaultRange.to).trim();

  if (options.requireDates !== false) {
    if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Invalid date format. Expected YYYY-MM-DD' },
          { status: 400 }
        ),
      };
    }

    const fromMs = Date.parse(`${from}T00:00:00.000+05:30`);
    const toMs = Date.parse(`${to}T23:59:59.999+05:30`);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid calendar date' }, { status: 400 }),
      };
    }

    if (fromMs > toMs) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: '"from" date must be on or before "to" date' },
          { status: 400 }
        ),
      };
    }

    const inclusiveDays = Math.floor((toMs - fromMs) / 86_400_000) + 1;
    if (inclusiveDays > MAX_RANGE_DAYS) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` },
          { status: 400 }
        ),
      };
    }
  }

  return {
    ok: true,
    ctx: {
      userId: profile.id,
      email: profile.email,
      role: role as 'admin' | 'super_admin' | 'manager',
      isAdmin,
      isManager,
      userOutletId: profile.outlet_id || null,
      effectiveOutletId,
      from,
      to,
      startTimestamp: `${from}T00:00:00.000+05:30`,
      endTimestamp: `${to}T23:59:59.999+05:30`,
    },
  };
}
