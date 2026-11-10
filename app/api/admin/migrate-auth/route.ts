import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { createAuthUser } from '@/lib/supabase-admin';
import bcrypt from 'bcryptjs';

// POST /api/admin/migrate-auth - Migrates all public.users without auth accounts to Supabase Auth
export async function POST(req: NextRequest) {
  try {
    // 1. Fetch all users from public.users
    const usersRes = await query('SELECT id, name, email, role, is_active FROM public.users ORDER BY created_at ASC');
    const allUsers = usersRes.rows;

    const migrated: Array<{ id: string; name: string; email: string; defaultPassword: string }> = [];
    const skipped: Array<{ name: string; email: string; reason: string }> = [];

    for (const u of allUsers) {
      // 2. Check if auth user exists with that email
      const authCheck = await query('SELECT id FROM auth.users WHERE email = $1', [u.email]);

      if (authCheck.rowCount && authCheck.rowCount > 0) {
        const authId = authCheck.rows[0].id;
        // If public.users id doesn't match authId, align it
        if (u.id !== authId) {
          await query('UPDATE public.users SET id = $1 WHERE id = $2', [authId, u.id]);
        }
        skipped.push({ name: u.name, email: u.email, reason: 'Auth account already exists' });
        continue;
      }

      // 3. Create auth user with pattern: {name}@zechai
      const cleanName = u.name.toLowerCase().replace(/\s+/g, '');
      const defaultPassword = `${cleanName}@zechai`;

      const { id: newAuthId, error: authError } = await createAuthUser(u.email, defaultPassword);

      if (authError || !newAuthId) {
        console.error(`Failed to migrate user ${u.email}:`, authError);
        skipped.push({ name: u.name, email: u.email, reason: authError || 'Failed to create auth user' });
        continue;
      }

      // 4. Update public.users id to match newAuthId and update password_hash
      const hash = await bcrypt.hash(defaultPassword, 10);
      await query('UPDATE public.users SET id = $1, password_hash = $2 WHERE id = $3', [
        newAuthId,
        hash,
        u.id,
      ]);

      migrated.push({
        id: newAuthId,
        name: u.name,
        email: u.email,
        defaultPassword,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Migration completed: ${migrated.length} migrated, ${skipped.length} already configured.`,
      migratedCount: migrated.length,
      migrated,
      skipped,
    });
  } catch (error: any) {
    console.error('Error in auth migration:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
