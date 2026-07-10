/**
 * Vercel serverless function. Every /api/* request is routed here (catch-all
 * filename) and handed to the shared Hono app, which matches on its /api
 * basePath. Env vars (ANTHROPIC_API_KEY, optional CLAUDE_MODEL / APP_PASSPHRASE)
 * come from the Vercel project settings.
 *
 * `_app.generated.js` is a pre-bundled (esbuild), dependency-free copy of
 * server/app.ts — see scripts/build-api.mjs. It's a plain same-directory JS
 * import so Vercel's function builder never has to resolve a cross-directory
 * relative TS import at runtime. Regenerate it with `npm run build:api`
 * whenever server/app.ts (or its imports) change; `npm run build` does this
 * automatically before `vite build`.
 */
import { handle } from 'hono/vercel'
import app from './_app.generated.js'

// hono/vercel's handle() produces a pure Fetch API (Request) => Response
// function. Vercel only invokes a function with that signature if it's
// explicitly told this is an Edge Function — otherwise it calls the default
// export as a classic Node (req, res) handler, which crashes immediately on
// every request since our function ignores its arguments and calls
// req.headers.get() etc. on a plain Node IncomingMessage.
export const config = { runtime: 'edge' }

export default handle(app)
