import { NextRequest, NextResponse } from 'next/server';
import { updateAuthPassword } from '@/lib/supabase-admin';

// POST /api/admin/users/reset-password - resets a user's password in Auth and public.users
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, password } = body;

    if (!id || !password || !password.trim()) {
      return NextResponse.json(
        { error: 'User ID and new password are required' },
        { status: 400 }
      );
    }

    const res = await updateAuthPassword(id, password.trim());
    if (!res.success) {
      return NextResponse.json(
        { error: res.error || 'Failed to update password' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
