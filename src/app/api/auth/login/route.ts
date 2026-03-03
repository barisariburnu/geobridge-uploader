import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    const validUsername = process.env.AUTH_USERNAME;
    const validPassword = process.env.AUTH_PASSWORD;

    if (!validUsername || !validPassword) {
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
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, message: 'Giriş sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
