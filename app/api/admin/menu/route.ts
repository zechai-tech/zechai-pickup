import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query, getClient } from '@/lib/db';
import { isValidMenuCategory } from '@/lib/menu-categories';
import { validatePortalManagerOrAdmin } from '@/lib/portal-auth';

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
    const outletId = (searchParams.get('outlet_id') || '').trim();

    if (outletId && outletId !== 'all') {
      const res = await query(
        `SELECT m.*, c.sort_order AS category_sort_order, o.name AS outlet_name,
                (m.master_item_id IS NOT NULL) AS is_shared,
                1::bigint AS outlets_count
         FROM public.menu_items m
         LEFT JOIN public.categories c ON m.category = c.name
         LEFT JOIN public.outlets o ON m.outlet_id = o.id
         WHERE m.outlet_id = $1 AND m.deleted_at IS NULL
         ORDER BY (m.category IS NULL) DESC, COALESCE(c.sort_order, 999) ASC, m.sort_order ASC, m.created_at DESC`,
        [outletId]
      );
      return NextResponse.json(
        { items: res.rows },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    } else {
      // All Outlets view:
      // Fetch live shared items (de-duplicated by master_item_id, preferring Taliparamba) with count of live outlets,
      // plus live outlet-only items (master_item_id IS NULL)
      const res = await query(
        `WITH live_items AS (
           SELECT m.*, c.sort_order AS category_sort_order, o.name AS outlet_name
           FROM public.menu_items m
           LEFT JOIN public.categories c ON m.category = c.name
           LEFT JOIN public.outlets o ON m.outlet_id = o.id
           WHERE m.deleted_at IS NULL
         ),
         counts AS (
           SELECT master_item_id, count(DISTINCT outlet_id) AS outlets_count
           FROM live_items
           WHERE master_item_id IS NOT NULL
           GROUP BY master_item_id
         ),
         deduped_shared AS (
           SELECT DISTINCT ON (li.master_item_id)
             li.*,
             true AS is_shared,
             COALESCE(cnt.outlets_count, 1) AS outlets_count
           FROM live_items li
           JOIN counts cnt ON li.master_item_id = cnt.master_item_id
           ORDER BY li.master_item_id,
             CASE WHEN li.outlet_id IN (SELECT id FROM public.outlets WHERE lower(name) LIKE '%taliparamba%') THEN 0 ELSE 1 END,
             li.created_at DESC
         ),
         outlet_only AS (
           SELECT li.*, false AS is_shared, 1::bigint AS outlets_count
           FROM live_items li
           WHERE li.master_item_id IS NULL
         )
         SELECT * FROM (
           SELECT * FROM deduped_shared
           UNION ALL
           SELECT * FROM outlet_only
         ) combined
         ORDER BY (category IS NULL) DESC, COALESCE(category_sort_order, 999) ASC, sort_order ASC, created_at DESC`
      );
      return NextResponse.json(
        { items: res.rows },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          },
        }
      );
    }
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
      is_shared,
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

    // Check if adding to "all" outlets (includes inactive outlets too, so when switched on they have the full menu)
    if (outlet_id === 'all') {
      const outletsRes = await query(`SELECT id FROM public.outlets`);
      const allOutlets = outletsRes.rows;
      if (allOutlets.length === 0) {
        return NextResponse.json({ error: 'No outlets found' }, { status: 400 });
      }

      const client = await getClient();
      try {
        await client.query('BEGIN');
        const masterIdRes = await client.query('SELECT gen_random_uuid() AS id');
        const masterItemId = masterIdRes.rows[0].id;

        let firstRow: any = null;
        for (const o of allOutlets) {
          const insRes = await client.query(
            `INSERT INTO public.menu_items (
               outlet_id, master_item_id, name, description, price, category, image_url,
               is_available, is_bestseller, is_veg, sort_order
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10)
             RETURNING *`,
            [
              o.id,
              masterItemId,
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
          if (!firstRow) firstRow = insRes.rows[0];
        }

        await client.query('COMMIT');
        revalidateMenuRoutes();
        return NextResponse.json({ item: firstRow });
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Single outlet add
    const masterItemId = is_shared ? null : null; // if not explicitly shared across all, keep outlet_id
    const res = await query(
      `
      INSERT INTO public.menu_items (
        outlet_id, master_item_id, name, description, price, category, image_url,
        is_available, is_bestseller, is_veg, sort_order
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9, $10)
      RETURNING *
      `,
      [
        outlet_id,
        is_shared ? null : null,
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
      outlet_id,
      scope,
    } = body;

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const itemRes = await query(
      `SELECT m.*, o.name AS outlet_name
       FROM public.menu_items m
       LEFT JOIN public.outlets o ON m.outlet_id = o.id
       WHERE m.id =  AND m.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (itemRes.rows.length === 0) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    const currentItem = itemRes.rows[0];
    const isSharedScope = (scope === 'all' || outlet_id === 'all') && !!currentItem.master_item_id;

    if (isSharedScope) {
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
      // Rule: 'Edit a shared item in All Outlets -> updates every outlet (never availability)'
      // Never update is_available across all outlets
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

      params.push(currentItem.master_item_id);
      const res = await query(
        `UPDATE public.menu_items
         SET ${fields.join(', ')}
         WHERE master_item_id = $${idx} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      // Ensure all outlets (both active and inactive) have a copy of this shared item
      const allOutletsRes = await query(`SELECT id FROM public.outlets`);
      for (const o of allOutletsRes.rows) {
        const hasCopy = await query(
          `SELECT id FROM public.menu_items WHERE outlet_id =  AND master_item_id =  AND deleted_at IS NULL LIMIT 1`,
          [o.id, currentItem.master_item_id]
        );
        if (hasCopy.rows.length === 0) {
          await query(
            `INSERT INTO public.menu_items (
               outlet_id, master_item_id, name, description, price, category, image_url,
               is_available, is_bestseller, is_veg, sort_order
             ) VALUES (, , , , , , , true, false, , )`,
            [
              o.id,
              currentItem.master_item_id,
              name !== undefined ? String(name).trim() : currentItem.name,
              description !== undefined ? (description ? String(description).trim() : null) : currentItem.description,
              price !== undefined ? price : currentItem.price,
              category !== undefined ? (category === '' ? null : category) : currentItem.category,
              image_url !== undefined ? image_url : currentItem.image_url,
              is_veg !== undefined ? is_veg : currentItem.is_veg,
              sort_order !== undefined ? sort_order : (currentItem.sort_order || 0),
            ]
          );
        }
      }

      revalidateMenuRoutes();
      return NextResponse.json({
        item: res.rows[0],
        updatedCount: res.rowCount,
        message: `Updated "${res.rows[0]?.name}" across all ${res.rowCount} outlets.`,
      });
    }

    // Single outlet update:
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
      `UPDATE public.menu_items
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
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
  const client = await getClient();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'single';
    const outletId = searchParams.get('outlet_id') || undefined;

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
    }

    const auth = await validatePortalManagerOrAdmin(req, outletId);
    if (!auth.ok) return auth.response;

    const { ctx } = auth;

    // Look up target item
    const itemRes = await client.query(
      `SELECT m.*, o.name AS outlet_name
       FROM public.menu_items m
       LEFT JOIN public.outlets o ON m.outlet_id = o.id
       WHERE m.id = $1 AND m.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (itemRes.rows.length === 0) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    const item = itemRes.rows[0];
    const isShared = item.master_item_id !== null;

    if (ctx.isManager) {
      if (isShared) {
        return NextResponse.json(
          { error: 'Forbidden: managers cannot delete shared menu items' },
          { status: 403 }
        );
      }
      if (item.outlet_id !== ctx.userOutletId) {
        return NextResponse.json(
          { error: 'Forbidden: managers can only delete items in their own outlet' },
          { status: 403 }
        );
      }

      // Check if item is used in any live combos
      const comboCheck = await client.query(
        `SELECT ci.id
         FROM public.combo_items ci
         JOIN public.combos c ON ci.combo_id = c.id
         WHERE ci.menu_item_id = $1 AND c.deleted_at IS NULL
         LIMIT 1`,
        [item.id]
      );
      if (comboCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'Forbidden: managers cannot delete items that are used in combos' },
          { status: 403 }
        );
      }

      // Manager soft delete of their own outlet-only item
      await client.query('BEGIN');
      await client.query(
        `UPDATE public.menu_items SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`,
        [item.id]
      );
      await client.query('COMMIT');

      revalidateMenuRoutes();
      return NextResponse.json({ success: true, message: `Deleted "${item.name}"` });
    }

    // Admin / Super Admin Delete
    if (scope === 'all') {
      if (!isShared) {
        return NextResponse.json(
          {
            error: `"${item.name}" is an outlet-only item for ${item.outlet_name || 'a single outlet'}. Please select that outlet to delete it.`,
          },
          { status: 400 }
        );
      }

      await client.query('BEGIN');

      // 1. Find all live combos across all outlets that use this master_item_id
      const combosRes = await client.query(
        `SELECT DISTINCT c.id
         FROM public.combos c
         JOIN public.combo_items ci ON c.id = ci.combo_id
         JOIN public.menu_items m ON ci.menu_item_id = m.id
         WHERE m.master_item_id = $1
           AND c.deleted_at IS NULL
           AND m.deleted_at IS NULL`,
        [item.master_item_id]
      );

      const affectedComboIds = combosRes.rows.map((r: any) => r.id);

      // 2. Soft delete affected combos in the same transaction
      if (affectedComboIds.length > 0) {
        await client.query(
          `UPDATE public.combos
           SET deleted_at = now()
           WHERE id = ANY($1) AND deleted_at IS NULL`,
          [affectedComboIds]
        );
      }

      // 3. Soft delete all item copies across all outlets in the same transaction
      const delItemRes = await client.query(
        `UPDATE public.menu_items
         SET deleted_at = now()
         WHERE master_item_id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [item.master_item_id]
      );

      await client.query('COMMIT');

      revalidateMenuRoutes();
      return NextResponse.json({
        success: true,
        deletedItemsCount: delItemRes.rows.length,
        deletedCombosCount: affectedComboIds.length,
        message: `Deleted "${item.name}" from all ${delItemRes.rows.length} outlets.`,
      });
    } else {
      // Scope === 'single'
      await client.query('BEGIN');

      // 1. Find all live combos in this outlet using this item
      const combosRes = await client.query(
        `SELECT DISTINCT c.id
         FROM public.combos c
         JOIN public.combo_items ci ON c.id = ci.combo_id
         WHERE ci.menu_item_id = $1 AND c.deleted_at IS NULL`,
        [item.id]
      );

      const affectedComboIds = combosRes.rows.map((r: any) => r.id);

      // 2. Soft delete affected combos in this outlet in the same transaction
      if (affectedComboIds.length > 0) {
        await client.query(
          `UPDATE public.combos
           SET deleted_at = now()
           WHERE id = ANY($1) AND deleted_at IS NULL`,
          [affectedComboIds]
        );
      }

      // 3. Soft delete this single item
      await client.query(
        `UPDATE public.menu_items
         SET deleted_at = now()
         WHERE id = $1 AND deleted_at IS NULL`,
        [item.id]
      );

      await client.query('COMMIT');

      revalidateMenuRoutes();
      return NextResponse.json({
        success: true,
        deletedItemsCount: 1,
        deletedCombosCount: affectedComboIds.length,
        message: `Deleted "${item.name}" from ${item.outlet_name || 'outlet'}.`,
      });
    }
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('Menu DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
