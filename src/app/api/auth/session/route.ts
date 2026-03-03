import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
  try {
    const session = await getSession();

    if (session.isLoggedIn) {
      return NextResponse.json({
        authenticated: true,
        user: { username: session.username },
      });
    }

    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 }
    );
  }
}
