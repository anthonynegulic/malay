# BUKIT — v1 Build Brief for Claude Code

> **Working name:** Bukit (Malay: "hill") — from the proverb *sedikit-sedikit, lama-lama jadi bukit* — "little by little, over time it becomes a hill." The entire product is this proverb, operationalised.

A personal Malay-learning tool for a single user (Ante), built around spaced repetition + AI-generated comprehensible input. Long-term fluency goal, anchored by a family relocation to Penang, Malaysia. This is not a Duolingo clone and not an Anki clone — it is a daily loop that a real product decision trail sits behind.

---

## 1. Decisions already made — do not relitigate

These were decided deliberately (PDR trail exists). Build to them exactly.

| # | Decision | Detail |
|---|----------|--------|
| D1 | **Register strategy** | Teach a *standard grammatical core* (bahasa baku), with every content item **register-tagged from day one**. Colloquial and northern (loghat utara / Penang) variants are stored alongside the baku form and surfaced in UI, never taught as the foundation. |
| D2 | **Core loop** | Fixed session order: **Retrieve → Absorb → Produce.** Reviews first (~5 min), generated reading second (~5–7 min), one output micro-task last (~3–5 min). Target session: 10–15 minutes. |
| D3 | **Bad-day mode is first-class** | A "Sikit je" ("just a little") session = reviews only, ≤20 cards, ~5 min, and it **counts as a completed day**. The user has a toddler and an infant; the bad day is Tuesday, not an edge case. |
| D4 | **New-word cap** | Default 7 new words/day, user-adjustable 3–10. Harvested words beyond the cap queue for tomorrow. This is the guard against the review-debt spiral. |
| D5 | **Scheduler** | FSRS, not SM-2. Use the `ts-fsrs` npm package. Desired retention 0.90. |
| D6 | **One card per word** | Recognition direction only (Malay → meaning) in the SRS. Production is trained in the daily output task, not via reversed cards. Deliberate call to keep review debt at half the naive design. |
| D7 | **Audio scope** | TTS-as-exposure is **in** (browser SpeechSynthesis, `ms-MY` voice where available, graceful absence otherwise). Speech recognition, pronunciation grading, and listening-comprehension exercises are **out** of v1. |
| D8 | **Content is generated, not authored** | Static lesson content is a non-goal. The Claude API generates i+1 reading passages calibrated to the user's exact known-word inventory. This is the product's reason to exist. |

---

## 2. Tech stack

- **Vite + React + TypeScript** (matches the user's existing pattern from DeadlineDay).
- **Tailwind CSS v4** with design tokens as CSS variables (tokens defined in §7 — derive everything from them).
- **Dexie (IndexedDB)** for local-first persistence. Single user, no auth, no accounts. Include a JSON **export/import backup** in Settings.
- **ts-fsrs** for scheduling.
- **PWA** via `vite-plugin-pwa` — installable on a phone; the daily session will mostly happen on mobile. Design mobile-first (~390px), scale up gracefully.
- **Thin API proxy server** (Hono or Express, single file) exposing `POST /api/generate` and `POST /api/grade`, forwarding to Anthropic `/v1/messages`. `ANTHROPIC_API_KEY` from `.env`, never shipped to the client. Dev: run client + server concurrently with a Vite proxy. Structure it so the server file can later be dropped into a Vercel function unchanged.
- **Model:** `claude-sonnet-4-6` for both generation and grading (single config constant so it can be swapped).

---

## 3. Data model (Dexie tables)

```ts
// words — the known-word inventory. The heart of the app.
{
  id: string
  baku: string                 // standard form: "pergi"
  colloquial?: string          // general colloquial: "pegi"
  utara?: string               // Penang/northern: "pi"
  pos: 'noun'|'verb'|'adj'|'adv'|'pronoun'|'particle'|'phrase'|'number'|'preposition'|'conjunction'
  gloss_en: string
  arabic_cognate?: string      // e.g. "وقت" for waktu — the user reads Arabic; this is a real accelerant
  example_baku: string
  example_colloq?: string
  tags: string[]               // domains: 'survival','food','masjid','school','family','numbers','time','market'
  source: 'seed' | 'harvested'
  addedAt: number
}

// cards — one per word (D6), FSRS state
{
  id: string
  wordId: string
  due: number
  stability: number
  difficulty: number
  reps: number
  lapses: number
  state: 'new'|'learning'|'review'|'relearning'
  lastReview?: number
}

// passages — generated reading, kept for re-reading
{
  id: string
  date: string                 // YYYY-MM-DD
  register: 'baku'|'colloquial'
  topic: string
  text: string
  translation: string
  glossary: { word: string; gloss: string }[]
  question: { prompt: string; answer: string }
  newWordIds: string[]
}

// sessions — one row per day
{
  id: string
  date: string
  type: 'full'|'reviews_only'
  reviewsDone: number
  newWordsLearned: number
  outputAttempted: boolean
}

// settings (single row)
{
  newWordsPerDay: number       // default 7
  registerPreference: 'baku'|'colloquial'   // reading register; default 'baku', toggleable per-passage
  ttsEnabled: boolean
  userContext: string          // short free-text bio used to personalise passage topics (see §5)
}
```

---

## 4. The daily loop (screens & flow)

Five screens. No more in v1.

### 4.1 Today (home)
- Greets with date + streak, shows **the Hill** (signature element, §7) and one primary action: **"Mula"** (Start) — or **"Sikit je"** as the quieter secondary action.
- Shows due-review count and today's new-word budget remaining.
- After session completion: the Hill grows with a single orchestrated animation. This is the emotional payoff moment of the app — spend the motion budget here.

### 4.2 Review (retrieve)
- FSRS due queue. Card = a **tile** (§7): Malay headword poster-large on the front; flip reveals gloss, example sentence, register variants, Arabic cognate when present, and a TTS play button.
- Grading: **Lagi / Susah / Okey / Senang** (Again / Hard / Good / Easy) — four buttons, thumb-reachable.
- A small register indicator on each tile: when a word has colloquial/utara variants, show them on the back as a "shutter" row: `baku pergi · colloq pegi · utara pi`.
- Session cap in Sikit-je mode: 20 cards, then done, celebrated exactly like a full session.

### 4.3 Read (absorb)
- One generated passage per day (see §5). 60–110 words, comfortable reading size, generous line height.
- **Tap-to-harvest:** any word tappable → popover with gloss (from passage glossary) → **"Tambah"** (Add) creates word + card, if within the daily cap; otherwise it queues with a gentle "esok" (tomorrow) note.
- New words for the day are pre-highlighted softly. A register toggle at the top of the passage regenerates it in the other register (same content, different register — this is the D1 payoff and a genuinely differentiating feature; cache both once generated).
- One comprehension question at the end (tap-to-reveal answer, self-graded honest/dishonest — no ceremony).

### 4.4 Speak/Write (produce)
- One micro-task: a situation prompt drawn from today's passage topic ("The mak cik at the pasar asks how many children you have. Answer in Malay.").
- User types a Malay response → `POST /api/grade` → returns: corrected version, one-line specific encouragement, and up to two error notes. **Lenient by instruction** — communication over perfection (grading prompt in §5.3).
- Skippable without guilt; skipping still completes a full session if reviews + reading are done.

### 4.5 Words & Progress
- **Words:** searchable browse of the inventory, filter by tag/register/source, per-word detail with all variants.
- **Progress:** the Hill at full size with milestone markers (100 / 250 / 500 / 1000 words — label the 1000 marker with the full proverb), streak footpath, review-debt indicator (due count trend), and register coverage (% of known words with colloquial/utara variants).

---

## 5. Claude API integration

### 5.1 Known-word inventory transmission
v1: send the full `baku` word list in the request (fine up to ~800 words; revisit if the inventory grows past that — then send frequency-banded samples plus a level descriptor).

### 5.2 Passage generation prompt (use verbatim as the base, tune as needed)

```
System:
You are a Malay-language content generator for a learner preparing to live in
Penang, Malaysia. You write short, natural, culturally grounded passages using
ONLY the vocabulary provided, plus basic function words (di, ke, dari, yang,
dan, atau, ini, itu, ada, dengan, untuk, pada, juga, sudah, belum, akan).
Register discipline is absolute: if register is "baku", write standard Malay
with full affixation; if "colloquial", write natural everyday Malaysian Malay
(dropped affixes, nak, tak, dah, particles lah/kan) but do NOT use northern
dialect forms unless they appear in the vocabulary list.
Respond with STRICT JSON only. No markdown, no preamble.

User:
{
  "known_words": [...],
  "new_words": ["pasar", "mahal", "murah"],   // 3–5, chosen by the app from the seed backlog by priority
  "register": "baku",
  "topic": "market",
  "user_context": "<settings.userContext>",
  "constraints": {
    "length_words": "60-110",
    "each_new_word_min_occurrences": 2
  }
}

Expected output JSON:
{
  "passage": "...",
  "translation": "...",
  "glossary": [{ "word": "...", "gloss": "..." }],
  "question": { "prompt": "...", "answer": "..." }
}
```

- **Topic rotation** (app-side, avoid repeating within 7 days): pasar / kopitiam / teksi-Grab / masjid / sekolah / cuaca / keluarga / makanan / kejiranan / urusan.
- `user_context` lets passages feature his actual life lightly (two young sons, coffee, market runs). Default seed for the settings field: *"Father of two young boys, loves specialty coffee, attends the masjid, planning life in Penang."*
- Parse defensively: strip code fences if present, try/catch JSON.parse, one retry on failure, then a friendly error state ("Tak boleh jana hari ini — cuba lagi" / Can't generate today — try again).

### 5.3 Grading prompt (output task)

```
System:
You are a warm, encouraging Malay tutor. The learner is a beginner. Grade for
COMMUNICATION, not perfection. If the meaning would be understood by a patient
native speaker, say so first. Return STRICT JSON:
{ "understood": true|false, "corrected": "...", "encouragement": "...",
  "notes": ["...", "..."] }   // max 2 notes, each one concrete fix
Never return more than 2 notes. Never lecture.
```

---

## 6. Seed deck

Generate **~250 items** as `src/data/seed.json` matching the `words` schema. Composition:

- **Survival core (~150):** greetings, numbers, time, food/ordering, market/haggling, directions/transport, family, common verbs, question words, yes/no/politeness.
- **Arabic-loanword head start (~50):** the user reads Arabic and converted to Islam ~8 years ago — these are near-free vocabulary. Include `arabic_cognate` for each. Must include: waktu, ilmu, dunia, sabar, kitab, masyarakat, selamat, khabar, maaf, syukur, doa, iman, wajib, halal, haram, zakat, sejarah, kerusi, and the prayer times (subuh, zohor, asar, maghrib, isyak) plus Jumaat.
- **Register showcase (~50):** words where baku/colloquial/utara meaningfully diverge, so the register system has teeth from day one.

**Northern (utara) variants to include where applicable** — only well-attested ones: *hang* (you), *hangpa* (you pl.), *depa* (they), *pi* (go), *mai* (come), *awat* (why), *lagu mana* (how), *la ni* (now).

Sample rows (follow this shape and quality exactly):

```json
[
  {
    "baku": "saya", "colloquial": "aku", "utara": "cek",
    "pos": "pronoun", "gloss_en": "I / me",
    "example_baku": "Saya tinggal di Pulau Pinang.",
    "example_colloq": "Aku tinggal kat Penang.",
    "tags": ["survival"], "source": "seed"
  },
  {
    "baku": "pergi", "colloquial": "pegi", "utara": "pi",
    "pos": "verb", "gloss_en": "to go",
    "example_baku": "Saya hendak pergi ke pasar.",
    "example_colloq": "Aku nak pi pasar.",
    "tags": ["survival"], "source": "seed"
  },
  {
    "baku": "waktu", "arabic_cognate": "وقت",
    "pos": "noun", "gloss_en": "time",
    "example_baku": "Sudah masuk waktu maghrib.",
    "example_colloq": "Dah masuk waktu maghrib.",
    "tags": ["masjid", "time"], "source": "seed"
  },
  {
    "baku": "berapa",
    "pos": "pronoun", "gloss_en": "how much / how many",
    "example_baku": "Berapa harga ini?",
    "example_colloq": "Berapa harga ni?",
    "tags": ["market", "survival"], "source": "seed"
  },
  {
    "baku": "lah",
    "pos": "particle", "gloss_en": "softening/emphasis particle",
    "example_baku": "Baiklah.",
    "example_colloq": "Okey lah!",
    "tags": ["survival"], "source": "seed"
  }
]
```

**Accuracy bar:** every example sentence must be natural, correct Malay. If uncertain about a form, prefer omission over invention. Do not fabricate utara variants.

---

## 7. Design system — "Rumah Api" direction

The user's brief: gorgeous palette, novel type, animation — *go crazy, but in one place.* The visual world is **Georgetown, Penang**: lime-washed shophouses, Peranakan tiles, the indigo of the Cheong Fatt Tze Blue Mansion, teal shutters, brass fittings. Daylight-tropical, not dusk (dusk belongs to another project of his). Explicitly avoid the stock AI looks: no warm-cream + terracotta serif, no black + acid green, no broadsheet hairlines.

### Tokens (CSS variables — derive everything from these)

```css
--mansion:   #2E4FA3;  /* Cheong Fatt Tze indigo — primary, used generously */
--limewash:  #F6F4EC;  /* background — cool lime-wash white, not warm cream */
--shutter:   #0F7B6F;  /* teal — success, TTS, secondary actions */
--nyonya:    #F2A0AC;  /* Peranakan pink — highlights, harvested-word marks */
--brass:     #C9A227;  /* sparing — streaks, milestones only */
--ink:       #1A2238;  /* text */
```

### Type
- **Display: Bricolage Grotesque** (Google Fonts) — the Malay headword on review tiles set poster-large (clamp ~64–96px), ExtraBold, tight tracking. The headword *is* the design.
- **Body: Instrument Sans** — passages and UI. Passages at a generous 20px/1.7.
- **Utility: IBM Plex Mono** — register tags, POS labels, counts. Register tags render as small mono chips: `BAKU` in mansion, `COLLOQ` in shutter, `UTARA` in nyonya.

### Signature element: the Hill
A generative SVG landscape on Today/Progress: layered hill silhouettes in the palette that **grow with total known-word count** — the structure literally encodes the data. Milestone markers at 100/250/500/1000; the 1000 marker carries the proverb in full. Streak renders as footpath stones climbing the hill. On session completion, the Hill grows with one sprung, orchestrated animation (~1.2s) — this is the only extravagant motion in the app.

### Other motion (quiet)
- Review tile: 3D flip on reveal (300ms). Register variants slide in like shutters.
- Everything else: fast fades. **Respect `prefers-reduced-motion`** — crossfade fallbacks throughout.

### Quality floor
Mobile-first, thumb-reachable grading buttons, visible keyboard focus, contrast-checked pairings (nyonya pink never carries text on limewash), empty states written as invitations ("Tiada kad hari ini — the queue is clear.").

---

## 8. Non-goals (v1)

No speech recognition or pronunciation grading. No listening-comprehension exercises. No accounts, sync, or multi-user. No gamification beyond streak + Hill (no XP, no leagues, no guilt notifications). No static lesson library. No Jawi script.

---

## 9. Build order

1. Scaffold: Vite + React + TS, Tailwind v4 tokens, fonts, Dexie schema, ts-fsrs wiring, proxy server with `/api/generate` + `/api/grade` stubs.
2. Seed deck (`seed.json`, ~250 items) + import-on-first-run.
3. Review screen: FSRS queue, tile flip, grading, Sikit-je cap.
4. Generation pipeline + Read screen + tap-to-harvest + register toggle.
5. Output task + grading.
6. Today screen: session orchestration, bad-day mode, completion moment (Hill growth).
7. Words browser + Progress screen.
8. TTS, PWA manifest/service worker, export/import backup, polish pass.

## 10. Acceptance criteria

- A full session (reviews → read → produce) completes in 10–15 minutes; Sikit-je in ≤5.
- FSRS state persists across restarts; review debt visible on Progress.
- Daily new-word cap enforced across both scheduled new cards and harvesting; overflow queues to tomorrow.
- A generated passage uses only known + new + whitelisted function words, in the requested register, and the register toggle produces a genuinely re-registered passage.
- Sikit-je day renders identically to a full day in streak/Hill terms.
- App installs as a PWA on a phone and works offline for reviews (generation obviously requires network).
- Zero raw API key exposure in the client bundle.

---

## 11. v1 Amendments (decided at build kickoff, 2026-07-08)

These supersede the sections they touch. PDR-style: decided deliberately, build to them exactly.

### A1 — Hybrid i+1 (amends §5.1, §5.2)
The generation request sends **two vocabulary lists**: `studied_words` (words with
cards — actually being studied) and `available_words` (seed backlog). The passage is
generated predominantly from studied + new words; available words are used sparingly
for naturalness and are ALWAYS glossed. Additionally, a **one-time onboarding
self-assessment** runs on first launch: the user swipes through the seed deck
(know / don't know); known words enter the SRS as studied (one Easy review applied,
due dates jittered across ~2 weeks to avoid a review lump). This seeds day-one
reviews honestly — the user has prior Ling exposure and reads Arabic.

### A2 — New words debut in the passage (amends §4.2, §4.3, D2 detail)
New words are introduced in the **Read (Absorb)** phase, pre-highlighted with
glossary support. Their cards are created on first successful generation with
**first review due the NEXT day** (~4am local). The Review phase is pure retrieval —
it never shows a never-met card. Scheduled new words and harvested words follow the
identical rule. Harvest beyond the daily cap queues the word for tomorrow's selection
(queued words take priority in the backlog ordering).

### A3 — No streak (amends §4.1, §4.5, acceptance criteria)
There is **no consecutive-day streak anywhere**. Replaced with:
(a) a **weekly rhythm target**, default 5/7 days, user-adjustable, shown as this
week's progress; (b) the footpath renders **full history with visible gaps** —
nothing resets on a missed day, no streak-freeze mechanics, no guilt copy. The Hill
never shrinks. A Sikit-je day counts identically to a full day for the rhythm.

Acceptance criteria updated accordingly: replace "Sikit-je day renders identically
to a full day in streak/Hill terms" with "…in weekly-rhythm/Hill terms".

### Build notes
- Seed deck shipped larger than the ~250 target (425 entries, same schema and
  accuracy bar) — deeper backlog, same cap-driven pacing.
- Model: `claude-sonnet-4-6` (verified current), single constant in `server/index.ts`
  (`CLAUDE_MODEL` env var to swap).
