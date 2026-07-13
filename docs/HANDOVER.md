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

---

## 10. v1.1 — Remediation, revised (supersedes §9; see `docs/REMEDIATION-v1.1.md`)

The owner replaced the earlier v1.1 note with a revised brief. Two changes vs §9:

**The Hill and the Peranakan motif are deleted, not restyled.** `src/components/Hill.tsx`
is removed; `CornerMotif` is gone from `ui.tsx`. The name Bukit and the proverb survive as
language (Today/Progress footer), not illustration. Progress is now a display numeral + an
oxblood milestone bar. The app contains no illustration of any kind (the launcher icon is a
flat geometric mark).

**Full design rebuild — "Mansion".** The Rumah Api palette is replaced entirely by the
Mansion tokens (`src/styles.css` `@theme`): indigo is a *field* (headers, review front),
never a button; gold and oxblood are the action colours. Two surfaces only — indigo field
and plaster page — separated by charcoal rules and hairlines; no cards, no shadows. Every
label follows the signage rule `MALAY · english` (`Label` in `ui.tsx`). Register chips are a
three-colour language (BAKU jade, COLLOQ oxblood, UTARA gold). Screen-by-screen per P1.5:
Today (indigo header + word-of-the-day, progress/rhythm/ledger on plaster), Review
(indigo front headword-only → plaster back with the register ledger), Read (gold underline
for new words, tier gloss), Words (BARU/BELAJAR/MATANG status chips), Progress (numeral +
bar), tab bar indigo with third tab **Kemajuan · progress**.

P0 (ramp/validator/selection) was already built in §9 and is unchanged — it matches the
revised P0 verbatim. P2 items all done.

**Interpretations made (documented for override):**
- "Exactly one gold element per screen" read as *one gold fill/action*, with gold permitted
  as accents (date, audio icons, milestone ticks) where P1.5 calls for them.
- The 300ms flip is implemented as a 300ms shrink+reveal (headword persists and shrinks, per
  P1.5) rather than a 3D flip; `prefers-reduced-motion` → instant.
- Word of the day: deterministic by date, studied-words-first, seed fallback.

**Not verified — needs a live key.** Acceptance criterion P0.4 (generate at 2/30/150 studied
words, all pass their tier's containment) cannot run here (no `ANTHROPIC_API_KEY`).
`scripts/verify-generation.mjs` runs it: `npm run dev:api` then `node scripts/verify-generation.mjs`.
The offline validator is unit-tested (`tests/p0.test.ts`, incl. the observed leak).

| Commit | What |
|--------|------|
| (v1.1) | P0 ramp/validator/selection + Mansion design rebuild (Hill deleted) + P2 |

---

## 11. Feedback round 001 (10 Jul 2026) — first live QA

The owner ran the deployed app (Vercel) as a zero-Malay beginner. Five changes came
out of it, all shipped:

1. **Onboarding fast-path.** The all-425-word self-assessment was far too long for the
   target user. First screen is now one question — *Pernah belajar Bahasa Melayu?* —
   with "brand new" going straight into the app at zero words. "I know some" leads to
   the old card review, now dealt in batches of 30 with an explicit "cukup — start
   learning" exit between batches. Reassess-from-Settings (`?redo=1`) unchanged.
2. **Settings entry relabelled.** The header "gear" icon read as a sun / light-mode
   toggle (circle with rays — a fair reading). Replaced with an explicit
   `tetapan · settings` text label per the signage system. `GearIcon` is now unused.
3. **Reading page explainer.** One muted sentence above the passage: new words are
   underlined, everything else uses only studied words, tap any word for meaning.
4. **Typed comprehension answers.** The question block now has a text input: type,
   `Semak · check` reveals your answer beside the correct one, then the existing
   betul/tak self-mark (still logged to the session). A "just show it" escape stays
   for tap-only users. Recall stays honest without an API round-trip.
5. **Tier-ramped speaking task** (`SpeakTask` in `src/lib/api.ts`). The static English
   situations demanded open production on day 0 ("The driver asks where you're from —
   answer in Malay"). Now: tier 0 = full Malay pattern with one `___` blank + gloss
   (fill it your way); tier 1 = situation + Malay sentence starter; tiers 2–3 = the
   original open prompts. The grader is told what scaffold the learner saw, so it
   grades against the intended task. Speak reads the tier from card count at runtime.

## 12. Lesson-arc sprint + feedback round 002 (13 Jul 2026)

Two owner documents landed together and govern this round:
[`docs/PEDAGOGY-RESPONSE-001.md`](PEDAGOGY-RESPONSE-001.md) (rulings on the pedagogy
review — built FIRST per the owner) and [`docs/FEEDBACK-002.md`](FEEDBACK-002.md)
(R1–R8 after several days of live use). Everything below is shipped and
browser-verified end-to-end (Playwright against the built PWA; generation stubbed —
still needs one live-API pass).

### Lesson arc (pedagogy-response §5.1–5.2)

- **Day-0 routing:** on the very first session with an empty queue, `Mula` goes
  straight to the reading (`isFirstEverSession()` in `src/lib/session.ts`); later
  empty days keep the friendly empty state.
- **Pre-teach intro cards** (`Read.tsx`): before the passage first renders, today's
  new words appear one at a time — word, bracketed gloss, register chips, audio,
  example block. Shown once per day (`localStorage bukit-intro-<date>`).
- **Ungraded recall pass** (`src/screens/Recall.tsx`, shared `FlipDeck` component):
  Speak → Recall → Siap. Today's new words, front → try → reveal → next. No grade
  buttons, zero FSRS writes (verified by diffing the cards table before/after);
  only `session.recallDone` is written. Skippable, no guilt.
- **Register toggle** hidden below tier 1. **Word of the day** on day 0 draws the
  head of the backlog captioned `KATA PERTAMA ANDA · YOUR FIRST WORD`.
- **Grammar whisper:** generation now returns one `notice` {form, note}; the server
  validates the form appears verbatim in the passage (`noticeValid`, tested), retries
  once with feedback, drops an invalid notice rather than shipping it. Rendered under
  the passage as `PERHATIKAN · NOTICE`.
- **Audio now:** per-line TTS buttons at every tier; tier 0 reveals lines one at a
  time (tap to advance), auto-plays each exactly once, tap the line's speaker to
  replay; global mute toggle in the reading header (persists to settings); no-ms-voice
  devices degrade gracefully with a one-time notice.
- **Session-time budget (§4.1):** sessions log `reviewMs/readMs/speakMs`; Kemajuan
  shows the recent per-phase average; Today shows a gentle "may run long — Sikit je
  also counts" note when the projection exceeds 18 min. Never blocks.
- **December checkpoint (§4.2):** `src/lib/checkpoint.ts` (target 450 words by
  1 Dec 2026 — owner-adjustable constant), trailing 12-week rhythm bars, and the
  5-item function self-test checklist (self-marked, stored in settings) on Kemajuan.
- Shadowing (§1-Q3) is **not** in this round — sequenced third by the owner, after
  audio. On the roadmap ledger with listen-first mode and EN→MS cards.

### Feedback-002 rulings

- **R1/R2/R3:** shared `ExampleBlock` (`RegisterChip.tsx`) labels example sentences
  with register chips, bolds a one-word difference in both sentences, never renders
  duplicates, and prints the English gloss bracketed/roman/muted beneath. All 425
  seed rows carry an authored `example_en`; three divergent-meaning colloquial
  sentences (sekejap/duduk/guru) carry their own `example_colloq_en`; 14 sentences
  using northern forms are chip-labelled `UTARA` (Q2 ruling). `Bi` in `ui.tsx` is the
  app-wide R3 primitive; every screen swept (mono `MALAY · ENGLISH` signage kept).
  **Owner review path:** `npm run verify:glosses` (needs `ANTHROPIC_API_KEY`)
  round-trips gloss → back-translation → divergence judge and writes
  `scripts/gloss-verification-report.json`; review flagged rows only.
- **Seed migration (Q1):** `SEED_VERSION`/`migrateSeed()` in `src/db/db.ts` patch
  `seed-*` rows in place on upgrade — cards/FSRS untouched, patched rows logged.
  Bump `SEED_VERSION` whenever `seed.json` content changes.
- **R4:** `Ulangkaji bebas` on Kata (honours active tag/status filters), shuffled,
  flip-only via the same `FlipDeck`; zero FSRS writes verified; logs
  `session.freePracticeRuns`.
- **R5:** `GRADE_SYSTEM` (`server/app.ts` — note: app.ts, not index.ts) now
  prioritises word choice/order/patterns; capitalisation-punctuation-spelling notes
  only when meaning changes, max one, and only when nothing more useful exists.
  Not yet exercised against a live key — test with "Saya Makan Asam laksa".
- **R6 verdict: not a bug.** `Okey · 10M` on a first-day card is correct
  mid-learning-step behaviour. ts-fsrs v5 defaults: learning steps 1m → 10m; the
  session re-queues sub-10-minute learning cards, and the second Good graduates to
  ~2 days (audit table: `node scripts/fsrs-audit.mjs`; progression documented in
  `src/lib/fsrs.ts`). Fresh card: Again 1m / Hard 6m / Good 10m / Easy 8d. Good-path:
  10m → 2d → 11d → 46d. No config change made or needed.
- **R7:** chips already render iff the field is non-empty in both list and card
  backs; `npm run check:seed` sweeps the data (empty-string fields, duplicate
  examples, mislabelled utara) — currently zero findings. The owner's observed
  chip-without-row was almost certainly **stale on-device seed data**, which the Q1
  migration now fixes.
- **R8:** corrected Cakap sentences have an audio button. The Hantar disabled state
  **already shipped in commit 9fbaa64** (Feedback 001) — the live PWA predates it.
- **Q4 deployment drift:** Settings now footers `binaan · build <sha> · <date>`
  (`__BUILD_COMMIT__` via Vite define; Vercel uses `VERCEL_GIT_COMMIT_SHA`).
  **Owner action:** redeploy, then check the stamp on the phone matches the latest
  commit before re-testing R7/R8a. Vercel's dashboard couldn't be checked from this
  environment.

### Verification done this round

`tsc -b`, `npm run build`, `npx tsx tests/p0.test.ts` (incl. new `noticeValid`
tests), `npm run check:seed`, `node scripts/fsrs-audit.mjs`, and a Playwright
end-to-end drive of the built PWA: onboarding → day-0 routing → intro cards →
tier-0 tap-to-advance → grammar whisper → Hantar disabled/enabled → recall pass
(zero-write diff) → free practice (zero-write diff) → utara chips on *mereka* →
in-place seed migration of a regressed row → Settings build stamp.
