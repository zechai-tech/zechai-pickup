import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const res = await query('SELECT * FROM public.outlets ORDER BY created_at ASC');
    return NextResponse.json({ outlets: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, address, phone, opening_time, closing_time, is_active, latitude, longitude } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : null;
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Outlet mobile number must be exactly 10 digits starting with 6, 7, 8, or 9' },
        { status: 400 }
      );
    }

    const numLat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : null;
    const numLng = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : null;

    const res = await query(
      `
      INSERT INTO public.outlets (name, address, phone, opening_time, closing_time, is_active, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        name,
        address || null,
        cleanPhone,
        opening_time || '15:00',
        closing_time || '00:00',
        is_active ?? true,
        numLat,
        numLng,
      ]
    );

    return NextResponse.json({ outlet: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, address, phone, opening_time, closing_time, is_active, latitude, longitude } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(name);
    }
    if (address !== undefined) {
      fields.push(`address = $${idx++}`);
      params.push(address);
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
    if (latitude !== undefined) {
      const numLat = latitude !== null && latitude !== '' ? Number(latitude) : null;
      fields.push(`latitude = $${idx++}`);
      params.push(numLat);
    }
    if (longitude !== undefined) {
      const numLng = longitude !== null && longitude !== '' ? Number(longitude) : null;
      fields.push(`longitude = $${idx++}`);
      params.push(numLng);
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
      `UPDATE public.outlets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Outlet not found' }, { status: 404 });
    }

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

    // Hard delete from database
    await query('DELETE FROM public.outlets WHERE id = $1', [id]);
    return NextResponse.json({ success: true, message: 'Outlet deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
