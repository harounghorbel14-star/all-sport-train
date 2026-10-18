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
| `npm run db:seed` | Seed or refresh the catalog (idempotent and additive: existing databases receive new sports content such as lessons and drills; admin-added exercises and admin-edited sports are never touched). `SEED_OVERWRITE=1` re-applies the seeded sports content over existing rows. Runs automatically on every deploy via `npm run start:prod`. |

For Playwright in a custom environment, set `PLAYWRIGHT_CHROMIUM_PATH` to a Chromium binary if needed.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` (SQLite) or a PostgreSQL URL (after switching the provider) |
| `SESSION_SECRET` | yes | 32+ characters; peppers the session-token hashes |
| `ADMIN_EMAILS` | no | Comma-separated emails allowed to become admins. The role is granted only after the address is **verified**, by signing in with Google or completing a password-reset link once. Registering with the address is not enough. |
| `ANTHROPIC_API_KEY` | no | Turns on the conversational coach, photo meal estimates and visual form analysis |
| `AI_MODEL` | no | Defaults to `claude-opus-5-5` |
| `FDC_API_KEY` | no | USDA FoodData Central key for extended food search; the local database is always available |
| `UPLOAD_DIR` | no | Private media storage, default `./storage/uploads` (never under `public/`) |
| `ENFORCE_TIERS` | no | `true` to gate Pro/Elite features. Default `false`, because there is no payment provider. |
| `APP_BASE_URL` | **yes in production** | Public base URL, e.g. `https://app.example.com`. Used for the OAuth callback and reset links. It is required so that links are never built from a forged Host header. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no | Enables "Continue with Google" (see [Google sign-in setup](#google-sign-in-setup)). |
| `GOOGLE_CALLBACK_URL` | no | Override for the redirect URI; defaults to `${APP_BASE_URL}/api/auth/google/callback`. |
| `RESEND_API_KEY`, `MAIL_FROM` | for password reset | Transactional email through Resend. Without them, development logs reset links to the server console; production sends nothing. |

Secrets are only read on the server (`src/lib/server/env.ts`, validated with Zod). No key ever reaches the browser.

## External integrations that need credentials

- **Anthropic API** (`ANTHROPIC_API_KEY`): coach conversations, meal-photo estimates, form-check image analysis. Requests use server-side refusal fallbacks and validated structured output. Without a key you get the rule-based coach, the local text meal parser, and a guided form-check checklist.
- **USDA FoodData Central** (`FDC_API_KEY`): extra food search results. Results are never fabricated; failures fall back to the local database.
- **Google OAuth** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`): implemented and tested against mocked Google responses (real RS256-signed ID tokens, mocked token endpoint). **It has not been tested against live Google credentials in this environment** — do that once with your own client before relying on it.
- **Email** (`RESEND_API_KEY`): password-reset delivery. Implemented against Resend's HTTP API; not exercised against the live service here.
- **Not implemented, needing credentials**: payments (Stripe or similar), wearables and health platforms (Apple Health, Health Connect, Strava, Garmin), push delivery. The UI marks each one as "not configured". Imports would use the existing `ActivityEntry.externalId` de-duplication.

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
| **Activity** | Every published sport, with sport-specific validated fields from its metric definitions; MET-based net energy estimates with ±20–35% ranges (pace-based for running, cycling and walking); separate Mifflin–St Jeor TDEE; workouts create exactly one activity entry (no double counting) |
| **Progress** | 4/12/24/52-week analytics from persisted data only: workouts, minutes, reps, load volume, activity, nutrition, exercise performance line, skills. Optional measurements with trends; private photo journal with consent, gallery, date comparison and deletion; data export. |
| **Recovery** | Check-ins (sleep, energy, soreness, stress, pain, rest day) → readiness band; 8 guided mobility routines with a timer player; educational posture self-check |
| **Form Check AI** | Photo or video. Video is sampled into frames in the browser, so the raw video is never uploaded. Explicit consent; media is not kept unless chosen. Results are split into observed / uncertain / can't be assessed. Delete anytime. |
| **Challenges** | Sustainable streaks (rest days count, one forgiven miss per week), weekly streaks, 16-week calendar, XP and levels, 13 data-driven achievements, weekly missions, monthly community challenges |
| **Community** | Feed (friends / public / group), reactions, comments, friend requests, groups, report (auto-hide at 3 reports) and block. Text-only posts, so body photos can never be published. |
| **Sports** | Searchable catalog of 143 sports and disciplines in 8 categories, 113 of them with a full learning system, with alias and accent-insensitive search. Each sport has a status label: *learning system*, *in development* or *requires external instruction*. Sport hub tabs: Overview, Learn, Drills, Practice, Rules, Progress, Conditioning & safety. Weekly multisport schedule. See [Sports knowledge system](#sports-knowledge-system). |
| **Profile & settings** | Profile, training setup, language (EN / FR / AR with RTL), units, theme (dark / light / system), time zone, reduced motion, nutrition goals, notification preferences with quiet hours, privacy, accountability, export, account deletion |
| **AI Coach** | Intent detection for the example requests; real actions (saved workouts, technique links, 4-week analysis charts, roadmap and meal guidance) computed from your data; safety screening for emergencies, injury, disordered eating and self-harm; the model gets compact factual context and is told not to invent plans |

## Sports knowledge system

Sports live in the database, not in code. Admins can add sports, disciplines (`parentSlug`) and regional variants from **Admin → Sports content** (`/admin/sports`) without a deploy.

**Catalog coverage, stated plainly.** The catalog has 143 entries across combat, team ball, racket, athletics/endurance, strength/gymnastics/fitness, water, outdoor/adventure, and dance/adaptive/other. It is not a list of every sport in the world.
- **Learning system** (113 sports): lessons from beginner to advanced, drills (warm-up, technique, tactics, conditioning, cool-down), a rules overview, practice builder, sport-specific metrics, milestones and safety. In total: 719 lessons and 1,284 drills.
  - The 8 original sports (calisthenics, boxing, football, basketball, baseball, swimming, running, tennis) are the deepest.
  - The other 105 live in `src/lib/content/sports/extended/<group>.ts` (track, endurance, combat, teamA, teamB, racket, outdoor, fitness). They are checked by `npx tsx scripts/validate-sports.ts`.
  - The validator enforces at least 6 lessons across all levels, at least 10 drills including solo work, at least 4 performance metrics and milestones, valid references, and no "verified" rules claims.
  - It also enforces safety: supervised partner work in combat sports, no full-contact or sparring drills, and homepage-only URLs for new sources.
- **In development** (9 gym-style modalities: strength, gym, powerlifting, weightlifting, strongman, CrossFit-style, functional fitness, street workout, adaptive fitness): these are trained through the workout engine, with an overview and tracking.
- **Requires external instruction** (e.g. diving, kitesurfing, climbing, mountaineering, gymnastics, equestrian, archery): tracking and general conditioning only, plus a pointer to certified instructors.

**Content model.** Each sport has a flexible profile, validated with zod and shared by every sport. A sport only fills the sections that make sense for it:
- Introduction, history, equipment, terminology.
- Positions and formations (team sports).
- Technique areas, tactics, conditioning and mobility (linked to real exercises in the library).
- Injury prevention, safety, age guidance and supervision notes.
- Milestones, weekly structure, templates and external resources.

Lessons have prerequisites and levels. Drills carry focus, setting, minimum players, a contact level (none/light/controlled/full) and a "requires supervision" flag. Metrics are typed per sport:
- Kinds: number, time (stored in seconds), ratio (made/attempts, with a minimum number of attempts before a result can count as a personal best) and select.
- Each metric has a scope (session vs. performance) and a direction.
- Examples: free-throw percentage for basketball, 5 km time for running, pitch count and exit velocity for baseball, and prerequisite-based skills for calisthenics through the Academy.

**Rules and sources.**
- Rulesets are plain-language summaries, never the rulebook.
- Each one names its governing body and scope, has an edition note and a verification label (*summary checked against source* / *general overview* / *unverified*), and records the date it was last reviewed.
- Each ruleset cites at least one entry from the source registry, which admins manage. Seeded sources only include URLs for well-known official sites.
- Basketball has separate FIBA and NBA rulesets; boxing separates amateur and professional.

**Workflow.** New or edited sports, lessons, drills and rulesets are saved as **draft**. They move to **review** and then **published**, and only published content is shown to users. Publishing a sport or ruleset records the review date.

**Practice builder** (`lib/engine/practice.ts`). It builds warm-up → main work (split by focus) → cooldown from the sport's drill library. It respects:
- the user's level, the setting (solo/partner/team) and player count;
- preferred drills from the user's next lesson.

Safety rules are in one function:
- Full-contact drills are never generated.
- Controlled contact is only for supervised adult advanced athletes.
- Coach-only drills require the user to say they train with a qualified coach.
- Under-18s get partner contact only when supervised.

Every drill that is left out is listed with its reason. Completing a practice creates one activity entry (MET-based estimated energy) and the results entered.

**Sport-aware coach.** The coach uses the sport the user opened it from (`/coach?sport=…`) or detects one from the message. Rule-based answers are split into labelled sections:
- **Official rules — <ruleset>**, with source and review date;
- **Coaching suggestion**;
- **Uncertain / check locally**.

When there is no reviewed ruleset, the coach says so instead of inventing rules. When an AI key is configured, the model gets the same data and explicit instructions to keep those labels and never invent rules, rankings or statistics. Workout requests for workout-based sports (calisthenics, strength) still go through the workout engine.

**Tracking honesty.** Progress is only what the user logs. There are no universal "sport scores", invented sensor data, rankings or match results.

## Authentication

One session system (HTTP-only `apex_session` cookie → HMAC-hashed token in the `Session` table); every sign-in method ends in the same kind of session.

| Flow | How it works |
| --- | --- |
| **Email + password** | scrypt hashes; client- and server-side validation; terms acceptance recorded; duplicate emails → clear 409 (race-safe via the unique index). Login compares against a dummy hash when the account doesn't exist, so timing doesn't reveal which emails are registered. |
| **Return to destination** | Middleware passes the requested path to the page guard; `/login?next=…` only accepts same-site relative paths (`safeNext` rejects absolute, protocol-relative, backslash and API URLs). |
| **Forgot / reset password** | Always the same response ("if an account exists…"). Tokens: 32 random bytes, only an HMAC stored, 30-minute expiry, one live token per user, atomically single-use. A reset signs out every device. |
| **Google (OAuth 2.0 + OIDC)** | Authorization-code flow with PKCE (S256), `state` and `nonce` held in a signed, 10-minute, HTTP-only cookie. The code is exchanged server-to-server with the client secret; the ID token is verified with Google's JWKS via `jose` (signature, issuer, audience, expiry, nonce). The account key is Google's stable `sub`, never the email. Handles cancelled consent, state mismatch, expired codes and bad tokens with specific messages. |
| **Account linking** | Never automatic. If a Google email matches an existing account, sign-in is refused with an explanation; the owner logs in with their password and connects Google from **Profile → Security** (`intent=link`). A Google identity can belong to only one account. Google-only accounts can add a password through the reset flow (proves inbox control). |
| **Guest mode** | "Continue as guest" creates an isolated guest account (`isGuest`, placeholder `…@guest.invalid` email, no password) with beginner defaults, so Today, the library, Academy, sports lessons, practice builder, logging and the rule-based coach all work immediately. Guests are blocked server-side from community, challenges, media uploads, progress photos, photo meal estimates and admin (`guestBlocked()` in the API wrapper), have a lower coach rate limit, and see a "Guest mode" banner. Inactive guests are deleted after 30 days. |
| **Guest → account** | *Create account* while a guest upgrades the same user in place — nothing to migrate. *Log in* to an existing account while a guest stores a signed claim cookie; the app then **asks** before importing. The import validates the claim, moves workouts, activities, plans, logs and progress, skips conflicts (same-day check-ins, existing favourites, lower skill progress), never overwrites, and deletes the guest. Matching emails never trigger a merge. |
| **Sessions** | HTTP-only, `SameSite=Lax`, `Secure` in production; 30-day expiry; logout deletes the session; *Sign out everywhere* deletes them all. Mutations are origin-checked (CSRF). Rate limits: login per IP+email and per email across IPs, registration, guest creation, reset requests. |
| **Audit** | `AuthEvent` records registrations, logins, failures, resets, Google links, guest creation/conversion/import (IP + user agent; never secrets). |

Routes: public — `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/account-required`. Everything under the app shell requires a session (guest or full); community, challenges and form check require a full account.

### Google sign-in setup

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, set the app name, support email and authorised domain, and add the scopes `openid`, `email`, `profile`.
3. While the app is in *Testing* status, add your Google accounts under **Test users** (others will be refused).
4. **Credentials → Create credentials → OAuth client ID → Web application.**
   - Authorised JavaScript origins: `http://localhost:3000` (dev) and `https://your-domain` (prod).
   - Authorised redirect URIs: `http://localhost:3000/api/auth/google/callback` and `https://your-domain/api/auth/google/callback` — must match `APP_BASE_URL` (or `GOOGLE_CALLBACK_URL`) exactly.
5. Put the client ID and secret in the **server** environment (`.env`, or your host's secret manager): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_BASE_URL`. Never commit them.
6. `npm run dev`, open `/login`, click **Continue with Google**, consent, and you should land on onboarding (new account) or Today.
7. Production: serve over HTTPS (secure cookies require it), set `APP_BASE_URL=https://your-domain`, publish the consent screen (Google may require verification for external apps), and keep the secret in your platform's secret store.

## Research & knowledge engine

Goal: every sports fact a user sees should be traceable to a source, and anything not yet checked should be visibly marked as such.

**What exists**
- **Data model**:
  - `ContentSource` — with `accessedAt` / `accessedBy` (set only when someone actually opened the source), edition, change-tracking hash and check status.
  - `KnowledgeClaim` — statement, category, level, source references with sections, confidence, `status` (unverified / verified / disputed / outdated / rejected) and `evidence` (`snippet` / `source_opened` / `admin_checked`).
  - `ResearchTask` — the persistent queue: verify rules, research a topic, user knowledge gaps, source changes, review suggestions.
  - `RulesetVersion` — previous versions are kept on every edit.
  - `Ruleset.reviewFlag` — the "possibly outdated" warning.
- **Coverage dashboard** (`/admin/research`): per sport, it shows:
  - lessons, drills, rulesets (and how many are verified), sources opened vs cited;
  - claims verified vs pending, open tasks, review suggestions, missing topics, last research run.
  - It also has tabs for suggested changes (current vs suggested text with sources), the research queue, and claim review. Verifying a claim requires entering the URL you opened and the section that supports it.
- **Retrieval for the coach**: `searchKnowledge()` searches published lessons, drills, rule points and **verified** claims only. It is keyword-based: no embedding provider is configured, so there is no semantic search. A hit needs a minimum term overlap.
  - Specific sports questions are answered from those hits, each with its verification label and sources.
  - With no hit, the coach says it has no verified information, doesn't guess, and adds a `knowledge_gap` task.
  - With an AI key, the model gets the same retrieved data and is told never to answer from memory when nothing was found.
- **AI web research** (`runAiResearch`, needs `ANTHROPIC_API_KEY`): uses Anthropic's server-side `web_search_20260209` and `web_fetch_20260209` tools, then structured extraction.
  - A claim is kept **only if its URL was actually returned** by the search or fetch tools; anything else is dropped.
  - Claims from opened pages are marked `source_opened`. Everything is saved as `unverified` for human review.
- **Source monitoring** (`npm run research -- check-sources`): respects robots.txt, uses one polite request per source and hashes the page text.
  - A changed page flags every ruleset that cites it and opens a review task.
  - Blocked or disallowed sources are recorded as such. Nothing is auto-published.
- **Queue and jobs**: `npm run research -- init-queue | import <dir> | check-sources | run-next [n]`. Suggested cron schedule: `check-sources` weekly, `run-next 5` nightly when an AI key is set; review the results in the dashboard.

**What was actually researched in this session (honest status)**
- Research agents covered the 8 full sports with web search. **This environment's network policy blocked every source page** (IFAB, FIBA, MLB, ITF, World Aquatics, World Athletics, World Boxing, PubMed and others), so **no source was opened**. Every finding is a *lead from search-result snippets*.
- The runs are committed in `prisma/research/2026-10-17/` and imported by the seed as:
  - 73 unverified, snippet-level claims;
  - 74 review suggestions (e.g. IFAB 2026/27 law changes, FIBA 2026 foul categories, the breaststroke underwater kick, the weak evidence behind the "10% rule");
  - "possibly outdated" flags on 8 rulesets, shown to users on the Rules tab and by the coach.
- Because nobody has checked the seeded rules summaries against the current rulebooks, all of them are now labelled **"General overview — not yet verified against the current rulebook"**. A migration downgraded the old "checked against source" label.
- To do real verification: allow the federation and journal domains in the environment's network settings (or run in an environment with internet access), re-run the research, and have a reviewer verify claims and apply suggestions in `/admin/research`.

## Deployment (Railway or similar)

`railway.json` builds with `npm run build` and starts with `npm run start:prod`, which applies migrations (`prisma migrate deploy`), runs the idempotent seed (exercises, foods, sports, research queue) and then `next start` on `$PORT`. The healthcheck is `/api/health`; it returns **503 with the reason** until configuration, database, migrations and seed are all OK, so a broken deploy fails visibly instead of serving error pages.

Set these in the service's **Variables** (the repository's `.env` is never committed, so a fresh deploy has none of them):

| Variable | Value |
| --- | --- |
| `SESSION_SECRET` | **Required.** A random string of 32+ characters, e.g. the output of `openssl rand -base64 48`. |
| `DATABASE_URL` | **Required.** For SQLite, use a file on a persistent volume, e.g. `file:/data/apex.db` with a Railway volume mounted at `/data` — without a volume every redeploy starts with an empty database. Or use PostgreSQL (switch the provider in `schema.prisma` and create a fresh migration). |
| `UPLOAD_DIR` | `/data/uploads` (same volume) so private photos survive redeploys. |
| `APP_BASE_URL` | Your public URL, e.g. `https://your-app.up.railway.app` (needed for Google sign-in and reset links). |
| `ADMIN_EMAILS` | Your email. After registering, use "Forgot password" once to verify it (needs email configured). Without email, run `npm run admin:grant -- you@example.com` from the service's shell. |
| Optional | `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY` / `MAIL_FROM`, `FDC_API_KEY`. |

If `SESSION_SECRET` or `DATABASE_URL` is missing, the sign-in pages show **"Server setup incomplete"** with the variable names (never values), the server logs the problem at startup, and `/api/health` explains it.

## Architecture

```
src/
  app/                 routes: (auth), onboarding, (app) shell pages, (focus)/live, api/*
  components/          ui/ primitives, charts, motion, overlays; shell; workout; muscle map
  lib/
    content/           exercise catalog, skills, mobility, foods, sports/ (seed content + zod schemas)
    engine/            workout generator, 24-week roadmap, sport practice builder (pure, unit-tested)
    domain/            dates/time zones, streaks, energy, nutrition maths, readiness, levels, achievements
    services/          DB-backed business logic (every query scoped by userId)
    ai/                provider, context, intents, safety, coach, sport coach, meal estimate, form check
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

The schema is in `prisma/schema.prisma`; the migration is in `prisma/migrations/`. Sports models: SportCategory, Sport, SportMetric, ContentSource, Ruleset, Lesson, Drill, UserSport, LessonProgress, PracticePlan, SportMetricEntry. Core models: User, Session, Profile, Exercise, FavoriteExercise, WorkoutPlan, WorkoutSession, SetLog, PersonalRecord, SkillProgress, Food, FoodEntry, SavedMeal, WaterLog, ActivityEntry, CheckIn, MobilitySession, BodyMeasurement, MediaUpload, FormCheck, UserAchievement, XpEvent, WeeklyReview, CoachMessage, Notification, Challenge, ChallengeParticipant, Friendship, Block, Report, Group, GroupMember, Post, Comment, Reaction.

All user data cascades on account deletion. Indexes cover per-user date lookups, and unique constraints make XP, achievements, notifications and imports idempotent.

To use PostgreSQL, change `provider` in `schema.prisma` to `postgresql`, set `DATABASE_URL`, and create a fresh migration with `prisma migrate dev`.

### Security

- Passwords hashed with scrypt; constant-time comparison, including a dummy comparison for unknown accounts. Session tokens are 256-bit random, stored as HMAC hashes, and expire after 30 days. Reset tokens and OAuth state are likewise never stored in plain form. See [Authentication](#authentication).
- Rate limits on login and registration, AI endpoints, uploads and social actions. The limiter is in-memory; use Redis when running more than one instance.
- Uploads are type-checked by magic bytes (not by extension or client-supplied type), size-limited, stored outside `public/` with random keys, and served only to their owner with `Cache-Control: private, no-store`.
- Security headers via `next.config.ts`. JSON logging without secrets or media.

## Test results (verified in this environment)

- `npm run typecheck`: passes
- `npm run lint`: passes with no warnings
- `npm test`: **147 tests in 10 files, all passing**. Auth tests (19) cover: terms validation, safe `next` redirects, rate limiting and CSRF, sign-out-everywhere, protected endpoints, password reset (identical responses, hashed single-use token, expiry, sessions invalidated), Google OIDC with **mocked** token endpoint and locally generated signing keys (PKCE/state/nonce in the start URL, new verified account, returning user, state mismatch, cancelled consent, wrong audience, bad nonce, unverified email, expired code, no auto-linking by email, explicit linking, one identity per account, Google-only password hint), guest sandbox, guest restrictions, in-place guest upgrade, explicit conflict-safe guest import with forged-claim rejection, guest purge. Research tests (11) cover: import honesty and idempotency, no seeded ruleset claiming source checks, verified-only retrieval and verification requiring a source, knowledge search, admin-only endpoints, coach answers from knowledge with labels, coach admitting gaps and queueing them, AI research refusal without a key, robots.txt, source-change flags, ruleset versioning. Earlier: Sports-specific tests cover: catalog integrity (unique slugs, valid references, https sources, full sports have lessons/drills/rulesets/metrics); practice-builder safety (no full contact, supervision, under-18, level, setting, time budget); personal bests and the ratio minimum-attempts rule; milestones; next lesson; weekly plan; API (search, hub, enrolment, lesson progress, practice create/complete/ownership, metric validation and personal bests, review, admin draft → publish visibility and required sources, non-admin 403); coach rule labels and "no verified summary" fallback; account export. The earlier tests cover: They cover: content integrity; engine (equipment, limitations, start-from-zero, time budget, readiness, determinism, V-taper legs, progression rules, substitutions); roadmap and reviews; dates and time zones; streaks (rest days, grace, pending today, late-night workouts across time zones); energy and TDEE (under-18 guard); nutrition maths and the text parser; readiness; levels and achievements; and API integration (auth, cookies, rate limit, 401s, CSRF origin, admin, onboarding persistence, ownership, plan generation/editing/validation, live session start/pause/resume/sets/refresh/complete, PRs, substitutions, skills and prerequisites, reviews, food logging and serving maths, water, saved meals, estimator fallback, activity estimates and import de-duplication, coach fallback and safety, uploads, private media, form check, export/delete, analytics empty state, community privacy and blocking, challenges, notifications).
- `npm run build`: passes
- `npm run test:e2e`: **17 Playwright tests passing** (desktop + mobile for auth): login returns to the protected page you asked for; client-side registration validation and show/hide password; wrong-credential errors and hidden unconfigured Google button (production build); forgot/reset password with no account disclosure and invalid-token message; guest → restricted feature → account gate → save progress → full access; sports search → join → lesson → practice → complete → log a result and see the personal best; anonymous redirect; register → start-from-zero onboarding → live workout → refresh → finish → summary; food logging; rule-based coach; responsive navigation on desktop and mobile.

## Known limitations

- **Translations**: French and Arabic cover navigation and core labels. Many page strings, plus all exercise and coaching content, are still English (the dictionary falls back key by key). The RTL layout works.
- **Notifications**: in-app only, generated when the app is opened. There is no background scheduler, web push or email.
- **Payments, wearables, health platforms**: interfaces and UI placeholders only; nothing is pretended to be connected.
- **Exercise media**: there are no videos. The catalog uses illustrated fallbacks plus written tutorials until verified media is added.
- **Form check**: video is analysed as sampled still frames. There is no pose-estimation model, and no tempo or range measurement.
- **Community**: no real-time updates (refresh-based), no admin moderation workflow beyond auto-hide plus a report list, and no images in posts by design.
- **Sports content depth and review**: 113 sports have learning content. The lessons and drills are editorial content written without access to the official coaching manuals or rulebooks (this environment's network blocked them), so they need review by qualified coaches before you rely on them for competition. Para sports content describes classification only in general terms. The seeded rules summaries were written from general knowledge of the cited rulebooks and need periodic re-review against current editions — the review date is shown to users for that reason.
- **Research verification**: no source could be opened from this environment (network policy), so there are no verified claims yet; the coach therefore answers specific questions only from published lesson and rules content (clearly labelled) or says it doesn't know.
- **Semantic search**: not available (no embedding provider); retrieval is keyword-based.
- **Google OAuth / email delivery**: verified only with mocked responses; needs a one-time live test with real credentials. Email verification for password sign-ups (a confirmation link) is not implemented; `emailVerifiedAt` is set by Google sign-in or a completed password reset.
- **Rate limiting and caching** are in-memory (single instance).
- **Offline**: queued sets sync on reconnect, but pages themselves need a connection (no service worker).

## Before production

1. Switch to PostgreSQL; run migrations in CI/CD; schedule backups.
2. Replace the in-memory rate limiter and exercise cache with Redis.
3. Move uploads to private object storage (S3 or GCS with signed URLs) and add malware scanning.
4. Configure HTTPS, `SESSION_SECRET` rotation, monitoring and error tracking (the JSON logs are ready to ship).
5. Configure Google OAuth and Resend with real credentials and test both once end to end; consider email verification for password sign-ups and 2FA.
6. Integrate a payment provider before setting `ENFORCE_TIERS=true`.
7. Add a background job runner for reminders and weekly reports, plus push/email delivery.
8. Complete the translations and have a professional review the exercise safety content.
9. Add verified exercise demonstration videos.
10. Add a moderation dashboard and terms/privacy pages; review medical-disclaimer copy with counsel.
