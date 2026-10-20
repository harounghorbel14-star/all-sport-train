# APEX FIT AI — product roadmap

Maps each requirement of the master product prompt to what the code actually does. Status: COMPLETE · PARTIAL · MISSING · BROKEN · BLOCKED.
Evidence names the test or check. Detailed history: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md); limits: [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

Baseline 2026-10-20 (branch `claude/modest-wozniak-1x8qcl` from `main` after PR 11): tsc clean, eslint clean, vitest 209/209, content validator ✓135. P0 re-check: every id-based write in `src/lib/services` targets a record first loaded with the owner's `userId` (groups and challenges are public by design) — no new P0 found.

| § | Requirement | Phase | Status | Evidence / gap |
|---|---|---|---|---|
| 4 | Adaptive next-workout recommendation, reasons, feedback | E | COMPLETE | recommendation.test.ts, e2e journey; feedback shapes later suggestions without overriding safety |
| 4.6 / 34 | Recommendation audit trail incl. measurable outcome | E | PARTIAL | decision + evidence stored in `RecommendationFeedback`; outcome of the following session not linked yet |
| 5 | Training twin (inspectable profile of what the app knows) | E | PARTIAL | profile, history and gaps feed the engine; no single "what we know / don't know" view |
| 6 | Skill trees, prerequisites, cycle detection, lesson states | F | COMPLETE | api-sports "lesson states", sports.test "prerequisite graph"; practical coach verification needs a coach role (§26) |
| 7 | Quizzes and verified learning | F | COMPLETE (2026-10-20) | Assessment engine: `LessonQuiz` (versioned, seeded additively) + `QuizAttempt` (migration `20261020110000_lesson_quizzes`); single/multiple-answer and scenario questions; questions and option order fixed per attempt (random subset via `perAttempt`); answers never sent to the client; exact-match grading on the server; one open attempt per quiz (DB-unique key); graded once — repeat/concurrent submissions return the same result; XP once per quiz; 5 attempts/day; review with correct answers and explanations; prerequisite-gated with the missing lesson named. Lessons with a check complete only when it is passed (and the progress test too, where defined); evidence "knowledge check passed" vs "assessed". Content: 14 checks / 61 questions for priority-sport beginner lessons, each answer taken from that lesson's own text, not coach-reviewed (validator enforces shape, real lesson, no instructor-only activity) — tests: quizzes.test.ts (10), api-sports lesson states, e2e sports journey (fail → review → retry → pass) |
| 8 | AI technique review | K | PARTIAL | photo/frame form check with consent, provider disclosure, confidence labels, "not assessable" list, deletion; full video biomechanics not claimed; needs `ANTHROPIC_API_KEY` for AI (guided fallback otherwise) |
| 9 | Drill / practice builder | F | COMPLETE | practice builder (supervision, level, setting, time budget), save, complete — api-sports |
| 10 | Smart workout generator | C | COMPLETE | engine tests (equipment, limitations, time budget, readiness) |
| 10 / 25 | Workout templates | H | COMPLETE (2026-10-20) | `WorkoutTemplate` (migration `20261020130000_workout_templates`): save from a plan (as last saved) or update an existing template from a plan, rename, folders, duplicate, soft delete with 30-day restore, schedule on a day (calendar rules + load warnings; replaces only today's untouched automatic plan, archived not deleted; never a started/edited/scheduled one). Re-validated on use; scheduled plans keep their own copy. Saving/scheduling never counts as training. Export + guest import — tests: templates.test.ts (6), e2e journey "save a workout as a template…". Sharing templates with others not implemented |
| 11 | Live workout (log, replace, pause, offline, finish once, correct) | C | COMPLETE | api-workouts, e2e journey |
| 12 | Plateau detection, training load | D | PARTIAL | cautious plateau check in the recommendation (≥4 sessions, ≥3 weeks); no training-load trend view |
| 13 | Missed-workout recovery | G | COMPLETE (2026-10-20) | Plans › calendar "Missed a workout?": last 7 days (never before sign-up) — scheduled workouts not done, planned training days with nothing logged; proposal only (applied on request): at most 2 sessions this week, only while the week is below the usual number, free days only, never back to back, never a third day in a row, lighter (80 % volume) after 2+ misses or a 14-day break, nothing after a check-in suggesting recovery; missed workouts stay in history as skipped; apply re-checks the proposal — tests: travel-catchup.test.ts |
| 14 | Exercise substitution | C | COMPLETE | engine substitution tests (equipment, pattern, level) |
| 15 | Goal roadmap (measurable goals, milestones) | C/D | COMPLETE (2026-10-20) | `Goal` model (additive migration `20261020090000_goals`); kinds: exercise best (completed workouts only), sport result (metric range/direction, ratio attempt minimum, labelled self-reported), weekly consistency (finished weeks only), lesson (completes only with the lesson, assessed vs self-reported). Starting point = best logged result, a labelled self-reported value, or the first result after the goal was set — never invented; milestones at 25/50/75/100 %; no projections; target date is a reminder. Edit/abandon/restore with `RecordCorrection` audit, recomputed on every read so corrections apply; in export and guest import. Progress page card, FR/AR — tests: goals.test.ts (10), e2e journey "set a weekly goal…" |
| 16 | Calendar: one-time, recurring, reschedule, cancel/restore, states | G | COMPLETE | calendar.test.ts, e2e |
| 16 | Reminders | G | PARTIAL | in-app notifications; push needs a new dependency + VAPID secrets (BLOCKED on decision) |
| 17 | Equipment inventory | H | COMPLETE | Settings › Training setup; used by the generator and substitutions |
| 18 | Travel mode | G | COMPLETE (2026-10-20) | `TravelPeriod` (migration `20261020150000_travel_periods`): dates (≤60 days, no overlaps), place, equipment, session length capped at the usual. Workouts generated for trip days use it automatically. Already-scheduled automatic workouts: preview → apply chosen (originals archived, never deleted); edited ones kept and flagged; cancelling restores untouched originals. Rest days and training days unchanged — tests: travel-catchup.test.ts, e2e journey "travel mode…" |
| 19 | Personal bests, provenance, corrections | D | COMPLETE | corrections.test.ts, api-sports bests |
| 20 / 22 | Progress story, weekly + monthly reports | D | PARTIAL | weekly review + monthly report; goals shown next to the report on Progress but not summarised inside it |
| 21 | Sports benchmarks | D | BLOCKED | no reliable, licensed norm datasets; own history used instead (no invented percentiles) |
| 23 | Nutrition & recovery | H | COMPLETE | api-other nutrition/recovery; estimates labelled; sharing control |
| 24 | Smart streaks | H | COMPLETE | domain tests (rest days, grace, weekly targets) |
| 26 | Coach workspace | K | MISSING | needs a product decision (coach role, client consent model) |
| 27 | Wearables / health services | K | BLOCKED | provider credentials and developer accounts required |
| 28 | Privacy center | I | COMPLETE (2026-10-20) | `/profile/privacy`: per-category counts of everything stored (own records only) with links to manage each; sharing settings; what is sent to the AI provider (or that none is configured), nutrition-sharing state, provider-retention caveat; clear AI conversation; connected services (Google; no health services); retention rules; export and account deletion — tests: privacy.test.ts, a11y spec (desktop + mobile). Per-category bulk deletion (e.g. "delete all food entries") not added; individual deletes and account deletion exist |
| 29 | Offline | J | COMPLETE | e2e pwa + offline set sync; cache cleared on logout |
| 30 | Accessibility & localisation | J | PARTIAL | automated a11y checks on 14 pages; FR/AR for shared UI + Today/calendar/corrections only |
| 31 | Product health | L | PARTIAL | `/api/health` readiness (DB, config); no performance budget |
| 32 | AI evaluation lab | L | PARTIAL | fallback, safety, privacy and feedback tests exist; no single fixture-based eval suite |
| 33 | Content quality / coverage | L | COMPLETE | per-topic coverage report — coverage.test.ts |
| 35 | Feature flags | L | COMPLETE (2026-10-20) | `FEATURES_DISABLED` env (`src/lib/server/features.ts`): default on; enforced server-side in `authedRoute({ feature })` (404 `feature_disabled`), in lesson completion (no waiting on a switched-off quiz) and in generation (trips ignored); UI hides the feature; data never deleted; `/api/health` reports disabled and misspelt names — tests: features.test.ts (enabled and disabled states) |
| 36 | Security & integrity | B/I | COMPLETE | auth/ownership/race/CSP tests |

## Order of work (this session)

1. ✅ Goal roadmap (§15) — Phase C/D.
2. ✅ Quizzes and assessment attempts (§7) — Phase F.
3. ✅ Workout templates (§25) — Phase H.
4. ✅ Missed-workout recovery and travel mode (§13, §18) — Phase G.
5. Feature flags (§35), privacy center (§28), AI evaluation suite (§32) — Phases I/L.

Each item ships with tests and a checklist entry before the next one starts.
