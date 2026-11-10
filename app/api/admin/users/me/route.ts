import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const uid = searchParams.get('uid');

    if (!email && !uid) {
      return NextResponse.json({ error: 'Email or UID required' }, { status: 400 });
    }

    let sql = `
      SELECT u.*, 
             json_build_object('id', o.id, 'name', o.name, 'address', o.address) as outlet
      FROM public.users u
      LEFT JOIN public.outlets o ON u.outlet_id = o.id
    `;
    const params: unknown[] = [];

    if (uid) {
      sql += ' WHERE u.id = $1';
      params.push(uid);
    } else {
      sql += ' WHERE LOWER(u.email) = LOWER($1)';
      params.push(email);
    }

    sql += ' LIMIT 1';

    const res = await query(sql, params);

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found in Zécha system' }, { status: 404 });
    }

    const user = res.rows[0];

    // Check if deactivated
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Contact your manager.', is_deactivated: true },
        { status: 403 }
      );
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
