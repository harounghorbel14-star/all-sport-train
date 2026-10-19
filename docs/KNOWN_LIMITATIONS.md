# Known limitations

Honest list of what APEX FIT does **not** do (yet). Updated with each work session; last reviewed 2026-10-19.

## Content and knowledge
- **Sports content is editorial.** All 135 sports have lessons, drills and rules overviews written for the app; none has been reviewed by qualified coaches yet. Rules overviews are labelled "general / unverified" and were not checked against the current rulebooks.
- **Results are self-reported.** The app records what users enter; it cannot verify performances. There is no coach role to verify results yet.
- **No quizzes.** Lessons complete on the user's word or, where defined, when a logged result meets the lesson's progress test.
- **Research needs credentials.** AI web research requires `ANTHROPIC_API_KEY`; without it, research tasks stay queued/blocked. No claim is ever marked verified without a human reviewer.

## Coaching
- **Live AI coaching needs a connection and an API key.** Without a key, the coach uses deterministic, rule-based answers.
- **Recommendation feedback** (accept / modify / reject) is recorded but not yet used to change future suggestions.
- Plateau detection needs at least 4 comparable sessions over 3+ weeks; with less data it says nothing.

## Scheduling
- No rescheduling, cancelling or recurring activities in the calendar yet (plans have a date only). Reminders are in-app notifications; there are no push notifications.

## Localisation
- Only the shared dictionary (navigation, sign-in, onboarding, Today, workout screens) is translated into French and Arabic. Most page bodies and all sports content are English-only; in Arabic, untranslated English text is laid out left-to-right inside the RTL page.

## Platform
- No native App Store / Play Store builds; the app installs as a PWA ("Add to Home Screen").
- Offline: saved lessons and plans, plus sets logged during a live workout, work offline. Everything else (AI, research, logging other data) needs a connection.
- Rate limiting is in memory (single instance). Multiple instances would need a shared store.
- SQLite on a Railway volume: a single instance only; back up the volume.
- No integrations with health services (Apple Health, Google Fit, Strava).

## Known issues
- Query-string tabs (sport hubs, Progress) occasionally don't commit a client-side navigation (Next.js; root cause unknown). A fallback reloads the page after 1.5 s.
- Registration reveals whether an email is already registered (accepted trade-off for clear UX; password reset does not).
