# BUKIT v1.1 — Remediation Brief

Post-first-live-session fixes. Priority order is load-bearing: P0 blocks real daily use, P1 is the design pass, P2 is polish. Read alongside `docs/BRIEF.md` and `HANDOVER.md`.

---

## P0 — Generation difficulty ramp + containment enforcement

**Observed failure (2026-07-09, first live passage):** user had 2 studied words; generator produced a 110-word baku prose passage using vocabulary far outside the inventory (*bersyukur, rezeki, iaitu, terkenal, gemar…*), and the day's 5 new words were all pronouns including the kami/kita contrast. Root causes: (a) the 60–110 word length floor is mathematically incompatible with a tiny inventory, forcing vocabulary leakage regardless of prompt wording; (b) containment was requested, never enforced; (c) new-word selection walks seed order, which front-loads the pronoun paradigm.

### P0.1 Difficulty ramp (keyed to studied-word count)

| Studied words | Format | Length | Max new words/day | Support |
|---|---|---|---|---|
| 0–24 | Mini-dialogue, 4–6 short lines (A/B speakers) | 15–35 words total | 3 | English gloss rendered under **every line**, always visible. Comprehension question asked **in English**. Each new word appears ≥3 times. |
| 25–74 | Dialogue or 2-paragraph micro-scene | 30–60 words | 5 | Per-sentence tap-to-reveal gloss. Question bilingual. |
| 75–199 | Short prose or dialogue | 50–90 words | up to cap | Tap-to-reveal per sentence. Question in Malay with English subtitle. |
| 200+ | As originally specced | 60–110 words | up to cap | Original behaviour (translation behind one toggle, question in Malay). |

- Send the tier and its constraints explicitly in the generation request; do not rely on the model inferring level from list sizes.
- Dialogue format at the early tiers is deliberate: short lines, natural repetition, easier parsing than prose.
- The register toggle continues to work at all tiers.

### P0.2 Containment validator (server-side, hard gate)

After generation, tokenise the passage: lowercase, strip punctuation, treat multi-word inventory items ("kamu semua", "terima kasih") as single units before word-splitting.

- **Allowed set:** studied words + today's new words + the function-word whitelist (brief §5.2) + proper nouns (Penang, Georgetown, names) + numerals.
- Tier 0–24: require **100%** containment. Tier 25–199: ≥95%. Tier 200+: ≥90%.
- On failure: regenerate **once**, feeding back the exact violating tokens ("Do not use: …"). If it fails again: accept the better of the two attempts, auto-add every out-of-set word to the glossary, and log the violation list to console for QA.
- Also validate: each new word meets its minimum-occurrence count; register discipline (no utara forms unless in the vocabulary list).

### P0.3 New-word selection rules

Replace naive seed-order selection with, in priority order: queued harvested words → tag priority (survival > food/market > time/numbers > family > masjid > rest) → **diversity constraints**: max 2 words of the same POS per day; never introduce both members of a contrast pair (kami/kita, ini/itu, bawa/ambil) on the same day; prefer concrete nouns/verbs/phrases over grammatical words in the first two weeks. Re-order or annotate the seed file with a `priority` field if simpler than computing this at runtime.

---

## P1 — Design pass

**Diagnosis, so the fix targets the disease:** the current UI is the default AI look — uniform white rounded cards on a beige field, the palette reduced to "primary buttons are indigo," no poster typography anywhere, and a signature element (the Hill) that reads as anonymous humps. The design tokens exist; they are not being *used as a system*. Every item below is specific and checkable.

### P1.1 The Hill — redesign, don't polish

The metaphor is currently inverted: at 2 studied words the screen shows fully-formed mountains with milestone pins. Rebuild it as:

- **The earned mound:** a small, solid foreground hill whose height/width scales with studied-word count. At day zero it is a genuinely small mound — that is the point, and the proverb caption carries it.
- **The aspiration silhouette:** behind it, a faint dotted/ghosted outline of the full bukit (the 1000-word shape). The user sees what they've built *against* what they're climbing toward. Growth = the solid shape filling the ghost.
- **Footpath:** stones wind up the earned mound, one per practised day (full history, gaps visible as missing stones — A3 unchanged). Same stone motif as the Today weekday row (see P1.3).
- **Scene composition:** anchor the hill full-bleed against a pale sky band (a barely-blue tint of limewash, not white), brass sun, 2–3 layered ridgelines using shutter-teal and mansion tints with atmospheric depth (further = lighter). Subtle SVG grain/texture on the earned mound so it feels drawn, not plotted.
- **Next milestone** labelled on the ghost outline ("100 · bukit kecil"); passed milestones become small brass flags on the earned mound.
- The 1.2s growth animation on session completion targets the earned mound only.

### P1.2 Typography & surfaces (global)

- **Review tile:** Malay headword in Bricolage Grotesque ExtraBold at poster scale — clamp(64px, 18vw, 96px) — per the original brief. This screen should feel like a Georgetown shop sign, not a flashcard.
- **Kill the uniform white card.** Allowed surfaces: (a) limewash background with an **ink hairline border** and generous radius for primary content; (b) tinted panels (mansion at ~6–8% opacity, shutter at ~6%) for secondary blocks; (c) white reserved for the review tile and passage only, so it reads as "paper." No default shadows — depth comes from borders and tint, not blur.
- **Section labels:** IBM Plex Mono smallcaps style with a short rule, in the existing `SITUASI · THE SITUATION` pattern — this pattern is already good; apply it consistently and colour the mono label by context (mansion/shutter/nyonya).
- **Register chips everywhere a variant appears:** mono, colour-coded — BAKU mansion, COLLOQ shutter, UTARA nyonya — as specified in brief §7.
- **Peranakan corner motif:** a single small tile-corner SVG ornament (two concentric quarter-arcs in mansion + nyonya) used on exactly two surfaces: the review tile and the session-complete moment. Nowhere else — one signature, executed well, beats sprinkled decoration.

### P1.3 Screen-specific

- **Today:** hill scene anchored to the top (full-bleed), content below it — no floating. Weekday indicators become footpath stones (filled = practised, outline = future, gap = missed), matching the Hill's language. The two stat tiles become one compact strip (due count · new-word budget) with mono labels. Fix the dead space below "Sikit je" — the screen should end where the content ends.
- **Read:** passage typography is already the best thing in the app; keep it. Add the tier-appropriate gloss treatment from P0.1. New-word highlight moves from pink blocks to a nyonya underline/marker treatment — the current blocks read as errors.
- **Speak/Write:** fine structurally; apply surface rules. Keep "skip today, no guilt."
- **Words:** studied/unstudied state is currently two ambiguous dots — replace with a small mono status chip (BARU / BELAJAR / MATANG) and show register variant availability with the colour-coded chips.
- **Settings:** apply surface rules; otherwise fine.

### P1.4 What not to do

No gradients-as-decoration, no glassmorphism, no emoji as icons (replace 🏔/📖/🪨 in the tab bar with simple line icons in the palette), no shadow stacks, no new colours outside the token set.

---

## P2 — Small fixes

- Hide the "register coverage %" stat until studied ≥ 20 (currently shows a meaningless 100% at n=2).
- Onboarding: allow re-running the self-assessment from Settings ("Tanda kata yang anda tahu") so early-known words can be marked without waiting for the SRS.
- Loading state ("Menjana bacaan hari ini…"): keep, but bilingual line order should match the app convention (Malay primary, English subtitle) — it already does; just ensure the writing-hand emoji follows the P1.4 icon rule.
- Comprehension answer reveal: after reveal, offer a one-tap "betul / tak" self-mark so sessions can log comprehension honestly (data only, no gating).

## Acceptance criteria (additions)

- A day-zero user (≤5 studied words) receives a dialogue of ≤35 words with 100% vocabulary containment, ≤3 new words, visible English glosses per line, and an English comprehension question.
- No day introduces more than 2 words of the same POS, and never both members of a defined contrast pair.
- The Hill at 2 studied words renders as a small solid mound against a ghost silhouette, and visibly differs from the Hill at 50 words.
- No screen contains more than one white card surface; every mono section label uses the established pattern.
- Tab bar contains no emoji.
