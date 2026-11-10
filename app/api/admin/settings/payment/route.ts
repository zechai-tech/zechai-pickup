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

    return NextResponse.json({ settings: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { value, updated_by } = body;
    const now = new Date().toISOString();

    const res = await query(
      `UPDATE public.app_settings 
       SET value = $1, updated_at = $2, updated_by = $3 
       WHERE key = 'payment_gateway' 
       RETURNING *`,
      [JSON.stringify(value), now, updated_by || 'Admin']
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Settings key not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, settings: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
