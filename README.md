# Bukit ⛰

> *Sedikit-sedikit, lama-lama jadi bukit* — little by little, over time it becomes a hill.

A personal Malay-learning tool built around spaced repetition (FSRS) + AI-generated
comprehensible input, anchored by a family relocation to Penang. One user, no
accounts, local-first. See [docs/BRIEF.md](docs/BRIEF.md) for the full product brief
and decision trail.

## The daily loop

**Retrieve → Absorb → Produce**, 10–15 minutes:

1. **Ulangkaji** — FSRS review queue (Malay → meaning, one card per word).
2. **Baca** — a generated i+1 passage in baku or colloquial register, calibrated to
   your studied vocabulary. Tap any word to harvest it. New words debut here; their
   cards first come due tomorrow.
3. **Cakap** — one output micro-task, graded leniently for communication.

Bad day? **Sikit je**: reviews only, ≤20 cards, ~5 minutes — counts fully. There is
no streak; the app tracks a weekly rhythm (default 5/7) and the Hill never shrinks.

## Running it

```sh
cp .env.example .env    # add your ANTHROPIC_API_KEY
npm install
npm run dev             # web on :5173, API proxy on :8787
```

Reviews work offline (PWA + IndexedDB); passage generation and grading need the
network and the API server. The server is a single Hono file
(`server/index.ts`) that can be dropped into a Vercel function unchanged.

## Stack

Vite · React · TypeScript · Tailwind v4 · Dexie (IndexedDB) · ts-fsrs ·
vite-plugin-pwa · Hono · Claude (`claude-sonnet-4-6`).

## Backup

Settings → Eksport JSON. Import replaces all local data. IndexedDB is the only
store — export before clearing browser data.
