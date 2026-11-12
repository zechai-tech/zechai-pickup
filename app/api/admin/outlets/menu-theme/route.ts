import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { query } from '@/lib/db';
import { validatePortalManagerOrAdmin } from '@/lib/portal-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateMenuThemeViews() {
  try {
    revalidatePath('/menu');
    revalidatePath('/api/menu');
    revalidatePath('/admin/menu');
    revalidatePath('/api/admin/outlets');
  } catch (err) {
    console.warn('revalidatePath notice:', err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const menuTheme = body?.menu_theme;
    const applyToAll = Boolean(body?.apply_to_all);
    const outletId = typeof body?.outlet_id === 'string' ? body.outlet_id.trim() : '';

    if (menuTheme !== 'classic' && menuTheme !== 'grid') {
      return NextResponse.json(
        { error: "menu_theme must be 'classic' or 'grid'" },
        { status: 400 }
      );
    }

    if (!applyToAll && !UUID_REGEX.test(outletId)) {
      return NextResponse.json(
        { error: 'Valid outlet_id is required unless apply_to_all is true' },
        { status: 400 }
      );
    }

    const authResult = await validatePortalManagerOrAdmin(
      req,
      applyToAll ? undefined : outletId
    );
    if (!authResult.ok) {
      return authResult.response;
    }

    const { ctx } = authResult;

    if (applyToAll) {
      if (!ctx.isAdmin) {
        return NextResponse.json(
          { error: 'Forbidden: only admins can apply menu theme to all outlets' },
          { status: 403 }
        );
      }

      const updRes = await query(
        `UPDATE public.outlets
         SET menu_theme = $1
         RETURNING id, menu_theme`,
        [menuTheme]
      );

      revalidateMenuThemeViews();
      return NextResponse.json({
        success: true,
        menu_theme: menuTheme,
        apply_to_all: true,
        updated_count: updRes.rows.length,
      });
    }

    const updRes = await query(
      `UPDATE public.outlets
       SET menu_theme = $1
       WHERE id = $2::uuid
       RETURNING id, menu_theme`,
      [menuTheme, outletId]
    );

    if (updRes.rows.length === 0) {
      return NextResponse.json({ error: 'Outlet not found' }, { status: 404 });
    }

    revalidateMenuThemeViews();
    return NextResponse.json({
      success: true,
      outlet_id: updRes.rows[0].id,
      menu_theme: updRes.rows[0].menu_theme,
    });
  } catch (error: any) {
    console.error('Update menu theme error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update menu theme' },
      { status: 500 }
    );
  }
}
