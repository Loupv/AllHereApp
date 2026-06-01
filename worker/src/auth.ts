/**
 * Auth — verify provider ID tokens (Apple / Google) and mint our own
 * session JWT. We NEVER trust the client: the idToken is verified
 * server-side against the provider's JWKS (signature + issuer + audience).
 *
 * `SESSION_SECRET` must be set (`wrangler secret put SESSION_SECRET`)
 * before these endpoints work in production.
 */
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';

// Remote JWKS are cached across requests by jose (config, not request state).
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export type Provider = 'google' | 'apple';
export type VerifiedIdentity = { sub: string; email: string | null };

const emailOf = (payload: Record<string, unknown>): string | null =>
  typeof payload.email === 'string' ? payload.email : null;

export const verifyGoogle = async (idToken: string, env: Env): Promise<VerifiedIdentity> => {
  const audience = [env.GOOGLE_IOS_CLIENT_ID, env.GOOGLE_ANDROID_CLIENT_ID, env.GOOGLE_WEB_CLIENT_ID].filter(Boolean);
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  });
  return { sub: String(payload.sub), email: emailOf(payload) };
};

export const verifyApple = async (idToken: string, env: Env): Promise<VerifiedIdentity> => {
  const { payload } = await jwtVerify(idToken, APPLE_JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: env.APPLE_BUNDLE_ID,
  });
  return { sub: String(payload.sub), email: emailOf(payload) };
};

const sessionKey = (env: Env): Uint8Array => new TextEncoder().encode(env.SESSION_SECRET);

/** Mint a 60-day session JWT (HS256) for our own user id. */
export const issueSession = (userId: string, env: Env): Promise<string> =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('60d')
    .sign(sessionKey(env));

/** Verify a session JWT → user id, or null if invalid/expired. */
export const verifySession = async (token: string, env: Env): Promise<string | null> => {
  try {
    const { payload } = await jwtVerify(token, sessionKey(env));
    return payload.sub ? String(payload.sub) : null;
  } catch {
    return null;
  }
};
