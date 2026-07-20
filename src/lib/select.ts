import type { Word } from '../db/types'

/**
 * New-word selection (remediation P0.3). Pure function so it's unit-testable.
 *
 * Priority: queued harvested words → tag priority → seed order, with diversity
 * constraints: max 2 words of the same POS per day; never both members of a
 * contrast pair on the same day; while the learner has < 50 studied words
 * ("the first two weeks" made mechanical), grammatical words are deprioritised
 * in favour of concrete nouns/verbs/phrases — deprioritised, not skipped, so a
 * thin backlog can still fill the day.
 */

const TAG_PRIORITY = ['survival', 'food', 'market', 'time', 'numbers', 'family', 'masjid']

/** Word pairs that confuse when introduced together. */
export const CONTRAST_PAIRS: [string, string][] = [
  ['kami', 'kita'],
  ['ini', 'itu'],
  ['sini', 'sana'],
  ['kiri', 'kanan'],
  ['masuk', 'keluar'],
  ['buka', 'tutup'],
  ['naik', 'turun'],
  ['datang', 'pergi'],
  ['sebelum', 'selepas'],
  ['pagi', 'petang'],
  ['besar', 'kecil'],
  ['mahal', 'murah'],
  ['banyak', 'sedikit'],
  ['suami', 'isteri'],
  ['lelaki', 'perempuan'],
  ['abang', 'kakak'],
  ['atas', 'bawah'],
  ['dalam', 'luar'],
  ['depan', 'belakang'],
  ['muda', 'tua'],
  ['panjang', 'pendek'],
  ['jauh', 'dekat'],
  ['bersih', 'kotor'],
  ['senang', 'susah'],
  ['betul', 'salah'],
  ['penuh', 'kosong'],
  ['cepat', 'lambat'],
  ['manis', 'masin'],
  ['lapar', 'haus'],
  ['sedih', 'gembira'],
  ['halal', 'haram'],
  ['jual', 'beli'],
  ['ambil', 'bawa'],
  ['tinggi', 'rendah'],
  ['panas', 'sejuk'],
  ['awal', 'lambat'],
  ['semalam', 'esok'],
  ['berat', 'ringan'],
]

const GRAMMATICAL_POS = new Set(['pronoun', 'particle', 'preposition', 'conjunction', 'adv'])

function contrastPartners(baku: string): string[] {
  const b = baku.toLowerCase()
  const partners: string[] = []
  for (const [x, y] of CONTRAST_PAIRS) {
    if (x === b) partners.push(y)
    if (y === b) partners.push(x)
  }
  return partners
}

function tagPriority(w: Word): number {
  const idx = w.tags.map((t) => TAG_PRIORITY.indexOf(t)).filter((i) => i >= 0)
  return idx.length ? Math.min(...idx) : TAG_PRIORITY.length
}

export function sortBacklog(backlog: Word[], studiedCount: number): Word[] {
  const early = studiedCount < 50
  return [...backlog].sort((a, b) => {
    // Queued (harvest overflow) always first, oldest queue entry first.
    const qa = a.queuedAt ?? Infinity
    const qb = b.queuedAt ?? Infinity
    if (qa !== qb) return qa - qb
    // Early on, concrete words before grammatical machinery.
    if (early) {
      const ga = GRAMMATICAL_POS.has(a.pos) ? 1 : 0
      const gb = GRAMMATICAL_POS.has(b.pos) ? 1 : 0
      if (ga !== gb) return ga - gb
    }
    const pa = tagPriority(a)
    const pb = tagPriority(b)
    if (pa !== pb) return pa - pb
    return a.addedAt - b.addedAt
  })
}

/**
 * Pick up to `count` words from the backlog respecting diversity constraints.
 * `alreadyIntroducedToday` covers harvested words that consumed budget earlier.
 */
export function pickDiverse(
  backlog: Word[],
  count: number,
  studiedCount: number,
  alreadyIntroducedToday: Word[] = [],
): Word[] {
  const sorted = sortBacklog(backlog, studiedCount)
  const picked: Word[] = []
  const posCount = new Map<string, number>()
  const taken = new Set<string>()
  for (const w of alreadyIntroducedToday) {
    posCount.set(w.pos, (posCount.get(w.pos) ?? 0) + 1)
    taken.add(w.baku.toLowerCase())
  }
  for (const w of sorted) {
    if (picked.length >= count) break
    if ((posCount.get(w.pos) ?? 0) >= 2) continue
    const partners = contrastPartners(w.baku)
    if (partners.some((p) => taken.has(p))) continue
    picked.push(w)
    posCount.set(w.pos, (posCount.get(w.pos) ?? 0) + 1)
    taken.add(w.baku.toLowerCase())
  }
  return picked
}
