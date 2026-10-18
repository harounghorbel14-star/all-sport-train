# APEX FIT — implementation checklist

Persistent, prioritised list of work. Status: ✅ done (tested) · 🔄 in progress · ⬜ to do · ⚠️ known limitation.
Each item names how it was verified. Audit of 2026-10-18 (findings verified by reading the code) is the source of most P0–P2 items.

## P0 — security, broken auth, data loss, critical failures
- ✅ Admin role granted to unverified emails in `ADMIN_EMAILS` → admin now requires role + verified email (Google or reset link); API and pages use `isAdmin()` — tests: api-auth-upgrade "admin access (P0)"
- ✅ Operator escape hatch for deployments without email: `npm run admin:grant -- you@example.com` (marks the address verified, logs an `admin_granted_by_operator` auth event) — verified manually
- ✅ Guarded pages were prerendered as a redirect to /login when `next build` ran without APP_BASE_URL (sign-up looped back to login) → session cookie is read before the config check — caught by e2e
- ✅ Reset/OAuth links built from the request Host → `APP_BASE_URL` required in production (health + setup notice report it) — test: "requires APP_BASE_URL in production"

## P1 — core workout experience, persistence, progress accuracy
- ✅ Practice completion not idempotent/atomic (duplicate activities on retry) → plan claimed atomically before logging — test: api-sports "logs a practice once…" (fails on the old code)
- ✅ Sets from abandoned ("end without saving") workouts count toward bests, skills and achievements → excluded everywhere
- ✅ Personal records never cleaned up when a set is corrected, substituted or the workout abandoned → reconciled per session, removed on discard — test: api-workouts "keeps personal records consistent…" (fails on the old code)
- ✅ Offline set queue: queue overwritten during flush, dropped on server error, not flushed after reload → ref-based queue, 5xx kept for retry, auto-flush after reload, finish blocked while sets are unsynced — e2e journey "sets logged without a connection sync after a reload…"
- ✅ Recovery check-in regenerates (archives) a workout the user edited → edited/coach/started plans are kept and the user is told — test: api-workouts "adapting after a check-in keeps…"
- ✅ Two active sessions possible on double start / two tabs (and duplicate today plans) → earliest wins, duplicates removed — test: api-workouts "never creates two plans…" (fails on the old code: 3 plans)
- ✅ Check-ins and mobility logs can be backdated for XP / streak repair; mobility double-submit → today or yesterday only, repeat taps logged once, busy state on the button — test: api-other "recovery logging dates"
- ✅ Completed sessions still render the live logging UI; completion retry loses the summary → reopening shows the summary; retries/races return the same summary, one activity, XP once — tests: api-workouts "completes once when two completions race", e2e journey
- ✅ Query-string tabs (sport hubs, Progress) sometimes didn't respond: Next's router fetched the page but never committed it (pre-existing — reproduced on the last merged commit; still present on the latest Next 15 patch; bisected to the chart components but not to any one behaviour) → `TabLink` falls back to a normal page load after 1.5 s — 50-click stress: 0 stuck (was 3–6 of 8); e2e sports "query-string tabs always respond…"
- ✅ Sport hub drops newest metric entries after 2,000 → newest 2,000 shown, personal bests from every entry — test: api-sports "…thousands of entries"
- ✅ Guest import drops XP / achievements → XP for moved records comes along (no double counting), achievements re-evaluated — test: api-auth-upgrade "conflict-safe import"
- ✅ Installable app (Android/iPhone) + offline saved lessons/plans — e2e + service-worker unit tests

## P2 — AI coaching, learning, analytics, hardening, performance
- ✅ Skill/lesson states: not started / in progress / awaiting assessment / completed; self-reported vs verified → opening a lesson changes nothing; lessons with a measurable progress test wait for a logged result that meets it (XP and prerequisites only once passed); evidence shown as self-reported / result logged / progress test passed; skill prerequisites say whether a best came from a workout or a self-reported test; results are labelled self-reported (APEX can't verify) — test: api-sports "lesson states"
- ⬜ Adaptive next-workout recommendation with reasons; accept / modify / reject
- ✅ IP rate limits trust X-Forwarded-For; limiter never evicts keys → right-most proxy-added address (`TRUSTED_PROXY_HOPS`, default 1), expired buckets swept — tests: hardening.test.ts
- ✅ Uploads parsed fully before size checks → Content-Length checked first, stream counted while reading, 413 past the limit — tests: hardening.test.ts
- ✅ Saved-meal foodId not ownership-checked → only shared or own foods are linked; unknown/deleted foods no longer crash logging — test: api-other "saved meals"
- ✅ Knowledge search loads the whole catalog per request; research-gap queue can be flooded → tokenised index cached (invalidated by content edits, 5-min TTL); 10 new gaps per user per day, 500 open gaps max; the coach only says a question was queued when it was — tests: research "knowledge index and gap queue"
- ✅ XP farming via activity log + delete → XP revoked on delete; at most 5 XP-earning activities per 24 h (all still logged) — test: api-other "XP integrity"
- ✅ Malformed cookie → 500 on every request → treated as no cookie — test: hardening.test.ts
- ✅ Imperial units for PRs, waist and volume; silent failures on deletes/toggles → shared `formatRecord`/`formatWeight` everywhere; user actions use `attempt()` which shows the error and stops — tests: hardening.test.ts
- ✅ Streaks counted a forgiven missed day as a streak day → grace protects the chain without adding to it — test: domain "forgives one missed planned day…"
- ✅ N+1 queries: achievements, practice completion, skills list, lesson page; exercise catalog in client bundles → achievements stats in one round trip; skills list uses 4 grouped queries; lesson page no longer loads the results history; practice completion reuses the loaded sport; labels moved to `src/lib/exercise-labels.ts` (no client component imports the catalog); coach context and sport hub built once per message

## P3 — community, integrations, polish
- ⬜ RTL decorative offsets; French/Arabic coverage of page strings
- ⬜ Missing loading states for (focus)/(auth); 401 redirect without `next`; invalid calendar dates accepted
- ⬜ Community: reaction double-tap 500; report brigading threshold
- ⚠️ Root cause of the stalled tab navigations is unknown; the fallback costs ~1.5 s plus a page load when it happens
- ⚠️ Registration reveals existing emails (accepted trade-off for clear UX; reset flow does not)

## Known limitations (not planned in this pass)
- ⚠️ No native App Store / Play Store builds — the app installs as a PWA.
- ⚠️ Live AI coaching and web research need a connection; offline covers saved pages and the live-workout set queue only.
- ⚠️ Sports content (113 sports) is editorial and unreviewed by qualified coaches; rules overviews unverified against current rulebooks.
- ⚠️ Rate limiting is in-memory (single instance).
