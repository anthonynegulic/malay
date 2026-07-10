/**
 * Offline route-level tests for POST /api/generate: drive the real Hono route
 * with a mocked Anthropic fetch. Proves the containment retry loop and the
 * grammar-whisper (notice) validation behave end-to-end without a live key —
 * the complement to scripts/verify-generation.mjs, which needs one.
 * Run: npx tsx tests/generate-route.test.ts
 */
import assert from 'node:assert'

process.env.ANTHROPIC_API_KEY = 'test-key-offline'

const { default: app } = await import('../server/app')

type GenOut = Record<string, unknown>

/** Queue of model outputs; each fetch to the Anthropic API consumes one. */
let modelOutputs: GenOut[] = []
let calls = 0

globalThis.fetch = (async (url: RequestInfo | URL) => {
  assert.ok(String(url).includes('api.anthropic.com'), `unexpected fetch: ${url}`)
  calls++
  const out = modelOutputs.shift()
  assert.ok(out, 'mock exhausted — route called the model more times than expected')
  return new Response(
    JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }] }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}) as typeof fetch

function generate(body: Record<string, unknown>) {
  return app.request('/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const tier0Request = {
  tier: {
    id: 0,
    format: 'dialogue',
    length_words: [15, 35],
    containment: 1.0,
    min_occurrences: 3,
    question_language: 'english',
  },
  studied_words: ['saya', 'hendak', 'minum', 'panas', 'ya', 'terima kasih'],
  new_words: ['kopi'],
  register: 'baku',
  topic: 'kopitiam',
  user_context: '',
}

const compliantLines = [
  { speaker: 'A', text: 'Saya hendak kopi.' },
  { speaker: 'B', text: 'Kopi panas?' },
  { speaker: 'A', text: 'Ya, kopi panas. Terima kasih.' },
]

function out(overrides: GenOut): GenOut {
  return {
    format: 'dialogue',
    lines: compliantLines.map((l) => ({ ...l, gloss: 'x' })),
    translation: 'x',
    glossary: [],
    question: { prompt: 'q', prompt_en: 'q', answer: 'a' },
    ...overrides,
  }
}

// ————— 1. compliant passage with a verbatim notice passes straight through —————
{
  modelOutputs = [out({ notice: { form: 'hendak', note: 'hendak = want to' } })]
  calls = 0
  const res = await generate(tier0Request)
  const body = (await res.json()) as Record<string, any>
  assert.equal(res.status, 200)
  assert.equal(calls, 1, 'no retry for a compliant passage')
  assert.equal(body.containment, 1)
  assert.deepEqual(body.notice, { form: 'hendak', note: 'hendak = want to' })
}

// ————— 2. non-verbatim notice is stripped, passage still ships —————
{
  modelOutputs = [out({ notice: { form: 'nak', note: 'not actually in the passage' } })]
  calls = 0
  const res = await generate(tier0Request)
  const body = (await res.json()) as Record<string, any>
  assert.equal(res.status, 200)
  assert.equal(body.notice, undefined, 'unvalidated notice never ships')
  assert.equal(body.containment, 1, 'passage itself unaffected')
}

// ————— 3. containment failure still triggers the retry; notice re-checked on the winner —————
{
  const leaky = out({
    lines: [{ speaker: 'A', text: 'Saya gemar kopi yang terkenal.', gloss: 'x' }],
    notice: { form: 'gemar', note: 'in the leaky attempt only' },
  })
  const clean = out({ notice: { form: 'kopi', note: 'kopi = coffee' } })
  modelOutputs = [leaky, clean]
  calls = 0
  const res = await generate(tier0Request)
  const body = (await res.json()) as Record<string, any>
  assert.equal(res.status, 200)
  assert.equal(calls, 2, 'one feedback retry on containment failure')
  assert.equal(body.containment, 1, 'second attempt chosen')
  assert.deepEqual(body.notice, { form: 'kopi', note: 'kopi = coffee' })
}

// ————— 4. absent notice is legal (older model output shape still parses) —————
{
  modelOutputs = [out({})]
  calls = 0
  const res = await generate(tier0Request)
  const body = (await res.json()) as Record<string, any>
  assert.equal(res.status, 200)
  assert.equal(body.notice, undefined)
  assert.equal(body.containment, 1)
}

console.log('all generate-route tests passed ✓')
