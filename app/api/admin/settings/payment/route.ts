import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query('SELECT * FROM public.app_settings WHERE key = $1 LIMIT 1', [
      'payment_gateway',
    ]);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
    }

    const row = res.rows[0];
    const val = row.value || {};

    // Sanitize: never return secrets in API responses
    const cleanValue = {
      active: val.active || 'cashfree',
      cashfree: {
        enabled: val.cashfree?.enabled ?? true,
        mode: val.cashfree?.mode || 'production',
      },
      razorpay: {
        enabled: val.razorpay?.enabled ?? true,
        mode: val.razorpay?.mode || 'test',
      },
    };

    return NextResponse.json({
      settings: {
        ...row,
        value: cleanValue,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Deprecated. Use /api/admin/settings/gateway instead.' },
    { status: 400 }
  );
}
