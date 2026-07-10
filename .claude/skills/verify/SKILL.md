---
name: verify
description: Drive the built Bukit PWA end-to-end in headless Chromium with the real API server and a mocked Anthropic backend. Use to verify UI/lesson-flow changes without an ANTHROPIC_API_KEY.
---

# Verifying Bukit without a live key

The surface is the PWA in a browser. The only thing that needs a key is the
outbound Anthropic call — mock that, keep everything else real (Hono routes,
containment validator, notice validation all execute).

## Recipe that works

1. **Build once** (`npm run build`) and serve `dist` with `npx vite preview
   --port 4173`. Use preview, not dev: React StrictMode double-effects in dev
   double-fire passage generation (pre-existing; prod-only semantics are what
   you want to observe). `preview` inherits the `/api → :8787` proxy.

2. **Real API server, mocked model:** a tsx wrapper that (a) sets a fake
   `ANTHROPIC_API_KEY`, (b) replaces `globalThis.fetch` for api.anthropic.com
   only, (c) `await import('server/index.ts')`. The mock must read the request
   body and echo back a passage built from the exact `new_words` the app sent,
   using only those words + the function words ini/itu/ada/dan, each new word
   ×3 — that passes tier-0 containment (1.0) through the real validator.
   Distinguish grade calls by `system.startsWith('You are a warm')`.

3. **Drive with playwright-core** (`npm i --no-save playwright-core`), launch
   `executablePath: '/opt/pw-browsers/chromium'`, viewport 390×844. Fresh
   launch = fresh IndexedDB, so every run is a clean day-0 user.

4. **TTS in headless has no voices.** To activate audio paths, inject a fake
   ms-MY voice via `addInitScript` — and use `Object.defineProperty(window,
   'speechSynthesis', {value: mock})`: plain assignment silently fails
   (getter-only property) and the app will correctly report "no Malay voice".
   Capture utterances in `window.__spoken`; fire `u.onend` on a timeout.

5. **Assert persistence via IndexedDB in-page** (`indexedDB.open('bukit')`) —
   cards/sessions/settings are directly inspectable.

## Flows worth driving

- Day-0 arc: onboarding "Belum — saya baru bermula" → Today (KATA PERTAMA ANDA)
  → Mula → /read fast path → intro cards → "Baca sekarang" → tier-0
  tap-to-advance (Dengar/Seterusnya) → question → Speak → /recall → Siap.
- Probes: re-enter /read same day (no intro repeat), senyap mid-read (full
  render fallback), register toggle absent at tier 0, Settings voice line,
  Kemajuan checkpoint checklist toggle.

## Gotchas

- Playwright `text=A, text=B` is not a union selector; use
  `locator('button:has-text("A"), button:has-text("B")')`.
- Scratchpad scripts can't resolve repo deps by name; import
  `<repo>/node_modules/playwright-core/index.mjs` by absolute path.
- Kill servers with `pkill -f "vite preview"` / `pkill -f tsx` when done.
