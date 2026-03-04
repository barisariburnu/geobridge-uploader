import { getIronSession, SessionOptions, IronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isLoggedIn: boolean;
  username?: string;
}

export const defaultSession: SessionData = {
  isLoggedIn: false,
  username: undefined,
};

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'geoserver_upload_session',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.SECURE_COOKIES !== 'false',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    session.isLoggedIn = defaultSession.isLoggedIn;
    session.username = defaultSession.username;
  }

  return session;
}
