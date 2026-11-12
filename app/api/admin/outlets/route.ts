import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function revalidateOutletViews() {
  try {
    revalidatePath('/outlets');
    revalidatePath('/outlet');
    revalidatePath('/api/outlets');
    revalidatePath('/admin/outlets');
    revalidatePath('/admin/dashboard');
    revalidatePath('/admin/orders');
  } catch (err) {
    console.warn('revalidatePath notice:', err);
  }
}

export async function GET() {
  try {
    const res = await query(
      `SELECT id, name, address, phone, opening_time, closing_time, is_active, created_at
       FROM public.outlets
       ORDER BY created_at ASC`
    );
    return NextResponse.json(
      { outlets: res.rows },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, address, phone, opening_time, closing_time, is_active } = body;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Outlet mobile number must be exactly 10 digits starting with 6, 7, 8, or 9' },
        { status: 400 }
      );
    }

    const res = await query(
      `
      INSERT INTO public.outlets (name, address, phone, opening_time, closing_time, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, address, phone, opening_time, closing_time, is_active, created_at
      `,
      [
        String(name).trim(),
        address ? String(address).trim() : null,
        cleanPhone,
        opening_time || '15:00',
        closing_time || '00:00',
        is_active ?? true,
      ]
    );

    revalidateOutletViews();
    return NextResponse.json({ outlet: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, address, phone, opening_time, closing_time, is_active } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(String(name).trim());
    }
    if (address !== undefined) {
      fields.push(`address = $${idx++}`);
      params.push(address ? String(address).trim() : null);
    }
    if (phone !== undefined) {
      const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
      if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
        return NextResponse.json(
          { error: 'Outlet mobile number must be exactly 10 digits starting with 6, 7, 8, or 9' },
          { status: 400 }
        );
      }
      fields.push(`phone = $${idx++}`);
      params.push(cleanPhone);
    }
    if (opening_time !== undefined) {
      fields.push(`opening_time = $${idx++}`);
      params.push(opening_time);
    }
    if (closing_time !== undefined) {
      fields.push(`closing_time = $${idx++}`);
      params.push(closing_time);
    }
    if (is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      params.push(is_active);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    const res = await query(
      `UPDATE public.outlets SET ${fields.join(', ')} WHERE id = $${idx}
       RETURNING id, name, address, phone, opening_time, closing_time, is_active, created_at`,
      params
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Outlet not found' }, { status: 404 });
    }

    revalidateOutletViews();
    return NextResponse.json({ outlet: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const existing = await query('SELECT id, name FROM public.outlets WHERE id = $1 LIMIT 1', [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Outlet not found' }, { status: 404 });
    }

    const outletName = existing.rows[0].name;

    // Preserve outlet name on historical orders before deleting the outlet row
    await query(
      `UPDATE public.orders
       SET outlet_name = COALESCE(NULLIF(outlet_name, ''), $1)
       WHERE outlet_id = $2`,
      [outletName, id]
    );

    // Hard delete from database (orders.outlet_id ON DELETE SET NULL, users.outlet_id ON DELETE SET NULL, menu_items CASCADE)
    await query('DELETE FROM public.outlets WHERE id = $1', [id]);

    revalidateOutletViews();
    return NextResponse.json({ success: true, message: 'Outlet deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
