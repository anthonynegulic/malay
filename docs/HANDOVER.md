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

---

## 12. Pedagogy round 001 (10 Jul 2026) — lesson arc + audio

Built to `docs/PEDAGOGY-RESPONSE-001.md` (the owner's rulings on
`docs/PEDAGOGY-REVIEW-001.md`; its §7 records the four build rulings). Two of the
response's three sprints shipped together:

**Sprint 1 — the shape of a lesson:**
- **Day-0 fast path:** empty queue before any day has ever counted → "Mula" routes
  straight into the reading (`Review.tsx` + `hasEverCompletedSession()`). Later
  empty days keep the friendly empty state.
- **Pre-teach intro cards** (`Read.tsx`): today's new words shown as intro cards
  during the generation wait (selection is deterministic, so the preview costs
  nothing and matches the passage). First generation of the day only.
- **Ungraded recall pass** (`Recall.tsx`, `/recall`, after Speak): front → recall →
  reveal → next. No grade buttons, no FSRS writes; 60s cap at a card boundary;
  first-class skip. Logs `recallDone` + `recallMs` only.
- **Register gating:** the BAKU/TUKAR control hidden below tier 1; tier 0 forces
  baku regardless of `registerPreference`.
- **Word-of-day caption:** before any word is studied, the Today poster word is
  today's first upcoming pick, captioned `KATA PERTAMA ANDA · your first word`.
- **Grammar whisper:** generation returns one `notice` {form, note}; server strips
  it unless the form appears verbatim in the passage (`noticeFormInPassage`,
  unit-tested + route-tested). Rendered as one quiet `PERHATIKAN · notice` line.
- **Session-time budget (§4.1):** session rows log `reviewMs/readMs/speakMs/recallMs`;
  Kemajuan shows the recent per-phase average; Today shows a gentle Sikit-je note
  when the projected session exceeds ~18 min (never blocks).
- **December checkpoint (§4.2):** `src/lib/checkpoint.ts` — 450 words by
  1 Dec 2026, trailing-12-week rhythm bars, and the five-item self-test checklist
  (self-marked, stored in settings) on Kemajuan.

**Sprint 2 — audio:**
- `tts.ts` rebuilt: voice preference **ms-MY → ms → id** with the kind tracked;
  session-scoped **senyap** mute (one tap in the Read header); `speak()` end
  callbacks + `stopSpeaking()`.
- **Tier-0 tap-to-advance** (ruling R1): "Dengar · listen" starts and plays line 1;
  each tap reveals + auto-plays the next; transcript accumulates with per-line
  replay. No voice / muted → full render, no autoplay.
- **Per-line TTS buttons** on dialogue lines at all tiers; prose keeps a
  whole-passage play.
- One-time notices: Indonesian-fallback voice (first playback) and no-voice
  degradation. Active voice inspectable in Settings.

**Deferred (roadmap):** shadowing (pending a week of real tier-0 audio to
calibrate the 1.5× pause), listen-first reading mode, EN→MS production cards at
tier 2, TTS API evaluation.

**Verification:** `tsc -b` + vite build clean; `tests/p0.test.ts` (incl. new
notice-validator cases) and `tests/generate-route.test.ts` (offline route tests:
mocked model, containment retry + notice strip/pass paths) all green. **Live
P0.4 rerun still needs a key** — this environment has no `ANTHROPIC_API_KEY`;
run `npm run dev:api` + `node scripts/verify-generation.mjs` (now also prints
the notice) after deploy. The containment validator itself is untouched by this
round; the only generation-pipeline change is the additive `notice` field.
