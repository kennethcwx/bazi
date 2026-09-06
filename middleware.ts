/**
 * PIN gate.
 *
 * Everything except the unlock screen, its endpoint and static assets requires
 * a valid session cookie. Running this as middleware rather than a per-page
 * check means the API routes are covered too — gating only the UI would leave
 * /api/chart and /api/read open to anyone who reads the page source.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAME, verifyToken } from './src/auth/session';

export const config = {
  // Everything but Next's own assets and the favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

const PUBLIC_PATHS = new Set(['/unlock', '/api/unlock']);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const secret = process.env['AUTH_SECRET'];
  const pin = process.env['APP_PIN'];

  // Fail closed. A misconfigured deployment must not silently serve the app
  // to everyone — that is exactly the failure a gate exists to prevent.
  if (!secret || !pin) {
    return new NextResponse('站点尚未完成设定（缺少 APP_PIN / AUTH_SECRET）。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  if (await verifyToken(req.cookies.get(COOKIE_NAME)?.value, secret)) {
    return NextResponse.next();
  }

  // API callers get a status they can act on; browsers get the PIN screen.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '需要先输入通行码。' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/unlock';
  url.search = '';
  return NextResponse.redirect(url);
}
