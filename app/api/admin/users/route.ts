import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createAuthUser } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';

// GET /api/admin/users - list users (admin sees all, or filter by outlet_id)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outlet_id');
    const role = searchParams.get('role');

    let sql = `
      SELECT u.id, u.name, u.email, u.role, u.outlet_id, u.is_active, u.created_at,
             o.name as outlet_name
      FROM public.users u
      LEFT JOIN public.outlets o ON u.outlet_id = o.id
    `;
    const params: unknown[] = [];

    if (outletId) {
      sql += ` WHERE u.outlet_id = $1 AND u.role != 'admin'`;
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

// POST /api/admin/users - create user in Supabase Auth first, then in public.users
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      role,
      outlet_id,
      password: customPassword,
      email: customEmail,
      caller_role,
      caller_outlet_id,
    } = body;

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });
    }

    // Manager restrictions
    if (caller_role === 'manager') {
      if (role === 'admin' || role === 'manager') {
        return NextResponse.json(
          { error: 'Managers can only create staff or ordering staff accounts.' },
          { status: 403 }
        );
      }
    }

    const assignedOutletId = caller_role === 'manager' ? caller_outlet_id : outlet_id;

    if (role !== 'admin' && !assignedOutletId) {
      return NextResponse.json({ error: 'Outlet is required for non-admin users' }, { status: 400 });
    }

    const cleanName = name.toLowerCase().replace(/\s+/g, '');
    const email = customEmail ? customEmail.trim().toLowerCase() : `${cleanName}zechai@gmail.com`;
    const plainPassword = customPassword && customPassword.trim() ? customPassword.trim() : `${cleanName}@zechai`;

    // 1. Check if user already exists in public.users
    const existing = await query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: `User with email ${email} already exists in database.` },
        { status: 400 }
      );
    }

    // 2. FIRST create Supabase Auth account using Supabase Admin API
    const { id: authUserId, error: authError } = await createAuthUser(email, plainPassword);

    if (authError || !authUserId) {
      return NextResponse.json(
        { error: authError || 'Failed to create Supabase Auth account.' },
        { status: 400 }
      );
    }

    // 3. THEN insert into public.users using authUserId as the id
    const passwordHash = await bcrypt.hash(plainPassword, 10);
    const userRes = await query(
      `
      INSERT INTO public.users (id, name, email, password_hash, role, outlet_id, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, name, email, role, outlet_id, is_active, created_at
      `,
      [authUserId, name.trim(), email, passwordHash, role, outlet_id || null]
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

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(name.trim());
    }
    if (role !== undefined) {
      fields.push(`role = $${idx++}`);
      params.push(role);
    }
    if (outlet_id !== undefined) {
      fields.push(`outlet_id = $${idx++}`);
      params.push(outlet_id || null);
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      params.push(is_active);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    const updateSql = `
      UPDATE public.users
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, email, role, outlet_id, is_active, created_at
    `;

    const res = await query(updateSql, params);

    return NextResponse.json({
      success: true,
      user: res.rows[0],
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
    const callerRole = searchParams.get('caller_role');

    if (callerRole === 'manager') {
      return NextResponse.json({ error: 'Managers are not permitted to delete users.' }, { status: 403 });
    }

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
