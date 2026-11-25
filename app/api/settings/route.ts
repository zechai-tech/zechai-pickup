import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const res = await query(
      `SELECT id, key, value, updated_at, updated_by
       FROM public.app_settings
       WHERE key IN ('combos_enabled', 'packaging_fee_enabled')`
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
    console.error('Error fetching settings:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
