import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { computeOrderTotal } from '@/lib/pricing';
import { verifyAndSyncOrder } from '@/lib/order-sync';

function normalizeCartSignature(rawItems: any[]): string {
  if (!Array.isArray(rawItems)) return '';
  return rawItems
    .map((it) => `${String(it.combo_id || it.menu_item_id || it.id || '')}:${Number(it.quantity ?? it.qty ?? 1)}`)
    .sort()
    .join('|');
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }

    // Reject unknown top-level fields
    const allowedKeys = ['outlet_id', 'customer_phone', 'kitchen_note', 'items'];
    const bodyKeys = Object.keys(body);
    const unknownKeys = bodyKeys.filter((k) => !allowedKeys.includes(k));
    if (unknownKeys.length > 0) {
      return NextResponse.json(
        { error: `Unknown field(s) in request: ${unknownKeys.join(', ')}` },
        { status: 400 }
      );
    }

    const { outlet_id, customer_phone, kitchen_note, items } = body;

    // Validate outlet_id
    if (!outlet_id || typeof outlet_id !== 'string' || !outlet_id.trim()) {
      return NextResponse.json({ error: 'Valid outlet_id is required' }, { status: 400 });
    }

    // Validate customer_phone (10-digit Indian mobile number)
    const rawPhone = typeof customer_phone === 'string' ? customer_phone : '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return NextResponse.json(
        { error: 'Valid 10-digit customer mobile phone number is required' },
        { status: 400 }
      );
    }

    // Validate kitchen_note
    if (kitchen_note !== undefined && kitchen_note !== null && typeof kitchen_note !== 'string') {
      return NextResponse.json({ error: 'kitchen_note must be a string' }, { status: 400 });
    }
    const cleanNote = kitchen_note ? kitchen_note.trim().slice(0, 300) : null;

    // Validate items array (1 to 30 items)
    if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
      return NextResponse.json(
        { error: 'Items must be an array containing between 1 and 30 items' },
        { status: 400 }
      );
    }

    // Validate each item structure
    const allowedItemKeys = ['menu_item_id', 'combo_id', 'quantity'];
    const menuItemIds: string[] = [];
    const comboIds: string[] = [];

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it || typeof it !== 'object' || Array.isArray(it)) {
        return NextResponse.json({ error: `Item at index ${i} must be an object` }, { status: 400 });
      }

      const itKeys = Object.keys(it);
      const unknownItemKeys = itKeys.filter((k) => !allowedItemKeys.includes(k));
      if (unknownItemKeys.length > 0) {
        return NextResponse.json(
          { error: `Item at index ${i} contains unknown fields: ${unknownItemKeys.join(', ')}` },
          { status: 400 }
        );
      }

      const hasMenuItemId = Boolean(it.menu_item_id && typeof it.menu_item_id === 'string');
      const hasComboId = Boolean(it.combo_id && typeof it.combo_id === 'string');

      if ((!hasMenuItemId && !hasComboId) || (hasMenuItemId && hasComboId)) {
        return NextResponse.json(
          { error: `Item at index ${i} must specify either menu_item_id or combo_id` },
          { status: 400 }
        );
      }

      const qty = Number(it.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 20) {
        return NextResponse.json(
          { error: `Item at index ${i} quantity must be an integer between 1 and 20` },
          { status: 400 }
        );
      }

      if (hasMenuItemId) {
        menuItemIds.push(it.menu_item_id.trim());
      } else {
        comboIds.push(it.combo_id.trim());
      }
    }

    // Validate outlet exists and is active
    const outletRes = await query(
      'SELECT id, name, is_active FROM public.outlets WHERE id = $1 LIMIT 1',
      [outlet_id]
    );

    if (outletRes.rows.length === 0) {
      return NextResponse.json({ error: 'Selected outlet does not exist' }, { status: 400 });
    }

    if (!outletRes.rows[0].is_active) {
      return NextResponse.json(
        { error: 'Selected outlet is currently inactive and not accepting orders' },
        { status: 400 }
      );
    }

    const outletName = outletRes.rows[0].name;

    // Load regular menu items strictly from database
    const uniqueMenuItemIds = Array.from(new Set(menuItemIds));
    const dbItemsMap = new Map<string, any>();
    if (uniqueMenuItemIds.length > 0) {
      const menuRes = await query(
        `SELECT id, name, price, outlet_id, is_available, image_url 
         FROM public.menu_items 
         WHERE id = ANY($1)`,
        [uniqueMenuItemIds]
      );
      menuRes.rows.forEach((r) => dbItemsMap.set(r.id, r));

      if (dbItemsMap.size !== uniqueMenuItemIds.length) {
        return NextResponse.json(
          { error: 'One or more menu items could not be found' },
          { status: 400 }
        );
      }
    }

    // Load combos strictly from database
    const uniqueComboIds = Array.from(new Set(comboIds));
    const dbCombosMap = new Map<string, any>();
    const comboItemsMap = new Map<string, any[]>();

    if (uniqueComboIds.length > 0) {
      const combosRes = await query(
        `SELECT id, outlet_id, name, price, image_url 
         FROM public.combos 
         WHERE id = ANY($1)`,
        [uniqueComboIds]
      );
      combosRes.rows.forEach((r) => dbCombosMap.set(r.id, r));

      if (dbCombosMap.size !== uniqueComboIds.length) {
        return NextResponse.json(
          { error: 'One or more combos could not be found' },
          { status: 400 }
        );
      }

      // Load all included items and their live availability for these combos
      const comboItemsRes = await query(
        `SELECT ci.combo_id, ci.menu_item_id, ci.quantity,
                m.name, m.price, m.outlet_id, m.is_available, m.is_veg
         FROM public.combo_items ci
         JOIN public.menu_items m ON ci.menu_item_id = m.id
         WHERE ci.combo_id = ANY($1)`,
        [uniqueComboIds]
      );

      for (const row of comboItemsRes.rows) {
        const list = comboItemsMap.get(row.combo_id) || [];
        list.push(row);
        comboItemsMap.set(row.combo_id, list);
      }
    }

    // Recompute order total on server from DB prices (never trust browser prices)
    const verifiedOrderItems: any[] = [];

    for (const reqItem of items) {
      const quantity = Number(reqItem.quantity);

      if (reqItem.menu_item_id) {
        const dbItem = dbItemsMap.get(reqItem.menu_item_id.trim());

        // Reject items from another outlet
        if (dbItem.outlet_id !== outlet_id) {
          return NextResponse.json(
            { error: `Menu item "${dbItem.name}" does not belong to the selected outlet` },
            { status: 400 }
          );
        }

        // Reject unavailable items
        if (!dbItem.is_available) {
          return NextResponse.json(
            { error: `Menu item "${dbItem.name}" is currently unavailable` },
            { status: 400 }
          );
        }

        const unitPrice = Math.round(Number(dbItem.price) || 0);

        verifiedOrderItems.push({
          id: dbItem.id,
          name: dbItem.name,
          price: unitPrice,
          unitPrice: unitPrice,
          quantity: quantity,
          qty: quantity,
          ...(dbItem.image_url ? { image: dbItem.image_url } : {}),
        });
      } else if (reqItem.combo_id) {
        const dbCombo = dbCombosMap.get(reqItem.combo_id.trim());

        // Reject combos from another outlet
        if (dbCombo.outlet_id !== outlet_id) {
          return NextResponse.json(
            { error: `Combo "${dbCombo.name}" does not belong to the selected outlet` },
            { status: 400 }
          );
        }

        const includedItems = comboItemsMap.get(dbCombo.id) || [];
        if (includedItems.length < 2) {
          return NextResponse.json(
            { error: `This combo is no longer available.` },
            { status: 400 }
          );
        }

        // Re-check that every item inside the combo is available and belongs to outlet
        for (const itemInside of includedItems) {
          if (!itemInside.is_available || itemInside.outlet_id !== outlet_id) {
            return NextResponse.json(
              { error: 'This combo is no longer available.' },
              { status: 400 }
            );
          }
        }

        const comboUnitPrice = Math.round(Number(dbCombo.price) || 0);

        // Snapshot of included items at this exact moment
        const itemsSnapshot = includedItems.map((ci) => ({
          menu_item_id: ci.menu_item_id,
          name: ci.name,
          quantity: Number(ci.quantity) || 1,
          unit_price: Math.round(Number(ci.price) || 0),
        }));

        verifiedOrderItems.push({
          id: dbCombo.id,
          combo_id: dbCombo.id,
          is_combo: true,
          name: dbCombo.name,
          price: comboUnitPrice,
          unitPrice: comboUnitPrice,
          quantity: quantity,
          qty: quantity,
          ...(dbCombo.image_url ? { image: dbCombo.image_url } : {}),
          combo_items: itemsSnapshot,
        });
      }
    }

    const pricing = computeOrderTotal(verifiedOrderItems);
    const grandTotal = pricing.toPay;

    if (grandTotal <= 0) {
      return NextResponse.json(
        { error: 'Order total must be greater than zero' },
        { status: 400 }
      );
    }

    // Check for an existing pending_payment order in the last 15 minutes for the same phone & cart
    const targetSig = normalizeCartSignature(verifiedOrderItems);
    const recentRes = await query(
      `SELECT *
       FROM public.orders
       WHERE outlet_id = $1
         AND customer_phone = $2
         AND total = $3
         AND status = 'pending_payment'
         AND created_at >= now() - interval '15 minutes'
       ORDER BY created_at DESC
       LIMIT 3`,
      [outlet_id, cleanPhone, grandTotal]
    );

    for (const existingOrder of recentRes.rows) {
      if (normalizeCartSignature(existingOrder.items) !== targetSig) continue;

      const syncRes = await verifyAndSyncOrder(existingOrder);
      if (syncRes.paid) {
        console.log(
          JSON.stringify({
            event: 'order_create_dedup',
            action: 'already_paid',
            order_id: existingOrder.id,
          })
        );
        return NextResponse.json({
          already_paid: true,
          order_id: existingOrder.id,
          total: Number(existingOrder.total),
        });
      }

      if (syncRes.status === 'pending_payment') {
        console.log(
          JSON.stringify({
            event: 'order_create_dedup',
            action: 'reuse_pending',
            order_id: existingOrder.id,
          })
        );
        return NextResponse.json({
          order_id: existingOrder.id,
          total: Number(existingOrder.total),
          reused: true,
        });
      }
    }

    // Generate unique 4-digit pickup code per outlet per day on server
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    let pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    for (let attempt = 0; attempt < 10; attempt++) {
      const codeRes = await query(
        `SELECT id FROM public.orders 
         WHERE outlet_id = $1 AND pickup_code = $2 AND created_at >= $3 
         LIMIT 1`,
        [outlet_id, pickupCode, startOfToday.toISOString()]
      );
      if (codeRes.rows.length === 0) break;
      pickupCode = Math.floor(1000 + Math.random() * 9000).toString();
    }

    // Insert order with server-forced status and payment_status
    const insertRes = await query(
      `INSERT INTO public.orders (
        outlet_id,
        outlet_name,
        customer_name,
        customer_phone,
        items,
        total,
        status,
        payment_status,
        pickup_code,
        kitchen_note,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pending_payment', 'unpaid', $7, $8, now(), now())
      RETURNING id, total`,
      [
        outlet_id,
        outletName,
        'Customer',
        cleanPhone,
        JSON.stringify(verifiedOrderItems),
        grandTotal,
        pickupCode,
        cleanNote,
      ]
    );

    const createdOrder = insertRes.rows[0];

    // Return ONLY order_id and total
    return NextResponse.json({
      order_id: createdOrder.id,
      total: Number(createdOrder.total),
    });
  } catch (err: any) {
    console.error('Order creation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to create order on server' },
      { status: 500 }
    );
  }
}
