# APEX FIT AI — architecture

Current as of 2026-10-20 (read from the code, not from earlier reports). The README has setup, environment variables and deployment.

## Runtime

| Layer | What it is |
|---|---|
| Web app | Next.js 15 App Router, React 19, Tailwind tokens, framer-motion. Server components read data; client components change it through `/api/*`. |
| API | Route handlers wrapped in `authedRoute` / `publicRoute` (`src/lib/server/api.ts`): session check, same-origin check on mutations, Zod body validation, admin gate, uniform error mapping. |
| Business logic | `src/lib/services/*` (DB-backed, every query scoped by `userId`), pure functions in `src/lib/engine/*` and `src/lib/domain/*` (unit-tested, no I/O). |
| Database | Prisma 6 + SQLite on a Railway volume. Migrations in `prisma/migrations/` are additive; `npm run start:prod` runs `migrate deploy`, an additive seed, then `next start`. Single instance only. |
| Auth | Session cookie (`apex_session`, HMAC-hashed 256-bit token, 30 days), scrypt passwords, Google OIDC (PKCE, nonce), guest mode with explicit import. Admin = role + verified email. |
| AI | Anthropic SDK when `ANTHROPIC_API_KEY` is set; otherwise rule-based fallbacks. The model explains; deterministic engines decide workouts, safety and progression. Context sent to the provider is built in `src/lib/ai/context.ts` and respects privacy settings. |
| PWA | `public/sw.js`: static assets, an app shell, and pages the user explicitly saves; cleared on logout and account deletion. Live-workout sets queue offline and sync idempotently. |
| Security headers | `next.config.ts` (HSTS in production, nosniff, frame DENY, referrer, permissions) and a per-request nonce CSP set in `src/middleware.ts` (`src/lib/server/csp.ts`). |

## Source layout

```
src/app/            (auth) sign-in pages · onboarding · (app) shell pages · (focus)/live workout · api/*
src/components/     ui primitives, charts, overlays, shell, workout, calendar, records, sports
src/lib/content/    seed content: exercises, skills, mobility, foods, sports (+ zod schemas)
src/lib/engine/     workout generator, 24-week roadmap, practice builder, prerequisite graph
src/lib/domain/     dates & time zones, streaks, energy, nutrition maths, readiness, levels, recommendation, coverage
src/lib/services/   workouts, calendar, progress, recommendation, sports, research, nutrition, recovery, account, …
src/lib/ai/         provider, context builder, intents, safety, coach, sport coach, meal estimate, form check
src/lib/server/     db, env, api wrapper, errors, rate limiter, logger, csp
src/lib/i18n/       en (source), fr, ar dictionaries; RTL
prisma/             schema, migrations, seed
tests/              Vitest unit + API integration (fresh SQLite DB per run)
e2e/                Playwright journeys (desktop + Pixel 7), production build
scripts/            content validator, research import, admin grant
```

## Conventions

- **Ownership**: look up user data with `findFirst({ where: { id, userId } })`; someone else's record returns 404, never 403.
- **Invariants that must survive concurrency** live in the database: nullable unique keys (`WorkoutPlan.dailyKey`, `WorkoutSession.activeKey`), composite uniques for XP, achievements and imports; P2002 is caught and the winner returned.
- **Corrections are audited**: changed records keep the previous values in `RecordCorrection`; derived values (bests, calories, lesson assessments, profile weight) are recomputed.
- **Honesty**: missing data is reported as missing — never as zero, recovery or improvement. Self-reported, logged and assessed evidence are labelled separately. Estimates are labelled.
- **Content workflow**: sports content is draft → review → published; validated by `scripts/validate-sports.ts` (schema, prerequisite cycles, instructor-only rules).
- **Strings**: new UI text goes through the dictionary (`src/lib/i18n/en.ts`, with `fr`/`ar` entries enforced by `tests/i18n.test.ts`).

## Data model (main groups)

- Identity: User, AuthAccount, Session, PasswordResetToken, AuthEvent, Profile.
- Training: Exercise, WorkoutPlan, WorkoutSession, SetLog, PersonalRecord, SkillProgress, WeeklyReview, RecommendationFeedback.
- Activity & body: ActivityEntry, CheckIn, MobilitySession, BodyMeasurement, RecordCorrection.
- Nutrition: Food, FoodEntry, SavedMeal, WaterLog.
- Sports learning: SportCategory, Sport, SportMetric, Lesson, Drill, Ruleset(+Version), UserSport, LessonProgress, PracticePlan, SportMetricEntry.
- Research: ContentSource, KnowledgeClaim, ResearchTask.
- Social: Friendship, Block, Report, Group, GroupMember, Post, Comment, Reaction, Challenge, ChallengeParticipant, Notification.
- Media: MediaUpload, FormCheck.

All user data cascades on account deletion and is included in the data export.
