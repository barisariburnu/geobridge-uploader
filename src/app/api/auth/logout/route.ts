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
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, message: 'Çıkış sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
