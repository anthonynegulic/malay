#!/usr/bin/env node
/**
 * Round-trip verification of example_en glosses (feedback-002 Q1 ruling):
 * gloss → back-translate to Malay → judge divergence against the original —
 * flagged rows go to the owner for review; unflagged rows are accepted.
 *
 * Usage:  ANTHROPIC_API_KEY=... node scripts/verify-example-glosses.mjs
 * Reads .env like server/index.ts does. Writes a report to
 * scripts/gloss-verification-report.json and prints flagged rows.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2]
  }
}

const API_KEY = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY not set — cannot run round-trip verification.')
  process.exit(1)
}

const seed = JSON.parse(readFileSync('src/data/seed.json', 'utf8'))
const BATCH = 25

async function callClaude(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  const text = data.content.find((b) => b.type === 'text')?.text ?? ''
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  return JSON.parse(text.slice(start, end + 1))
}

const BACK_SYSTEM = `Translate each English sentence into simple, natural Malay
(Malaysian, beginner register). Return STRICT JSON only: an array of strings,
one Malay sentence per input, same order. No markdown.`

const JUDGE_SYSTEM = `You compare pairs of Malay sentences for MEANING. Small
wording differences (synonyms, word order, saya/aku, particle choice) are fine.
Flag a pair only if the meanings genuinely diverge — different action, subject,
object, polarity, tense-marker sense, or missing/added information a learner
would notice. Return STRICT JSON only: an array of objects
{"i": <index>, "diverges": true|false, "reason": "<short, only when true>"}.
No markdown.`

const flagged = []
for (let off = 0; off < seed.length; off += BATCH) {
  const rows = seed.slice(off, off + BATCH)
  const back = await callClaude(BACK_SYSTEM, JSON.stringify(rows.map((r) => r.example_en)))
  const pairs = rows.map((r, j) => ({
    i: off + j,
    original: r.example_baku,
    backtranslation: back[j] ?? '',
  }))
  const verdicts = await callClaude(JUDGE_SYSTEM, JSON.stringify(pairs))
  for (const v of verdicts) {
    if (v.diverges) {
      const r = seed[v.i]
      flagged.push({
        index: v.i,
        baku: r.baku,
        example_baku: r.example_baku,
        example_en: r.example_en,
        backtranslation: pairs.find((p) => p.i === v.i)?.backtranslation,
        reason: v.reason,
      })
    }
  }
  process.stdout.write(`\rverified ${Math.min(off + BATCH, seed.length)}/${seed.length}`)
}
console.log()

writeFileSync(
  'scripts/gloss-verification-report.json',
  JSON.stringify({ verifiedAt: new Date().toISOString(), model: MODEL, flagged }, null, 2),
)
if (flagged.length) {
  console.log(`${flagged.length} rows flagged for owner review:`)
  for (const f of flagged) console.log(`  #${f.index} ${f.baku}: ${f.reason}`)
  console.log('Full report: scripts/gloss-verification-report.json')
} else {
  console.log('No divergent rows — all glosses round-trip cleanly.')
}
