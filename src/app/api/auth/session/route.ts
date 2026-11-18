import { reportError } from '@/lib/monitoring.cjs'
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
    reportError('OP_APP_API_AUTH_SESSION_ROUTE_TS_1', error);
    return NextResponse.json(
      { authenticated: false, user: null },
      { status: 500 }
    );
  }
}
