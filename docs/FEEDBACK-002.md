# BUKIT — Feedback Round 2: Owner Rulings & Build Instructions

*13 July 2026 · follows several days of live daily use on iPhone (PWA). Same
precedence rule as before: where this conflicts with earlier docs, this wins.
Companion docs: `BRIEF.md`, `HANDOVER.md`, `bukit-v1.1-remediation.md`,
`bukit-pedagogy-response-001.md`.*

---

## R1 — Example sentences must be self-explanatory: label the registers inline

**Observed:** on review cards, the example block shows an italic baku sentence
with the colloquial rendering beneath it, unlabelled. On cards where the LOGHAT
ledger is absent or below the fold (*punya*, *kena*), the second sentence reads
as an unexplained duplicate — and on *kena*, where the sentences differ by one
word (saya → aku), it reads as a typo. Implicit structure does not survive on
cards where the explaining context is missing.

**Build:**
- Every example block labels its sentences inline with the existing tiny mono
  register chips: `BAKU` before the first sentence, `COLLOQ` before the second.
  Every card self-explanatory without scrolling.
- Where the colloquial sentence differs from the baku sentence by **one word
  only**, bold the differing word in both sentences. If they are identical,
  render the baku sentence once — never show a duplicate.
- The LOGHAT ledger stays as-is where variants exist; R1 is about the example
  block, not the ledger.

## R2 — Every example sentence carries its English gloss

**Observed:** example sentences render with no translation (the yellow-circled
gap). The design reference included the gloss line ("Saya hendak pergi ke
pasar" / *I want to go to the market*); it was dropped in implementation. At
the owner's tier, an unparseable example is dead weight.

**Build:** every example sentence — card backs, intro cards, recall pass, and
the Cakap pattern block — renders its English translation directly beneath it,
styled per R3.

## R3 — Global bilingual formatting rule

**Owner request:** English translations italicised and bracketed to separate
them from Malay. **Amended after discussion** because italic already belongs to
Malay example sentences; italicising English too would collide the two
languages into one style.

**The rule, applied app-wide:**
- **Malay carries the styling** — weight, italics, display size.
- **English is always roman, smaller, muted, and in brackets** when it follows
  Malay inline or on the next line. Example: `Langkau hari ini (skip today, no
  guilt)` with the bracketed text in the muted secondary colour.
- Mono section labels keep their existing `MALAY · ENGLISH` pattern unchanged.
- Sweep every screen for compliance; the mixed dot/dash separators currently in
  use are replaced by this one rule.

## R4 — Free practice mode ("Ulangkaji bebas") — APPROVED with a hard guardrail

**Owner request:** a Quizlet/Anki-style way to flip through already-studied
words from the Kata screen.

**Build:**
- Entry button on the Kata screen: `Ulangkaji bebas (free practice)`.
- Deck = studied words, filterable by the existing tag/status filters before
  starting. Shuffle order. Card front → tap to reveal → next. Uses the same
  card component as reviews.
- **Zero FSRS writes. Non-negotiable.** No grade buttons, no due-date changes,
  no stability updates — low-effort same-day flips would corrupt the scheduler
  (same principle as the recall pass ruling in pedagogy-response §1). Optional:
  a session-log row noting free practice happened, for the Kemajuan screen.
- Label the mode honestly on entry: one line — `Latihan sahaja — tidak mengubah
  jadual ulangkaji (practice only — doesn't change your review schedule)`.

## R5 — Grading prompt: usefulness over orthography

**Observed:** "Saya Makan Asam laksa" received two notes about capitalisation
and none about language. *Makan* unmarked for tense is correct Malay; the
valuable note was the optional time-marker pattern (*saya makan asam laksa
tadi*). The grader gravitates to orthographic trivia.

**Build:** add to `GRADE_SYSTEM` in `server/index.ts`: notes must prioritise
word choice, word order, and useful patterns over capitalisation, punctuation
or spelling unless meaning is affected; at most one orthography note, and only
when nothing more useful exists. Keep the 2-note cap and lenient tone.

## R6 — Verify FSRS learning-steps configuration

**Observed:** interval previews on first-day cards show `Okey · 10M` — Good
keeping a card in same-session minutes rather than graduating it toward ~1 day.
Possibly correct mid-learning-step behaviour; possibly a mis-config that will
balloon review time by week 3.

**Build:** audit `src/lib/fsrs.ts` learning-steps setup against ts-fsrs v5
defaults and the request_retention 0.90 config. Document the intended
progression (new → first Good → next due) in a code comment, and log a table of
button→interval for a fresh card, a 1-day card and a 7-day card to verify. Fix
if graduation is not occurring; report either way in the handover note.

## R7 — Register chips must be data-backed

**Observed:** the Kata list shows chips (e.g. UTARA on *mereka*) where the card
back renders no corresponding variant row. A chip is a promise; an unbacked
chip is a bug.

**Build:** chips render if and only if the underlying field is non-empty, in
both the Kata list and card backs. Add a one-off data sweep (script or console
report) listing any word where chip visibility and field presence disagree, and
fix the seed rows it finds.

## R8 — Small fixes

- **Hantar disabled state:** the send button on Cakap renders active while the
  textarea is empty. Disable (reduced opacity, no tap) until non-empty input.
- **TTS on the corrected sentence:** the grader's corrected Malay sentence on
  the Cakap result gets an audio button — it is exactly the sentence the
  learner should hear. Uses the existing voice/fallback logic.
- Sweep both fixes' surroundings for R3 formatting compliance while in there.

---

## Acceptance criteria

- No example sentence anywhere renders without (a) a register chip when a
  second sentence is present and (b) an English gloss per R3 styling.
- One-word-difference colloquial sentences bold the differing word; identical
  sentences never duplicate.
- Free practice writes no FSRS state (verify: run a free-practice session, dump
  the cards table before/after, diff is empty) and displays its "doesn't change
  your schedule" line.
- The grading prompt produces a language-level note, not a capitalisation note,
  for the test input "Saya Makan Asam laksa" against the eating prompt.
- The button→interval log for a fresh card shows graduation to ≥1 day on the
  Good path within the intended number of learning steps.
- Zero chip/field mismatches reported by the R7 sweep.
- Hantar is inert until input exists; corrected sentences are playable.
