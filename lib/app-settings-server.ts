import { query } from '@/lib/db';
import { AppSettingRecord } from './app-settings';

/**
 * Server-side helper to read all settings directly from database.
 */
export async function getServerAppSettings(): Promise<Record<string, AppSettingRecord>> {
  try {
    const res = await query(
      `SELECT id, key, value, updated_at, updated_by FROM public.app_settings`
    );
    const map: Record<string, AppSettingRecord> = {};
    for (const row of res.rows) {
      map[row.key] = {
        id: row.id,
        key: row.key,
        value: row.value || {},
        updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
        updated_by: row.updated_by,
      };
    }
    return map;
  } catch (err) {
    console.warn('getServerAppSettings error:', err);
    return {
      combos_enabled: { key: 'combos_enabled', value: { enabled: true } },
      packaging_fee_enabled: { key: 'packaging_fee_enabled', value: { enabled: true } },
    };
  }
}

/**
 * Server-side helper to read a single setting directly from database.
 */
export async function getServerAppSetting(key: string): Promise<any> {
  try {
    const res = await query(
      `SELECT value FROM public.app_settings WHERE key = $1 LIMIT 1`,
      [key]
    );
    if (res.rows.length === 0) return { enabled: true };
    return res.rows[0].value || { enabled: true };
  } catch (err) {
    console.warn(`getServerAppSetting(${key}) error:`, err);
    return { enabled: true };
  }
}
