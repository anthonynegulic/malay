/**
 * P0.4 verification harness — generate passages at simulated inventories of
 * 2 / 30 / 150 studied words and print the containment log for each.
 *
 * Requires a running API server with ANTHROPIC_API_KEY set:
 *   npm run dev:api        # in one terminal
 *   node scripts/verify-generation.mjs   # in another
 *
 * All three must pass their tier's containment threshold (100 / 95 / 95%).
 */
import seed from '../src/data/seed.json' with { type: 'json' }
import { tierFor } from '../src/lib/tier.ts'

const API = process.env.API_URL || 'http://localhost:8787'
const baku = seed.map((w) => w.baku)

async function run(studiedN) {
  const tier = tierFor(studiedN)
  const studied = baku.slice(0, studiedN)
  const newWords = baku.slice(studiedN, studiedN + tier.passageNewWords)
  const res = await fetch(`${API}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tier: {
        id: tier.id,
        format: tier.format,
        length_words: tier.lengthWords,
        containment: tier.containment,
        min_occurrences: tier.minOccurrences,
        question_language: tier.questionLanguage,
      },
      studied_words: studied,
      new_words: newWords,
      register: 'baku',
      topic: 'pasar',
      user_context: 'Father of two, planning life in Penang.',
    }),
  })
  const out = await res.json()
  const passLabel =
    out.containment >= tier.containment ? 'PASS' : 'FAIL'
  console.log(`\n===== ${studiedN} studied · tier ${tier.id} · need ${(tier.containment * 100).toFixed(0)}% =====`)
  if (!res.ok) {
    console.log('  request failed:', out)
    return false
  }
  console.log(`  containment: ${(out.containment * 100).toFixed(1)}%  → ${passLabel}`)
  console.log(`  new words: ${newWords.join(', ')}`)
  for (const line of out.lines ?? []) {
    console.log(`    ${line.speaker ? line.speaker + ': ' : ''}${line.text}`)
    if (line.gloss) console.log(`       ${line.gloss}`)
  }
  return out.containment >= tier.containment
}

const results = []
for (const n of [2, 30, 150]) results.push(await run(n))
console.log(`\n${results.every(Boolean) ? '✓ all tiers passed' : '✗ some tiers failed — inspect logs above'}`)
process.exit(results.every(Boolean) ? 0 : 1)
