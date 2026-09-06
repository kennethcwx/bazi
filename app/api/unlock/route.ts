/**
 * PIN verification.
 *
 * Rate limited per IP because a four-digit PIN is only 10,000 guesses — the
 * gate is worth very little without it. The counter is in-memory, so on
 * serverless it is per-instance and therefore best-effort: it raises the cost
 * of a brute-force attempt rather than making one impossible. Durable
 * rate limiting belongs in Turso or Upstash when this needs to be real.
 */

import { NextResponse } from 'next/server';
import { COOKIE_NAME, SESSION_TTL_MS, createToken, timingSafeEqual } from '../../../src/auth/session';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }
  entry.count++;
  return { allowed: entry.count <= MAX_ATTEMPTS, remaining: Math.max(0, MAX_ATTEMPTS - entry.count) };
}

export async function POST(req: Request) {
  const secret = process.env['AUTH_SECRET'];
  const expected = process.env['APP_PIN'];
  if (!secret || !expected) {
    return NextResponse.json({ error: '站点尚未完成设定。' }, { status: 503 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown';

  const { allowed, remaining } = rateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: '尝试次数过多，请稍后再试。' },
      { status: 429 },
    );
  }

  let pin = '';
  try {
    pin = String(((await req.json()) as { pin?: unknown }).pin ?? '');
  } catch {
    return NextResponse.json({ error: '请求格式不正确。' }, { status: 400 });
  }

  if (!timingSafeEqual(pin, expected)) {
    return NextResponse.json(
      { error: `通行码不对。剩余 ${remaining} 次尝试。` },
      { status: 401 },
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await createToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
  return res;
}
