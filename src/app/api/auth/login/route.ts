import { reportError } from '@/lib/monitoring.cjs'
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: 'Geçersiz istek' }, { status: 400 });
    }
    const { username, password } = body;

    const validUsername = process.env.AUTH_USERNAME;
    const validPassword = process.env.AUTH_PASSWORD;

    if (!validUsername || !validPassword) {
      reportError('AUTH_CONFIGURATION_FAILURE')
      return NextResponse.json(
        { success: false, message: 'Sunucu yapılandırma hatası' },
        { status: 500 }
      );
    }

    if (username === validUsername && password === validPassword) {
      const session = await getSession();
      session.isLoggedIn = true;
      session.username = username;
      await session.save();

      return NextResponse.json({
        success: true,
        message: 'Giriş başarılı',
        user: { username },
      });
    }

    return NextResponse.json(
      { success: false, message: 'Geçersiz kullanıcı adı veya şifre' },
      { status: 401 }
    );
  } catch (error) {
    reportError('OP_APP_API_AUTH_LOGIN_ROUTE_TS_1', error);
    return NextResponse.json(
      { success: false, message: 'Giriş sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
