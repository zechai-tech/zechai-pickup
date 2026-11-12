import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface PortalAuthContext {
  userId: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager';
  isAdmin: boolean;
  isManager: boolean;
  userOutletId: string | null;
}

type PortalAuthResult =
  | { ok: true; ctx: PortalAuthContext }
  | { ok: false; response: NextResponse };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function validatePortalManagerOrAdmin(
  req: NextRequest,
  targetOutletId?: string | null
): Promise<PortalAuthResult> {
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
      response: NextResponse.json(
        { error: 'Forbidden: Portal user profile not found' },
        { status: 403 }
      ),
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
        { error: 'Forbidden: restricted to Portal admin and manager roles' },
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

  if (targetOutletId !== undefined && targetOutletId !== null && targetOutletId !== '') {
    if (!UUID_REGEX.test(targetOutletId)) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Invalid outlet_id UUID' }, { status: 400 }),
      };
    }

    if (isManager && targetOutletId !== profile.outlet_id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Forbidden: managers can only manage their assigned outlet' },
          { status: 403 }
        ),
      };
    }
  }

  return {
    ok: true,
    ctx: {
      userId: profile.id,
      email: profile.email,
      role: role as 'super_admin' | 'admin' | 'manager',
      isAdmin,
      isManager,
      userOutletId: profile.outlet_id || null,
    },
  };
}
