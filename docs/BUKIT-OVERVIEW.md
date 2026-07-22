# Bukit — Complete Project Overview

> *Sedikit-sedikit, lama-lama jadi bukit* — "little by little, over time it becomes a hill."
> The entire product is this proverb, operationalised.

**Purpose of this document:** a single, ground-up summary of what Bukit is, why it
exists, how it works, and what state it is in — written to be handed to an outside
advisor (human or AI) with no prior context. Where useful it points at the source
files and the deeper design docs in `docs/`. It supersedes nothing; it synthesises
everything.

**Repository:** `anthonynegulic/malay`
**Status:** feature-complete v1.x; used daily by its single owner; runs deployed on
Vercel. The one persistent caveat throughout its history is that AI-generation
*quality* has only been lightly exercised against a live model key — the machinery is
built and unit-tested, but happy-path generation QA is the standing open item.

---

## 1. What Bukit is, in one paragraph

Bukit is a **personal, single-user, local-first Malay-learning web app (PWA)**. It is
built around a fixed daily loop — **Retrieve → Absorb → Produce** — that takes about
10–15 minutes: spaced-repetition vocabulary reviews (FSRS), then an **AI-generated
reading passage calibrated to exactly the words the learner already knows**, then one
lightly-graded speaking micro-task. It has **no accounts and no backend database** —
all data lives in the browser (IndexedDB), with JSON export/import as the only backup.
The single server component is a thin proxy that keeps the Anthropic API key off the
client. It was built for one specific learner (an adult beginner) preparing for a
family relocation to **Penang, Malaysia**.

---

## 2. Goals & guiding philosophy

**Primary goal.** Get one adult beginner from zero to functional, everyday Malay for
life in Penang — durable long-term fluency, not a quick phrasebook. There is a
concrete built-in milestone: a **December 2026 relocation-recon trip** used as the
app's informal exam (`src/lib/checkpoint.ts`): ~450 words known and five real-world
function checks (order food, direct a Grab driver, greet at the masjid, handle a
market purchase incl. prices, follow a simple overheard exchange).

**What makes it different from Duolingo/Anki.** Two convictions:

1. **Comprehensible input, generated per-learner.** Rather than static lessons, the
   Claude API writes a fresh *i+1* passage every day using **only** words the learner
   has already studied plus a few new ones — genuinely calibrated to that person's
   vocabulary. This is the product's reason to exist (brief decision **D8**).
2. **Respect for a real, busy life.** The owner has a toddler and an infant. A bad day
   is Tuesday, not an edge case. So a reduced **"Sikit je"** ("just a little") session —
   reviews only, ≤20 cards, ~5 minutes — **counts as a full day**. There is **no
   streak** to break; progress never resets.

**Design temperament.** Calm, fast, mobile-first, quietly opinionated. Minimal
motion. Bilingual chrome (Malay primary, muted English subtitle) because the learner
starts from zero. Accuracy over cleverness in the language content (omission over
invention).

---

## 3. The daily loop (the core concept)

A full session is a fixed order (brief decision **D2**):

1. **Ulangkaji — Retrieve (~5 min).** FSRS review queue. One card per word,
   recognition direction only (Malay → meaning). Four grading buttons (Again / Hard /
   Good / Easy) mapped to FSRS.
2. **Baca — Absorb (~5–7 min).** A generated reading passage in either **baku**
   (standard) or **colloquial** register, tightly constrained to the learner's known
   vocabulary. New words are introduced *here first* (with pre-teach intro cards, per-
   line audio, glosses), then tapped to "harvest" into the deck. A comprehension
   question and a one-line "grammar whisper" accompany it.
3. **Cakap — Produce (~3–5 min).** One output micro-task, graded **leniently for
   communication**, not perfection. The task is scaffolded by level (fill-in-the-blank
   at tier 0, sentence-starter at tier 1, open prompt above that). Followed by an
   optional ungraded **Recall** pass over the day's new words.

**Bad-day mode (D3).** "Sikit je" = reviews only, capped, ~5 min, counts fully.

**No streak (deviation A3).** Replaced by a **weekly rhythm target** (default 5 of 7
days) and a full-history footpath with visible, guilt-free gaps. Nothing ever shrinks.

---

## 4. The eight foundational product decisions

These were fixed up front and deliberately *not* relitigated (brief §1). An advisor
should treat them as the load-bearing walls:

| # | Decision | Summary |
|---|----------|---------|
| **D1** | **Register strategy** | Teach a standard grammatical core (*bahasa baku*); every item is register-tagged from day one. Colloquial and northern (*loghat utara* / Penang) variants are stored and surfaced, never taught as the foundation. |
| **D2** | **Core loop** | Fixed order Retrieve → Absorb → Produce, 10–15 min target. |
| **D3** | **Bad-day mode is first-class** | "Sikit je" reviews-only session counts as a full day. |
| **D4** | **New-word cap** | Default 7/day (adjustable 3–10). Overflow queues to tomorrow. This is the guard against a review-debt spiral. |
| **D5** | **Scheduler** | FSRS (via `ts-fsrs`), not SM-2. Desired retention 0.90, fuzz on. |
| **D6** | **One card per word** | Recognition only in the SRS; production is trained in the daily output task, not reversed cards. Halves review debt vs. the naive design. |
| **D7** | **Audio scope** | TTS-as-exposure is in (browser SpeechSynthesis, `ms-MY` where available). Speech recognition / pronunciation grading are out of v1. |
| **D8** | **Content is generated, not authored** | Static lessons are a non-goal. The Claude API generates calibrated i+1 passages. |

Three ambiguities were resolved with the owner before build (recorded as A1–A3): a
**hybrid i+1 + onboarding self-assessment**, **new words debut in the passage with
cards due next day**, and **no streak** (see §3). Full trail in `docs/BRIEF.md §11`.

---

## 5. The vocabulary model — the heart of the app

Everything keys off a **known-word inventory** (`words` table). Each word carries its
register variants and pedagogical metadata (`src/db/types.ts`):

- `baku` (standard form, e.g. *pergi*), optional `colloquial` (*pegi*) and `utara`
  (Penang/northern, *pi*)
- `pos`, `gloss_en`, optional `arabic_cognate` (the learner reads Arabic — a real
  accelerant, e.g. وقت for *waktu*)
- `example_baku`, `example_colloq` (+ their English glosses and honest register
  labels), `tags` (survival, food, masjid, school, family, numbers, time, market…)
- `source: 'seed' | 'harvested'`, `addedAt`, optional `queuedAt` (overflow queue)

**Seed deck:** **425 hand-built entries** (`src/data/seed.json`), one row per word.
Northern (utara) variants are restricted to well-attested forms (*hang, hangpa, depa,
pi, mai, awat, la ni, cek, besaq, ayaq, betui, habaq, keta*…). The deck is versioned
(`SEED_VERSION` + in-place migration) so content fixes reach live installs without
touching FSRS state. **A native-speaker linguistic review of the seed deck is a
standing recommended step.**

**Harvesting:** tapping a new word in a passage adds it to the deck. Harvesting past
the daily cap sets `queuedAt` so the word wins tomorrow's selection.

---

## 6. The difficulty ramp (tiers)

Passage difficulty is driven by **studied-word count**, not guesswork
(`src/lib/tier.ts`). The tier is sent **explicitly** to the model *and* enforced by a
server-side validator — the model never infers level from list sizes:

| Tier | Studied words | Passage | New words | Containment | Glosses | Question |
|------|---------------|---------|-----------|-------------|---------|----------|
| **0** | < 25 | 15–35-word A/B dialogue | ≤3 | **100%** | under every line | English |
| **1** | 25–74 | 30–60 words, either shape | ≤5 | 95% | tap per line | bilingual |
| **2** | 75–199 | 50–90 words | 5 | 95% | tap | bilingual |
| **3** | ≥ 200 | 60–110 words | 5 | 90% | one toggle | Malay |

"Containment" = the fraction of passage tokens that must fall inside the allowed set
(studied + today's new + a fixed function-word whitelist + proper nouns/numerals).

---

## 7. Screens (the app surface)

Hash-routed React screens (`src/screens/`). Navigation is a three-tab bar plus the
session flow:

| Screen | Route | What it does |
|--------|-------|--------------|
| **Onboarding** | `/onboarding` | One-question fast path — *Pernah belajar Bahasa Melayu?* "Brand new" → straight in at zero words; "I know some" → swipe the seed deck in batches of 30 (know/don't-know), known words seeded as Easy reviews jittered over ~2 weeks. Re-runnable from Settings (`?redo=1`). |
| **Today** | `/` | The home tile: what's due, start a **full** or **Sikit je** session, word-of-the-day, rhythm/ledger, gentle "may run long" note when a session projects over ~18 min. Plays the single completion animation. |
| **Review (Ulangkaji)** | `/review?mode=full\|sikit` | FSRS review cards. Indigo front shows the headword only; reveal flips to the meaning + register ledger; four grade buttons with interval previews. |
| **Read (Baca)** | `/read` | Pre-teach intro cards for today's new words → the generated passage (per-line audio, tap-to-reveal at tier 0, new words underlined, tap any word for a gloss) → comprehension question (type an answer, self-check, honest betul/tak self-mark) → grammar whisper. |
| **Speak (Cakap)** | `/speak` | One tier-scaffolded output task; the learner's sentence is graded leniently for communication, with a corrected version + ≤2 concrete notes and audio of the correction. |
| **Recall** | `/recall` | Optional ungraded flip pass over the day's new words. Zero FSRS writes. Skippable, no guilt. |
| **Words (Kata)** | `/words` | The deck browser: status chips (BARU / BELAJAR / MATANG), tag/status filters, example blocks with register chips, and **free practice** (shuffled flip-only review that never touches FSRS). |
| **Progress (Kemajuan)** | `/progress` | A display numeral + oxblood milestone bar, weekly-rhythm bars, the December-checkpoint target + function self-test, per-phase time averages, review-debt trend. No gamification. |
| **Settings (Tetapan)** | `/settings` | New-words/day, register preference, TTS mute, weekly target, user context, **JSON export/import backup**, re-run self-assessment, and a `binaan · build <sha> · <date>` stamp so deployment drift is visible from the phone. |
| **Practice** | `/practice` | Free/extra practice surface (flip-only, no FSRS writes). |

**Session route flow:** `/onboarding` (once) → `/` → `/review` → (full) `/read` →
`/speak` → `/recall` → back to `/` with the completion animation.

---

## 8. Key functional systems (where the logic lives)

| Module | Responsibility |
|--------|----------------|
| `src/lib/fsrs.ts` | ts-fsrs adapter: create/grade cards, 4-button interval previews, due queries, onboarding `knownCard()` seeding. |
| `src/lib/session.ts` | Daily orchestration: session row (idempotent, `id === date`), the single new-word budget shared across scheduled + harvested, backlog priority, weekly rhythm, history, day-0 routing. |
| `src/lib/tier.ts` | The four tiers + the function-word whitelist. Shared by client and server. |
| `src/lib/select.ts` | New-word selection: queued harvest → tag priority → seed order; max 2 per part-of-speech/day; never co-introduce known confusable pairs; deprioritise grammatical words in the first ~50. Pure + unit-tested. |
| `src/lib/api.ts` | Client for `/api`: topic rotation (no repeat within 7 days), passage cache per (date, register), register-toggle reuse, the output-task scaffold bank. |
| `src/lib/tts.ts` | Browser SpeechSynthesis wrapper (`ms-MY` where present, graceful absence otherwise). |
| `src/lib/backup.ts` | JSON export/import (import replaces all local data). |
| `src/lib/checkpoint.ts` | The December 2026 target + function checklist. |
| `server/app.ts` | The entire backend: system prompts, the Anthropic call, defensive JSON parsing, abuse guards. |
| `server/validate.ts` | Pure, unit-tested containment validator + grammar-whisper check. |

---

## 9. Architecture & tech stack

```
Browser (installable PWA, reviews work offline)
  Vite · React 18 · TypeScript · Tailwind v4 · react-router (hash routing)
  Dexie (IndexedDB): words / cards / passages / sessions / settings
  ts-fsrs v5 scheduler (retention 0.90, fuzz on)
  vite-plugin-pwa (precached shell; /api never cached)
        │
        │  POST /api/generate, POST /api/grade
        ▼
Thin Hono proxy  (server/app.ts)
  Local dev: server/index.ts on :8787 (Vite proxies /api)
  Production: pre-bundled into a Vercel serverless function (api/[...route].js)
  Injects system prompts → forwards to Anthropic /v1/messages
  Model: claude-sonnet-4-6 (CLAUDE_MODEL env var to swap)
```

- **Local-first, no accounts, no server DB.** IndexedDB is the only store. This is a
  deliberate v1 decision, and it is also the single biggest constraint on any future
  multi-user direction (see §12).
- **The proxy exists only to hide the API key.** It also carries the containment
  validator and the cost/abuse guards below.
- **Vercel build quirk (documented in `docs/DEPLOY.md`):** the function is built by
  pre-bundling `server/app.ts` into a dependency-free `api/_app.generated.js` and must
  stay plain `.js` with the classic `(req,res)` signature — two hard-won lessons.

---

## 10. Cost, abuse, and safety guards (current state)

The two model-calling routes (`/api/generate`, `/api/grade`) each spend the **owner's**
Anthropic credit, so `server/app.ts` layers:

- **Optional shared passphrase** (`APP_PASSPHRASE`) — the app prompts once, stores it
  in the browser, and sends it as a header; a visitor without it gets 401. This is the
  only *global* gate.
- **Per-IP fixed-window rate limit** (default 30/min) — in-memory, therefore
  per-warm-serverless-instance on Vercel. A backstop, explicitly *not* a real global
  quota.
- **Payload clamps** on list/string sizes so one crafted request can't inflate the
  prompt (and cost).

**Important for an advisor:** these guards are appropriate for a single trusted user.
They do **not** constitute a real multi-tenant cost model — see §12.

---

## 11. Generation & grading — how the AI is used

**Generation** (`GENERATE_SYSTEM` in `server/app.ts`): the model receives an explicit
tier with hard constraints and strict allow-lists (studied words, today's new words,
the function-word whitelist). It must return strict JSON: dialogue/prose lines with
per-line glosses, a whole-passage translation, a glossary, one comprehension question,
and one "grammar whisper" notice. The server then **validates** the output
(`server/validate.ts`): tokenise (fusing multi-word units), compute containment against
the tier threshold, check new-word minimum occurrences, and verify the grammar
whisper's form appears verbatim. On failure it retries **once** with the specific
violations fed back, then accepts best-of-two with any residual leaks auto-glossed and
logged for QA. Invalid notices are dropped rather than shipped.

**Grading** (`GRADE_SYSTEM`): a warm tutor graded for communication. Returns
`{understood, corrected, encouragement, notes[]}` with at most two concrete notes,
prioritising word choice / word order / reusable patterns over spelling and
punctuation.

**The standing open item across the whole project:** this generation/grading quality
has only been lightly exercised against a live key. The offline validator is
unit-tested (`tests/p0.test.ts`, including a regression test on a real observed leak),
and `scripts/verify-generation.mjs` / `npm run verify:glosses` exist to run live-key QA
— but a thorough happy-path pass with a real model remains the top recommended task.

---

## 12. Known limitations & the "going public" question

The owner has asked what it would take to release Bukit publicly / on an app store. The
honest summary (fuller analysis available on request):

1. **The economic model is the #1 blocker.** Every AI call spends the owner's single
   API key, gated only by a shared passphrase and an in-memory limiter. Any real
   audience requires a decision: **bring-your-own-key**, **accounts + metering +
   billing**, or **pre-generated/cached content**.
2. **Single-user by design.** No accounts, no sync; all data is per-device in
   IndexedDB (clearing the browser loses everything — export is the only backup).
   Persistent cross-device accounts mean a real backend build.
3. **Content is personalised to one learner** (Penang relocation, personal `userContext`,
   the seed deck's framing). Public use needs generic onboarding and delisting of
   personal content.
4. **Legal/compliance:** privacy policy, terms, data export/delete, licensing (repo is
   currently private with no LICENSE).
5. **App Store reality:** Bukit is a PWA. Google Play accepts it via a TWA wrapper with
   little change; Apple rejects thin web wrappers and would need a native shell
   (e.g. Capacitor) plus store-compliance work — and IAP if anything is charged.
6. **Abuse hardening** on a public money-spending endpoint (prompt-injection surface
   via user context/harvested words, a hard global spend cap, real per-user quotas).

---

## 13. Running it

```sh
cp .env.example .env    # add ANTHROPIC_API_KEY=sk-ant-...
npm install             # postinstall regenerates gitignored PWA icons
npm run dev             # web on :5173, API proxy on :8787
```

- `GET :8787/api/health` → `{ok, model, keyConfigured, gated, rateLimit}` — first stop
  when generation fails.
- Reviews and all local features work offline; passage generation and grading need the
  network + a configured key.
- Tests: `npm test` (P0 validator + scheduler). Data-integrity sweeps:
  `npm run check:seed`, `npm run verify:glosses` (needs a key), `node scripts/fsrs-audit.mjs`.
- Deploy: see `docs/DEPLOY.md` (Vercel, set env vars, mind the Production Branch).

---

## 14. Document map (for deeper reading)

| Doc | Contents |
|-----|----------|
| `docs/BRIEF.md` | The original product brief; §1 the eight decisions, §11 the A1–A3 rulings. |
| `docs/HANDOVER.md` | Chronological developer log — every build round, bug, and feedback cycle (the "how we got here" trail). |
| `docs/DEPLOY.md` | Vercel deployment, the build quirks, and the API-credit protection guidance. |
| `docs/PEDAGOGY-REVIEW-001.md` / `docs/PEDAGOGY-RESPONSE-001.md` | The pedagogy critique and the owner's rulings (lesson arc, grammar whisper, checkpoint). |
| `docs/UI-REVIEW-001.md` / `docs/UX-REVIEW-001.md` | Design/UX reviews behind the "Mansion" visual system. |
| `docs/FEEDBACK-002.md` | R1–R8 feedback after several days of live use. |
| `docs/REMEDIATION-v1.1.md` | The P0 generation-quality remediation (ramp, validator, selection). |
| `docs/HARDENING-AUDIT-001.md` | The cost/abuse hardening audit behind §10. |

---

*This overview reflects the project as of the current branch. It is a synthesis for
handover; the per-round detail and decision trail live in the documents above.*
