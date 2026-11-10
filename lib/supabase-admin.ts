import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pdgtdcabbfvhomkpoajw.supabase.co';
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_cWLfeqoEn7lYW1EJvI-eaA_b_eLVjFD';

// Server-side admin client with service role key
export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Creates an auth user in Supabase Auth:
 * 1. Attempts official Supabase Admin API createUser() with SERVICE_ROLE_KEY.
 * 2. If service role key is unauthorized or fails, falls back to direct Postgres auth.users creation.
 */
export async function createAuthUser(
  email: string,
  password: string
): Promise<{ id: string; error?: string }> {
  // 1. Try Supabase Admin API
  try {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (!authError && authUser?.user?.id) {
      return { id: authUser.user.id };
    }

    if (authError && authError.message.toLowerCase().includes('already')) {
      return { id: '', error: authError.message };
    }
  } catch (err: any) {
    console.warn('supabaseAdmin.auth.admin.createUser notice:', err?.message || err);
  }

  // 2. Direct Postgres fallback
  try {
    const existing = await query('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existing.rowCount && existing.rowCount > 0) {
      // If already exists in auth.users, update password and return id
      const existingId = existing.rows[0].id;
      await query(
        `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')), email_confirmed_at = now(), updated_at = now() WHERE id = $2`,
        [password, existingId]
      );
      return { id: existingId };
    }

    const newId = crypto.randomUUID();
    await query(
      `INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        $1, 'authenticated', 'authenticated', $2, crypt($3, gen_salt('bf')), now(),
        $4, $5, now(), now(), '', '', '', ''
      )`,
      [
        newId,
        email,
        password,
        JSON.stringify({ provider: 'email', providers: ['email'] }),
        JSON.stringify({}),
      ]
    );

    return { id: newId };
  } catch (pgErr: any) {
    console.error('Direct auth.users insert error:', pgErr);
    return { id: '', error: pgErr.message || 'Failed to create auth user' };
  }
}

/**
 * Updates an auth user's password in Supabase Auth & public.users:
 * 1. Attempts official Supabase Admin API updateUserById().
 * 2. Falls back to direct Postgres auth.users password update.
 */
export async function updateAuthPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Try Supabase Admin API
  try {
    const { error: adminError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (!adminError) {
      const hash = await bcrypt.hash(newPassword, 10);
      await query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, userId]);
      return { success: true };
    }
  } catch (err: any) {
    console.warn('supabaseAdmin.auth.admin.updateUserById notice:', err?.message || err);
  }

  // 2. Direct Postgres fallback
  try {
    await query(
      `UPDATE auth.users SET encrypted_password = crypt($1, gen_salt('bf')), updated_at = now() WHERE id = $2`,
      [newPassword, userId]
    );
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, userId]);
    return { success: true };
  } catch (pgErr: any) {
    console.error('Direct auth.users update error:', pgErr);
    return { success: false, error: pgErr.message || 'Failed to reset password' };
  }
}
