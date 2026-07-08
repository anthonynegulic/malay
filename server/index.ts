/**
 * Bukit API proxy — single file, deliberately.
 *
 * Exposes POST /api/generate and /api/grade, forwarding to the Anthropic
 * Messages API. The client never sees ANTHROPIC_API_KEY.
 *
 * To deploy on Vercel later: `import { handle } from 'hono/vercel'` and
 * `export default handle(app)` — the app itself needs no changes.
 */
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { readFileSync, existsSync } from 'node:fs'

// Minimal .env loader so we don't need dotenv as a dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
}

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
const API_KEY = process.env.ANTHROPIC_API_KEY

const GENERATE_SYSTEM = `You are a Malay-language content generator for a learner preparing to live in
Penang, Malaysia. You write short, natural, culturally grounded passages using
ONLY the vocabulary provided, plus basic function words (di, ke, dari, yang,
dan, atau, ini, itu, ada, dengan, untuk, pada, juga, sudah, belum, akan).
The learner's vocabulary comes in two lists: "studied_words" (words the learner
has actually studied — draw predominantly from these, plus the "new_words") and
"available_words" (words the learner will study soon — use sparingly, only
where they make the passage more natural, and ALWAYS include any you use in the
glossary).
Register discipline is absolute: if register is "baku", write standard Malay
with full affixation; if "colloquial", write natural everyday Malaysian Malay
(dropped affixes, nak, tak, dah, particles lah/kan) but do NOT use northern
dialect forms unless they appear in the vocabulary list.
Each word in "new_words" must appear at least twice in the passage and must be
included in the glossary.
Respond with STRICT JSON only. No markdown, no preamble. Shape:
{"passage": "...", "translation": "...",
 "glossary": [{"word": "...", "gloss": "..."}],
 "question": {"prompt": "...", "answer": "..."}}`

const GRADE_SYSTEM = `You are a warm, encouraging Malay tutor. The learner is a beginner. Grade for
COMMUNICATION, not perfection. If the meaning would be understood by a patient
native speaker, say so first. Return STRICT JSON:
{ "understood": true|false, "corrected": "...", "encouragement": "...",
  "notes": ["...", "..."] }
"notes" has at most 2 entries, each one concrete fix. Never return more than 2
notes. Never lecture. No markdown, no preamble.`

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`)
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> }
  const text = data.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Empty response from model')
  return text
}

/** Strip code fences if present, then JSON.parse. */
function parseStrictJson(text: string): unknown {
  let t = text.trim()
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) t = fence[1]
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start > 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

/** One retry on parse failure, per the brief. */
async function callAndParse(system: string, user: string): Promise<unknown> {
  try {
    return parseStrictJson(await callClaude(system, user))
  } catch {
    return parseStrictJson(await callClaude(system, user))
  }
}

const app = new Hono()

app.post('/api/generate', async (c) => {
  if (!API_KEY) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  const body = await c.req.json()
  const payload = {
    studied_words: body.studied_words ?? [],
    available_words: body.available_words ?? [],
    new_words: body.new_words ?? [],
    register: body.register === 'colloquial' ? 'colloquial' : 'baku',
    topic: String(body.topic ?? 'pasar'),
    user_context: String(body.user_context ?? ''),
    constraints: {
      length_words: '60-110',
      each_new_word_min_occurrences: 2,
    },
  }
  try {
    const out = (await callAndParse(GENERATE_SYSTEM, JSON.stringify(payload))) as Record<
      string,
      unknown
    >
    if (typeof out.passage !== 'string' || typeof out.translation !== 'string') {
      throw new Error('Malformed generation output')
    }
    return c.json(out)
  } catch (e) {
    console.error('[generate]', e)
    return c.json({ error: 'generation_failed' }, 502)
  }
})

app.post('/api/grade', async (c) => {
  if (!API_KEY) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  const body = await c.req.json()
  const payload = {
    task_prompt: String(body.prompt ?? ''),
    learner_response: String(body.response ?? ''),
  }
  try {
    const out = (await callAndParse(GRADE_SYSTEM, JSON.stringify(payload))) as Record<
      string,
      unknown
    >
    if (typeof out.corrected !== 'string') throw new Error('Malformed grading output')
    return c.json(out)
  } catch (e) {
    console.error('[grade]', e)
    return c.json({ error: 'grading_failed' }, 502)
  }
})

app.get('/api/health', (c) => c.json({ ok: true, model: MODEL, keyConfigured: Boolean(API_KEY) }))

const port = Number(process.env.PORT || 8787)
serve({ fetch: app.fetch, port }, () => {
  console.log(`Bukit API proxy on :${port} (model: ${MODEL}, key: ${API_KEY ? 'set' : 'MISSING'})`)
})

export default app
