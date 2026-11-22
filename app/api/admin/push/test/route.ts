import { NextRequest, NextResponse } from 'next/server';
import { validatePortalStaffOrAbove } from '@/lib/portal-auth';
import { sendTestPush } from '@/lib/push';

export async function POST(req: NextRequest) {
  try {
    const authRes = await validatePortalStaffOrAbove(req);
    if (!authRes.ok) {
      return authRes.response;
    }

    const userId = authRes.ctx.userId;
    const result = await sendTestPush(userId);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    console.error('Error sending test push:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
