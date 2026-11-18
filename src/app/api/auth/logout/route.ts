import { reportError } from '@/lib/monitoring.cjs'
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST() {
  try {
    const session = await getSession();
    session.destroy();

    return NextResponse.json({
      success: true,
      message: 'Çıkış başarılı',
    });
  } catch (error) {
    reportError('OP_APP_API_AUTH_LOGOUT_ROUTE_TS_1', error);
    return NextResponse.json(
      { success: false, message: 'Çıkış sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
