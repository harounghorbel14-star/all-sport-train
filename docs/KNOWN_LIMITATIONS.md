# Known limitations

Honest list of what APEX FIT does **not** do (yet). Updated with each work session; last reviewed 2026-10-19.

## Content and knowledge
- **Sports content is editorial.** All 135 sports have lessons, drills and rules overviews written for the app; none has been reviewed by qualified coaches yet. Rules overviews are labelled "general / unverified" and were not checked against the current rulebooks.
- **Results are self-reported.** The app records what users enter; it cannot verify performances. There is no coach role to verify results yet.
- **Knowledge checks cover 14 beginner lessons** in the priority sports (61 questions written from each lesson's own text, not reviewed by a coach). Other lessons complete on the user's word or, where defined, when a logged result meets the progress test. A failed attempt shows the correct answers, so a retry tests recall rather than discovery; 5 attempts a day per check limit guessing.
- **No coach verification.** There is no coach role; practical results are self-reported and labelled as such.
- **Research needs credentials.** AI web research requires `ANTHROPIC_API_KEY`; without it, research tasks stay queued/blocked. No claim is ever marked verified without a human reviewer.

## Coaching
- **Live AI coaching needs a connection and an API key.** Without a key, the coach uses deterministic, rule-based answers.
- **Recommendation feedback** adjusts only session length and effort-only lightening; it never overrides pain, recovery or re-entry rules.
- Plateau detection needs at least 4 comparable sessions over 3+ weeks; with less data it says nothing.

## Scheduling
- Recurring activities are weekly (the profile's sport schedule); there are no custom intervals (e.g. every other week) or times of day yet.
- Reminders are in-app notifications; there are no push notifications.

## Goals
- Goal kinds are limited to exercise bests (reps, seconds, load), sport results with a numeric/time/ratio metric, weekly consistency and lessons. Body-measurement goals (weight, waist) are deliberately not offered.
- Consistency goals count completed workouts plus other logged activities; a week with nothing logged counts as 0 sessions.
- Goals aren't summarised inside the monthly report yet.

## Scheduling
- Catch-up proposals only look at the current week; they never carry sessions into next week. Two catch-up requests sent at the same instant could, in theory, both add a session to the same day (each request re-checks the day first).
- Travel mode changes generated workouts only (equipment, place, length); sport practice plans aren't adapted.

## Templates
- Templates can't be shared with other users yet, and template contents are edited by editing a plan and updating the template from it (there's no separate template editor).

## Localisation
- French and Arabic cover the shared dictionary (navigation, sign-in, onboarding, workout screens) and the full Today page, training calendar and record corrections. Other page bodies, engine-generated text (workout titles, phase names, missions), server messages (errors, calendar load warnings) and all sports content are English-only; in Arabic, untranslated English text is laid out left-to-right inside the RTL page.

## Platform
- No native App Store / Play Store builds; the app installs as a PWA ("Add to Home Screen").
- Offline: saved lessons and plans, plus sets logged during a live workout, work offline. Everything else (AI, research, logging other data) needs a connection.
- Rate limiting is in memory (single instance). Multiple instances would need a shared store.
- SQLite on a Railway volume: a single instance only; back up the volume.
- No integrations with health services (Apple Health, Google Fit, Strava).

## Security
- The Content-Security-Policy allows inline styles ('unsafe-inline' in style-src) because animations set style attributes. Scripts are nonce-only. Every page is rendered per request (needed for the nonce).

## Known issues
- Query-string tabs (sport hubs, Progress) occasionally don't commit a client-side navigation (Next.js; root cause unknown). A fallback reloads the page after 1.5 s.
- Registration reveals whether an email is already registered (accepted trade-off for clear UX; password reset does not).
