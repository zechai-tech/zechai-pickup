import { query, getClient } from '@/lib/db';

/**
 * Copies currently live shared menu items and shared combos to a target outlet.
 *
 * Rules:
 * - Copy only what exists RIGHT NOW as shared items and shared combos (master id not null, deleted_at is null).
 * - De-duplicated by master id.
 * - Take details from any existing live copy, preferring Zechai Taliparamba's.
 * - Copied rows are available, same price.
 * - combo_items rebuilt against the new outlet's own item copies.
 * - Skip a combo if any of its items does not exist.
 * - All executed within the provided client transaction or a new transaction.
 */
export async function copySharedMenuToOutlet(
  targetOutletId: string,
  existingClient?: any
): Promise<{ itemsCopied: number; combosCopied: number }> {
  const client = existingClient || (await getClient());
  const isOwnClient = !existingClient;

  if (isOwnClient) {
    await client.query('BEGIN');
  }

  try {
    // 0. Resolve standard outlet ID (Taliparamba) dynamically by name
    const taliRes = await client.query(
      `SELECT id FROM public.outlets WHERE lower(name) LIKE '%taliparamba%' LIMIT 1`
    );
    const taliparambaOutletId = taliRes.rows[0]?.id || null;

    // 1. Fetch live shared items (de-duplicated by master_item_id, preferring Taliparamba)
    const itemsRes = await client.query(
      `SELECT DISTINCT ON (m.master_item_id)
         m.id, m.master_item_id, m.name, m.description, m.price, m.category,
         m.image_url, m.is_available, m.is_bestseller, m.is_veg, m.sort_order, m.outlet_id
       FROM public.menu_items m
       WHERE m.master_item_id IS NOT NULL
         AND m.deleted_at IS NULL
       ORDER BY m.master_item_id,
         CASE WHEN m.outlet_id = $1 THEN 0 ELSE 1 END,
         m.created_at DESC`,
      [taliparambaOutletId]
    );

    const masterToNewItemId = new Map<string, string>();
    let itemsCopied = 0;

    for (const item of itemsRes.rows) {
      // Check if target outlet already has a live copy of this master_item_id
      const existingItem = await client.query(
        `SELECT id FROM public.menu_items
         WHERE outlet_id = $1 AND master_item_id = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [targetOutletId, item.master_item_id]
      );

      if (existingItem.rows.length > 0) {
        masterToNewItemId.set(item.master_item_id, existingItem.rows[0].id);
      } else {
        const insItem = await client.query(
          `INSERT INTO public.menu_items (
             outlet_id, master_item_id, name, description, price, category, image_url,
             is_available, is_bestseller, is_veg, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            targetOutletId,
            item.master_item_id,
            item.name,
            item.description,
            item.price,
            item.category,
            item.image_url || '/assets/chai.v1.webp',
            item.is_available ?? true,
            false, // reset bestseller flag for new outlet
            item.is_veg ?? true,
            item.sort_order ?? 0,
          ]
        );
        masterToNewItemId.set(item.master_item_id, insItem.rows[0].id);
        itemsCopied++;
      }
    }

    // 2. Fetch live shared combos (de-duplicated by master_combo_id, preferring Taliparamba)
    const combosRes = await client.query(
      `SELECT DISTINCT ON (c.master_combo_id)
         c.id, c.master_combo_id, c.name, c.description, c.image_url, c.price, c.sort_order, c.outlet_id
       FROM public.combos c
       WHERE c.master_combo_id IS NOT NULL
         AND c.deleted_at IS NULL
       ORDER BY c.master_combo_id,
         CASE WHEN c.outlet_id = $1 THEN 0 ELSE 1 END,
         c.created_at DESC`,
      [taliparambaOutletId]
    );

    let combosCopied = 0;

    for (const combo of combosRes.rows) {
      // Check if target outlet already has a live copy of this master_combo_id
      const existingCombo = await client.query(
        `SELECT id FROM public.combos
         WHERE outlet_id = $1 AND master_combo_id = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [targetOutletId, combo.master_combo_id]
      );

      if (existingCombo.rows.length > 0) {
        continue;
      }

      // Check included items for this combo
      const comboItemsRes = await client.query(
        `SELECT ci.quantity, m.master_item_id
         FROM public.combo_items ci
         JOIN public.menu_items m ON ci.menu_item_id = m.id
         WHERE ci.combo_id = $1
           AND m.deleted_at IS NULL`,
        [combo.id]
      );

      if (comboItemsRes.rows.length < 2) {
        // Combo must have at least 2 items; skip if incomplete
        continue;
      }

      // Verify every included item has a mapped live copy in the target outlet
      let canBuild = true;
      for (const ci of comboItemsRes.rows) {
        if (!ci.master_item_id || !masterToNewItemId.has(ci.master_item_id)) {
          canBuild = false;
          break;
        }
      }

      if (!canBuild) {
        continue;
      }

      // Insert combo for target outlet
      const insCombo = await client.query(
        `INSERT INTO public.combos (
           outlet_id, master_combo_id, name, description, image_url, price, sort_order
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          targetOutletId,
          combo.master_combo_id,
          combo.name,
          combo.description,
          combo.image_url || '/assets/chai.v1.webp',
          combo.price,
          combo.sort_order ?? 0,
        ]
      );

      const newComboId = insCombo.rows[0].id;

      // Insert combo_items
      for (const ci of comboItemsRes.rows) {
        const targetMenuItemId = masterToNewItemId.get(ci.master_item_id)!;
        await client.query(
          `INSERT INTO public.combo_items (combo_id, menu_item_id, quantity)
           VALUES ($1, $2, $3)`,
          [newComboId, targetMenuItemId, ci.quantity || 1]
        );
      }

      combosCopied++;
    }

    if (isOwnClient) {
      await client.query('COMMIT');
    }

    return { itemsCopied, combosCopied };
  } catch (err) {
    if (isOwnClient) {
      await client.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (isOwnClient) {
      client.release();
    }
  }
}
