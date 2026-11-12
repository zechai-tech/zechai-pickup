import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { isValidMenuCategory } from '@/lib/menu-categories';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function revalidateMenuRoutes() {
  try {
    revalidatePath('/menu');
    revalidatePath('/api/menu');
    revalidatePath('/admin/menu');
    revalidatePath('/admin/bestsellers');
  } catch (err) {
    console.warn('revalidatePath notice:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = searchParams.get('outlet_id');

    let sql = `
      SELECT m.*, c.sort_order AS category_sort_order
      FROM public.menu_items m
      LEFT JOIN public.categories c ON m.category = c.name
    `;
    const params: unknown[] = [];

    if (outletId) {
      sql += ' WHERE m.outlet_id = $1';
      params.push(outletId);
    }

    sql +=
      ' ORDER BY (m.category IS NULL) DESC, COALESCE(c.sort_order, 999) ASC, m.sort_order ASC, m.created_at DESC';

    const res = await query(sql, params);
    return NextResponse.json(
      { items: res.rows },
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
    const {
      outlet_id,
      name,
      description,
      price,
      category,
      image_url,
      is_available,
      is_veg,
      sort_order,
    } = body;

    if (!outlet_id || !name || price === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isValidMenuCategory(category)) {
      return NextResponse.json(
        { error: 'Please select a valid category from the fixed list' },
        { status: 400 }
      );
    }

    const res = await query(
      `
      INSERT INTO public.menu_items (
        outlet_id, name, description, price, category, image_url,
        is_available, is_bestseller, is_veg, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9)
      RETURNING *
      `,
      [
        outlet_id,
        String(name).trim(),
        description ? String(description).trim() : null,
        price,
        category,
        image_url || '/assets/chai.v1.webp',
        is_available ?? true,
        is_veg ?? true,
        sort_order ?? 0,
      ]
    );

    revalidateMenuRoutes();
    return NextResponse.json({ item: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      name,
      description,
      price,
      category,
      image_url,
      is_available,
      is_veg,
      sort_order,
    } = body;

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(String(name).trim());
    }
    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      params.push(description ? String(description).trim() : null);
    }
    if (price !== undefined) {
      fields.push(`price = $${idx++}`);
      params.push(price);
    }
    if (category !== undefined) {
      if (category !== null && category !== '' && !isValidMenuCategory(category)) {
        return NextResponse.json(
          { error: 'Invalid category selected' },
          { status: 400 }
        );
      }
      fields.push(`category = $${idx++}`);
      params.push(category === '' ? null : category);
    }
    if (image_url !== undefined) {
      fields.push(`image_url = $${idx++}`);
      params.push(image_url);
    }
    if (is_available !== undefined) {
      fields.push(`is_available = $${idx++}`);
      params.push(is_available);
    }
    if (is_veg !== undefined) {
      fields.push(`is_veg = $${idx++}`);
      params.push(is_veg);
    }
    if (sort_order !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      params.push(sort_order);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    const res = await query(
      `UPDATE public.menu_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    revalidateMenuRoutes();
    return NextResponse.json({ item: res.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await query('DELETE FROM public.menu_items WHERE id = $1', [id]);
    revalidateMenuRoutes();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
