/**
 * Operator command: grant admin to an existing account from a shell on the server
 * (e.g. Railway → service → Shell). Having server access is the proof of authority,
 * so this marks the email verified and grants the role.
 *   npm run admin:grant -- you@example.com
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const email = (process.argv[2] ?? "").trim().toLowerCase();

async function main() {
  if (!email.includes("@")) throw new Error("Usage: npm run admin:grant -- you@example.com");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.isGuest) throw new Error(`No registered account for ${email}. Register in the app first.`);
  await db.user.update({ where: { id: user.id }, data: { role: "admin", emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
  await db.authEvent.create({ data: { userId: user.id, type: "admin_granted_by_operator", meta: JSON.stringify({ via: "cli" }) } });
  console.log(`✓ ${email} is now an admin.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
