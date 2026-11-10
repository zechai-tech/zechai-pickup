import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET /api/admin/users - list users (admin sees all, or filter by outlet_id)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outlet_id');
    const role = searchParams.get('role'); // caller's role

    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.outlet_id, u.is_active, u.created_at,
             o.name as outlet_name
      FROM public.users u
      LEFT JOIN public.outlets o ON u.outlet_id = o.id
    `;
    const params: unknown[] = [];

    if (outletId && role !== 'admin') {
      sql += ` WHERE u.outlet_id = $1`;
      params.push(outletId);
    }

    sql += ` ORDER BY u.created_at DESC`;

    const res = await query(sql, params);
    return NextResponse.json({ users: res.rows });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/admin/users - create user in auth.users + public.users
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, role, outlet_id } = body;

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });
    }

    if (role !== 'admin' && !outlet_id) {
      return NextResponse.json({ error: 'Outlet is required for non-admin users' }, { status: 400 });
    }

    // Auto-generate email and password per spec:
    // email: {name.toLowerCase().replaceAll(' ','')}zechai@gmail.com
    // password: {name.toLowerCase().replaceAll(' ','')}@zechai
    const cleanName = name.toLowerCase().replace(/\s+/g, '');
    const email = `${cleanName}zechai@gmail.com`;
    const plainPassword = `${cleanName}@zechai`;
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 1. Check if user already exists
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: `User with email ${email} already exists.` },
        { status: 400 }
      );
    }

    // 2. Create in auth.users so Supabase Auth sign-in works
    // Generate UUID
    const idRes = await query('SELECT gen_random_uuid() as id');
    const userId = idRes.rows[0].id;

    // Insert into auth.users (encrypted_password handled via bcrypt)
    try {
      await query(
        `
        INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
          created_at, updated_at
        )
        VALUES (
          $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          $2, crypt($3, gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}',
          json_build_object('name', $4, 'role', $5),
          now(), now()
        )
        `,
        [userId, email, plainPassword, name, role]
      );
    } catch (authErr: any) {
      console.warn('auth.users insert notice:', authErr.message);
      // If auth.users already had the email, update password
      await query(
        `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')), email_confirmed_at = now() WHERE email = $2`,
        [plainPassword, email]
      );
    }

    // 3. Insert into public.users
    const userRes = await query(
      `
      INSERT INTO public.users (id, name, email, password_hash, role, outlet_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, name, email, role, outlet_id, is_active, created_at
      `,
      [userId, name, email, passwordHash, role, outlet_id || null]
    );

    return NextResponse.json({
      success: true,
      user: userRes.rows[0],
      generatedEmail: email,
      generatedPassword: plainPassword,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/admin/users - update user (name, role, outlet_id, is_active)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, role, outlet_id, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Handle quick status toggle (only is_active provided)
    if (is_active !== undefined && name === undefined && role === undefined) {
      const res = await query(
        'UPDATE public.users SET is_active = $1 WHERE id = $2 RETURNING id, name, email, role, outlet_id, is_active, created_at',
        [is_active, id]
      );
      return NextResponse.json({ success: true, user: res.rows[0] });
    }

    // If name changed, regenerate email & password per spec
    let emailUpdateSql = '';
    const params: unknown[] = [id];
    let newEmail = '';
    let newPlainPassword = '';

    if (name) {
      const cleanName = name.toLowerCase().replace(/\s+/g, '');
      newEmail = `${cleanName}zechai@gmail.com`;
      newPlainPassword = `${cleanName}@zechai`;
      const newHash = await bcrypt.hash(newPlainPassword, 10);

      params.push(name, newEmail, newHash);
      emailUpdateSql = `, name = $2, email = $3, password_hash = $4`;

      // Update auth.users password and email
      try {
        await query(
          `UPDATE auth.users SET email = $1, encrypted_password = crypt($2, gen_salt('bf')) WHERE id = $3`,
          [newEmail, newPlainPassword, id]
        );
      } catch (e) {
        console.warn('Could not update auth.users email:', e);
      }
    }

    let roleParamIndex = params.length + 1;
    let outletParamIndex = params.length + 2;
    let activeParamIndex = params.length + 3;

    params.push(role, outlet_id || null, is_active !== undefined ? is_active : true);

    const updateSql = `
      UPDATE public.users
      SET role = $${roleParamIndex},
          outlet_id = $${outletParamIndex},
          is_active = $${activeParamIndex}
          ${emailUpdateSql}
      WHERE id = $1
      RETURNING id, name, email, role, outlet_id, is_active, created_at
    `;

    const res = await query(updateSql, params);

    return NextResponse.json({
      success: true,
      user: res.rows[0],
      newEmail: newEmail || undefined,
      newPassword: newPlainPassword || undefined,
    });
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/admin/users - delete user from public.users and auth.users
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // 1. Delete auth account in auth.users
    try {
      await query('DELETE FROM auth.users WHERE id = $1', [id]);
    } catch (authErr) {
      console.warn('Could not delete auth.users record directly:', authErr);
    }

    // 2. Delete public user profile
    await query('DELETE FROM public.users WHERE id = $1', [id]);

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
