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

export interface Passage {
  id: string
  date: string // YYYY-MM-DD
  register: Register
  topic: string
  text: string
  translation: string
  glossary: { word: string; gloss: string }[]
  question: { prompt: string; answer: string }
  newWordIds: string[]
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
