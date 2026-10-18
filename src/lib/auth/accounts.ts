import { Prisma } from "@prisma/client";
import { db } from "../server/db";
import { appBaseUrl } from "../server/env";
import { AppError, badRequest, conflict, forbidden, notFound } from "../server/errors";
import { LIMITS, rateLimit } from "../server/rate-limit";
import { clientIp } from "../server/request";
import { completeOnboarding, uniqueHandle } from "../services/profile";
import { evaluateAchievements } from "../services/gamification";
import { recordAuthEvent } from "./audit";
import { sendMail } from "./mailer";
import { hashPassword, verifyPassword } from "./password";
import { promoteIfVerifiedAdmin } from "./roles";
import type { AuthUser } from "./session";
import type { GoogleIdentity, OAuthIntent } from "./google";
import { hmac, randomToken, signPayload, verifyPayload } from "./tokens";

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
const GUEST_DOMAIN = "guest.invalid"; // RFC 2606 reserved — never deliverable
export const GUEST_TTL_DAYS = 30;
export const RESET_TTL_MS = 30 * 60_000;
export const GUEST_CLAIM_COOKIE = "apex_guest_claim";

async function createUser(data: { email: string; passwordHash: string | null; displayName: string; timezone?: string; emailVerifiedAt?: Date | null; isGuest?: boolean; termsAcceptedAt?: Date | null }) {
  const handle = await uniqueHandle(data.displayName || data.email.split("@")[0]);
  try {
    return await db.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        emailVerifiedAt: data.emailVerifiedAt ?? null,
        isGuest: data.isGuest ?? false,
        termsAcceptedAt: data.termsAcceptedAt ?? null,
        role: "user", // admin is granted only after email verification (see roles.ts)
        profile: { create: { displayName: data.displayName, handle, timezone: data.timezone ?? "UTC" } },
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("An account with this email already exists");
    throw e;
  }
}

// ── Email + password ───────────────────────────────────────────────────
export async function registerWithPassword(req: Request, input: { email: string; password: string; displayName: string; timezone?: string }, current: AuthUser | null) {
  rateLimit(`register:${clientIp(req)}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  if (await db.user.findUnique({ where: { email: input.email } })) throw conflict("An account with this email already exists. Log in instead, or reset your password.");
  const passwordHash = await hashPassword(input.password);
  // A guest creating an account keeps everything: the guest user is upgraded in place.
  if (current?.isGuest) {
    try {
      const user = await db.user.update({
        where: { id: current.id },
        data: { email: input.email, passwordHash, isGuest: false, termsAcceptedAt: new Date(), profile: { update: { displayName: input.displayName } } },
      });
      await recordAuthEvent("guest_converted", { userId: user.id, req, meta: { method: "password" } });
      return { user, upgradedGuest: true };
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict("An account with this email already exists");
      throw e;
    }
  }
  const user = await createUser({ email: input.email, passwordHash, displayName: input.displayName, timezone: input.timezone, termsAcceptedAt: new Date() });
  await recordAuthEvent("register", { userId: user.id, req, meta: { method: "password" } });
  return { user, upgradedGuest: false };
}

export async function loginWithPassword(req: Request, email: string, password: string) {
  rateLimit(`login:${clientIp(req)}:${email}`, LIMITS.auth.limit, LIMITS.auth.windowMs);
  rateLimit(`login-email:${email}`, LIMITS.auth.limit * 3, 60 * 60_000); // across IPs
  const user = await db.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user && !user.isGuest ? user.passwordHash : null);
  if (!user || !ok) {
    await recordAuthEvent("login_failed", { userId: user?.id ?? null, req });
    // Same message for unknown email, wrong password and Google-only accounts.
    throw new AppError(401, "invalid_credentials", user && !user.passwordHash && !user.isGuest ? "Email or password is incorrect. If you signed up with Google, use “Continue with Google”." : "Email or password is incorrect");
  }
  await recordAuthEvent("login_success", { userId: user.id, req, meta: { method: "password" } });
  return user;
}

// ── Guests ─────────────────────────────────────────────────────────────
/** Guest = a real, isolated user row flagged isGuest, with sensible beginner defaults so the app is useful immediately. */
export async function createGuest(req: Request, timezone?: string) {
  rateLimit(`guest:${clientIp(req)}`, 10, 60 * 60_000);
  await purgeExpiredGuests();
  const user = await createUser({ email: `guest-${randomToken(12).toLowerCase()}@${GUEST_DOMAIN}`, passwordHash: null, displayName: "Guest", timezone, isGuest: true });
  await completeOnboarding(user.id, {
    experience: "beginner",
    startFromZero: true,
    goals: ["calisthenics", "general_fitness"],
    emphasis: "balanced_calisthenics",
    sports: ["calisthenics"],
    location: "home",
    equipment: [],
    daysPerWeek: 3,
    trainingDays: [1, 3, 5],
    sessionMinutes: 30,
    activityLevel: "light",
    limitations: [],
    exercisePrefs: [],
    dietPrefs: [],
    allergies: [],
    timezone,
  });
  await recordAuthEvent("guest_created", { userId: user.id, req });
  return user;
}

/** Guests inactive for GUEST_TTL_DAYS are deleted with all their data (cascade). */
export async function purgeExpiredGuests(now = new Date()) {
  const cutoff = new Date(now.getTime() - GUEST_TTL_DAYS * 86_400_000);
  const stale = await db.user.findMany({ where: { isGuest: true, createdAt: { lt: cutoff }, sessions: { none: { lastSeenAt: { gte: cutoff } } } }, select: { id: true }, take: 200 });
  if (stale.length) await db.user.deleteMany({ where: { id: { in: stale.map((s) => s.id) }, isGuest: true } });
  return stale.length;
}

/** Signed proof that this browser owned a guest account, so its data can be imported after signing in. */
export const guestClaimCookie = (guestId: string) => signPayload("guest-claim", { guestId }, 24 * 3_600_000);
export const readGuestClaim = (value: string | undefined | null) => verifyPayload<{ guestId: string }>("guest-claim", value)?.guestId ?? null;

export async function guestSummary(guestId: string) {
  const guest = await db.user.findFirst({ where: { id: guestId, isGuest: true } });
  if (!guest) return null;
  const [workouts, activities, checkIns, skills, foods, favorites, sports] = await Promise.all([
    db.workoutSession.count({ where: { userId: guestId, status: "completed" } }),
    db.activityEntry.count({ where: { userId: guestId } }),
    db.checkIn.count({ where: { userId: guestId } }),
    db.skillProgress.count({ where: { userId: guestId } }),
    db.foodEntry.count({ where: { userId: guestId } }),
    db.favoriteExercise.count({ where: { userId: guestId } }),
    db.userSport.count({ where: { userId: guestId } }),
  ]);
  return { workouts, activities, checkIns, skills, foods, favorites, sports, total: workouts + activities + checkIns + skills + foods + favorites + sports };
}

/**
 * Explicit, user-confirmed import of a guest's training data into a signed-in account.
 * Ownership is proven by the signed claim cookie; records that would conflict with the
 * account (same day check-in, same favourite, …) are skipped, never overwritten.
 */
export async function importGuestData(req: Request, accountId: string, guestId: string) {
  if (accountId === guestId) throw badRequest("Nothing to import");
  const [account, guest] = await Promise.all([db.user.findUnique({ where: { id: accountId } }), db.user.findUnique({ where: { id: guestId } })]);
  if (!account || account.isGuest) throw forbidden("Sign in to a full account first");
  if (!guest || !guest.isGuest) throw notFound("Guest data not found or already imported");
  const moved: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  await db.$transaction(async (tx) => {
    const move = async (name: string, ids: string[], update: (ids: string[]) => Promise<{ count: number }>) => {
      moved[name] = ids.length ? (await update(ids)).count : 0;
    };
    // Plain per-user records (no per-user unique keys).
    for (const [name, model] of [
      ["plans", tx.workoutPlan],
      ["workouts", tx.workoutSession],
      ["personalRecords", tx.personalRecord],
      ["foodEntries", tx.foodEntry],
      ["waterLogs", tx.waterLog],
      ["mobility", tx.mobilitySession],
      ["measurements", tx.bodyMeasurement],
      ["coachMessages", tx.coachMessage],
      ["practicePlans", tx.practicePlan],
      ["sportResults", tx.sportMetricEntry],
      ["savedMeals", tx.savedMeal],
    ] as const) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same updateMany shape on each delegate
      moved[name] = (await (model as any).updateMany({ where: { userId: guestId }, data: { userId: accountId } })).count;
    }
    // Activities: skip imported entries whose externalId the account already has.
    const acts = await tx.activityEntry.findMany({ where: { userId: guestId }, select: { id: true, externalId: true } });
    const takenExt = new Set((await tx.activityEntry.findMany({ where: { userId: accountId, externalId: { not: null } }, select: { externalId: true } })).map((a) => a.externalId));
    const okActs = acts.filter((a) => !a.externalId || !takenExt.has(a.externalId));
    skipped.activities = acts.length - okActs.length;
    await move("activities", okActs.map((a) => a.id), (ids) => tx.activityEntry.updateMany({ where: { id: { in: ids } }, data: { userId: accountId } }));
    // Check-ins: one per day — the account's existing day wins.
    const cis = await tx.checkIn.findMany({ where: { userId: guestId }, select: { id: true, dateKey: true } });
    const days = new Set((await tx.checkIn.findMany({ where: { userId: accountId }, select: { dateKey: true } })).map((c) => c.dateKey));
    const okCis = cis.filter((c) => !days.has(c.dateKey));
    skipped.checkIns = cis.length - okCis.length;
    await move("checkIns", okCis.map((c) => c.id), (ids) => tx.checkIn.updateMany({ where: { id: { in: ids } }, data: { userId: accountId } }));
    // Skill progress: keep whichever is further along.
    for (const g of await tx.skillProgress.findMany({ where: { userId: guestId } })) {
      const a = await tx.skillProgress.findUnique({ where: { userId_skillSlug: { userId: accountId, skillSlug: g.skillSlug } } });
      if (!a) await tx.skillProgress.update({ where: { id: g.id }, data: { userId: accountId } });
      else if (g.stepIndex > a.stepIndex) {
        await tx.skillProgress.delete({ where: { id: a.id } });
        await tx.skillProgress.update({ where: { id: g.id }, data: { userId: accountId } });
      } else skipped.skills = (skipped.skills ?? 0) + 1;
    }
    // Composite-key rows: copy what the account doesn't have yet.
    for (const f of await tx.favoriteExercise.findMany({ where: { userId: guestId } })) {
      await tx.favoriteExercise.upsert({ where: { userId_exerciseId: { userId: accountId, exerciseId: f.exerciseId } }, create: { userId: accountId, exerciseId: f.exerciseId }, update: {} });
    }
    for (const s of await tx.userSport.findMany({ where: { userId: guestId } })) {
      await tx.userSport.upsert({ where: { userId_sportId: { userId: accountId, sportId: s.sportId } }, create: { userId: accountId, sportId: s.sportId, level: s.level, goals: s.goals, position: s.position, supervised: s.supervised }, update: {} });
    }
    for (const l of await tx.lessonProgress.findMany({ where: { userId: guestId } })) {
      await tx.lessonProgress.upsert({ where: { userId_lessonId: { userId: accountId, lessonId: l.lessonId } }, create: { userId: accountId, lessonId: l.lessonId, status: l.status, completedAt: l.completedAt }, update: {} });
    }
    // XP earned for the moved records comes along (same source + record = earned once). Achievement
    // XP is not copied: achievements are re-evaluated against the merged data below.
    const taken = new Set((await tx.xpEvent.findMany({ where: { userId: accountId }, select: { source: true, refId: true } })).map((x) => `${x.source}:${x.refId}`));
    const xp = (await tx.xpEvent.findMany({ where: { userId: guestId, source: { not: "achievement" } } })).filter((x) => !taken.has(`${x.source}:${x.refId}`));
    if (xp.length) {
      await tx.xpEvent.updateMany({ where: { id: { in: xp.map((x) => x.id) } }, data: { userId: accountId } });
      await tx.profile.update({ where: { userId: accountId }, data: { xp: { increment: xp.reduce((sum, x) => sum + x.amount, 0) } } });
    }
    moved.xp = xp.reduce((sum, x) => sum + x.amount, 0);
    await tx.user.delete({ where: { id: guestId } });
  });
  await evaluateAchievements(accountId);
  await recordAuthEvent("guest_imported", { userId: accountId, req, meta: { workouts: moved.workouts ?? 0, activities: moved.activities ?? 0 } });
  return { moved, skipped };
}

// ── Password reset ─────────────────────────────────────────────────────
const resetHash = (token: string) => hmac("reset", token);

/** Always resolves the same way, whether or not the email has an account. */
export async function requestPasswordReset(req: Request, email: string) {
  rateLimit(`reset:${clientIp(req)}`, 5, 60 * 60_000);
  rateLimit(`reset-email:${email}`, 3, 60 * 60_000);
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.isGuest) return;
  await db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }); // one live token at a time
  const token = randomToken(32);
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: resetHash(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } });
  const link = `${appBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: "Reset your APEX FIT password",
    text: `Someone (hopefully you) asked to reset the password for your APEX FIT account.\n\nReset it here (valid for 30 minutes, single use):\n${link}\n\nIf you didn't ask for this, you can ignore this email — your password won't change.`,
  });
  await recordAuthEvent("password_reset_requested", { userId: user.id, req });
}

export async function resetPassword(req: Request, token: string, password: string) {
  rateLimit(`reset-use:${clientIp(req)}`, 10, 60 * 60_000);
  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: resetHash(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError(400, "invalid_token", "This reset link is invalid or has expired. Request a new one.");
  const passwordHash = await hashPassword(password);
  // Single use is enforced atomically: only one request can flip usedAt.
  const { count } = await db.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (!count) throw new AppError(400, "invalid_token", "This reset link has already been used.");
  await db.user.update({ where: { id: row.userId }, data: { passwordHash, emailVerifiedAt: new Date() } }); // the link proved control of the inbox
  await db.session.deleteMany({ where: { userId: row.userId } }); // sign out everywhere
  await promoteIfVerifiedAdmin(row.userId);
  await recordAuthEvent("password_reset_completed", { userId: row.userId, req });
}

// ── Google ─────────────────────────────────────────────────────────────
export type GoogleOutcome = { kind: "session"; userId: string; isNew: boolean } | { kind: "linked"; userId: string } | { kind: "error"; code: "google_unverified" | "google_account_exists" | "google_in_use" | "google_link_requires_login" };

/**
 * Maps a verified Google identity to an account without ever linking by email alone:
 * - known Google subject → sign in to that account
 * - intent "link" (signed-in, non-guest user) → attach this Google identity to them
 * - email belongs to an existing account → refuse; the owner must sign in and link explicitly
 * - otherwise → new account (or the current guest is upgraded in place)
 */
export async function resolveGoogleIdentity(req: Request, id: GoogleIdentity, intent: OAuthIntent, current: AuthUser | null): Promise<GoogleOutcome> {
  const linked = await db.authAccount.findUnique({ where: { provider_providerAccountId: { provider: "google", providerAccountId: id.sub } } });
  if (intent === "link") {
    if (!current || current.isGuest) return { kind: "error", code: "google_link_requires_login" };
    if (linked && linked.userId !== current.id) return { kind: "error", code: "google_in_use" };
    if (!linked) {
      try {
        await db.authAccount.create({ data: { userId: current.id, provider: "google", providerAccountId: id.sub, email: id.email, emailVerified: id.emailVerified } });
      } catch (e) {
        if (isUniqueViolation(e)) return { kind: "error", code: "google_in_use" }; // this account already has a different Google identity
        throw e;
      }
      await recordAuthEvent("google_link", { userId: current.id, req });
    }
    return { kind: "linked", userId: current.id };
  }
  if (linked) {
    if (linked.emailVerified) await db.user.updateMany({ where: { id: linked.userId, emailVerifiedAt: null, email: id.email ?? "" }, data: { emailVerifiedAt: new Date() } });
    await promoteIfVerifiedAdmin(linked.userId);
    await recordAuthEvent("google_login", { userId: linked.userId, req });
    return { kind: "session", userId: linked.userId, isNew: false };
  }
  if (!id.email || !id.emailVerified) return { kind: "error", code: "google_unverified" };
  if (await db.user.findUnique({ where: { email: id.email } })) return { kind: "error", code: "google_account_exists" };
  const displayName = id.name?.trim() || id.email.split("@")[0];
  let userId: string;
  if (current?.isGuest) {
    try {
      await db.user.update({ where: { id: current.id }, data: { email: id.email, emailVerifiedAt: new Date(), isGuest: false, termsAcceptedAt: new Date(), profile: { update: { displayName } } } });
    } catch (e) {
      if (isUniqueViolation(e)) return { kind: "error", code: "google_account_exists" };
      throw e;
    }
    userId = current.id;
    await recordAuthEvent("guest_converted", { userId, req, meta: { method: "google" } });
  } else {
    userId = (await createUser({ email: id.email, passwordHash: null, displayName, emailVerifiedAt: new Date(), termsAcceptedAt: new Date() })).id;
    await recordAuthEvent("google_register", { userId, req });
  }
  await db.authAccount.create({ data: { userId, provider: "google", providerAccountId: id.sub, email: id.email, emailVerified: true } });
  await promoteIfVerifiedAdmin(userId);
  return { kind: "session", userId, isNew: true };
}
