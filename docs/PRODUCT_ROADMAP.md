# APEX FIT AI — product roadmap

Maps each requirement of the master product prompt to what the code actually does. Status: COMPLETE · PARTIAL · MISSING · BROKEN · BLOCKED.
Evidence names the test or check. Detailed history: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md); limits: [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md).

Baseline 2026-10-20 (branch `claude/modest-wozniak-1x8qcl` from `main` after PR 11): tsc clean, eslint clean, vitest 209/209, content validator ✓135. P0 re-check: every id-based write in `src/lib/services` targets a record first loaded with the owner's `userId` (groups and challenges are public by design) — no new P0 found.

| § | Requirement | Phase | Status | Evidence / gap |
|---|---|---|---|---|
| 4 | Adaptive next-workout recommendation, reasons, feedback | E | COMPLETE | recommendation.test.ts, e2e journey; feedback shapes later suggestions without overriding safety |
| 4.6 / 34 | Recommendation audit trail incl. measurable outcome | E | PARTIAL | decision + evidence stored in `RecommendationFeedback`; outcome of the following session not linked yet |
| 5 | Training twin (inspectable profile of what the app knows) | E | PARTIAL | profile, history and gaps feed the engine; no single "what we know / don't know" view |
| 6 | Skill trees, prerequisites, cycle detection, lesson states | F | COMPLETE | api-sports "lesson states", sports.test "prerequisite graph" |
| 7 | Quizzes and verified learning | F | MISSING → next | no assessment engine yet |
| 8 | AI technique review | K | PARTIAL | photo/frame form check with consent, provider disclosure, confidence labels, "not assessable" list, deletion; full video biomechanics not claimed; needs `ANTHROPIC_API_KEY` for AI (guided fallback otherwise) |
| 9 | Drill / practice builder | F | COMPLETE | practice builder (supervision, level, setting, time budget), save, complete — api-sports |
| 10 | Smart workout generator | C | COMPLETE | engine tests (equipment, limitations, time budget, readiness) |
| 10 / 25 | Workout templates | H | MISSING | plans can be edited and re-run; no saved template library |
| 11 | Live workout (log, replace, pause, offline, finish once, correct) | C | COMPLETE | api-workouts, e2e journey |
| 12 | Plateau detection, training load | D | PARTIAL | cautious plateau check in the recommendation (≥4 sessions, ≥3 weeks); no training-load trend view |
| 13 | Missed-workout recovery | G | PARTIAL | skipped days derived on the calendar; re-entry rule after long breaks; no "rebuild my week" flow |
| 14 | Exercise substitution | C | COMPLETE | engine substitution tests (equipment, pattern, level) |
| 15 | Goal roadmap (measurable goals, milestones) | C/D | MISSING → next | profile goals are categories only |
| 16 | Calendar: one-time, recurring, reschedule, cancel/restore, states | G | COMPLETE | calendar.test.ts, e2e |
| 16 | Reminders | G | PARTIAL | in-app notifications; push needs a new dependency + VAPID secrets (BLOCKED on decision) |
| 17 | Equipment inventory | H | COMPLETE | Settings › Training setup; used by the generator and substitutions |
| 18 | Travel mode | G | MISSING | |
| 19 | Personal bests, provenance, corrections | D | COMPLETE | corrections.test.ts, api-sports bests |
| 20 / 22 | Progress story, weekly + monthly reports | D | PARTIAL | weekly review + monthly report; goal progress not included yet |
| 21 | Sports benchmarks | D | BLOCKED | no reliable, licensed norm datasets; own history used instead (no invented percentiles) |
| 23 | Nutrition & recovery | H | COMPLETE | api-other nutrition/recovery; estimates labelled; sharing control |
| 24 | Smart streaks | H | COMPLETE | domain tests (rest days, grace, weekly targets) |
| 26 | Coach workspace | K | MISSING | needs a product decision (coach role, client consent model) |
| 27 | Wearables / health services | K | BLOCKED | provider credentials and developer accounts required |
| 28 | Privacy center | I | PARTIAL | privacy settings, AI disclosure, export, deletion exist; spread across pages |
| 29 | Offline | J | COMPLETE | e2e pwa + offline set sync; cache cleared on logout |
| 30 | Accessibility & localisation | J | PARTIAL | automated a11y checks on 14 pages; FR/AR for shared UI + Today/calendar/corrections only |
| 31 | Product health | L | PARTIAL | `/api/health` readiness (DB, config); no performance budget |
| 32 | AI evaluation lab | L | PARTIAL | fallback, safety, privacy and feedback tests exist; no single fixture-based eval suite |
| 33 | Content quality / coverage | L | COMPLETE | per-topic coverage report — coverage.test.ts |
| 35 | Feature flags | L | MISSING | |
| 36 | Security & integrity | B/I | COMPLETE | auth/ownership/race/CSP tests |

## Order of work (this session)

1. Goal roadmap (§15) — Phase C/D.
2. Quizzes and assessment attempts (§7) — Phase F.
3. Workout templates (§25) — Phase H.
4. Missed-workout recovery and travel mode (§13, §18) — Phase G.
5. Feature flags (§35), privacy center (§28), AI evaluation suite (§32) — Phases I/L.

Each item ships with tests and a checklist entry before the next one starts.
