import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs'
import type { Card, CardState } from '../db/types'
import { db, uid } from '../db/db'

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }))

export { Rating }
export type { Grade }

const STATE_TO_STR: Record<number, CardState> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}
const STR_TO_STATE: Record<CardState, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}

function toFsrs(c: Card): FsrsCard {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsedDays,
    scheduled_days: c.scheduledDays,
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: STR_TO_STATE[c.state],
    last_review: c.lastReview ? new Date(c.lastReview) : undefined,
  }
}

function fromFsrs(f: FsrsCard, id: string, wordId: string): Card {
  return {
    id,
    wordId,
    due: f.due.getTime(),
    stability: f.stability,
    difficulty: f.difficulty,
    elapsedDays: f.elapsed_days,
    scheduledDays: f.scheduled_days,
    learningSteps: f.learning_steps,
    reps: f.reps,
    lapses: f.lapses,
    state: STATE_TO_STR[f.state],
    lastReview: f.last_review ? f.last_review.getTime() : undefined,
  }
}

/** Create a brand-new card for a word, due at the given time (default: now). */
export function newCard(wordId: string, due?: Date): Card {
  const f = createEmptyCard(due ?? new Date())
  const c = fromFsrs(f, uid(), wordId)
  if (due) c.due = due.getTime()
  return c
}

/**
 * Create a card for a word the user marked as already known during
 * onboarding. Grade one Easy review immediately, then jitter the due date
 * across the next two weeks so a large known-set doesn't come due as one lump.
 */
export function knownCard(wordId: string): Card {
  const f = createEmptyCard(new Date())
  const { card } = scheduler.next(f, new Date(), Rating.Easy)
  const c = fromFsrs(card, uid(), wordId)
  const jitterDays = Math.floor(Math.random() * 14)
  c.due = c.due + jitterDays * 24 * 60 * 60 * 1000
  return c
}

/** Apply a review grade and return the updated card. */
export function gradeCard(card: Card, rating: Grade): Card {
  const { card: next } = scheduler.next(toFsrs(card), new Date(), rating)
  return fromFsrs(next, card.id, card.wordId)
}

/** Preview interval labels for the four grade buttons (e.g. "10m", "3d"). */
export function previewIntervals(card: Card): Record<'again' | 'hard' | 'good' | 'easy', string> {
  const now = new Date()
  const f = toFsrs(card)
  const label = (r: Grade) => {
    const { card: next } = scheduler.next(f, now, r)
    const mins = Math.max(1, Math.round((next.due.getTime() - now.getTime()) / 60000))
    if (mins < 60) return `${mins}m`
    if (mins < 60 * 24) return `${Math.round(mins / 60)}h`
    const days = Math.round(mins / (60 * 24))
    if (days < 30) return `${days}d`
    return `${Math.round(days / 30)}mo`
  }
  return {
    again: label(Rating.Again),
    hard: label(Rating.Hard),
    good: label(Rating.Good),
    easy: label(Rating.Easy),
  }
}

export async function dueCards(limit?: number) {
  const now = Date.now()
  let q = db.cards.where('due').belowOrEqual(now)
  const cards = await q.sortBy('due')
  return limit ? cards.slice(0, limit) : cards
}

export async function dueCount(): Promise<number> {
  return db.cards.where('due').belowOrEqual(Date.now()).count()
}
