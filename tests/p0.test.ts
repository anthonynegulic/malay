/**
 * P0 unit tests: containment validator + new-word selection diversity.
 * Run: npx tsx tests/p0.test.ts
 */
import assert from 'node:assert'
import { validatePassage, tokenise, properNouns, noticeFormInPassage } from '../server/validate'
import { pickDiverse, sortBacklog } from '../src/lib/select'
import { tierFor, FUNCTION_WORDS } from '../src/lib/tier'
import type { Word } from '../src/db/types'

// ————— tokeniser —————
{
  const tokens = tokenise('Terima kasih, saya suka kopi!', ['terima kasih'])
  assert.deepEqual(tokens, ['terima_kasih', 'saya', 'suka', 'kopi'])
}
{
  // Longest multi-word unit wins.
  const tokens = tokenise('Selamat pagi cikgu.', ['selamat pagi', 'selamat'])
  assert.equal(tokens[0], 'selamat_pagi')
}

// ————— proper-noun heuristic —————
{
  const proper = properNouns('Saya tinggal di Penang. Bersyukur sangat.')
  assert.ok(proper.has('penang'), 'mid-sentence capital = proper noun')
  assert.ok(!proper.has('bersyukur'), 'sentence-initial capital gets no free pass')
}

// ————— containment: the observed 2026-07-09 failure must now be caught —————
{
  const result = validatePassage({
    lines: [
      { text: 'Saya bersyukur dengan rezeki hari ini, iaitu kopi yang terkenal.' },
      { text: 'Kami gemar minum kopi di Penang.' },
    ],
    allowed: ['saya', 'kami', 'kopi', 'minum', 'hari ini'],
    newWords: ['kopi'],
    functionWords: FUNCTION_WORDS,
    containment: 1.0,
    minOccurrences: 3,
  })
  assert.equal(result.ok, false)
  for (const leak of ['bersyukur', 'rezeki', 'iaitu', 'terkenal', 'gemar']) {
    assert.ok(result.violations.includes(leak), `should flag "${leak}"`)
  }
  assert.ok(result.underused.includes('kopi'), 'kopi appears 2x, needs 3')
}

// ————— containment: a compliant tier-0 dialogue passes —————
{
  const result = validatePassage({
    lines: [
      { speaker: 'A', text: 'Selamat pagi! Kopi?' },
      { speaker: 'B', text: 'Ya, saya hendak kopi.' },
      { speaker: 'A', text: 'Kopi panas?' },
      { speaker: 'B', text: 'Ya, kopi panas. Terima kasih.' },
    ],
    allowed: ['saya', 'ya', 'selamat pagi', 'terima kasih', 'kopi', 'panas', 'hendak'],
    newWords: ['kopi', 'panas'],
    functionWords: FUNCTION_WORDS,
    containment: 1.0,
    minOccurrences: 3,
  })
  assert.equal(result.violations.length, 0, `violations: ${result.violations}`)
  assert.equal(result.ok, false, 'panas appears twice, needs 3') // deliberate near-miss
  assert.deepEqual(result.underused, ['panas'])
}

// ————— grammar whisper: noticed form must appear verbatim in the passage —————
{
  const lines = [
    { speaker: 'A', text: 'Saya nak pergi ke pasar.' },
    { speaker: 'B', text: 'Lagu mana nak pergi?' },
  ]
  assert.ok(noticeFormInPassage(lines, 'nak'), 'single word present')
  assert.ok(noticeFormInPassage(lines, 'Nak'), 'case-insensitive')
  assert.ok(noticeFormInPassage(lines, 'lagu mana'), 'multi-word form present')
  assert.ok(noticeFormInPassage(lines, 'pasar.'), 'punctuation on the form is forgiven')
  assert.ok(!noticeFormInPassage(lines, 'hendak'), 'absent form rejected')
  assert.ok(!noticeFormInPassage(lines, 'mana lagu'), 'order matters — not a bag of words')
  assert.ok(!noticeFormInPassage(lines, ''), 'empty form rejected')
}

// ————— tier thresholds —————
assert.equal(tierFor(0).id, 0)
assert.equal(tierFor(24).id, 0)
assert.equal(tierFor(25).id, 1)
assert.equal(tierFor(75).id, 2)
assert.equal(tierFor(200).id, 3)
assert.equal(tierFor(0).maxNewWordsPerDay, 3)
assert.equal(tierFor(0).containment, 1.0)

// ————— selection diversity —————
function w(baku: string, pos: Word['pos'], tags: string[] = ['survival'], i = 0): Word {
  return {
    id: baku,
    baku,
    pos,
    gloss_en: '',
    example_baku: '',
    tags,
    source: 'seed',
    addedAt: i,
  }
}

{
  // The observed failure: 5 pronouns incl. kami/kita must be impossible now.
  const backlog = [
    w('saya', 'pronoun', ['survival'], 0),
    w('awak', 'pronoun', ['survival'], 1),
    w('kami', 'pronoun', ['survival'], 2),
    w('kita', 'pronoun', ['survival'], 3),
    w('dia', 'pronoun', ['survival'], 4),
    w('makan', 'verb', ['survival', 'food'], 5),
    w('nasi', 'noun', ['food'], 6),
    w('kopi', 'noun', ['food'], 7),
    w('sedap', 'adj', ['food'], 8),
  ]
  const picked = pickDiverse(backlog, 5, 2)
  const posCounts = new Map<string, number>()
  for (const p of picked) posCounts.set(p.pos, (posCounts.get(p.pos) ?? 0) + 1)
  for (const [pos, n] of posCounts) assert.ok(n <= 2, `${pos} picked ${n}x`)
  const bakus = picked.map((p) => p.baku)
  assert.ok(!(bakus.includes('kami') && bakus.includes('kita')), 'contrast pair blocked')
  // Concrete-first at low studied count: pronouns deprioritised.
  assert.ok(['makan', 'nasi', 'kopi', 'sedap'].includes(picked[0].baku), `first pick: ${picked[0].baku}`)
}

{
  // Queued harvest overflow still wins over everything.
  const backlog = [
    w('nasi', 'noun', ['food'], 0),
    { ...w('pasar', 'noun', ['market'], 1), queuedAt: 123 },
  ]
  const sorted = sortBacklog(backlog, 2)
  assert.equal(sorted[0].baku, 'pasar')
}

{
  // Contrast partner already introduced today (via harvest) blocks the twin.
  const backlog = [w('kita', 'pronoun', ['survival'], 0), w('nasi', 'noun', ['food'], 1)]
  const picked = pickDiverse(backlog, 2, 100, [w('kami', 'pronoun')])
  assert.ok(!picked.map((p) => p.baku).includes('kita'))
}

console.log('all P0 tests passed ✓')
