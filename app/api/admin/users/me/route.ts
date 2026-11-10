import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const res = await query(
      `
      SELECT u.*, 
             json_build_object('id', o.id, 'name', o.name, 'address', o.address) as outlet
      FROM public.users u
      LEFT JOIN public.outlets o ON u.outlet_id = o.id
      WHERE u.email = $1 AND u.is_active = true
      LIMIT 1
      `,
      [email]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found or inactive' }, { status: 404 });
    }

    return NextResponse.json({ user: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
