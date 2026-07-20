# UX Review 001 — all screens

> **Status:** H1–H5, M1–M9, and the Today/Settings duplication items were
> fixed on this branch (see `git log` for the three fix commits). Still open:
> the Low-tier notes on slider labelling, passage button semantics for screen
> readers, popover copy, and system-back behaviour in sessions.

Reviewed: Onboarding, Today, Review, Read, Speak, Recall, Practice, Words,
Progress, Settings, plus NavBar and the shared FlipDeck/ui components.
Method: full code read + live run at 390×844 (Chromium), seeded DB, no API key
(so the Read error state was exercised for real). Findings are ordered by
severity; each carries a file reference.

## What's working

Worth saying first, because most of it should not be touched:

- The bilingual signage system (`Label` / `Bi`, Malay primary, bracketed muted
  English) is consistent everywhere and does real pedagogical work.
- The design language is coherent and distinctive — indigo as a wall, gold as
  the single action colour, rules instead of cards. Screens are recognisably
  one app.
- Interval previews on the grade buttons, reduced-motion handling, visible
  keyboard focus, `safe-area-inset` on the nav, the sikit-je / "skip today, no
  guilt" paths, batch pauses in onboarding, and the harvest popover flow are
  all genuinely good UX.
- Empty and error states exist nearly everywhere (Review empty queue, Read
  generation failure, Practice empty filter) rather than blank screens.

## High

### H1 — Import JSON destroys all data with zero confirmation
`src/screens/Settings.tsx:146` — tapping **Import JSON** opens the file picker
directly, and choosing a file immediately replaces the entire database
(cards, FSRS history, harvested words). One mis-tap plus one file selection
loses months of scheduling state, and there is no export-first prompt.
Fix: confirmation step that states what will be lost, ideally with an
automatic export of the current data before the import runs.

### H2 — Review progress counter can exceed its total
`src/screens/Review.tsx:70-74,121` — `graded` increments on every grade, and
Again/Hard on learning cards re-appends the card to the queue, but `total` is
frozen at the initial queue size. A 10-card session with relearns shows
"11 / 10", "12 / 10"… Either count unique cards, or recompute the denominator
as `graded + queue.length`.

### H3 — Legibility floor: 9.5–10px uppercase mono on primary controls
`src/styles.css:41-54` — `.mono` (10px) and `.mono-sm` (9.5px) are used not
just for signage but for tap controls: the nav tab labels, `← keluar · exit`,
`tetapan · settings`, `tutup · close`, the grade-button sublabels. Measured
contrast makes it worse at these sizes:

| pair | ratio | WCAG AA (normal text: 4.5) |
|---|---|---|
| muted `#6f6a5e` on plaster `#efe9da` | ≈ 4.4:1 | borderline fail |
| indigo-lo `#93a6d2` on indigo `#2b4c9b` | ≈ 3.3:1 | fail |
| gold `#c8912f` on indigo `#2b4c9b` | ≈ 2.9:1 | fail (even large-text) |

Gold-on-indigo is the *progress counter and date* on Today and every card
front. Suggest: raise `.mono` to ≥11px for interactive elements, and brighten
gold/indigo-lo variants used on indigo grounds.

### H4 — Tap targets far below 44px
Same elements as H3: the header text links (`keluar · exit`,
`tetapan · settings`, `tutup · close`) are bare 10px text with no padding —
roughly 14px tall. Inline TTS speaker buttons in the passage are `w-4 h-4`
(16px). The EN gloss toggles are similar. On a phone these are the most
frequently used controls in a session. Add generous padding / min-height
(44×44 effective) even if the visual glyph stays small.

### H5 — Blank screen while loading, worst on first launch
Observed live: the very first load renders a fully blank plaster page while
425 seed words are written to IndexedDB (`App.tsx:67` returns `null`; same
pattern in Review, Progress, Settings, Words, Practice, Recall). On a slow
phone this is several seconds of "is it broken?". The app already has a
`.spinner` — use it as the suspense fallback everywhere a screen returns
`null` today.

## Medium

### M1 — Onboarding self-assessment has no undo
`src/screens/Onboarding.tsx:42-53` — during the 425-word know/don't-know pass
a mis-tap on **Tahu** silently creates a "known" card and advances; there is
no back button and no way to review what you marked. Add a one-step undo
(← back re-showing the previous word and reversing its card).

### M2 — Words: 425 flat rows, no virtualisation, no result count
`src/screens/Words.tsx:128` — the full inventory renders as one unvirtualised
list (the live page is ~43,000px tall). Search and filters work, but there's
no match count ("no matches" only appears at zero), no grouping, and scroll
fatigue is real. Suggest: virtualise or paginate, show `N padanan` above the
list. Also two naming inconsistencies: the status chip says **BARU** but the
filter for the same set says **backlog** (and is the only English-only chip).

### M3 — "Mula" with an empty queue lands on an empty state
`src/screens/Today.tsx:62-65` — the day-0 routing (straight to Read when
due = 0) only applies to the first-ever session. On any later day with a
clear queue, **Mula** opens Review's empty state and the user must tap
"Teruskan ke bacaan". Route `due === 0 → /read` unconditionally.

### M4 — Progress: milestone fraction and bar disagree
`src/screens/Progress.tsx:91-99` — the header reads "5 / 100" but the bar
width is computed against 1000, so at 100 words the text says complete while
the bar shows 10%. The tick labels explain it, but fraction and bar sit on
different scales in the same figure. Either fill to the *next milestone* or
label the bar `/1000`.

### M5 — Progress: empty-chart noise and touch-inaccessible tooltips
`Progress.tsx:203-217` — "rentak 12 minggu" draws 12 near-empty 6%-height
bars before any history exists (looks like a broken chart — confirmed live).
Hide until ≥1 non-zero week, as debt-trend already does with `length > 1`.
Debt-trend bars and footpath squares carry `title=` tooltips only — invisible
on touch; surface the number in text or on tap.

### M6 — Review grades: the easiest grade is the loudest button
`Review.tsx:219-222` — "Senang" is the only filled button (jade) in the 2×2
grid; "Okey", the grade most reviews should get, is a plain outline. Visual
salience nudges toward grade inflation, which corrupts FSRS scheduling. Give
the filled treatment to Okey (or none), keep Senang quiet. Also consider that
2×2 places Lagi directly above Okey — a mis-tap swaps the two most opposite
grades; a single row in severity order is harder to fumble.

### M7 — Read: repeated English coaching text and jargon in the error state
`Read.tsx:347-351` — the "A short reading written just for you… Tap any word"
paragraph is English-only and shows every single day; collapse it after the
first few sessions (same daily-key trick as the intro cards). The error state
mentions `ANTHROPIC_API_KEY` (`Read.tsx:304-307`) — fine for the developer,
noise for anyone else; move the detail behind the retry. Also "Selesai
(finish)" in the error state records the day as a completed sikit session
(`Read.tsx:316`) even when nothing was reviewed or read.

### M8 — NavBar labels at the clipping edge
`src/components/NavBar.tsx:27-30` — at 390px "KEMAJUAN · PROGRESS" touches
the screen edge (visible in every live capture); at 360/320px widths it will
truncate. Drop the English on narrow screens (`hidden min-[400px]:inline`) or
shorten to icon + Malay only.

### M9 — Speak: one-shot grading, no second attempt
`src/screens/Speak.tsx:126-163` — after feedback the only action is "Selesai
hari ini". The pedagogical moment ("now say it right") has no affordance:
offer "Cuba lagi" to resubmit an improved sentence against the same
situation. Minor: typed drafts are lost without warning on `← keluar`.

## Low

- **Today, duplicated stats**: "5 / 100 kata", "next · 100", and "5 words
  learned" say the same thing three ways within 60px (`Today.tsx:140-151`).
  One fraction + one caption is enough. The `history` state loaded at
  `Today.tsx:48` is never rendered — dead fetch.
- **Settings, doubled title**: the header shows `TETAPAN · SETTINGS` and
  `Tetapan` directly beneath (`Settings.tsx:40-41`).
- **Settings, silent save**: the "Konteks anda" textarea saves on blur with
  no confirmation flash; sliders have no programmatic label (the `Label`
  component is a span, not a `<label for=…>`), so screen readers announce
  bare ranges.
- **Passage as button soup**: every word is its own `<button>`
  (`Read.tsx:163-177`) — hundreds of unlabeled stops for a screen reader.
  Consider a single interactive region with word-level hit detection, or at
  least `aria-label` context per button.
- **Popover copy**: "No gloss available." offers Tambah anyway; say the gloss
  will be fetched when harvested rather than sounding like a dead end.
- **Session screens vs system back**: exits use `navigate(replace)` and the
  custom `keluar` link; the browser/Android back gesture leaves mid-session
  without laying down history the way the visible controls do. Worth a pass
  once real-device testing starts.

## Suggested order of attack

1. H1 (data loss) and H2 (counter bug) — small diffs, high stakes.
2. H3/H4 together — one styling pass over `.mono` sizes, indigo-ground
   colour variants, and control padding.
3. H5 + M3 + M8 — loading fallback, empty-queue routing, nav clipping.
4. The M-tier polish as sessions allow.
