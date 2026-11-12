import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const res = await query(
      `SELECT id, name, address, opening_time, closing_time, is_active
       FROM public.outlets
       WHERE is_active = true
       ORDER BY created_at ASC`
    );

    return NextResponse.json(
      { outlets: res.rows },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          Pragma: 'no-cache',
        },
      }
    );
  } catch (error: any) {
    console.error('Public outlets fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to load outlets', outlets: [] },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  }
}
