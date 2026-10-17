import { db } from "../server/db";
import { hourInZone, todayKey, weekday, weekStart } from "../domain/dates";
import { getProfile } from "./profile";

export type NotificationCategory = "milestones" | "weeklyReport" | "challengeDeadlines" | "workoutReminders" | "hydrationReminders" | "habitReminders" | "system";

interface NewNotification {
  type: NotificationCategory;
  title: string;
  body: string;
  href?: string;
  dedupeKey?: string;
}

/** In-app notification, respecting the user's category preferences. Idempotent with a dedupeKey. */
export async function notify(userId: string, n: NewNotification) {
  if (n.type !== "system") {
    const p = await getProfile(userId);
    if (!p.notificationPrefs[n.type]) return null;
  }
  if (n.dedupeKey) {
    return db.notification.upsert({
      where: { userId_dedupeKey: { userId, dedupeKey: n.dedupeKey } },
      create: { userId, ...n },
      update: {},
    });
  }
  return db.notification.create({ data: { userId, ...n } });
}

export function inQuietHours(hour: number, start: number, end: number) {
  if (start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * Generates reminders that are due "now" for this user. Called lazily when the
 * user opens the app (no background scheduler is required). Push/email delivery
 * would hook in here once that infrastructure is configured.
 */
export async function generateDueReminders(userId: string, now = new Date()) {
  const p = await getProfile(userId);
  const prefs = p.notificationPrefs;
  const tz = p.timezone;
  const hour = hourInZone(now, tz);
  if (inQuietHours(hour, prefs.quietStart, prefs.quietEnd)) return;
  const today = todayKey(tz, now);

  if (prefs.workoutReminders && hour >= prefs.reminderHour && p.trainingDays.includes(weekday(today))) {
    const done = await db.workoutSession.count({ where: { userId, status: "completed", dateKey: today } });
    if (!done) {
      await notify(userId, {
        type: "workoutReminders",
        title: "Today's session is ready",
        body: "Your plan is waiting. Even a short session keeps momentum going.",
        href: "/today",
        dedupeKey: `workout-${today}`,
      });
    }
  }
  if (prefs.hydrationReminders && hour >= 11 && hour <= 20) {
    const water = await db.waterLog.aggregate({ where: { userId, dateKey: today }, _sum: { ml: true } });
    if ((water._sum.ml ?? 0) < p.waterGoalMl / 2 && hour >= 14) {
      await notify(userId, { type: "hydrationReminders", title: "Hydration check", body: "A glass of water now helps you reach today's goal.", href: "/nutrition", dedupeKey: `water-${today}` });
    }
  }
  if (prefs.weeklyReport && weekday(today) === 1) {
    await notify(userId, {
      type: "weeklyReport",
      title: "Your weekly review is ready",
      body: "Look back at last week and set up the next one.",
      href: "/plans#review",
      dedupeKey: `weekly-${weekStart(today)}`,
    });
  }
  if (prefs.habitReminders && hour >= prefs.reminderHour) {
    const checkin = await db.checkIn.findUnique({ where: { userId_dateKey: { userId, dateKey: today } } });
    if (!checkin) {
      await notify(userId, { type: "habitReminders", title: "Quick recovery check-in", body: "Ten seconds to log sleep, energy and soreness.", href: "/recovery", dedupeKey: `checkin-${today}` });
    }
  }
}

export async function listNotifications(userId: string, limit = 30) {
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: Math.min(limit, 100) }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, unread };
}

export async function markRead(userId: string, ids?: string[]) {
  await db.notification.updateMany({ where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
}
