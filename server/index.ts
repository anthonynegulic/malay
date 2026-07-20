/**
 * Local dev entry. Loads .env (hand-rolled, no dotenv dep), then serves the
 * shared Hono app on :8787. In production the same app is exported from
 * server/app.ts and mounted as a Vercel serverless function (api/index.ts).
 */
import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
}

const { serve } = await import('@hono/node-server')
const app = (await import('./app')).default

const port = Number(process.env.PORT || 8787)
serve({ fetch: app.fetch, port }, () => {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY)
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
  console.log(`Bukit API proxy on :${port} (model: ${model}, key: ${configured ? 'set' : 'MISSING'})`)
})
