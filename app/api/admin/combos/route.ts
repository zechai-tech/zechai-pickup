import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query, getClient } from '@/lib/db';
import { validatePortalAdmin, validatePortalStaffOrAbove } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function revalidateMenuRoutes() {
  try {
    revalidatePath('/menu');
    revalidatePath('/api/menu');
    revalidatePath('/admin/menu');
  } catch (err) {
    console.warn('revalidatePath notice:', err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const outletId = (searchParams.get('outlet_id') || searchParams.get('outlet') || '').trim();

    const authResult = await validatePortalStaffOrAbove(req, outletId === 'all' ? undefined : outletId || undefined);
    if (!authResult.ok) {
      return authResult.response;
    }

    const isAllOutlets = outletId === 'all' && authResult.ctx.isAdmin;
    const effectiveOutletId = isAllOutlets ? null : outletId || authResult.ctx.userOutletId;

    if (!isAllOutlets && !effectiveOutletId) {
      return NextResponse.json({ error: 'outlet_id is required' }, { status: 400 });
    }

    // 1. Fetch combos (ignoring soft-deleted rows)
    let combosQuery = `
      SELECT c.*, o.name AS outlet_name
      FROM public.combos c
      LEFT JOIN public.outlets o ON c.outlet_id = o.id
      WHERE c.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (!isAllOutlets) {
      combosQuery += ` AND c.outlet_id = $1`;
      params.push(effectiveOutletId);
    }

    combosQuery += ` ORDER BY c.sort_order ASC, c.created_at DESC`;

    const combosRes = await query(combosQuery, params);
    let rawCombos = combosRes.rows;

    if (rawCombos.length === 0) {
      return NextResponse.json({ combos: [] });
    }

    // In All Outlets view, de-duplicate shared combos by master_combo_id and count live outlets
    let combosToProcess: any[] = [];
    if (isAllOutlets) {
      const liveSharedCounts = new Map<string, number>();
      for (const c of rawCombos) {
        if (c.master_combo_id) {
          liveSharedCounts.set(c.master_combo_id, (liveSharedCounts.get(c.master_combo_id) || 0) + 1);
        }
      }

      const seenMasters = new Set<string>();
      for (const c of rawCombos) {
        if (c.master_combo_id) {
          if (!seenMasters.has(c.master_combo_id)) {
            seenMasters.add(c.master_combo_id);
            combosToProcess.push({
              ...c,
              is_shared: true,
              outlets_count: liveSharedCounts.get(c.master_combo_id) || 1,
            });
          }
        } else {
          combosToProcess.push({
            ...c,
            is_shared: false,
            outlets_count: 1,
          });
        }
      }
    } else {
      combosToProcess = rawCombos.map((c) => ({
        ...c,
        is_shared: c.master_combo_id !== null,
        outlets_count: 1,
      }));
    }

    const comboIds = rawCombos.map((c) => c.id);

    // 2. Fetch all items for these combos with joined menu_item details (ignoring soft-deleted items)
    const itemsRes = await query(
      `SELECT ci.id AS combo_item_id, ci.combo_id, ci.menu_item_id, ci.quantity,
              m.name, m.price, m.image_url, m.is_available, m.is_veg, m.category
       FROM public.combo_items ci
       JOIN public.menu_items m ON ci.menu_item_id = m.id
       WHERE ci.combo_id = ANY($1)
         AND m.deleted_at IS NULL
       ORDER BY ci.created_at ASC`,
      [comboIds]
    );

    const itemsByCombo = new Map<string, any[]>();
    for (const row of itemsRes.rows) {
      const list = itemsByCombo.get(row.combo_id) || [];
      list.push({
        id: row.combo_item_id,
        menu_item_id: row.menu_item_id,
        name: row.name,
        price: Number(row.price),
        quantity: Number(row.quantity),
        image_url: row.image_url,
        is_available: row.is_available ?? true,
        is_veg: row.is_veg ?? true,
        category: row.category,
      });
      itemsByCombo.set(row.combo_id, list);
    }

    const formattedCombos = combosToProcess.map((combo) => {
      const included = itemsByCombo.get(combo.id) || [];
      const isAvailable = included.length > 0 && included.every((i) => i.is_available === true);
      const isVeg = included.every((i) => i.is_veg === true);
      const itemsTotal = included.reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (Number(i.quantity) || 1),
        0
      );
      const price = Number(combo.price);
      const savings = Math.max(0, itemsTotal - price);

      return {
        id: combo.id,
        outlet_id: combo.outlet_id,
        outlet_name: combo.outlet_name,
        master_combo_id: combo.master_combo_id,
        is_shared: combo.is_shared,
        outlets_count: combo.outlets_count,
        name: combo.name,
        description: combo.description || '',
        price: price,
        image_url: combo.image_url || '/assets/chai.v1.webp',
        image: combo.image_url || '/assets/chai.v1.webp',
        sort_order: Number(combo.sort_order || 0),
        is_available: isAvailable,
        is_veg: isVeg,
        items_total: itemsTotal,
        savings: savings,
        items: included,
        created_at: combo.created_at,
      };
    });

    return NextResponse.json({ combos: formattedCombos });
  } catch (error: any) {
    console.error('Error fetching combos:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Only Admin can create combos
    const authResult = await validatePortalAdmin(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = await req.json().catch(() => ({}));
    const { outlet_id, name, description, image_url, price, items, sort_order } = body;

    if (!outlet_id || typeof outlet_id !== 'string') {
      return NextResponse.json({ error: 'Valid outlet_id is required' }, { status: 400 });
    }

    const cleanName = String(name || '').trim();
    if (!cleanName) {
      return NextResponse.json({ error: 'Combo name is required' }, { status: 400 });
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      return NextResponse.json({ error: 'Valid combo price is required' }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'A combo must contain at least 2 distinct menu items' },
        { status: 400 }
      );
    }

    // Deduplicate distinct menu_item_ids and sanitize quantities
    const uniqueItemMap = new Map<string, number>();
    for (const it of items) {
      if (!it || !it.menu_item_id) continue;
      const id = String(it.menu_item_id).trim();
      const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
      uniqueItemMap.set(id, qty);
    }

    if (uniqueItemMap.size < 2) {
      return NextResponse.json(
        { error: 'A combo must contain at least 2 distinct menu items' },
        { status: 400 }
      );
    }

    const itemIds = Array.from(uniqueItemMap.keys());

    // 1. All Outlets creation (includes inactive outlets too)
    if (outlet_id === 'all') {
      const dbItemsRes = await query(
        `SELECT id, master_item_id, name FROM public.menu_items WHERE id = ANY($1) AND deleted_at IS NULL`,
        [itemIds]
      );

      if (dbItemsRes.rows.length !== itemIds.length) {
        return NextResponse.json(
          { error: 'One or more selected menu items do not exist' },
          { status: 400 }
        );
      }

      const itemMasterMap = new Map<string, number>();
      for (const row of dbItemsRes.rows) {
        if (!row.master_item_id) {
          return NextResponse.json(
            { error: `"${row.name}" is an outlet-only item and cannot be included in a shared combo` },
            { status: 400 }
          );
        }
        itemMasterMap.set(row.master_item_id, uniqueItemMap.get(row.id) || 1);
      }

      // Query all outlets (both active and inactive)
      const outletsRes = await query(`SELECT id FROM public.outlets`);
      const allOutlets = outletsRes.rows;
      if (allOutlets.length === 0) {
        return NextResponse.json({ error: 'No outlets found' }, { status: 400 });
      }

      const client = await getClient();
      try {
        await client.query('BEGIN');
        const masterComboIdRes = await client.query('SELECT gen_random_uuid() AS id');
        const masterComboId = masterComboIdRes.rows[0].id;
        const masterItemIds = Array.from(itemMasterMap.keys());

        let firstCombo: any = null;
        for (const o of allOutlets) {
          const outletItemsRes = await client.query(
            `SELECT id, master_item_id FROM public.menu_items
             WHERE outlet_id = $1 AND master_item_id = ANY($2) AND deleted_at IS NULL`,
            [o.id, masterItemIds]
          );

          if (outletItemsRes.rows.length !== masterItemIds.length) {
            continue;
          }

          const insCombo = await client.query(
            `INSERT INTO public.combos (outlet_id, master_combo_id, name, description, image_url, price, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              o.id,
              masterComboId,
              cleanName,
              description ? String(description).trim() : null,
              image_url || '/assets/chai.v1.webp',
              numericPrice,
              Number(sort_order || 0),
            ]
          );

          if (!firstCombo) firstCombo = insCombo.rows[0];

          for (const itemRow of outletItemsRes.rows) {
            const qty = itemMasterMap.get(itemRow.master_item_id) || 1;
            await client.query(
              `INSERT INTO public.combo_items (combo_id, menu_item_id, quantity)
               VALUES ($1, $2, $3)`,
              [insCombo.rows[0].id, itemRow.id, qty]
            );
          }
        }

        await client.query('COMMIT');
        revalidateMenuRoutes();
        return NextResponse.json({ combo: firstCombo }, { status: 201 });
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // 2. Single outlet creation
    const dbItemsRes = await query(
      `SELECT id, outlet_id FROM public.menu_items WHERE id = ANY($1) AND deleted_at IS NULL`,
      [itemIds]
    );

    if (dbItemsRes.rows.length !== itemIds.length) {
      return NextResponse.json(
        { error: 'One or more selected menu items do not exist' },
        { status: 400 }
      );
    }

    for (const row of dbItemsRes.rows) {
      if (row.outlet_id !== outlet_id) {
        return NextResponse.json(
          { error: 'All items in a combo must belong to the selected outlet' },
          { status: 400 }
        );
      }
    }

    // Insert combo
    const comboRes = await query(
      `INSERT INTO public.combos (outlet_id, name, description, image_url, price, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        outlet_id,
        cleanName,
        description ? String(description).trim() : null,
        image_url || '/assets/chai.v1.webp',
        numericPrice,
        Number(sort_order || 0),
      ]
    );

    const createdCombo = comboRes.rows[0];

    // Insert combo items
    for (const [itemId, qty] of uniqueItemMap.entries()) {
      await query(
        `INSERT INTO public.combo_items (combo_id, menu_item_id, quantity)
         VALUES ($1, $2, $3)`,
        [createdCombo.id, itemId, qty]
      );
    }

    revalidateMenuRoutes();
    return NextResponse.json({ combo: createdCombo }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating combo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Only Admin can edit combos
    const authResult = await validatePortalAdmin(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    const body = await req.json().catch(() => ({}));
    const { id, name, description, image_url, price, items, sort_order, outlet_id, scope } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Valid combo ID is required' }, { status: 400 });
    }

    // Fetch existing combo to check outlet
    const existingComboRes = await query(
      `SELECT * FROM public.combos WHERE id = $1 LIMIT 1`,
      [id]
    );
    if (existingComboRes.rows.length === 0) {
      return NextResponse.json({ error: 'Combo not found' }, { status: 404 });
    }
    const existingCombo = existingComboRes.rows[0];

    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName) {
        return NextResponse.json({ error: 'Combo name cannot be empty' }, { status: 400 });
      }
      fields.push(`name = $${idx++}`);
      params.push(cleanName);
    }

    if (description !== undefined) {
      fields.push(`description = $${idx++}`);
      params.push(description ? String(description).trim() : null);
    }

    if (image_url !== undefined) {
      fields.push(`image_url = $${idx++}`);
      params.push(image_url);
    }

    if (price !== undefined) {
      const numericPrice = Number(price);
      if (!Number.isFinite(numericPrice) || numericPrice < 0) {
        return NextResponse.json({ error: 'Valid combo price is required' }, { status: 400 });
      }
      fields.push(`price = $${idx++}`);
      params.push(numericPrice);
    }

    if (sort_order !== undefined) {
      fields.push(`sort_order = $${idx++}`);
      params.push(Number(sort_order || 0));
    }

    fields.push(`updated_at = now()`);

    const isSharedComboUpdate = (scope === 'all' || outlet_id === 'all') && !!existingCombo.master_combo_id;

    if (isSharedComboUpdate) {
      const client = await getClient();
      try {
        await client.query('BEGIN');

        // 1. Update combo details across all outlets (active and inactive)
        params.push(existingCombo.master_combo_id);
        const updateRes = await client.query(
          `UPDATE public.combos
           SET ${fields.join(', ')}
           WHERE master_combo_id = $${idx} AND deleted_at IS NULL
           RETURNING *`,
          params
        );

        // 2. If items provided, update combo_items for all outlets (active and inactive)
        if (items !== undefined) {
          if (!Array.isArray(items) || items.length === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { error: 'A combo must contain at least 2 distinct menu items' },
              { status: 400 }
            );
          }

          const uniqueItemMap = new Map<string, number>();
          for (const it of items) {
            if (!it || !it.menu_item_id) continue;
            const itemId = String(it.menu_item_id).trim();
            const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
            uniqueItemMap.set(itemId, qty);
          }

          if (uniqueItemMap.size < 2) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { error: 'A combo must contain at least 2 distinct menu items' },
              { status: 400 }
            );
          }

          const itemIds = Array.from(uniqueItemMap.keys());
          const dbItemsRes = await client.query(
            `SELECT id, master_item_id, name FROM public.menu_items WHERE id = ANY($1) AND deleted_at IS NULL`,
            [itemIds]
          );

          const itemMasterMap = new Map<string, number>();
          for (const r of dbItemsRes.rows) {
            if (!r.master_item_id) {
              await client.query('ROLLBACK');
              return NextResponse.json(
                { error: `"${r.name}" is an outlet-only item and cannot be in a shared combo.` },
                { status: 400 }
              );
            }
            itemMasterMap.set(r.master_item_id, uniqueItemMap.get(r.id) || 1);
          }

          const masterItemIds = Array.from(itemMasterMap.keys());

          // Find all combos across all outlets (active and inactive)
          const targetCombos = await client.query(
            `SELECT id, outlet_id FROM public.combos WHERE master_combo_id = $1 AND deleted_at IS NULL`,
            [existingCombo.master_combo_id]
          );

          for (const tc of targetCombos.rows) {
            const outletItemsRes = await client.query(
              `SELECT id, master_item_id FROM public.menu_items
               WHERE outlet_id = $1 AND master_item_id = ANY($2) AND deleted_at IS NULL`,
              [tc.outlet_id, masterItemIds]
            );

            if (outletItemsRes.rows.length === masterItemIds.length) {
              await client.query(`DELETE FROM public.combo_items WHERE combo_id = $1`, [tc.id]);
              for (const oItem of outletItemsRes.rows) {
                const qty = itemMasterMap.get(oItem.master_item_id) || 1;
                await client.query(
                  `INSERT INTO public.combo_items (combo_id, menu_item_id, quantity)
                   VALUES ($1, $2, $3)`,
                  [tc.id, oItem.id, qty]
                );
              }
            }
          }
        }

        await client.query('COMMIT');
        revalidateMenuRoutes();
        return NextResponse.json({ combo: updateRes.rows[0], updatedCount: updateRes.rowCount });
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    params.push(id);
    const updateRes = await query(
      `UPDATE public.combos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    // If items are provided in update, replace combo_items
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'A combo must contain at least 2 distinct menu items' },
          { status: 400 }
        );
      }

      const uniqueItemMap = new Map<string, number>();
      for (const it of items) {
        if (!it || !it.menu_item_id) continue;
        const itemId = String(it.menu_item_id).trim();
        const qty = Math.max(1, Math.round(Number(it.quantity) || 1));
        uniqueItemMap.set(itemId, qty);
      }

      if (uniqueItemMap.size < 2) {
        return NextResponse.json(
          { error: 'A combo must contain at least 2 distinct menu items' },
          { status: 400 }
        );
      }

      const itemIds = Array.from(uniqueItemMap.keys());
      const dbItemsRes = await query(
        `SELECT id, outlet_id FROM public.menu_items WHERE id = ANY($1)`,
        [itemIds]
      );

      if (dbItemsRes.rows.length !== itemIds.length) {
        return NextResponse.json(
          { error: 'One or more selected menu items do not exist' },
          { status: 400 }
        );
      }

      for (const row of dbItemsRes.rows) {
        if (row.outlet_id !== existingCombo.outlet_id) {
          return NextResponse.json(
            { error: 'All items in a combo must belong to the same outlet' },
            { status: 400 }
          );
        }
      }

      // Replace items
      await query(`DELETE FROM public.combo_items WHERE combo_id = $1`, [id]);
      for (const [itemId, qty] of uniqueItemMap.entries()) {
        await query(
          `INSERT INTO public.combo_items (combo_id, menu_item_id, quantity)
           VALUES ($1, $2, $3)`,
          [id, itemId, qty]
        );
      }
    }

    revalidateMenuRoutes();
    return NextResponse.json({ combo: updateRes.rows[0] });
  } catch (error: any) {
    console.error('Error updating combo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const client = await getClient();
  try {
    // Only Admin can delete combos (managers/staff get 403)
    const authResult = await validatePortalAdmin(req);
    if (!authResult.ok) {
      return authResult.response;
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const scope = searchParams.get('scope') === 'all' ? 'all' : 'single';

    if (!id) {
      return NextResponse.json({ error: 'Valid combo ID is required' }, { status: 400 });
    }

    // Look up target combo
    const comboRes = await client.query(
      `SELECT c.*, o.name AS outlet_name
       FROM public.combos c
       LEFT JOIN public.outlets o ON c.outlet_id = o.id
       WHERE c.id = $1 AND c.deleted_at IS NULL
       LIMIT 1`,
      [id]
    );

    if (comboRes.rows.length === 0) {
      return NextResponse.json({ error: 'Combo not found' }, { status: 404 });
    }

    const combo = comboRes.rows[0];
    const isShared = combo.master_combo_id !== null;

    if (scope === 'all') {
      if (!isShared) {
        return NextResponse.json(
          {
            error: `"${combo.name}" is an outlet-only combo. Please select ${combo.outlet_name || 'its outlet'} to delete it.`,
          },
          { status: 400 }
        );
      }

      await client.query('BEGIN');
      const delRes = await client.query(
        `UPDATE public.combos
         SET deleted_at = now()
         WHERE master_combo_id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [combo.master_combo_id]
      );
      await client.query('COMMIT');

      revalidateMenuRoutes();
      return NextResponse.json({
        success: true,
        deletedCount: delRes.rows.length,
        message: `Deleted combo "${combo.name}" from all ${delRes.rows.length} outlets.`,
      });
    } else {
      await client.query('BEGIN');
      await client.query(
        `UPDATE public.combos
         SET deleted_at = now()
         WHERE id = $1 AND deleted_at IS NULL`,
        [combo.id]
      );
      await client.query('COMMIT');

      revalidateMenuRoutes();
      return NextResponse.json({
        success: true,
        deletedCount: 1,
        message: `Deleted combo "${combo.name}" from ${combo.outlet_name || 'outlet'}.`,
      });
    }
  } catch (error: any) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    console.error('Error deleting combo:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
