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
 *
 * This uses Vercel's original, classic Node.js function signature —
 * `(req, res)` — deliberately, instead of relying on Vercel auto-detecting a
 * Fetch API `(Request) => Response` handler (which needs either an Edge
 * runtime declaration or a specific @vercel/node version's auto-detection to
 * work, and repeatedly failed here in ways that gave no useful diagnostic
 * output). This adapter manually builds a standard Request from the incoming
 * Node request, runs it through the Hono app, and writes the Response back —
 * the same pattern every non-Fetch-native framework uses on Vercel, with the
 * longest track record of just working.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import app from './_app.generated.js'

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? 'localhost'
  const url = `https://${host}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  let body: Buffer | undefined
  if (hasBody) {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    body = Buffer.concat(chunks)
  }
  return new Request(url, { method: req.method ?? 'GET', headers, body })
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const request = await toWebRequest(req)
  const response = await app.fetch(request)
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  const buf = Buffer.from(await response.arrayBuffer())
  res.end(buf)
}
