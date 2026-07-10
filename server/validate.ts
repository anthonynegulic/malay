/**
 * Containment validator (remediation P0.2) — the hard gate the v1 prompt lacked.
 * Pure functions, no I/O, so it can be unit-tested with tsx.
 */

export interface PassageLine {
  speaker?: string | null
  text: string
  gloss?: string
}

export interface ValidationInput {
  lines: PassageLine[]
  allowed: string[] // studied + today's new words (baku surface forms)
  newWords: string[]
  functionWords: string[]
  containment: number // required fraction, e.g. 1.0 / 0.95 / 0.9
  minOccurrences: number
}

export interface ValidationResult {
  ok: boolean
  containmentRatio: number
  violations: string[] // out-of-set tokens (unique)
  underused: string[] // new words below their minimum occurrence count
}

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFC')
}

/**
 * Tokenise passage text against an allowed set. Multi-word inventory items
 * ("kamu semua", "terima kasih") are fused into single tokens first.
 */
export function tokenise(rawText: string, multiWordUnits: string[]): string[] {
  let text = ' ' + normalise(rawText) + ' '
  // Longest-first so "selamat pagi" wins over "selamat".
  const units = [...multiWordUnits].sort((a, b) => b.length - a.length)
  for (const unit of units) {
    const u = normalise(unit)
    if (!u.includes(' ')) continue
    text = text.split(u).join(u.replace(/ /g, '_'))
  }
  return text
    .split(/[^a-zà-ɏ'\-_0-9]+/i)
    .map((t) => t.replace(/^[-']+|[-']+$/g, ''))
    .filter(Boolean)
}

function isNumeral(token: string): boolean {
  return /^[0-9]+$/.test(token)
}

/**
 * Proper-noun heuristic: the token appears capitalised in the original text at a
 * non-sentence-initial position (mid-sentence capital = name/place). Sentence-
 * initial capitals get no free pass — "Bersyukur" at line start is a violation.
 */
export function properNouns(rawText: string): Set<string> {
  const result = new Set<string>()
  // Positions after sentence-ending punctuation, a line start, or a dialogue
  // speaker label ("A:") are sentence-initial.
  const midSentenceCaps = rawText.matchAll(/(?<![.!?:\n]\s{0,3})(?<=\S\s)([A-ZÀ-Ý][a-zà-ÿ'\-]+)/g)
  for (const m of midSentenceCaps) result.add(normalise(m[1]))
  return result
}

/**
 * Grammar-whisper check (pedagogy response §3.4): the noticed form must appear
 * verbatim in the passage. Token-sequence containment, case/punctuation-
 * insensitive, so multi-word forms ("lagu mana") and forms adjacent to
 * punctuation both match honestly.
 */
export function noticeFormInPassage(lines: PassageLine[], form: string): boolean {
  const needle = tokenise(form, [])
  if (!needle.length) return false
  const haystack = tokenise(lines.map((l) => l.text).join('\n'), [])
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return true
  }
  return false
}

export function validatePassage(input: ValidationInput): ValidationResult {
  const allowed = new Set<string>()
  for (const w of [...input.allowed, ...input.functionWords]) {
    allowed.add(normalise(w).replace(/ /g, '_'))
  }

  const fullText = input.lines.map((l) => l.text).join('\n')
  const proper = properNouns(fullText)
  const multiWord = input.allowed.filter((w) => w.includes(' '))
  const tokens = tokenise(fullText, multiWord)

  let inSet = 0
  const violationCounts = new Map<string, number>()
  for (const t of tokens) {
    if (allowed.has(t) || isNumeral(t) || proper.has(t)) {
      inSet++
    } else {
      violationCounts.set(t, (violationCounts.get(t) ?? 0) + 1)
    }
  }
  const ratio = tokens.length === 0 ? 0 : inSet / tokens.length

  const underused: string[] = []
  for (const nw of input.newWords) {
    const needle = normalise(nw).replace(/ /g, '_')
    const count = tokens.filter((t) => t === needle).length
    if (count < input.minOccurrences) underused.push(nw)
  }

  const violations = [...violationCounts.keys()].map((t) => t.replace(/_/g, ' '))
  return {
    ok: ratio >= input.containment && underused.length === 0,
    containmentRatio: ratio,
    violations,
    underused,
  }
}
