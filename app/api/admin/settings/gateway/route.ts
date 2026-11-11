import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';

export interface NonSecretGatewayConfig {
  active: 'cashfree' | 'razorpay';
  cashfree: {
    enabled: boolean;
    mode: 'sandbox' | 'production';
  };
  razorpay: {
    enabled: boolean;
    mode: 'test' | 'live';
  };
}

function sanitizeGatewayConfig(raw: any): NonSecretGatewayConfig {
  const active = raw?.active === 'razorpay' ? 'razorpay' : 'cashfree';
  const cashfreeMode = raw?.cashfree?.mode === 'production' ? 'production' : 'sandbox';
  const razorpayMode = raw?.razorpay?.mode === 'live' ? 'live' : 'test';

  return {
    active,
    cashfree: {
      enabled: raw?.cashfree?.enabled ?? true,
      mode: cashfreeMode,
    },
    razorpay: {
      enabled: raw?.razorpay?.enabled ?? true,
      mode: razorpayMode,
    },
  };
}

export async function GET() {
  try {
    const res = await query(
      "SELECT id, key, value, updated_at, updated_by FROM public.app_settings WHERE key = 'payment_gateway' LIMIT 1"
    );

    if (res.rows.length === 0) {
      const defaultConfig: NonSecretGatewayConfig = {
        active: 'cashfree',
        cashfree: { enabled: true, mode: 'production' },
        razorpay: { enabled: true, mode: 'test' },
      };
      return NextResponse.json({
        settings: {
          key: 'payment_gateway',
          value: defaultConfig,
          updated_at: new Date().toISOString(),
          updated_by: 'System',
        },
      });
    }

    const row = res.rows[0];
    const sanitizedValue = sanitizeGatewayConfig(row.value);

    return NextResponse.json({
      settings: {
        id: row.id,
        key: row.key,
        value: sanitizedValue,
        updated_at: row.updated_at,
        updated_by: row.updated_by,
      },
    });
  } catch (error: any) {
    console.error('Error fetching gateway settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verify caller authentication and authorization (Super Admin check)
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user: authUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authUser?.email) {
      return NextResponse.json({ error: 'Unauthorized: invalid session token' }, { status: 401 });
    }

    // Verify user role in public.users
    const userRes = await query(
      'SELECT id, role, email FROM public.users WHERE email = $1 LIMIT 1',
      [authUser.email.toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Forbidden: user profile not found' }, { status: 403 });
    }

    const callerRole = userRes.rows[0].role;
    if (callerRole !== 'super_admin' && callerRole !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: only super_admin can configure payment gateways' },
        { status: 403 }
      );
    }

    // 2. Validate and sanitize input: NEVER allow credentials in database
    const body = await req.json();
    const cleanConfig = sanitizeGatewayConfig(body.value || body);

    const nowISO = new Date().toISOString();
    const updatedBy = userRes.rows[0].email;

    // 3. Update using service-role client / direct db query
    const res = await query(
      `INSERT INTO public.app_settings (key, value, updated_at, updated_by)
       VALUES ('payment_gateway', $1, $2, $3)
       ON CONFLICT (key) DO UPDATE
       SET value = $1, updated_at = $2, updated_by = $3
       RETURNING id, key, value, updated_at, updated_by`,
      [JSON.stringify(cleanConfig), nowISO, updatedBy]
    );

    return NextResponse.json({
      success: true,
      settings: {
        id: res.rows[0]?.id,
        key: 'payment_gateway',
        value: cleanConfig,
        updated_at: nowISO,
        updated_by: updatedBy,
      },
    });
  } catch (error: any) {
    console.error('Error updating gateway settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
