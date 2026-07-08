# Bukit v1 — Developer Handover

**Repo:** `anthonynegulic/malay`, branch `claude/bukit-app-review-3hnowa`
**Status:** v1 feature-complete against the brief; browser-verified; AI generation exercised only in error paths (needs a live `ANTHROPIC_API_KEY` to test the happy path).
**Read alongside:** [`docs/BRIEF.md`](BRIEF.md) — the original product brief, with §11 recording the three decisions made at build kickoff.

---

## 1. What this is

A single-user, local-first Malay-learning PWA for a learner relocating to Penang. The core
loop is **Retrieve → Absorb → Produce**: FSRS spaced-repetition reviews, then an
AI-generated reading passage calibrated to the learner's known vocabulary, then one
graded output micro-task. Target session 10–15 min; a "Sikit je" bad-day mode
(reviews only, ≤20 cards) counts as a full day.

No accounts, no backend database — IndexedDB in the browser is the only store, with
JSON export/import as backup. The only server component is a thin proxy that keeps the
Anthropic API key off the client.

## 2. Deviations from the brief — all deliberate, all recorded

The brief (§1) listed eight decisions marked "do not relitigate"; all eight are built
as specified. Three ambiguities were resolved with the owner before build and are
documented in `BRIEF.md §11`:

| # | Decision | What it means in code |
|---|----------|----------------------|
| A1 | **Hybrid i+1 + onboarding self-assessment** | Generation sends `studied_words` (words with cards) and `available_words` (seed backlog) as separate lists; the prompt draws predominantly from studied+new, uses available sparingly and always glossed. First launch swipes the seed deck know/don't-know; known words get one Easy FSRS review with due dates jittered over ~2 weeks (`knownCard()` in `src/lib/fsrs.ts`). |
| A2 | **New words debut in the passage, cards due next day** | `introduceWords()` creates cards due tomorrow 4am. The Review phase never shows a never-met card. Harvested words follow the same rule; harvesting past the daily cap sets `queuedAt` so the word wins tomorrow's selection. |
| A3 | **No streak** | Replaced with a weekly rhythm target (default 5/7, in Settings) and a full-history footpath with visible gaps. Nothing resets; the Hill never shrinks. |

Two further deviations made during the build:

- **Seed deck is 425 entries, not ~250.** Same schema and accuracy bar; a deeper
  backlog changes nothing about pacing (the 7/day cap drives that). Utara variants are
  restricted to well-attested forms (hang, hangpa, depa, pi, mai, awat, lagu mana,
  la ni, cek, besaq, ayaq, betui, habaq, keta).
- **Bilingual UI layer** (post-launch feedback): the brief assumed the owner could
  navigate Malay-first chrome; he starts from zero. Every label now pairs Malay
  (primary) with a muted English subtitle. Explanatory copy is plain English.

## 3. Architecture

```
Browser (PWA, offline-capable for reviews)
  React 18 + react-router (hash routing) + Tailwind v4
  Dexie (IndexedDB): words / cards / passages / sessions / settings
  ts-fsrs v5 scheduler (request_retention 0.90, fuzz on)
        │
        │  /api/generate, /api/grade  (Vite dev proxy → :8787)
        ▼
server/index.ts — single-file Hono app
  Injects system prompts, forwards to Anthropic /v1/messages
  Model: claude-sonnet-4-6 (CLAUDE_MODEL env var to swap)
  Defensive JSON parsing: strip fences → parse → one retry → 502
  Vercel-ready: `import { handle } from 'hono/vercel'; export default handle(app)`
```

### Data model notes (vs brief §3)

- `cards` carries the full ts-fsrs state (`elapsedDays`, `scheduledDays`,
  `learningSteps` added to the brief's schema) so round-tripping is lossless.
- `sessions.id === date` (YYYY-MM-DD) — makes creation idempotent under React
  StrictMode's doubled effects (this was a real bug, see §5).
- `sessions.dueAtStart` added to power the review-debt trend on Progress.
- `settings` gains `weeklyTargetDays` and `onboarded`.
- `words.queuedAt` implements the harvest-overflow queue.

### Key modules

| Path | Responsibility |
|------|----------------|
| `src/lib/fsrs.ts` | ts-fsrs adapter: card create/grade, interval previews for the 4 buttons, due queries, onboarding `knownCard()` |
| `src/lib/session.ts` | Daily orchestration: session row, new-word budget (cap shared between scheduled + harvested), backlog priority (queued → tag priority → seed order), harvest, weekly rhythm, history |
| `src/lib/api.ts` | Client for /api: topic rotation (no repeat in 7 days), passage cache per (date, register), register-toggle reuses same topic+new words, output-task prompt bank |
| `src/components/Hill.tsx` | Generative SVG: hills grow with studied-word count, milestone markers 100/250/500/1000 (proverb on full view), footpath from history, seeded PRNG so it's stable per count |
| `server/index.ts` | The entire backend |

### Session flow (routes)

`/onboarding` (once) → `/` Today → `/review?mode=full|sikit` → (full) `/read` →
`/speak` → `/?done=full|sikit` (plays the single 1.2s Hill growth animation —
deliberately the only extravagant motion; everything else is fast fades, with
`prefers-reduced-motion` respected throughout).

## 4. Acceptance criteria status (brief §10)

| Criterion | Status |
|-----------|--------|
| Full session 10–15 min; Sikit-je ≤5 | ✅ by construction (queue caps, one passage, one task) |
| FSRS state persists across restarts | ✅ Dexie; verified |
| Daily cap enforced across scheduled + harvested; overflow queues | ✅ `newWordBudgetRemaining()` is the single gate |
| Passage uses only known/new/whitelisted-function words, register toggle genuinely re-registers | ⚠️ prompt implements it (incl. A1 hybrid split); **needs live-key QA** — untested against the real model |
| Sikit-je day counts identically (rhythm/Hill) | ✅ `sessionCounts()` treats them the same |
| Installs as PWA, reviews work offline | ✅ vite-plugin-pwa, precached app shell; `/api` uncached by design |
| Zero API key exposure in client bundle | ✅ key lives only in server env; verified nothing in `dist/` |

## 5. Verification done (and bugs found by it)

- `tsc -b && vite build` clean.
- Playwright (headless Chromium, 390×844) drives the real app: onboarding swipe →
  Today → forced-due review card flip + grade → Words → Progress → Read failure
  state → Settings. All passing.
- Bugs caught this way, all fixed: missing `addedAt` Dexie index (blank onboarding);
  seed imported twice under StrictMode (fixed: deterministic `seed-<i>` ids +
  bulkPut in a transaction); duplicate session rows (fixed: id=date); flip-card
  height collapse (percentage height vs flex parent — now absolute-positioned).
- **Not verified:** live passage generation and grading (no API key in the build
  environment). First QA task: run a real session with a key and check register
  discipline, glossary coverage, and new-word min-occurrences (§5.2 constraints).

## 6. Running it

```sh
cp .env.example .env   # ANTHROPIC_API_KEY=sk-ant-...
npm install            # postinstall regenerates public/icons/ (gitignored, zero-dep PNG encoder in scripts/gen-icons.mjs)
npm run dev            # vite :5173 + hono :8787 via concurrently
```

`GET :8787/api/health` reports `{ok, model, keyConfigured}` — first stop when
generation fails. The server reads `.env` at startup only (hand-rolled loader, no
dotenv dep) — restart after editing.

## 7. Suggested next steps (not started)

1. **Live-key QA of generation quality** (see §5) — tune `GENERATE_SYSTEM` in
   `server/index.ts` if register discipline or vocabulary containment is loose.
2. **Deploy** — the owner wants this on a phone. Server drops into a Vercel function
   unchanged; client is a static build. Add basic auth or an allowlist since the
   proxy spends the owner's API credit.
3. **Seed-deck linguistic review** — a native/fluent speaker should sweep
   `src/data/seed.json` (425 entries, one per line). The accuracy bar in brief §6
   was followed (omission over invention) but a human pass is the right next check.
4. **Owner feedback loop** — he's reviewing the UI now; expect copy/UX iterations.

## 8. Commit history

| Commit | What |
|--------|------|
| `e8f72f0` | Full v1 build (everything in §1–§4) |
| `2705f6f` | Bilingual UI layer (English subtitles throughout) |

---

## 9. v1.1 — Remediation (see `docs/REMEDIATION-v1.1.md`)

Executed in full after the first live session exposed generation-quality failures:

- **P0.1 Difficulty ramp** — `src/lib/tier.ts` (shared client/server). Four tiers keyed
  to studied-word count; tier constraints are sent explicitly in every generation
  request. Tier 0 (≤24 words) = 15–35-word A/B dialogue, ≤3 new words/day, always-visible
  per-line English glosses, English comprehension question.
- **P0.2 Containment validator** — `server/validate.ts`, pure + unit-tested
  (`tests/p0.test.ts`, includes a regression test on the exact observed leak).
  Multi-word units fused before tokenising; proper-noun heuristic gives no free pass to
  sentence-initial capitals. 100%/95%/90% thresholds by tier; one feedback retry with the
  violating tokens; then best-of-two accepted with leaks auto-glossed and logged for QA.
- **P0.3 Selection diversity** — `src/lib/select.ts`, pure + unit-tested. Queued
  harvest → tag priority → seed order; max 2 per POS/day; contrast pairs
  (`CONTRAST_PAIRS`) never co-introduced; grammatical POS deprioritised while
  studied < 50 (the "first two weeks" made mechanical).
- **P1 design pass** — Hill rebuilt as earned-mound-vs-ghost-silhouette; surface system
  (`.panel/.panel-m/.panel-s/.paper`, white reserved for tile + passage, no shadows);
  poster headword at clamp(64px,18vw,96px); `SectionLabel` + `CornerMotif` (tile +
  completion only); nyonya marker-underline for new words; footpath-stone weekday row;
  SVG line icons in the tab bar; status chips (BARU/BELAJAR/MATANG) in Words.
- **P2** — register coverage hidden until 20 studied; re-runnable self-assessment from
  Settings (`/onboarding?redo=1`, backlog-only); spinner/cloud icons replace emoji;
  betul/tak comprehension self-mark stored on the session row (data only).

Old cached passages (pre-v1.1, no `lines`) degrade to a single prose block. Passage
generation quality still needs live-key QA — now against the tier-0 acceptance criteria.

| Commit | What |
|--------|------|
| (v1.1) | P0 ramp/validator/selection + P1 design pass + P2 fixes |
