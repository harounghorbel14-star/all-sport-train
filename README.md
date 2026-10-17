# APEX FIT AI

A calisthenics-first fitness platform: personalised workouts, a live training mode, a Calisthenics Academy, nutrition and activity tracking, recovery, progress analytics, gamification, community and an AI coach.

It works from day one without an AI key, a paid plan, a wearable or any equipment. Every AI feature has a working rule-based fallback.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React 19, TypeScript strict) |
| Data | Prisma 6 with SQLite by default (the schema is portable to PostgreSQL) |
| Styling / motion | Tailwind CSS 4 with design tokens in `src/app/globals.css`; Framer Motion (respects reduced motion) |
| Validation | Zod on every API input and JSON column |
| Auth | Email + password (scrypt). Random session tokens are stored hashed (HMAC) in the DB and sent as an `HttpOnly`, `SameSite=Lax` cookie. Mutating requests get a same-origin check. |
| AI | `@anthropic-ai/sdk`, server-only, optional |
| Tests | Vitest (unit and API integration against a real migrated SQLite DB) and Playwright (end-to-end) |

The repository was empty apart from a README, so this stack was chosen from scratch: one process, one database, and nothing external required to run.

## Getting started

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then set SESSION_SECRET to a random string of 32+ characters
npx prisma migrate deploy   # create the SQLite database (prisma/dev.db)
npm run db:seed             # exercises, food database, monthly challenges
npm run dev                 # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js and TypeScript rules) |
| `npm test` | Vitest unit and integration tests (creates `prisma/test.db` automatically) |
| `npm run test:e2e` | Playwright tests (builds nothing; run `npm run build` first). Uses `prisma/e2e.db`. |
| `npm run db:migrate` | Create a new migration during development |
| `npm run db:seed` | Seed or refresh the catalog (idempotent; keeps admin-added exercises) |

For Playwright in a custom environment, set `PLAYWRIGHT_CHROMIUM_PATH` to a Chromium binary if needed.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` (SQLite) or a PostgreSQL URL (after switching the provider) |
| `SESSION_SECRET` | yes | 32+ characters; peppers the session-token hashes |
| `ADMIN_EMAILS` | no | Comma-separated emails that get the admin role on registration (exercise management, reports) |
| `ANTHROPIC_API_KEY` | no | Turns on the conversational coach, photo meal estimates and visual form analysis |
| `AI_MODEL` | no | Defaults to `claude-opus-5-5` |
| `FDC_API_KEY` | no | USDA FoodData Central key for extended food search; the local database is always available |
| `UPLOAD_DIR` | no | Private media storage, default `./storage/uploads` (never under `public/`) |
| `ENFORCE_TIERS` | no | `true` to gate Pro/Elite features. Default `false`, because there is no payment provider. |

Secrets are only read on the server (`src/lib/server/env.ts`, validated with Zod). No key ever reaches the browser.

## External integrations that need credentials

- **Anthropic API** (`ANTHROPIC_API_KEY`): coach conversations, meal-photo estimates, form-check image analysis. Requests use server-side refusal fallbacks and validated structured output. Without a key you get the rule-based coach, the local text meal parser, and a guided form-check checklist.
- **USDA FoodData Central** (`FDC_API_KEY`): extra food search results. Results are never fabricated; failures fall back to the local database.
- **Not implemented, needing credentials**: payments (Stripe or similar), wearables and health platforms (Apple Health, Health Connect, Strava, Garmin), push and email delivery. The UI marks each one as "not configured". Imports would use the existing `ActivityEntry.externalId` de-duplication.

## What's in the app

| Section | Highlights |
| --- | --- |
| **Onboarding** | 9-step animated wizard: Start-from-Zero mode, goals, interactive muscle map → program emphasis, sports, location/equipment, schedule, optional body data and limitations, preferences. Every answer can be edited later. |
| **Today** | Today's generated session, start/resume, quick 15/20/30-min regeneration, weekly ring, streak, level/XP, week strip, readiness check-in (adapts the session), roadmap progress, next skill, nutrition summary, PRs, missions, recommended next action |
| **Workout engine** (`src/lib/engine`) | Weekly split templates per emphasis and days per week; movement-pattern slots filled from progression ladders, filtered by equipment, location, limitations and difficulty; history-driven progression (only after 2 top-of-range sessions at RPE ≤ 8 on a full-readiness day; regression after repeated misses); readiness and deload volume; time-budget fitting; warm-up and cooldown; substitutions; deterministic per day |
| **Plan editor** | Replace (suitable substitutes only), reorder, add/remove exercises, adjust sets, reps, holds and rest, all validated server-side |
| **Live mode** | Full-screen: rep stepper or hold timer, RPE, optional load, animated rest timer (+15 s, skip, vibration), pause/resume, previous/next, mid-workout swap, technique sheet, skip set. State is server-backed and survives refresh, with an offline queue in `localStorage`. PR detection; completion summary with calorie range, achievements and optional sharing. |
| **24-week roadmap** | Six phases, deload every 4th week (from week 8), weekly review → progress / continue / repeat week / deload. It never escalates after pain or a hard week. |
| **Calisthenics Academy** | 19 skill paths across foundations, upper, core, legs and advanced (L-sit, handstand, muscle-up, front lever, back lever, planche). Each has prerequisites checked against logged data or self-tests, equipment checks, step targets, supporting exercises, errors, rest, safety and an honest timeline. |
| **Exercise library** | 125 exercises with setup, steps, breathing, cues, mistakes, safety, easier/harder variations and related moves. Filters: muscle (body map), pattern, difficulty, equipment, sport, location, type, favorites, "fits my equipment". Honest media fallback (no invented video URLs); admins can add verified video URLs. |
| **Nutrition** | Diary by meal, food search with serving sizes, custom foods, edit/delete, water, saved meals, 7-day chart, macro and calorie goals. AI or text meal estimates show confidence and an editable review step, and are labelled as estimates. No calorie deficit is suggested for under-18s. |
| **Activity** | 19 sports with sport-specific validated fields; MET-based net energy estimates with ±20–35% ranges (pace-based for running, cycling and walking); separate Mifflin–St Jeor TDEE; workouts create exactly one activity entry (no double counting) |
| **Progress** | 4/12/24/52-week analytics from persisted data only: workouts, minutes, reps, load volume, activity, nutrition, exercise performance line, skills. Optional measurements with trends; private photo journal with consent, gallery, date comparison and deletion; data export. |
| **Recovery** | Check-ins (sleep, energy, soreness, stress, pain, rest day) → readiness band; 8 guided mobility routines with a timer player; educational posture self-check |
| **Form Check AI** | Photo or video. Video is sampled into frames in the browser, so the raw video is never uploaded. Explicit consent; media is not kept unless chosen. Results are split into observed / uncertain / can't be assessed. Delete anytime. |
| **Challenges** | Sustainable streaks (rest days count, one forgiven miss per week), weekly streaks, 16-week calendar, XP and levels, 13 data-driven achievements, weekly missions, monthly community challenges |
| **Community** | Feed (friends / public / group), reactions, comments, friend requests, groups, report (auto-hide at 3 reports) and block. Text-only posts, so body photos can never be published. |
| **Sports Explorer** | Per-sport tracking fields, beginner guidance, templates, personal stats, weekly multisport schedule |
| **Profile & settings** | Profile, training setup, language (EN / FR / AR with RTL), units, theme (dark / light / system), time zone, reduced motion, nutrition goals, notification preferences with quiet hours, privacy, accountability, export, account deletion |
| **AI Coach** | Intent detection for the example requests; real actions (saved workouts, technique links, 4-week analysis charts, roadmap and meal guidance) computed from your data; safety screening for emergencies, injury, disordered eating and self-harm; the model gets compact factual context and is told not to invent plans |

## Architecture

```
src/
  app/                 routes: (auth), onboarding, (app) shell pages, (focus)/live, api/*
  components/          ui/ primitives, charts, motion, overlays; shell; workout; muscle map
  lib/
    content/           exercise catalog, skills, mobility, sports, foods (typed data)
    engine/            workout generator, 24-week roadmap (pure, unit-tested)
    domain/            dates/time zones, streaks, energy, nutrition maths, readiness, levels, achievements
    services/          DB-backed business logic (every query scoped by userId)
    ai/                provider, context, intents, safety, coach, meal estimate, form check
    server/            db, env, API wrapper (auth, origin check, Zod, errors), rate limiter, logger
    i18n/              dictionaries + RTL support
prisma/                schema, migrations, seed
tests/                 unit + API integration tests
e2e/                   Playwright journeys
```

Design decisions:

- **Pure engine, thin services.** The generator, streaks, energy and roadmap are pure functions with unit tests. Services load data, call them and persist results.
- **Server components read; clients mutate through `/api`.** Every route goes through `authedRoute`, which verifies the session, checks Origin, validates with Zod and maps errors. Ownership is enforced in queries (`where: { id, userId }`), and missing ownership returns 404.
- **AI never drives actions directly.** Workouts the coach shows are produced by the engine and validated; the model only explains them.
- **Estimates are always ranges or labelled.** That covers calories burned, TDEE, AI meal items (never "high" confidence for photos) and form feedback.

### Database

The schema is in `prisma/schema.prisma`; the migration is in `prisma/migrations/`. Models: User, Session, Profile, Exercise, FavoriteExercise, WorkoutPlan, WorkoutSession, SetLog, PersonalRecord, SkillProgress, Food, FoodEntry, SavedMeal, WaterLog, ActivityEntry, CheckIn, MobilitySession, BodyMeasurement, MediaUpload, FormCheck, UserAchievement, XpEvent, WeeklyReview, CoachMessage, Notification, Challenge, ChallengeParticipant, Friendship, Block, Report, Group, GroupMember, Post, Comment, Reaction.

All user data cascades on account deletion. Indexes cover per-user date lookups, and unique constraints make XP, achievements, notifications and imports idempotent.

To use PostgreSQL, change `provider` in `schema.prisma` to `postgresql`, set `DATABASE_URL`, and create a fresh migration with `prisma migrate dev`.

### Security

- Passwords hashed with scrypt; constant-time comparison. Session tokens are 256-bit random, stored as HMAC hashes, and expire after 30 days.
- Rate limits on login and registration, AI endpoints, uploads and social actions. The limiter is in-memory; use Redis when running more than one instance.
- Uploads are type-checked by magic bytes (not by extension or client-supplied type), size-limited, stored outside `public/` with random keys, and served only to their owner with `Cache-Control: private, no-store`.
- Security headers via `next.config.ts`. JSON logging without secrets or media.

## Test results (verified in this environment)

- `npm run typecheck`: passes
- `npm run lint`: passes with no warnings
- `npm test`: **84 tests in 6 files, all passing**. They cover: content integrity; engine (equipment, limitations, start-from-zero, time budget, readiness, determinism, V-taper legs, progression rules, substitutions); roadmap and reviews; dates and time zones; streaks (rest days, grace, pending today, late-night workouts across time zones); energy and TDEE (under-18 guard); nutrition maths and the text parser; readiness; levels and achievements; and API integration (auth, cookies, rate limit, 401s, CSRF origin, admin, onboarding persistence, ownership, plan generation/editing/validation, live session start/pause/resume/sets/refresh/complete, PRs, substitutions, skills and prerequisites, reviews, food logging and serving maths, water, saved meals, estimator fallback, activity estimates and import de-duplication, coach fallback and safety, uploads, private media, form check, export/delete, analytics empty state, community privacy and blocking, challenges, notifications).
- `npm run build`: passes
- `npm run test:e2e`: **6 Playwright tests passing**: anonymous redirect; register → start-from-zero onboarding → live workout → refresh → finish → summary; food logging; rule-based coach; responsive navigation on desktop and mobile.

## Known limitations

- **Translations**: French and Arabic cover navigation and core labels. Many page strings, plus all exercise and coaching content, are still English (the dictionary falls back key by key). The RTL layout works.
- **Notifications**: in-app only, generated when the app is opened. There is no background scheduler, web push or email.
- **Payments, wearables, health platforms**: interfaces and UI placeholders only; nothing is pretended to be connected.
- **Exercise media**: there are no videos. The catalog uses illustrated fallbacks plus written tutorials until verified media is added.
- **Form check**: video is analysed as sampled still frames. There is no pose-estimation model, and no tempo or range measurement.
- **Community**: no real-time updates (refresh-based), no admin moderation workflow beyond auto-hide plus a report list, and no images in posts by design.
- **Rate limiting and caching** are in-memory (single instance).
- **Offline**: queued sets sync on reconnect, but pages themselves need a connection (no service worker).

## Before production

1. Switch to PostgreSQL; run migrations in CI/CD; schedule backups.
2. Replace the in-memory rate limiter and exercise cache with Redis.
3. Move uploads to private object storage (S3 or GCS with signed URLs) and add malware scanning.
4. Configure HTTPS, `SESSION_SECRET` rotation, monitoring and error tracking (the JSON logs are ready to ship).
5. Add email verification, password reset and optionally 2FA/OAuth.
6. Integrate a payment provider before setting `ENFORCE_TIERS=true`.
7. Add a background job runner for reminders and weekly reports, plus push/email delivery.
8. Complete the translations and have a professional review the exercise safety content.
9. Add verified exercise demonstration videos.
10. Add a moderation dashboard and terms/privacy pages; review medical-disclaimer copy with counsel.
