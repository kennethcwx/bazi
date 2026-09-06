/**
 * PIN session tokens.
 *
 * A four-digit PIN is a low bar by construction — 10,000 combinations — so the
 * job here is to make sure it is at least an honest one:
 *
 *  - The cookie is an HMAC over an expiry, not a flag. A value like `auth=1`
 *    is guessable by anyone who opens devtools; this one cannot be forged
 *    without the server secret.
 *  - PIN comparison is constant-time, so response timing leaks nothing.
 *  - The token carries its own expiry, checked on every request.
 *
 * Web Crypto only, so this runs unchanged in middleware on the Edge runtime.
 */

const encoder = new TextEncoder();

export const COOKIE_NAME = 'bazi_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function base64url(bytes: ArrayBuffer): string {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
}

/** `<expiresAtMs>.<signature>` */
export async function createToken(secret: string, ttlMs = SESSION_TTL_MS): Promise<string> {
  const expires = String(Date.now() + ttlMs);
  return `${expires}.${await hmac(secret, expires)}`;
}

export async function verifyToken(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token) return false;

  const dot = token.indexOf('.');
  if (dot <= 0) return false;

  const expires = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expiresAt = Number(expires);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  return timingSafeEqual(signature, await hmac(secret, expires));
}

/**
 * Constant-time string comparison.
 *
 * `===` on a secret short-circuits at the first differing character, which
 * leaks its prefix through response timing. Irrelevant for most strings;
 * it matters for a four-digit PIN, where the search space is small enough that
 * a timing oracle genuinely helps an attacker.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
