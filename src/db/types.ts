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
  /** English translation of the example block (R2). Same meaning across registers
   *  unless example_colloq_en says otherwise. Harvested words have no examples. */
  example_en?: string
  /** Register of the second example sentence. Defaults to 'colloq'; 'utara' where
   *  the sentence uses northern forms (Q2 ruling: honest labels). */
  example_colloq_kind?: 'colloq' | 'utara'
  /** Own gloss for example_colloq when it is a different sentence, not a
   *  rendering of example_baku (e.g. duduk: "Sila duduk" vs "Kau duduk mana?"). */
  example_colloq_en?: string
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
  /** Grammar whisper (pedagogy-response §3.4): one noticed form per passage,
   *  validator-checked to appear verbatim in the text. Absent when the model
   *  failed to produce a valid one. */
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
  /** Ungraded end-of-lesson recall pass completed (pedagogy-response §1-Q1). */
  recallDone?: boolean
  /** Free-practice sessions run today (R4 — log only, never touches FSRS). */
  freePracticeRuns?: number
  /** Per-phase durations in ms (pedagogy-response §4.1 — drift visible, not resented). */
  reviewMs?: number
  readMs?: number
  speakMs?: number
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
  /** Version of the seed deck applied to this install — bump SEED_VERSION in
   *  db.ts when seed content changes so existing installs get patched in place. */
  seedVersion?: number
  /** December-checkpoint self-test checklist marks (index-aligned with CHECKPOINT.checklist). */
  checkpointMarks?: boolean[]
  /** Epoch ms of the last successful JSON export — powers the backup-age nudge. */
  lastBackupAt?: number
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
