import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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
    const allowedItemKeys = ['menu_item_id', 'quantity'];
    const menuItemIds: string[] = [];

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

      if (!it.menu_item_id || typeof it.menu_item_id !== 'string') {
        return NextResponse.json(
          { error: `Item at index ${i} has invalid menu_item_id` },
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

      menuItemIds.push(it.menu_item_id.trim());
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

    // Load menu items strictly from database
    const uniqueIds = Array.from(new Set(menuItemIds));
    const menuRes = await query(
      `SELECT id, name, price, outlet_id, is_available, image_url 
       FROM public.menu_items 
       WHERE id = ANY($1)`,
      [uniqueIds]
    );

    const dbItemsMap = new Map<string, any>();
    menuRes.rows.forEach((r) => dbItemsMap.set(r.id, r));

    if (dbItemsMap.size !== uniqueIds.length) {
      return NextResponse.json(
        { error: 'One or more menu items could not be found' },
        { status: 400 }
      );
    }

    // Recompute total on server and build verified order items
    let recomputedTotal = 0;
    const verifiedOrderItems: any[] = [];

    for (const reqItem of items) {
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

      const unitPrice = Number(dbItem.price) || 0;
      const quantity = Number(reqItem.quantity);
      recomputedTotal += unitPrice * quantity;

      verifiedOrderItems.push({
        id: dbItem.id,
        name: dbItem.name,
        price: unitPrice,
        unitPrice: unitPrice,
        quantity: quantity,
        qty: quantity,
        ...(dbItem.image_url ? { image: dbItem.image_url } : {}),
      });
    }

    if (recomputedTotal <= 0) {
      return NextResponse.json(
        { error: 'Order total must be greater than zero' },
        { status: 400 }
      );
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
      ) VALUES ($1, $2, $3, $4, $5, 'pending_payment', 'unpaid', $6, $7, now(), now())
      RETURNING id, total`,
      [
        outlet_id,
        'Customer',
        cleanPhone,
        JSON.stringify(verifiedOrderItems),
        recomputedTotal,
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
