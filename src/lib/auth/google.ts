import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { appBaseUrl, env, googleConfigured } from "../server/env";
import { randomToken, signPayload, verifyPayload } from "./tokens";

/**
 * Google Sign-In via OAuth 2.0 Authorization Code flow + OpenID Connect,
 * with PKCE (S256), state and nonce. ID tokens are verified with Google's
 * published JWKS (signature, issuer, audience, expiry, nonce).
 */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
export const OAUTH_COOKIE = "apex_oauth";
const OAUTH_TTL_MS = 10 * 60_000;

/** Overridable in tests (mocked token endpoint and keys). */
export const googleDeps: { fetch: typeof fetch; jwks: JWTVerifyGetKey | null } = { fetch: (...a) => fetch(...a), jwks: null };
const jwks = () => (googleDeps.jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)));

export const callbackUrl = (req?: Request) => env().GOOGLE_CALLBACK_URL.trim() || `${appBaseUrl(req)}/api/auth/google/callback`;

export type OAuthIntent = "login" | "link";
interface OAuthState extends Record<string, unknown> {
  state: string;
  verifier: string;
  nonce: string;
  next: string;
  intent: OAuthIntent;
}

const challenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function beginGoogleAuth(req: Request, next: string, intent: OAuthIntent) {
  if (!googleConfigured()) throw new Error("Google sign-in is not configured");
  const st: OAuthState = { state: randomToken(24), verifier: randomToken(48), nonce: randomToken(24), next, intent };
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID,
    redirect_uri: callbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    state: st.state,
    nonce: st.nonce,
    code_challenge: challenge(st.verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), cookie: signPayload("oauth", st, OAUTH_TTL_MS), maxAge: OAUTH_TTL_MS / 1000 };
}

export const readOAuthState = (cookie: string | undefined) => verifyPayload<OAuthState>("oauth", cookie);

export interface GoogleIdentity {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export class GoogleAuthError extends Error {
  constructor(public code: "google_state" | "google_expired" | "google_failed" | "google_token" | "google_cancelled") {
    super(code);
  }
}

/** Exchanges the authorization code (server-to-server, with client secret + PKCE verifier) and verifies the ID token. */
export async function completeGoogleAuth(req: Request, code: string, st: OAuthState): Promise<GoogleIdentity> {
  let res: Response;
  try {
    res = await googleDeps.fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env().GOOGLE_CLIENT_ID,
        client_secret: env().GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl(req),
        grant_type: "authorization_code",
        code_verifier: st.verifier,
      }).toString(),
    });
  } catch {
    throw new GoogleAuthError("google_failed");
  }
  const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !data.id_token) throw new GoogleAuthError(data.error === "invalid_grant" ? "google_expired" : "google_failed");
  try {
    const { payload } = await jwtVerify(data.id_token, jwks(), { issuer: GOOGLE_ISSUERS, audience: env().GOOGLE_CLIENT_ID, algorithms: ["RS256"], clockTolerance: 30 });
    if (payload.nonce !== st.nonce || typeof payload.sub !== "string" || !payload.sub) throw new Error("nonce/sub");
    return {
      sub: payload.sub,
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" ? payload.name.slice(0, 40) : null,
    };
  } catch {
    throw new GoogleAuthError("google_token");
  }
}
