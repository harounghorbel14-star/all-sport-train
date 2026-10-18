import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { db } from "@/lib/server/db";
import { resetEnvCache } from "@/lib/server/env";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { devMailbox } from "@/lib/auth/mailer";
import { googleDeps, OAUTH_COOKIE } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/redirect";
import { GUEST_CLAIM_COOKIE, purgeExpiredGuests } from "@/lib/auth/accounts";
import { seed } from "../prisma/seed";
import { call, newUser } from "./helpers";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as logout from "@/app/api/auth/logout/route";
import * as me from "@/app/api/auth/me/route";
import * as guest from "@/app/api/auth/guest/route";
import * as forgot from "@/app/api/auth/password/forgot/route";
import * as reset from "@/app/api/auth/password/reset/route";
import * as googleStart from "@/app/api/auth/google/route";
import * as googleCallback from "@/app/api/auth/google/callback/route";
import * as importGuest from "@/app/api/auth/import-guest/route";
import * as profile from "@/app/api/profile/route";
import * as activity from "@/app/api/activity/route";
import * as checkin from "@/app/api/recovery/checkin/route";
import * as feed from "@/app/api/community/feed/route";
import * as exercises from "@/app/api/exercises/route";
import * as health from "@/app/api/health/route";
import { configProblems } from "@/lib/server/env";

const D = "2026-10-01";
const cookieOf = (res: Response, name: string) =>
  res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${name}=`))
    ?.split(";")[0];
const sessionCookie = (res: Response) => cookieOf(res, "apex_session")!;

beforeAll(async () => {
  await seed(db);
});
afterEach(() => resetRateLimits());

describe("safe redirects", () => {
  it("accepts same-site paths and rejects open redirects", () => {
    expect(safeNext("/sports/boxing?tab=rules")).toBe("/sports/boxing?tab=rules");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "/api/auth/logout", "/login", ""]) expect(safeNext(bad)).toBe("/today");
  });
});

describe("registration & login", () => {
  it("requires accepted terms and reports field errors", async () => {
    const r = await call(register.POST, { body: { email: "terms@example.com", password: "password123", displayName: "T" } });
    expect(r.status).toBe(400);
    expect(r.json.error.details.acceptTerms).toBeTruthy();
  });

  it("returns the post-login destination, honouring a safe next path", async () => {
    const u = await newUser();
    const r = await call(login.POST, { body: { email: u.email, password: "password123", next: "/sports/tennis" } });
    expect(r.json.redirectTo).toBe("/sports/tennis");
    const evil = await call(login.POST, { body: { email: u.email, password: "password123", next: "https://evil.com" } });
    expect(evil.json.redirectTo).toBe("/today");
  });

  it("rate-limits repeated failures and rejects cross-site posts", async () => {
    const u = await newUser();
    let last = 0;
    for (let i = 0; i < 11; i++) last = (await call(login.POST, { body: { email: u.email, password: "wrong-password-1" } })).status;
    expect(last).toBe(429);
    resetRateLimits();
    const csrf = await call(login.POST, { body: { email: u.email, password: "password123" }, headers: { origin: "https://evil.example", host: "localhost" } });
    expect(csrf.status).toBe(403);
    expect(await db.authEvent.count({ where: { userId: u.userId, type: "login_failed" } })).toBeGreaterThanOrEqual(10);
  });

  it("signs out every device on request", async () => {
    const u = await newUser();
    const other = sessionCookie((await call(login.POST, { body: { email: u.email, password: "password123" } })).res);
    await call(logout.POST, { cookie: u.cookie, body: { all: true } });
    expect((await call(me.GET, { cookie: u.cookie })).status).toBe(401);
    expect((await call(me.GET, { cookie: other })).status).toBe(401);
  });

  it("protects private endpoints from anonymous requests", async () => {
    expect((await call(profile.GET, {})).status).toBe(401);
    expect((await call(activity.GET, {})).status).toBe(401);
  });
});

describe("password reset", () => {
  it("answers identically for unknown emails and resets with a single-use token", async () => {
    const unknown = await call(forgot.POST, { body: { email: "nobody-here@example.com" } });
    const u = await newUser();
    const known = await call(forgot.POST, { body: { email: u.email } });
    expect(unknown.status).toBe(200);
    expect(known.json).toEqual(unknown.json);

    const mail = devMailbox().filter((m) => m.to === u.email).at(-1)!;
    const token = decodeURIComponent(mail.text.match(/token=([^\s]+)/)![1]);
    const stored = await db.passwordResetToken.findFirst({ where: { userId: u.userId } });
    expect(stored!.tokenHash).not.toContain(token); // only a hash is stored

    expect((await call(reset.POST, { body: { token, password: "short" } })).status).toBe(400);
    expect((await call(reset.POST, { body: { token, password: "newpassword456" } })).status).toBe(200);
    expect((await call(reset.POST, { body: { token, password: "another-pass789" } })).status).toBe(400); // single use
    expect((await call(me.GET, { cookie: u.cookie })).status).toBe(401); // sessions invalidated
    expect((await call(login.POST, { body: { email: u.email, password: "password123" } })).status).toBe(401);
    expect((await call(login.POST, { body: { email: u.email, password: "newpassword456" } })).status).toBe(200);
  });

  it("rejects expired tokens", async () => {
    const u = await newUser();
    await call(forgot.POST, { body: { email: u.email } });
    const token = decodeURIComponent(devMailbox().filter((m) => m.to === u.email).at(-1)!.text.match(/token=([^\s]+)/)![1]);
    await db.passwordResetToken.updateMany({ where: { userId: u.userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await call(reset.POST, { body: { token, password: "newpassword456" } });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("invalid_token");
  });
});

// ── Google OIDC — MOCKED token endpoint and signing keys (not a live Google test) ──
describe("Google sign-in (mocked OAuth responses)", () => {
  let privateKey: CryptoKey;
  let jwk: JWK;
  const CLIENT_ID = "test-client.apps.googleusercontent.com";

  beforeAll(async () => {
    const kp = await generateKeyPair("RS256");
    privateKey = kp.privateKey;
    jwk = { ...(await exportJWK(kp.publicKey)), kid: "test", alg: "RS256", use: "sig" };
    googleDeps.jwks = createLocalJWKSet({ keys: [jwk] });
  });
  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    resetEnvCache();
  });
  const configure = () => {
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.APP_BASE_URL = "http://localhost";
    resetEnvCache();
  };
  const idToken = (claims: Record<string, unknown>, aud = CLIENT_ID) =>
    new SignJWT(claims).setProtectedHeader({ alg: "RS256", kid: "test" }).setIssuer("https://accounts.google.com").setAudience(aud).setIssuedAt().setExpirationTime("5m").sign(privateKey);

  /** Runs the start step and returns the state + cookie the callback needs. */
  async function start(opts: { cookie?: string; intent?: string } = {}) {
    const r = await call(googleStart.GET, { path: `/api/auth/google?next=%2Fsports${opts.intent ? `&intent=${opts.intent}` : ""}`, cookie: opts.cookie });
    expect(r.status).toBe(303);
    const loc = new URL(r.res.headers.get("location")!);
    return { loc, state: loc.searchParams.get("state")!, oauthCookie: cookieOf(r.res, OAUTH_COOKIE)! };
  }
  async function finish(s: Awaited<ReturnType<typeof start>>, token: () => Promise<Response>, extraCookie?: string) {
    googleDeps.fetch = (async () => token()) as typeof fetch;
    return call(googleCallback.GET, { path: `/api/auth/google/callback?code=abc&state=${s.state}`, cookie: [s.oauthCookie, extraCookie].filter(Boolean).join("; ") });
  }
  const tokenResponse = (claims: Record<string, unknown>, aud?: string) => async () => new Response(JSON.stringify({ id_token: await idToken(claims, aud) }), { status: 200 });
  const nonceOf = (s: { loc: URL }) => s.loc.searchParams.get("nonce")!;

  it("explains when Google is not configured", async () => {
    const r = await call(googleStart.GET, { path: "/api/auth/google" });
    expect(r.res.headers.get("location")).toContain("/login?error=google_not_configured");
  });

  it("starts an authorization-code flow with PKCE, state and nonce", async () => {
    configure();
    const { loc, oauthCookie } = await start();
    expect(loc.origin + loc.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(loc.searchParams.get("code_challenge_method")).toBe("S256");
    expect(loc.searchParams.get("response_type")).toBe("code");
    expect(loc.searchParams.get("redirect_uri")).toBe("http://localhost/api/auth/google/callback");
    expect(loc.searchParams.get("client_secret")).toBeNull();
    expect(oauthCookie).toBeTruthy();
  });

  it("creates a verified account, then signs the same Google subject back in", async () => {
    configure();
    const s = await start();
    const r = await finish(s, tokenResponse({ sub: "g-new-1", email: "new.google@example.com", email_verified: true, name: "Goo Gle", nonce: nonceOf(s) }));
    expect(r.status).toBe(303);
    expect(r.res.headers.get("location")).toContain("/onboarding");
    const user = await db.user.findUnique({ where: { email: "new.google@example.com" } });
    expect(user!.emailVerifiedAt).not.toBeNull();
    expect(user!.passwordHash).toBeNull();
    expect((await call(me.GET, { cookie: sessionCookie(r.res) })).status).toBe(200);

    const s2 = await start();
    const r2 = await finish(s2, tokenResponse({ sub: "g-new-1", email: "new.google@example.com", email_verified: true, nonce: nonceOf(s2) }));
    expect(await db.user.count({ where: { email: "new.google@example.com" } })).toBe(1);
    expect(r2.res.headers.get("location")).not.toContain("error");
  });

  it("rejects state mismatch, cancelled consent, wrong audience, bad nonce, unverified email and expired codes", async () => {
    configure();
    const s = await start();
    const mismatch = await call(googleCallback.GET, { path: `/api/auth/google/callback?code=abc&state=forged`, cookie: s.oauthCookie });
    expect(mismatch.res.headers.get("location")).toContain("error=google_state");
    const noCookie = await call(googleCallback.GET, { path: `/api/auth/google/callback?code=abc&state=${s.state}` });
    expect(noCookie.res.headers.get("location")).toContain("error=google_state");
    const denied = await call(googleCallback.GET, { path: `/api/auth/google/callback?error=access_denied&state=${s.state}`, cookie: s.oauthCookie });
    expect(denied.res.headers.get("location")).toContain("error=google_cancelled");

    const aud = await finish(s, tokenResponse({ sub: "g-x", email: "x@example.com", email_verified: true, nonce: nonceOf(s) }, "someone-else"));
    expect(aud.res.headers.get("location")).toContain("error=google_token");
    const nonce = await finish(s, tokenResponse({ sub: "g-x", email: "x@example.com", email_verified: true, nonce: "wrong" }));
    expect(nonce.res.headers.get("location")).toContain("error=google_token");
    const unverified = await finish(s, tokenResponse({ sub: "g-x", email: "x@example.com", email_verified: false, nonce: nonceOf(s) }));
    expect(unverified.res.headers.get("location")).toContain("error=google_unverified");
    const expired = await finish(s, async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    expect(expired.res.headers.get("location")).toContain("error=google_expired");
    expect(await db.user.count({ where: { email: "x@example.com" } })).toBe(0);
  });

  it("never links to an existing password account by email; linking is explicit", async () => {
    configure();
    const u = await newUser();
    const s = await start();
    const r = await finish(s, tokenResponse({ sub: "g-owner", email: u.email, email_verified: true, nonce: nonceOf(s) }));
    expect(r.res.headers.get("location")).toContain("error=google_account_exists");
    expect(cookieOf(r.res, "apex_session")).toBeUndefined();
    expect(await db.authAccount.count({ where: { providerAccountId: "g-owner" } })).toBe(0);

    // The signed-in owner links it explicitly…
    const sl = await start({ cookie: u.cookie, intent: "link" });
    const linked = await finish(sl, tokenResponse({ sub: "g-owner", email: u.email, email_verified: true, nonce: nonceOf(sl) }), u.cookie);
    expect(linked.res.headers.get("location")).toContain("/profile?linked=google");
    // …and can now sign in with Google.
    const s3 = await start();
    const r3 = await finish(s3, tokenResponse({ sub: "g-owner", email: u.email, email_verified: true, nonce: nonceOf(s3) }));
    const session = sessionCookie(r3.res);
    expect((await call(me.GET, { cookie: session })).json.user.id).toBe(u.userId);

    // The same Google identity can't be attached to a second account.
    const other = await newUser();
    const s4 = await start({ cookie: other.cookie, intent: "link" });
    const taken = await finish(s4, tokenResponse({ sub: "g-owner", email: u.email, email_verified: true, nonce: nonceOf(s4) }), other.cookie);
    expect(taken.res.headers.get("location")).toContain("error=google_in_use");
  });

  it("tells Google-only users to use Google when they try a password", async () => {
    configure();
    const s = await start();
    await finish(s, tokenResponse({ sub: "g-only", email: "only.google@example.com", email_verified: true, nonce: nonceOf(s) }));
    const r = await call(login.POST, { body: { email: "only.google@example.com", password: "password123" } });
    expect(r.status).toBe(401);
    expect(r.json.error.message).toMatch(/Continue with Google/);
  });
});

describe("guest mode", () => {
  async function newGuest() {
    const r = await call(guest.POST, { body: { timezone: "UTC" } });
    expect(r.status).toBe(200);
    return sessionCookie(r.res);
  }

  it("gives guests a useful, onboarded sandbox with private APIs scoped to themselves", async () => {
    const cookie = await newGuest();
    const m = await call(me.GET, { cookie });
    expect(m.json.profile.onboardingCompleted).toBe(true);
    expect((await call(exercises.GET, { cookie })).status).toBe(200);
    expect((await call(activity.POST, { cookie, body: { sport: "running", dateKey: D, durationMin: 20, intensity: "light" } })).status).toBe(200);
    expect((await call(activity.GET, { cookie })).json.entries ?? (await call(activity.GET, { cookie })).json).toBeTruthy();
  });

  it("blocks social, media and admin areas for guests", async () => {
    const cookie = await newGuest();
    const r = await call(feed.GET, { cookie, path: "/api/community/feed" });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("guest_restricted");
  });

  it("guest registration upgrades the same account and keeps progress", async () => {
    const cookie = await newGuest();
    const guestId = (await call(me.GET, { cookie })).json.user.id;
    await call(activity.POST, { cookie, body: { sport: "walking", dateKey: D, durationMin: 30, intensity: "light" } });
    const r = await call(register.POST, { cookie, body: { email: "converted@example.com", password: "password123", displayName: "Conv", acceptTerms: true } });
    expect(r.status).toBe(201);
    expect(r.json.upgradedGuest).toBe(true);
    const after = await db.user.findUnique({ where: { id: guestId } });
    expect(after!.isGuest).toBe(false);
    expect(after!.email).toBe("converted@example.com");
    expect(await db.activityEntry.count({ where: { userId: guestId } })).toBe(1);
    expect((await call(feed.GET, { cookie, path: "/api/community/feed" })).status).toBe(200);
  });

  it("signing in to an existing account offers an explicit, conflict-safe import", async () => {
    const account = await newUser();
    await call(checkin.POST, { cookie: account.cookie, body: { dateKey: D, energy: 4, soreness: 2 } });
    const g = await newGuest();
    const guestId = (await call(me.GET, { cookie: g })).json.user.id;
    await call(activity.POST, { cookie: g, body: { sport: "running", dateKey: D, durationMin: 25, intensity: "moderate" } });
    await call(checkin.POST, { cookie: g, body: { dateKey: D, energy: 2, soreness: 4 } }); // same day as the account's

    const l = await call(login.POST, { cookie: g, body: { email: account.email, password: "password123" } });
    const claim = cookieOf(l.res, GUEST_CLAIM_COOKIE)!;
    expect(claim).toBeTruthy();
    const both = `${sessionCookie(l.res)}; ${claim}`;
    // Nothing moved until the user decides.
    expect(await db.activityEntry.count({ where: { userId: account.userId } })).toBe(0);
    const pending = await call(importGuest.GET, { cookie: both });
    expect(pending.json.pending).toBe(true);
    expect(pending.json.summary.activities).toBe(1);

    // A forged claim is rejected.
    expect((await call(importGuest.GET, { cookie: `${sessionCookie(l.res)}; ${GUEST_CLAIM_COOKIE}=forged.sig` })).json.pending).toBe(false);

    const done = await call(importGuest.POST, { cookie: both, body: { action: "import" } });
    expect(done.status).toBe(200);
    expect(done.json.moved.activities).toBe(1);
    expect(done.json.skipped.checkIns).toBe(1);
    expect(await db.activityEntry.count({ where: { userId: account.userId } })).toBe(1);
    const ci = await db.checkIn.findFirst({ where: { userId: account.userId, dateKey: D } });
    expect(ci!.energy).toBe(4); // the account's own check-in was not overwritten
    expect(await db.user.findUnique({ where: { id: guestId } })).toBeNull();
  });

  it("purges guests inactive for 30 days", async () => {
    const cookie = await newGuest();
    const id = (await call(me.GET, { cookie })).json.user.id;
    const old = new Date(Date.now() - 40 * 86_400_000);
    await db.user.update({ where: { id }, data: { createdAt: old } });
    await db.session.updateMany({ where: { userId: id }, data: { lastSeenAt: old } });
    expect(await purgeExpiredGuests()).toBeGreaterThanOrEqual(1);
    expect(await db.user.findUnique({ where: { id } })).toBeNull();
  });
});

describe("deployment health", () => {
  it("reports ok when configured, migrated and seeded, and names missing variables otherwise", async () => {
    const r = await health.GET();
    expect(r.status).toBe(200);
    const saved = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "";
    try {
      expect(configProblems().join(" ")).toMatch(/SESSION_SECRET/);
      const bad = await health.GET();
      expect(bad.status).toBe(503);
      const body = await bad.json();
      expect(JSON.stringify(body)).not.toContain(saved!); // names only, never values
    } finally {
      process.env.SESSION_SECRET = saved;
    }
  });
});

describe("admin access (P0)", () => {
  it("never grants admin at registration; only after the email is verified via a reset link", async () => {
    // tests/setup.ts sets ADMIN_EMAILS=admin@example.com
    const reg = await call(register.POST, { body: { email: "admin@example.com", password: "password123", displayName: "Imposter", acceptTerms: true } });
    expect(reg.status).toBe(201);
    const cookie = sessionCookie(reg.res);
    const u = await db.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });
    expect(u.role).toBe("user");
    const { GET: adminList } = await import("@/app/api/admin/sports/route");
    expect((await call(adminList, { cookie })).status).toBe(403);

    // A role flag alone (e.g. set by an older version) is not enough without a verified email.
    await db.user.update({ where: { id: u.id }, data: { role: "admin" } });
    expect((await call(adminList, { cookie })).status).toBe(403);
    await db.user.update({ where: { id: u.id }, data: { role: "user" } });

    // Proving inbox control with a reset link promotes the account.
    await call(forgot.POST, { body: { email: "admin@example.com" } });
    const token = decodeURIComponent(devMailbox().filter((m) => m.to === "admin@example.com").at(-1)!.text.match(/token=([^\s]+)/)![1]);
    expect((await call(reset.POST, { body: { token, password: "newpassword456" } })).status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.role).toBe("admin");
    const fresh = sessionCookie((await call(login.POST, { body: { email: "admin@example.com", password: "newpassword456" } })).res);
    expect((await call(adminList, { cookie: fresh })).status).toBe(200);
  });

  it("requires APP_BASE_URL in production instead of trusting the Host header", async () => {
    const { appBaseUrl, configProblems } = await import("@/lib/server/env");
    const env = process.env as Record<string, string | undefined>;
    const prev = { node: env.NODE_ENV, base: env.APP_BASE_URL };
    env.NODE_ENV = "production";
    delete env.APP_BASE_URL;
    resetEnvCache();
    try {
      expect(() => appBaseUrl(new Request("https://evil.example/x"))).toThrow(/APP_BASE_URL/);
      expect(configProblems().join(" ")).toMatch(/APP_BASE_URL/);
    } finally {
      env.NODE_ENV = prev.node;
      if (prev.base !== undefined) env.APP_BASE_URL = prev.base;
      resetEnvCache();
    }
  });
});
