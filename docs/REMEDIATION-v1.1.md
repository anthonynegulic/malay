# BUKIT v1.1 — Remediation Brief

Supersedes all earlier v1.1 notes. Read alongside `docs/BRIEF.md` and `HANDOVER.md`.

Two independent workstreams. **P0 is a correctness fix and blocks daily use — do it first and verify it before touching the UI.** P1 is a design rebuild, not a reskin. P2 is polish.

**Deleted from the original brief, by owner decision:** the Hill (§7 signature element, §4.1, §4.5) and the Peranakan tile/corner motif. Both are removed entirely — not restyled. The `Hill.tsx` component and all references to it should be deleted, not hidden. The *name* Bukit and the proverb remain; they survive as language, not as illustration. Rationale: an ornament that requires adjacent text to explain what it means is not conveying information. Progress is now a number and a bar.

---

## P0 — Generation difficulty ramp + containment enforcement

**Observed failure (first live passage, 2026-07-09):** the user had 2 studied words; the generator produced a 110-word baku prose passage using vocabulary far outside the inventory (*bersyukur, rezeki, iaitu, terkenal, gemar*), and the day's 5 new words were all pronouns, including the kami/kita inclusive-exclusive contrast.

Root causes: (a) the 60–110 word length floor is mathematically incompatible with a tiny inventory, so vocabulary leakage is *forced* regardless of prompt wording; (b) containment was requested in the prompt but never enforced in code; (c) new-word selection walks seed order, which front-loads the pronoun paradigm.

### P0.1 Difficulty ramp, keyed to studied-word count

| Studied words | Format | Length | Max new/day | Support |
|---|---|---|---|---|
| 0–24 | Mini-dialogue, 4–6 short lines (A/B speakers) | 15–35 words | 3 | English gloss under **every line**, always visible. Comprehension question in **English**. Each new word appears ≥3×. |
| 25–74 | Dialogue or 2-paragraph micro-scene | 30–60 words | 5 | Per-sentence tap-to-reveal gloss. Bilingual question. |
| 75–199 | Short prose or dialogue | 50–90 words | up to cap | Tap-to-reveal per sentence. Malay question, English subtitle. |
| 200+ | As originally specced | 60–110 words | up to cap | Original behaviour. |

Send the tier and its constraints explicitly in the request; never rely on the model inferring level from list sizes. Dialogue at early tiers is deliberate — short lines, natural repetition, easier parsing than prose. The register toggle works at all tiers.

### P0.2 Containment validator (server-side, hard gate)

After generation, tokenise: lowercase, strip punctuation, match multi-word inventory items ("kamu semua", "terima kasih") as single units *before* word-splitting.

- **Allowed set** = studied words + today's new words + function-word whitelist (brief §5.2) + proper nouns + numerals.
- Containment required: **100%** at tier 0–24; ≥95% at 25–199; ≥90% at 200+.
- On failure: regenerate **once**, feeding back the exact violating tokens ("Do not use: …"). If it fails again, accept the better attempt, auto-add every out-of-set word to the glossary, and log violations to console for QA.
- Also validate minimum-occurrence counts per new word, and register discipline (no utara forms unless present in the vocabulary list).

### P0.3 New-word selection rules

Replace naive seed-order selection with, in priority order: queued harvested words → tag priority (survival > food/market > time/numbers > family > masjid > rest) → **diversity constraints**: max 2 words of the same POS per day; never both members of a contrast pair (kami/kita, ini/itu, bawa/ambil) on the same day; prefer concrete nouns, verbs and phrases over grammatical words for the first two weeks. Add a `priority` field to the seed file if that's simpler than computing at runtime.

### P0.4 Verify before proceeding

Generate three passages at simulated inventories of 2, 30 and 150 studied words with the containment log visible. All three must pass their tier's threshold before any design work begins.

---

## P1 — Design rebuild: "Mansion"

The v1 UI is the default AI look: uniform white rounded cards on beige, palette reduced to "primary buttons are blue," no poster typography. The tokens existed; they were never used as a system. This is a replacement visual language, specified in values rather than adjectives.

**Governing idea:** the app is about words, so a word is the hero of every screen. No illustration anywhere in the app. Identity is carried by typography, colour-as-architecture, and hairline rules.

The colour reference is the Cheong Fatt Tze Blue Mansion in Georgetown. The critical rule: **indigo is a wall, not a button.** It floods large surfaces. Actions are gold and oxblood.

### P1.1 Tokens (replace the existing set entirely)

```css
--indigo:    #2B4C9B;  /* field colour — headers, card fronts. NEVER a button. */
--indigo-lo: #93A6D2;  /* muted text on indigo */
--indigo-hi: #C6CFE6;  /* brighter text on indigo */
--indigo-rl: #4C69AE;  /* rule lines on indigo */
--plaster:   #EFE9DA;  /* page background, text on indigo */
--charcoal:  #221F1C;  /* text, borders, rules */
--muted:     #6F6A5E;  /* secondary text */
--hairline:  #C9C2B0;  /* internal rules on plaster */
--gold:      #C8912F;  /* THE action colour. Also audio icons, milestones. */
--gold-ink:  #3D2B09;  /* text on gold */
--oxblood:   #8C2F26;  /* progress, "today", the Lagi grade, COLLOQ chip */
--jade:      #8FBBA6;  /* BAKU chip, Senang grade */
--jade-ink:  #173A30;  /* text on jade */
```

No other colours. No gradients, no shadows, no glassmorphism, no emoji as icons (use a simple line-icon set). Depth comes from borders and flat fields.

### P1.2 Type

- **Display: Bricolage Grotesque 800**, tight negative tracking. Used for: the review headword, word-of-the-day, stat numerals, button labels.
- **Body: Instrument Sans.**
- **Utility: IBM Plex Mono**, uppercase, ~0.12em letter-spacing, 9.5–10.5px. Used for all section labels, register chips, counters.

**The signage rule** (this is the brand, apply it everywhere): every label is Malay primary, English secondary beneath or beside it, in the pattern `KATA BARU · NEW WORDS` for mono labels, or a display Malay word with small muted English under it. This is how Georgetown shop signs stack languages, and it is also what a day-zero learner needs. The bilingual layer is the aesthetic, not an apology.

### P1.3 Surfaces

Kill every white rounded card. Only two surfaces exist:

1. **Indigo field** — full-bleed, no radius, no border. Headers, the review card front.
2. **Plaster** — the page. Content is separated by 1.5px charcoal rules and 1px hairlines, not by cards.

Stat blocks: charcoal rule above and below, hairline divider between columns. Buttons: 1.5px charcoal border, flat fill (gold for primary, transparent for secondary), no radius beyond 0–4px. Stacked buttons share a border edge.

### P1.4 Colour semantics (non-negotiable, or the system collapses into decoration)

- **Gold** = the action. Exactly one gold element per screen.
- **Oxblood** = progress, today, and "Lagi" (again).
- **Jade** = BAKU register, and "Senang" (easy).
- **Register chips are a three-colour language:** BAKU jade, COLLOQ oxblood, UTARA gold. Mono, uppercase, tiny, flat.

### P1.5 Screens

**Today.** Indigo header floods the top third and contains: date (mono, gold), then **KATA HARI INI · WORD OF THE DAY** — a word drawn from the deck at poster scale (~66px plaster on indigo), its gloss, its register chip, an audio button (gold), a rule, and one example sentence with translation. Below on plaster: a progress row (`12 / 1000 kata`, a 6px bar filled oxblood, a charcoal tick at the next milestone, "12 words learned" / "next: 100"); the weekday row (filled indigo squares = practised, oxblood outline = today, hairline outline = future, gaps stay visible — A3 unchanged) with `3 / 5 HARI · days this week`; a two-column stat ledger between charcoal rules (due count, new-word budget); the **Mula** button in gold with **Sikit je** as a bordered secondary sharing its lower edge; the proverb with its English translation as a signature line. Tab bar is **indigo**, active tab plaster, inactive `--indigo-lo`. Rename the third tab **Kemajuan · progress**.

**Review — front.** Indigo full-bleed. Mono exit link and `4 / 12` counter (gold) at top. Headword in plaster at clamp(64px, 20vw, 96px), centred, alone. Gold audio icon beneath. Nothing else — no gloss, no hint; the empty face is what makes it retrieval. A bordered **Tunjuk · tap to reveal** button on plaster at the bottom.

**Review — back.** The headword stays in place and shrinks to ~44px on indigo, with gloss and POS beneath it — the learner compares against what they tried to recall. On plaster below: **CONTOH · EXAMPLE** (sentence + translation); **LOGHAT · REGISTER** as a hairline-ruled ledger of three rows (chip · form · context) showing baku/colloquial/utara — this row is the payoff of PDR-001 and should never be collapsed or hidden; an **ARAB · ARABIC** row rendered only where `arabic_cognate` exists. Then **INGAT? · HOW WELL?** and a 2×2 grid of grade buttons with FSRS interval previews: Lagi (oxblood border, oxblood text), Susah and Okey (charcoal border), Senang (jade fill). Keep the 300ms flip; respect `prefers-reduced-motion`.

**Read.** Passage typography is the best thing in the current build — keep it. Add the tier-appropriate gloss treatment from P0.1. Replace the pink highlight blocks on new words (they read as errors) with a 2px gold underline. Register toggle as a mono chip pair.

**Speak/Write.** Structure is fine; apply surfaces and type. Keep "skip today, no guilt."

**Words.** Replace the two ambiguous dots with a mono status chip (`BARU` / `BELAJAR` / `MATANG`) and show register availability with the three-colour chips.

**Progress (was Bukit).** No illustration. A large display numeral for words learned, the oxblood bar with milestone ticks at 100/250/500/1000, the weekly rhythm figure, the review-debt trend, the footpath as a simple ruled row of practised days with gaps visible, and the proverb as a footer line.

### P1.6 Known tension

Jade means both BAKU and "Senang". If it reads as noise in use, strip colour from all four grade buttons (charcoal outlines, intervals doing the work) rather than reassigning jade. Do not introduce a new colour to resolve this.

---

## P2 — Small fixes

- Hide the register-coverage stat until studied ≥ 20 (it currently shows a meaningless 100% at n=2).
- Let the onboarding self-assessment be re-run from Settings ("Tanda kata yang anda tahu · mark the words you know").
- After the comprehension answer is revealed, offer a one-tap `betul / tak` self-mark — logged only, never gating.
- Loading and empty states follow the signage rule; no emoji.

---

## Acceptance criteria (additions to brief §10)

- A day-zero user (≤5 studied words) receives a dialogue of ≤35 words at 100% vocabulary containment, ≤3 new words, English gloss under every line, and an English comprehension question.
- Simulated generations at 2 / 30 / 150 studied words all pass their tier's containment threshold (P0.4).
- No day introduces more than 2 words of the same POS, and never both members of a defined contrast pair.
- No `Hill.tsx`, no tile pattern, no illustration of any kind remains in the codebase.
- No white card surfaces anywhere; every section label follows the Malay-primary / English-secondary signage rule.
- Exactly one gold element per screen. Register chips use jade/oxblood/gold consistently.
- The review front shows the headword at ≥64px with no gloss, hint, or example visible.
- Tab bar is indigo; third tab reads `Kemajuan · progress`.
