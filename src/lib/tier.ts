/**
 * Difficulty ramp keyed to studied-word count (remediation P0.1).
 * Shared between client (selection, rendering) and server (prompt + validation) —
 * the tier is sent explicitly in the generation request; the model never has to
 * infer level from list sizes.
 */

export interface Tier {
  id: 0 | 1 | 2 | 3
  /** Preferred passage shape at this tier. */
  format: 'dialogue' | 'either'
  lengthWords: [number, number]
  /** Hard daily cap on new words at this tier (min with the user setting). */
  maxNewWordsPerDay: number
  /** New words featured in the passage. */
  passageNewWords: number
  /** Required vocabulary containment (fraction of tokens inside the allowed set). */
  containment: number
  /** Minimum occurrences of each new word in the passage. */
  minOccurrences: number
  /** How glosses are shown: under every line / tap per line / one translation toggle. */
  glossMode: 'always' | 'tap' | 'toggle'
  /** Language of the comprehension question. */
  questionLanguage: 'english' | 'bilingual' | 'malay'
}

export const TIERS: Tier[] = [
  {
    id: 0,
    format: 'dialogue',
    lengthWords: [15, 35],
    maxNewWordsPerDay: 3,
    passageNewWords: 3,
    containment: 1.0,
    minOccurrences: 3,
    glossMode: 'always',
    questionLanguage: 'english',
  },
  {
    id: 1,
    format: 'either',
    lengthWords: [30, 60],
    maxNewWordsPerDay: 5,
    passageNewWords: 5,
    containment: 0.95,
    minOccurrences: 2,
    glossMode: 'tap',
    questionLanguage: 'bilingual',
  },
  {
    id: 2,
    format: 'either',
    lengthWords: [50, 90],
    maxNewWordsPerDay: 99,
    passageNewWords: 5,
    containment: 0.95,
    minOccurrences: 2,
    glossMode: 'tap',
    questionLanguage: 'bilingual',
  },
  {
    id: 3,
    format: 'either',
    lengthWords: [60, 110],
    maxNewWordsPerDay: 99,
    passageNewWords: 5,
    containment: 0.9,
    minOccurrences: 2,
    glossMode: 'toggle',
    questionLanguage: 'malay',
  },
]

export function tierFor(studiedCount: number): Tier {
  if (studiedCount < 25) return TIERS[0]
  if (studiedCount < 75) return TIERS[1]
  if (studiedCount < 200) return TIERS[2]
  return TIERS[3]
}

/** Function-word whitelist from brief §5.2 — always allowed in passages. */
export const FUNCTION_WORDS = [
  'di', 'ke', 'dari', 'yang', 'dan', 'atau', 'ini', 'itu', 'ada', 'dengan',
  'untuk', 'pada', 'juga', 'sudah', 'belum', 'akan',
]
