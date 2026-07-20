# Hardening Audit 001 — API, durability, scheduler, offline, content

Five areas beyond the UX/UI reviews, audited and fixed together. Each was
verified by exercising it, not just reading it.

## 1. API endpoint exposure and cost — FIXED

**Finding.** `/api/generate` and `/api/grade` each spend Anthropic credit. The
passphrase gate (`APP_PASSPHRASE`) is *optional* — unset, both routes are open
to anyone who finds the URL — and there was no rate limiting or payload bound,
so a discovered endpoint could be looped to drain the budget.

**Fix (`server/app.ts`).**
- Per-IP fixed-window rate limiter on both routes (default 30 req/min,
  `RATE_LIMIT_MAX` override), ordered before the passphrase and handler.
  In-memory, so on Vercel it is per-warm-instance — a burst guard, with the
  passphrase remaining the real global gate (documented honestly).
- Payload caps: `studied_words` ≤ 2000, `new_words` ≤ 20, topic ≤ 120 chars,
  `user_context` ≤ 500, grade prompt/response ≤ 1000/2000 — a crafted request
  can't inflate the prompt (and the bill).
- `/api/health` now echoes the active `rateLimit`; `docs/DEPLOY.md` gained a
  "set `APP_PASSPHRASE` on any lasting deployment" callout.

**Verified.** 35 requests from one IP → 30 pass, 5 × `429`; a fresh IP is
unaffected.

**Action for you:** confirm `APP_PASSPHRASE` is set in the Vercel project
(Settings → Environment Variables) if the deployment stays up. The limiter is a
backstop, not a replacement.

## 2. Data durability — FIXED

**Finding.** IndexedDB was the only store, backups were manual, and the app
never called `navigator.storage.persist()`. iOS Safari can evict a
not-installed PWA's storage after ~7 idle days — months of FSRS history could
vanish over a holiday.

**Fix.**
- `App.tsx` requests persistent storage on startup (best-effort, silent
  no-op where unsupported).
- `Settings` shows a backup-age line under Sandaran: reassuring when recent,
  oxblood with an iOS-eviction warning when never/≥7 days. Backed by a new
  `lastBackupAt` written on every export (`backup.ts`, `types.ts`).

**Verified.** Type-checks and renders; export updates the timestamp and the
nudge state.

## 3. Scheduler and timezone correctness — AUDITED, TESTS ADDED

**Finding.** Day boundaries use the device's *local* calendar
(`todayStr`, `tomorrowStart` at 04:00 local) — correct for a single-user
local-first app, and robust across a relocation to UTC+8 (rhythm counts
distinct local dates, so a forward shift can't double-count). The real gap was
**zero test coverage** of this logic; `tests/p0.test.ts` only covered the
containment validator and word selection.

**Fix (`tests/scheduler.test.ts`, wired into `npm test`).** Locks: `todayStr`
formatting + intra-day stability, `tomorrowStart` (next day at 04:00, always
future), `sessionCounts`, `nextMilestone` boundaries, `newCard` due handling,
the FSRS progression shape with fuzz on (Again sub-hour, Easy graduates ≥1 day
to review, intervals never inverted), `knownCard` maturity + jitter bounds over
50 draws, and `previewIntervals` label format.

**Verified.** `npm test` runs both suites green.

## 4. Offline behavior — VERIFIED, no change needed

**Finding/result.** The README's "reviews work offline" claim holds. Against a
production build served over HTTP with the service worker registered, then
switched offline: the shell boots from cache, a full review flow (flip + grade,
FSRS write to IndexedDB) works, and Read fails gracefully to its "cuba lagi"
error rather than white-screening. Workbox precaches all JS/CSS/HTML/fonts and
leaves `/api` uncached (NetworkOnly), which is exactly right.

## 5. Seed content QA — VERIFIED CLEAN, no change needed

**Finding/result.** A static sweep of all 425 seed rows found zero missing
base glosses, zero examples without an English gloss, and zero divergent
colloquial examples lacking a gloss. My earlier live flag on the "dia" card was
a misread: its colloquial line ("Dia member aku.") intentionally shares the
base gloss ("He's my friend"), the documented design for the 97 rows where the
register differs but the meaning is identical. `npm run verify:glosses` (the
model round-trip) still needs an API key to run against live content.
