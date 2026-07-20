# UI Review 001 — visual craft, all screens

Companion to UX-REVIEW-001 (behaviour and flows). This review is about the
*visual layer*: the token system, type scale, component consistency, spacing,
and per-screen finish. Method: live captures at 390×844 and 320×690, including
states the first pass missed — review card front/back with the grade grid,
expanded Words rows, FlipDeck reveal, and narrow-viewport onboarding.

## Verdict up front

The "Mansion" identity is genuinely strong: one display face doing poster
duty, indigo as a ground rather than a button, hairline rules instead of
cards, a single action colour. Screens are unmistakably one app, and the
review-card front (headword alone on indigo) is the best single view in the
build. The issues below are mostly about the system being *stretched* — a
small set of tokens carrying too many meanings — and about inconsistencies
between screens that the system itself is good enough to expose.

## 1. The token system is overloaded

### 1.1 One chip shape, four meanings
`RegisterChip`, `StatusChip` (Words), the A/B speaker tags (Read dialogue),
and the EN gloss toggle all share the identical form: tiny uppercase mono,
2px radius, filled ground. In a Words row they collide directly — `COLLOQ
UTARA MATANG` reads as three chips of the same class, but two are registers
and one is a study status (`Words.tsx:139-143`). MATANG is filled indigo,
which sits next to oxblood COLLOQ and gold UTARA as if it were a fourth
register. Suggest one differentiator: registers stay filled, statuses go
outline-only (or move status to the left of the row). Down a 425-row list
this repetition is also the loudest thing on the page — consider showing
variant chips only in the expanded state and keeping the collapsed row to
headword + gloss + status.

### 1.2 Colour semantics double-booked
Documented in `styles.css` and visible in practice:

- **jade** = BAKU register *and* the Senang grade. On the review back they
  appear ~200px apart: a jade BAKU chip above a filled jade Senang button.
- **oxblood** = COLLOQ register, progress fill, "today" outline, the Lagi
  grade, and harvest confirmations.
- **gold** = the action colour, but also UTARA, audio icons, milestone
  accents, and the section label colour for "arab" / "perhatikan".

Two of these are fine; five is a lot for a learner who is being taught that
chip colour *means register*. The cheapest fix is to take the grade buttons
out of the register palette (all-outline grades, oxblood reserved for Lagi's
text only — already half true) so jade/oxblood/gold stay register-pure in
learning surfaces.

### 1.3 `.mono` vs `.mono-sm`
10px vs 9.5px (`styles.css:41-54`) — a 0.5px distinction no screen renders
meaningfully. Collapse to one token, or make the step real (e.g. 11px / 9px)
and reserve the small one for non-interactive signage only (see UX H3/H4 for
the accessibility side of this).

## 2. Type scale drifts between screens

- Big-stat numerals have no shared size: Words header "425" is inline-styled
  40px (`Words.tsx:61`), Progress "5" is 64px (`Progress.tsx:78`), Today's
  "Siap." is 46px, word-of-the-day 66px, ledger stats `text-2xl`. These are
  the same semantic element at five ad-hoc sizes, all as magic numbers in
  `style={{}}` rather than tokens. Define 2–3 display steps (`display-lg`,
  `display-md`, `display-sm`) and use them everywhere.
- Example sentences (the most repeated content object in the app) render at
  three sizes: 20px `.passage` in Read, default 16px on the review back, and
  `text-sm` (14px) in Words expanded rows. Pick two: reading size and
  reference size.
- Settings header sets the title twice — `TETAPAN · SETTINGS` signage
  immediately above a display "Tetapan" (`Settings.tsx:40-41`). Every other
  tab header uses signage + *content* (a numeral, a name); this one repeats
  the same word in both slots.

## 3. Component consistency

### 3.1 Primary buttons: three label conventions
All primaries are gold/charcoal-border/4px-radius — good. But the label
anatomy varies: Today's "Mula" uses the display face with a mono sublabel;
Onboarding's use display-xl with mono sublabels; FlipDeck/Speak use
`font-medium` body with inline bracketed English; Read's error "Cuba lagi"
puts the sublabel *inline*, which wraps to two ragged lines at 390px
(observed: "Cuba lagi (TRY / AGAIN)"). Standardise on one anatomy —
`font-medium` Malay + mono sublabel on its own line is the most robust —
and never inline the bracket inside a button that can compress.

### 3.2 Buttons lack horizontal padding
Primaries are `w-full` with `py-*` only. At 320px, onboarding's "Belum —
saya baru bermula" display text runs to within a few px of the button edge
and its sublabel wraps mid-word (observed live). Add `px-4` to every full-
width button so compressed labels breathe.

### 3.3 Native controls unstyled
The Settings sliders are native ranges with only `accent-oxblood` — the
track/thumb are stock browser chrome inside an otherwise fully drawn system.
The textareas (Settings, Speak) show the browser resize grip in the corner;
`resize-none` (they're already sized right) would clean both. Low effort,
visible polish.

### 3.4 Separator grammar
The signage separator is `·` everywhere except the Speak header, which mixes
slashes and the dot: `CAKAP / TULIS · SPEAK / WRITE` (`Speak.tsx:70`). Fine
to keep the slash *inside* one language, but the current string reads as
four items. Consider `CAKAP·TULIS · SPEAK·WRITE` or just `CAKAP · SPEAK`.

## 4. Per-screen visual notes

**Today** — The indigo header's height swings hugely with content: a
two-line 66px headword plus example block ("kamu semua" day, observed) makes
the header ~60% of the viewport, pushing Mula below the fold; the "Siap."
state is half that height. Cap the phrase case harder (multi-word headwords
could drop to ~44px) so the header stays inside a predictable band. Also
three renderings of the same fact within 60px: "5 / 100 kata", "next · 100",
"5 words learned" (see UX doc, Low).

**Review (back)** — Short cards leave a large dead zone between the example
block and the bottom-pinned grade bar (observed: ~700px of empty plaster on
"dia"). Bottom-pinned grades are right for thumb reach; consider letting the
content column vertically centre in the leftover space, or pulling the
variant ledger/arabic sections down toward the grades. Grade grid: Senang
filled jade while the other three are outline (UX M6 covers the behavioural
risk; visually it also breaks the "one filled action per view" rule the rest
of the app follows — the filled slot here isn't the primary action).

**Read** — The tap-word affordance is invisible: passage words are buttons
but carry no visual hint until pressed (`active:bg-gold/15`), and the intro
paragraph has to *explain* tappability in English. A hairline dotted
underline on glossary words (the ones with known glosses) would let the UI
say it. New-word gold underline (`.mark-new`) is excellent. Error state: see
3.1 for the wrapping button.

**Words** — Filter chips clip mid-shape at the right edge with no scroll
affordance; the cut chip does hint scrollability, but an edge fade
(`mask-image` gradient) is cheap and cleaner. Two chip rows + a full-width
practice button + list = four competing horizontal bands before content;
the practice button could sit lighter (text link) to let the list lead.
Expanded row exposes the raw source enum — `PRONOUN · SURVIVAL · SEED` —
"seed" is an internal value; map to copy ("asas · core") or drop it. The
expanded panel has no ground shift, so its content visually belongs to the
rows below; a subtle inset border-l (as the example block already does) or
`bg-charcoal/[0.03]` would contain it.

**Progress** — Checklist checkboxes use `items-center`, so on two-line
items the box floats between lines (observed on "Beri salam dan berbual…");
`items-start` + small top margin fixes it. Square motifs come in three
subtly different weights: weekday squares (1.5px border, 24px), footpath
squares (1px, 14px), checklist boxes (1.5px, 16px) — harmonise borders at
1.5px. Empty 12-week chart: see UX M5.

**Onboarding** — The know/don't-know card is the system at its best
(poster headword, chip ledger, split Belum/Tahu bar). At 320px the header
title wraps fine but the primary button needs 3.2's padding. The
Belum/Tahu split button: Tahu (jade, right) is filled while Belum is not —
same "filled = most clicked" nudge as the grade grid, here probably
harmless but note the pattern.

**Practice / Recall interstitials** — Full-indigo screens with one numeral
and two lines of text centred in ~70% empty field. The emptiness is on-brand
but these two screens are the only ones without any signage rule or
structure; a hairline rule above the button block (as Review's front has via
the plaster button) would tie them in.

**NavBar** — `KEMAJUAN · PROGRESS` touches the right edge at 390px, clips
below ~380px (UX M8). Visually the tab bar also sits flush indigo-on-indigo
when the Words/Progress header is indigo too — a 1px `indigo-rl` top border
on the nav would separate it from same-colour grounds.

## 5. Small wins list

1. `resize-none` on both textareas; style the range inputs. (3.3)
2. `px-4` on all full-width buttons; sublabels never inline. (3.1/3.2)
3. Outline status chips vs filled register chips. (1.1)
4. One display-size scale, applied to the five stat surfaces. (2)
5. `items-start` on Progress checklist rows; 1.5px borders on all squares.
6. Edge fade on Words chip rows; map or drop the `seed` source label.
7. Top hairline on NavBar; drop English tab labels below 400px.
8. Dotted underline on tappable glossed words in Read.

Positives to preserve: the headword-fits-width logic (`Headword`), the gold
new-word underline, the 1.5px-border language, chip radius discipline
(2px chips / 4px buttons), stroke-1.7 icon set, the reveal/fade motion
timing with reduced-motion fallbacks, and the indigo-as-wall rule itself.
