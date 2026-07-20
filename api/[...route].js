/**
 * Vercel serverless function. Every /api/* request is routed here (catch-all
 * filename) and handed to the shared Hono app, which matches on its /api
 * basePath. Env vars (ANTHROPIC_API_KEY, optional CLAUDE_MODEL / APP_PASSPHRASE)
 * come from the Vercel project settings.
 *
 * `_app.generated.js` is a pre-bundled (esbuild), dependency-free copy of
 * server/app.ts — see scripts/build-api.mjs. Regenerate it with
 * `npm run build:api` whenever server/app.ts (or its imports) change;
 * `npm run build` and the Vercel buildCommand both do this automatically.
 *
 * DELIBERATELY PLAIN JAVASCRIPT, NOT TYPESCRIPT. Vercel type-checks api/*.ts
 * with its own compiler settings (not this repo's tsconfig), and two deploys
 * in a row failed that check on code that passed the same TypeScript version
 * locally (`duplex` in RequestInit, then Buffer vs BodyInit). A failed check
 * means no function is deployed at all — every /api/* request then 500s with
 * FUNCTION_INVOCATION_FAILED and nothing in Runtime Logs. Plain JS skips
 * Vercel's type-check entirely. Do not convert this file back to .ts.
 *
 * Uses the classic Node (req, res) signature — no hono/vercel handle(), no
 * Edge runtime declaration — because it's the invocation style with no
 * auto-detection involved: build a standard Request from the incoming Node
 * request, run it through the Hono app, write the Response back.
 */
import app from './_app.generated.js'

async function toWebRequest(req) {
  const host = req.headers.host ?? 'localhost'
  const url = `https://${host}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
  let body
  if (hasBody) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    body = new Uint8Array(Buffer.concat(chunks))
  }
  return new Request(url, { method: req.method ?? 'GET', headers, body })
}

export default async function handler(req, res) {
  try {
    const request = await toWebRequest(req)
    const response = await app.fetch(request)
    res.statusCode = response.status
    response.headers.forEach((value, key) => res.setHeader(key, value))
    res.end(Buffer.from(await response.arrayBuffer()))
  } catch (e) {
    console.error('[api] handler error:', e)
    res.statusCode = 500
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ error: 'internal_error' }))
  }
}
