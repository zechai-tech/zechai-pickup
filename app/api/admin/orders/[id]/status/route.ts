import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isValidStaffTransition, normalizeOrderStatus, CanonicalStatus } from '@/lib/order-flow';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const {
      status: rawNextStatus,
      cancel_reason,
      cancelled_by,
      caller_role,
      caller_outlet_id,
    } = body;

    if (!rawNextStatus) {
      return NextResponse.json({ error: 'Target status is required' }, { status: 400 });
    }

    // Determine caller role and outlet access
    let userRole = caller_role;
    let userOutletId = caller_outlet_id;
    let userEmail = cancelled_by;

    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const {
          data: { user },
        } = await supabaseAdmin.auth.getUser(token);
        if (user?.email) {
          userEmail = user.email;
          const userRes = await query('SELECT * FROM public.users WHERE email = $1', [
            user.email.toLowerCase(),
          ]);
          if (userRes.rows.length > 0) {
            userRole = userRes.rows[0].role;
            userOutletId = userRes.rows[0].outlet_id;
          }
        }
      } catch (authErr) {
        console.warn('Bearer token authentication notice:', authErr);
      }
    }

    const allowedRoles = ['admin', 'super_admin', 'manager', 'staff', 'ordering_staff'];
    if (userRole && !allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden: insufficient permissions' }, { status: 403 });
    }

    // Fetch order
    const orderRes = await query('SELECT * FROM public.orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // Check outlet access for manager and staff
    if (userRole && ['manager', 'staff', 'ordering_staff'].includes(userRole) && userOutletId) {
      if (order.outlet_id && order.outlet_id !== userOutletId) {
        return NextResponse.json(
          { error: 'Forbidden: you cannot manage orders for another outlet' },
          { status: 403 }
        );
      }
    }

    const currentCanonical = normalizeOrderStatus(order.status);
    const targetCanonical = normalizeOrderStatus(rawNextStatus);

    // Validate transition
    if (!isValidStaffTransition(currentCanonical, targetCanonical)) {
      return NextResponse.json(
        {
          error: 'Invalid order transition',
          message: `Cannot transition from "${order.status}" (${currentCanonical}) to "${rawNextStatus}" (${targetCanonical})`,
        },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const updateFields: string[] = ['status = $1', 'updated_at = now()'];
    const updateParams: unknown[] = [targetCanonical];
    let pIdx = 2;

    if (targetCanonical === 'preparing') {
      updateFields.push(`confirmed_at = COALESCE(confirmed_at, now())`);
      updateFields.push(`making_at = now()`);
    } else if (targetCanonical === 'packaging') {
      updateFields.push(`packaging_at = now()`);
    } else if (targetCanonical === 'ready') {
      updateFields.push(`ready_at = now()`);
    } else if (targetCanonical === 'received') {
      updateFields.push(`received_at = now()`);
    } else if (targetCanonical === 'cancelled') {
      updateFields.push(`cancelled_at = now()`);
      updateFields.push(`cancel_reason = $${pIdx++}`);
      updateParams.push(cancel_reason || 'Staff cancelled');
      updateFields.push(`cancelled_by = $${pIdx++}`);
      updateParams.push(userEmail || 'staff');

      // If already paid, mark refund as required
      if (order.payment_status === 'success') {
        updateFields.push(`refund_required = true`);
      }
    }

    updateParams.push(orderId);
    const sql = `
      UPDATE public.orders
      SET ${updateFields.join(', ')}
      WHERE id = $${pIdx}
      RETURNING *
    `;

    const result = await query(sql, updateParams);
    return NextResponse.json({ success: true, order: result.rows[0] });
  } catch (error: any) {
    console.error('Order status update error:', error);
    return NextResponse.json({ error: error?.message || 'Status update failed' }, { status: 500 });
  }
}
