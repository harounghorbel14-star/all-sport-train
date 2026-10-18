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
- ⬜ Check-ins and mobility logs can be backdated for XP / streak repair; mobility double-submit
- ✅ Completed sessions still render the live logging UI; completion retry loses the summary → reopening shows the summary; retries/races return the same summary, one activity, XP once — tests: api-workouts "completes once when two completions race", e2e journey
- ⬜ Sport hub drops newest metric entries after 2,000
- ⬜ Guest import drops XP / achievements
- ✅ Installable app (Android/iPhone) + offline saved lessons/plans — e2e + service-worker unit tests

## P2 — AI coaching, learning, analytics, hardening, performance
- ⬜ Skill/lesson states: not started / in progress / awaiting assessment / completed; self-reported vs verified
- ⬜ Adaptive next-workout recommendation with reasons; accept / modify / reject
- ⬜ IP rate limits trust X-Forwarded-For; limiter never evicts keys
- ⬜ Uploads parsed fully before size checks
- ⬜ Saved-meal foodId not ownership-checked
- ⬜ Knowledge search loads the whole catalog per request; research-gap queue can be flooded
- ⬜ XP farming via activity log + delete
- ⬜ Malformed cookie → 500 on every request
- ⬜ Imperial units for PRs, waist and volume; silent failures on deletes/toggles
- ⬜ N+1 queries: achievements, practice completion, skills list, lesson page; exercise catalog in client bundles

## P3 — community, integrations, polish
- ⬜ RTL decorative offsets; French/Arabic coverage of page strings
- ⬜ Missing loading states for (focus)/(auth); 401 redirect without `next`; invalid calendar dates accepted
- ⬜ Community: reaction double-tap 500; report brigading threshold
- ⚠️ Registration reveals existing emails (accepted trade-off for clear UX; reset flow does not)

## Known limitations (not planned in this pass)
- ⚠️ No native App Store / Play Store builds — the app installs as a PWA.
- ⚠️ Live AI coaching and web research need a connection; offline covers saved pages and the live-workout set queue only.
- ⚠️ Sports content (113 sports) is editorial and unreviewed by qualified coaches; rules overviews unverified against current rulebooks.
- ⚠️ Rate limiting is in-memory (single instance).
