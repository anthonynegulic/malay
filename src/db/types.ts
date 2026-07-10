export type Pos =
  | 'noun'
  | 'verb'
  | 'adj'
  | 'adv'
  | 'pronoun'
  | 'particle'
  | 'phrase'
  | 'number'
  | 'preposition'
  | 'conjunction'

export type Register = 'baku' | 'colloquial'

export interface Word {
  id: string
  baku: string
  colloquial?: string
  utara?: string
  pos: Pos
  gloss_en: string
  arabic_cognate?: string
  example_baku: string
  example_colloq?: string
  tags: string[]
  source: 'seed' | 'harvested'
  addedAt: number
  /** Set when the word is queued for tomorrow because today's new-word cap was hit. */
  queuedAt?: number
}

export type CardState = 'new' | 'learning' | 'review' | 'relearning'

/** FSRS state, one card per word (D6 — recognition direction only). */
export interface Card {
  id: string
  wordId: string
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: CardState
  lastReview?: number
}

export interface PassageLine {
  speaker: 'A' | 'B' | null
  text: string
  gloss: string
}

export interface Passage {
  id: string
  date: string // YYYY-MM-DD
  register: Register
  topic: string
  /** Joined text of all lines — used for harvesting/tokenising. */
  text: string
  /** Tier-aware structure (P0.1): dialogue lines or prose sentences with glosses. */
  format: 'dialogue' | 'prose'
  lines: PassageLine[]
  /** Difficulty tier this passage was generated at. */
  tier: 0 | 1 | 2 | 3
  translation: string
  glossary: { word: string; gloss: string }[]
  question: { prompt: string; promptEn: string; answer: string }
  newWordIds: string[]
  /**
   * Grammar whisper (pedagogy response §3.4): exactly one plain-language
   * observation drawn from this passage. Absent when the model's notice failed
   * verbatim-form validation — never rendered unvalidated.
   */
  notice?: { form: string; note: string }
}

export interface Session {
  id: string
  date: string // YYYY-MM-DD
  type: 'full' | 'reviews_only'
  reviewsDone: number
  newWordsLearned: number
  outputAttempted: boolean
  /** Due count at first open of the day — powers the review-debt trend. */
  dueAtStart: number
  /** Honest self-mark on the comprehension question (P2 — data only, no gating). */
  comprehension?: 'betul' | 'tak'
  /** Per-phase durations (pedagogy response §4.1) — session-time drift must be
   *  visible on Kemajuan, not discovered by resentment. Accumulated per day. */
  reviewMs?: number
  readMs?: number
  speakMs?: number
  recallMs?: number
  /** The ungraded end-of-lesson recall pass was completed (no FSRS data). */
  recallDone?: boolean
}

export interface Settings {
  id: 'settings'
  newWordsPerDay: number // default 7, range 3–10
  registerPreference: Register
  ttsEnabled: boolean
  userContext: string
  /** Weekly rhythm target: days per week that count as "on rhythm". */
  weeklyTargetDays: number
  onboarded: boolean
  /** December-checkpoint self-test items ticked off (ids from CHECKPOINT.checklist).
   *  Self-marked in Penang — a list and a date, no gamification. */
  checkpointDone?: string[]
}

export const DEFAULT_SETTINGS: Settings = {
  id: 'settings',
  newWordsPerDay: 7,
  registerPreference: 'baku',
  ttsEnabled: true,
  userContext:
    'Father of two young boys, loves specialty coffee, attends the masjid, planning life in Penang.',
  weeklyTargetDays: 5,
  onboarded: false,
}

export interface GradeResult {
  understood: boolean
  corrected: string
  encouragement: string
  notes: string[]
}
