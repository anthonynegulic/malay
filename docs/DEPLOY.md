# Deploying Bukit to Vercel

Bukit is a Vite static SPA plus one Hono serverless function (`api/[...route].ts`,
which re-exports the shared app in `server/app.ts`). Client uses hash routing, so
the only server route is `/api/*`; everything else is static from `dist`.

## One-time setup (Vercel dashboard)

1. **vercel.com → Add New… → Project → Import** the `anthonynegulic/malay` repo.
2. Framework preset auto-detects **Vite** (build `vite build`, output `dist`) — the
   committed `vercel.json` pins this. No changes needed.
3. **Environment Variables** — add before the first deploy:
   - `ANTHROPIC_API_KEY` = your key (required)
   - `CLAUDE_MODEL` = `claude-sonnet-4-6` (optional; this is the default)
   - `APP_PASSPHRASE` = any phrase (optional but recommended — see below)
4. **Deploy.** Every push to the connected branch redeploys automatically.

Set the **Production Branch** (Settings → Git) to whichever branch you want live —
currently `claude/bukit-app-review-3hnowa`, or `main` after this is merged.

## Protecting your API credit

The `/api/generate` and `/api/grade` routes spend your Anthropic credit, and a
Vercel URL is public. Set **`APP_PASSPHRASE`** and the app will ask for it once
(stored in the browser) before it calls the API — a random visitor without the
phrase gets a 401 and can't generate anything. Reviews, the word browser, and all
local-only features keep working without it. Leave `APP_PASSPHRASE` unset for a
fully open deployment (fine for a quick private test).

## Verifying a deploy

- `https://<your-app>.vercel.app/api/health` → `{"ok":true,"keyConfigured":true,"gated":…}`.
  If `keyConfigured` is false, the env var isn't set (or you didn't redeploy after
  adding it).
- Then open the app, run a session, and hit **Baca** — the reading should generate.

## Notes

- Env vars are read at request time, so changing one only needs a redeploy, not a
  code change.
- The service worker caches the app shell; after a deploy, hard-refresh once (or
  reinstall the PWA) to pick up the new version.
- Local dev is unchanged: `npm run dev` (Vite :5173 + Hono :8787).
