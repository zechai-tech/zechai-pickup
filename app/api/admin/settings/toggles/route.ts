import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { validatePortalAdmin, validatePortalStaffOrAbove } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_KEYS = ['combos_enabled', 'packaging_fee_enabled'];

function revalidateSettingsRoutes() {
  try {
    revalidatePath('/menu');
    revalidatePath('/api/menu');
    revalidatePath('/admin/menu');
    revalidatePath('/cart');
  } catch (err) {
    console.warn('revalidateSettingsRoutes notice:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await validatePortalStaffOrAbove(req);
    if (!auth.ok) return auth.response;

    const res = await query(
      `SELECT id, key, value, updated_at, updated_by
       FROM public.app_settings
       WHERE key = ANY($1)`,
      [ALLOWED_KEYS]
    );

    const settings: Record<string, any> = {
      combos_enabled: {
        key: 'combos_enabled',
        value: { enabled: true },
        updated_at: null,
        updated_by: null,
      },
      packaging_fee_enabled: {
        key: 'packaging_fee_enabled',
        value: { enabled: true },
        updated_at: null,
        updated_by: null,
      },
    };

    for (const row of res.rows) {
      settings[row.key] = {
        id: row.id,
        key: row.key,
        value: row.value || { enabled: true },
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        updated_by: row.updated_by,
      };
    }

    return NextResponse.json(
      { settings },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching toggle settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await validatePortalAdmin(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { key, enabled } = body;

    if (!key || !ALLOWED_KEYS.includes(key)) {
      return NextResponse.json(
        { error: `Invalid setting key. Allowed: ${ALLOWED_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Field "enabled" must be a boolean' },
        { status: 400 }
      );
    }

    // Determine admin identifier
    const updaterIdentifier = auth.ctx.name
      ? `${auth.ctx.name} (${auth.ctx.email})`
      : auth.ctx.email || 'Admin';

    const res = await query(
      `INSERT INTO public.app_settings (key, value, updated_at, updated_by)
       VALUES ($1, jsonb_build_object('enabled', $2::boolean), now(), $3)
       ON CONFLICT (key) DO UPDATE
       SET value = jsonb_build_object('enabled', $2::boolean),
           updated_at = now(),
           updated_by = $3
       RETURNING id, key, value, updated_at, updated_by`,
      [key, enabled, updaterIdentifier]
    );

    revalidateSettingsRoutes();

    const row = res.rows[0];
    return NextResponse.json({
      success: true,
      setting: {
        id: row.id,
        key: row.key,
        value: row.value,
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        updated_by: row.updated_by,
      },
    });
  } catch (error: any) {
    console.error('Error updating toggle setting:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
