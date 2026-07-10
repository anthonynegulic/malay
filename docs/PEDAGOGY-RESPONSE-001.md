# BUKIT — Pedagogy Review 001: Owner Response & Build Instructions

*10 July 2026 · responds to `PEDAGOGYREVIEW001.md`. Where this document and the
review disagree, this document wins. Companion docs: `HANDOVER.md`, `BRIEF.md`,
`bukit-v1.1-remediation.md`.*

---

## 1. Rulings on the three open questions

### Q1 — Cards-start-tomorrow: KEEP. Recall pass: BUILD, but ungraded.

The overnight gap before the first *scheduled* FSRS test stays. Do not create
same-day FSRS reviews.

The end-of-lesson recall pass is approved with one hard constraint: **it must not
touch the scheduler.** No Lagi/Susah/Okey/Senang buttons — a grade given three
minutes after first exposure is nearly always "Good" and would inflate the
stability estimate for a word the learner barely knows. The pass is: card front →
try to recall → tap to reveal → next. Guess, reveal, move on. No data written
except (optionally) a session-log flag that the pass was completed.

- Scope: today's new words only (scheduled + harvested). Cap ~60 seconds.
- Skippable, no guilt, same pattern as the speaking task.

### Q1a — Amendment to the review's shape: pre-teach as well as recall.

The review places the "here are your words" moment only at the lesson's end. Add
a mirror of it at the **start of the reading**: before the passage renders, show
today's 2–3 new words as simple intro cards — word, gloss, register chip, audio —
ten seconds total, then the passage. Pre-teaching vocabulary before reading is
one of the best-evidenced moves in comprehension pedagogy and directly fixes the
"thrown in the deep end" feeling.

The full arc within one lesson becomes: **exposure (intro cards) → context
(passage) → retrieval (recall pass)** — with the first *graded* test still
tomorrow. This is an amendment to decision A2, not a reversal: the Review phase
stays pure retrieval; cards still debut in tomorrow's queue.

*Owner note: this amendment gets recorded as a PDR (change to a recorded
decision), not made silently.*

### Q2 — Tier-0 without audio: NOT acceptable. Fix is cheap; do it now.

Audio-as-exposure was already decision D7; it never reached the reading. Build:

- **Per-line TTS buttons** on every dialogue line at all tiers.
- **Tier 0 additionally auto-plays each line once** as it appears; tap to replay.
  Listening leads at tier 0 for the price of an afternoon.
- Respect a global mute quickly reachable from the reading screen.

Known limitation to code around, not against: browser SpeechSynthesis Malay
voices vary by platform (iOS serviceable, Android device-dependent). Detect
availability of an `ms-MY` voice; if absent, degrade gracefully (buttons hidden,
one-time notice). Treat TTS as phoneme-mapping exposure, not listening training.
The "listen first, then reveal text" mode at higher tiers stays on the roadmap;
when built, evaluate a proper TTS API rather than the browser voice.

### Q3 — Shadowing UX: play → pause → speak. The pause is the feature.

Approved as item 3 in sequencing, after audio exists. Spec:

- Play the model line → hold a **silent gap of ~1.5× the line's audio duration**
  with a "giliran anda · your turn" indicator → offer replay. Up to 3 reps per
  line, learner-controlled. Short lines only (the dialogue format already fits).
- **Never gate progression on it.** No speech recognition anywhere — the review's
  instinct is correct; Malay ASR is too unreliable to grade against and grading
  would raise the affective filter the design deliberately keeps low.
- Self-recording (MediaRecorder) is **opt-in**, playback-compare only, no
  judgement attached, nothing uploaded.
- **"Senyap · quiet mode" skip is first-class:** one tap, no guilt copy, and it
  remembers itself for the rest of the session. Sessions happen around a sleeping
  infant; a speaking-aloud feature without a quiet path will silently die. Same
  philosophy as Sikit je.

---

## 2. Rulings on §3 first-run seams

1. **Day-0 empty review** — approved as described: when the queue is empty AND no
   session has ever been completed, "Mula" routes straight into the reading. (An
   empty queue on a later day keeps the current friendly empty state.)
2. **New words never introduced** — solved by §1/§1a above.
3. **Register toggle gating** — approved: hide the BAKU/TUKAR control until
   tier 1 (25+ studied words). At tier 0 everything is baku; the concept debuts
   when the learner has context to want it.
4. **Word of the day on day 0** — **caption, don't suppress.** The poster word is
   the best thing on the Today screen; hiding it from a first-time user wastes
   the first impression. Day 0 (and any day the user hasn't yet studied words):
   draw it from today's upcoming new words and caption it
   `KATA PERTAMA ANDA · YOUR FIRST WORD`. Thereafter: drawn from the studied
   deck as normal.

---

## 3. Rulings on the §4 gap table

| # | Review's gap | Ruling |
|---|--------------|--------|
| 1 | Listening weakest limb | Agreed. §1-Q2 closes most of it now; listen-first mode stays on roadmap. |
| 2 | No same-day retrieval | Agreed. Built as §1-Q1/Q1a. |
| 3 | Speak is typing | Agreed. Shadowing per §1-Q3, sequenced third. |
| 4 | Grammar 100% implicit | **Endorsed more strongly than the review.** Build the grammar whisper now, not opportunistically: add a `notice` field to the generation JSON — exactly one observation per passage, drawn from that day's text, plain language, no terminology ("*nak* = want to — you'll hear this constantly"). Render as a single quiet line after the passage, mono label `PERHATIKAN · NOTICE`. Validator: the noticed form must actually appear in the passage. |
| 5 | Recognition-only cards | Correctly deferred. Revisit at tier 2. Ledger, not sprint. |

---

## 4. Two items the review missed — add to its ledger

### 4.1 Session-time budget is a design constraint, not a hope

Pre-teach (+~15s), recall pass (+~60s), and later shadowing (+1–2 min) all spend
from the 15-minute ceiling, while the review queue grows week by week. Rules:

- Recall pass hard-capped at 60 seconds.
- Log per-phase durations in the session row (`reviewMs`, `readMs`, `speakMs`)
  so drift is visible on the Kemajuan screen, not discovered by resentment.
- If a full session projects past ~18 minutes (due count × observed per-card
  time), surface a gentle pre-session note offering Sikit je. Never block.

### 4.2 December checkpoint — define success now

The relocation-recon trip (December 2026) is the app's built-in exam. Add a
static checkpoint definition (constant or settings JSON, shown on Kemajuan):

- **Volume:** studied-word count target (owner to set; suggest 400–500 by
  1 December ≈ 5–7 words/day × 5 days/week).
- **Consistency:** weekly-rhythm trend visible for the trailing 12 weeks.
- **Function (self-test, checklist rendered in-app, self-marked):** order food
  for the family; direct a Grab driver; greet and small-talk at the masjid;
  handle a market purchase incl. prices; understand a simple overheard exchange.

No gamification around it — it is a list and a date. The owner marks it in
Penang.

---

## 5. Sequencing (supersedes the review's §5)

1. **Lesson-arc fix** — day-0 routing, pre-teach intro cards, ungraded recall
   pass, register-toggle gating, word-of-day caption, grammar whisper. One
   coherent sprint: it is all "the shape of a lesson."
2. **Audio now** — per-line TTS, tier-0 autoplay, voice detection/degradation.
3. **Shadowing** — per §1-Q3, including senyap mode.
4. Roadmap ledger: listen-first reading mode, production (EN→MS) cards at
   tier 2, TTS API evaluation.

---

## 6. Acceptance criteria (additions)

- The recall pass writes no FSRS state and renders no grade buttons.
- A day-0 user tapping Mula reaches the reading without seeing an empty review
  state; on all subsequent days with an empty queue the friendly empty state
  remains.
- Every passage line has a working TTS control when an `ms-MY` voice exists;
  tier 0 auto-plays each line exactly once; absence of a voice degrades without
  errors.
- The register toggle is not rendered below tier 1.
- Each generated passage includes exactly one `notice`, and the noticed form
  appears verbatim in the passage (validator-enforced).
- Session rows record per-phase durations.
- Shadowing (when built): never gates progression; senyap skip persists for the
  session; recording is opt-in and local-only.
- The Kemajuan screen renders the December checkpoint: target, trailing rhythm,
  and the self-test checklist.

---

## 7. Build rulings (10 Jul 2026, decided with the owner at build kickoff)

Four questions raised against this document before the build; rulings recorded
here so the trail stays in one place.

### R1 — Tier-0 autoplay is tap-to-advance reveal (shapes §1-Q2)

"Auto-plays each line as it appears" is implemented as progressive reveal,
tier 0 only:

- A **"Dengar · listen"** tap starts the reading (satisfies the browser's
  user-gesture requirement) and reveals + plays line 1.
- Each subsequent tap reveals the next line, which auto-plays once on reveal.
  The transcript accumulates; every revealed line has a replay button.
- Fallbacks: no usable voice, or audio muted/senyap → tier 0 falls back to
  full-passage render with no autoplay. Reading never depends on audio.
- Tiers 1+: full render, per-line TTS buttons.
- Rationale for the record: syncs audio to the line the learner is actually
  reading, and establishes the interaction pattern that listen-first mode and
  shadowing will reuse.

### R2 — Indonesian voice fallback stays (amends §1-Q2 and §6)

Voice preference order: **ms-MY → any ms → id**, selection tracked. Conditions:

- One-time notice on first id-voice playback: "Audio is using an Indonesian
  voice — very close to Malay, with small pronunciation differences." Dismiss
  once, never again.
- The active voice is inspectable in Settings (read-only line under Audio TTS).
- **Acceptance criterion amended:** audio controls are hidden only when NO ms
  or id voice exists (was: no ms-MY voice).

### R3 — December checkpoint volume target: 450 studied words by 1 Dec 2026

Owner-set per §4.2 ("suggest 400–500"). Encoded in `src/lib/checkpoint.ts`.

### R4 — Sequencing: sprints 1+2 built together; shadowing deferred

Lesson-arc fix and audio shipped in one build (the pre-teach intro cards carry
their audio buttons from the start). Shadowing (§1-Q3) is deferred to the next
round, pending one week of real tier-0 audio use to calibrate the pause
multiplier (currently a 1.5× guess).

### Acceptance-criterion note on the grammar whisper (§6)

"Each generated passage includes exactly one `notice`" is enforced as: the model
is instructed to produce exactly one; the verbatim-form check rides the existing
containment retry; a still-invalid notice is **stripped rather than regenerated**
(not worth a third model call). Net criterion: **an unvalidated notice never
renders** — a rare passage may ship without one.
