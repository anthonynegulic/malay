import { db, getSettings, uid } from '../db/db'
import type { Session, Word } from '../db/types'
import { dueCount, newCard } from './fsrs'

export function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Start of tomorrow, local time — when today's new-word cards first come due (Q2 decision). */
export function tomorrowStart(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(4, 0, 0, 0) // 4am, so late-night sessions don't make cards due mid-session
  return d
}

export async function getOrCreateTodaySession(): Promise<Session> {
  const date = todayStr()
  const due = await dueCount()
  // id === date, created inside a transaction: idempotent under StrictMode's
  // doubled effects and concurrent callers.
  return db.transaction('rw', db.sessions, async () => {
    const existing = await db.sessions.get(date)
    if (existing) return existing
    const s: Session = {
      id: date,
      date,
      type: 'reviews_only',
      reviewsDone: 0,
      newWordsLearned: 0,
      outputAttempted: false,
      dueAtStart: due,
    }
    await db.sessions.put(s)
    return s
  })
}

export async function updateSession(patch: Partial<Session>): Promise<Session> {
  const s = await getOrCreateTodaySession()
  const next = { ...s, ...patch }
  await db.sessions.put(next)
  return next
}

/** Words already introduced today (cards created today), counted against the cap. */
export async function newWordsUsedToday(): Promise<number> {
  const s = await getOrCreateTodaySession()
  return s.newWordsLearned
}

export async function newWordBudgetRemaining(): Promise<number> {
  const settings = await getSettings()
  const used = await newWordsUsedToday()
  return Math.max(0, settings.newWordsPerDay - used)
}

/**
 * Domain priority for scheduling new words from the seed backlog.
 * Earlier tags win; within a tag, seed order (addedAt) wins.
 */
const TAG_PRIORITY = [
  'survival',
  'numbers',
  'time',
  'food',
  'market',
  'family',
  'transport',
  'masjid',
  'school',
]

function wordPriority(w: Word): number {
  const idx = w.tags.map((t) => TAG_PRIORITY.indexOf(t)).filter((i) => i >= 0)
  return idx.length ? Math.min(...idx) : TAG_PRIORITY.length
}

/** Words with no card yet = the backlog. Queued-yesterday words come first. */
export async function backlogWords(): Promise<Word[]> {
  const cards = await db.cards.toArray()
  const withCard = new Set(cards.map((c) => c.wordId))
  const all = await db.words.toArray()
  const backlog = all.filter((w) => !withCard.has(w.id))
  backlog.sort((a, b) => {
    const qa = a.queuedAt ?? Infinity
    const qb = b.queuedAt ?? Infinity
    if (qa !== qb) return qa - qb
    const pa = wordPriority(a)
    const pb = wordPriority(b)
    if (pa !== pb) return pa - pb
    return a.addedAt - b.addedAt
  })
  return backlog
}

/**
 * Pick today's new words for the passage: 3–5, capped by remaining budget.
 * Does NOT create cards — cards are created once the passage actually
 * generates (introduceWords), so a failed generation doesn't burn budget.
 */
export async function pickNewWords(): Promise<Word[]> {
  const budget = await newWordBudgetRemaining()
  if (budget <= 0) return []
  const n = Math.min(5, budget)
  const backlog = await backlogWords()
  return backlog.slice(0, n)
}

/**
 * Introduce words: create their cards due tomorrow (first retrieval is the
 * NEXT day — the Review phase never shows a never-met card), consume budget.
 */
export async function introduceWords(words: Word[]): Promise<void> {
  if (!words.length) return
  const due = tomorrowStart()
  await db.cards.bulkAdd(words.map((w) => newCard(w.id, due)))
  await db.words.bulkPut(words.map((w) => ({ ...w, queuedAt: undefined })))
  const s = await getOrCreateTodaySession()
  await updateSession({ newWordsLearned: s.newWordsLearned + words.length })
}

export type HarvestResult = 'added' | 'queued' | 'already'

/**
 * Tap-to-harvest from the passage. Within budget → card due tomorrow.
 * Over budget → queued for tomorrow ("esok").
 */
export async function harvestWord(
  surface: string,
  gloss: string | undefined,
): Promise<HarvestResult> {
  const clean = surface.toLowerCase().replace(/[^a-zÀ-ɏ'-]/g, '')
  if (!clean) return 'already'
  let word = await db.words.where('baku').equals(clean).first()
  if (!word) {
    // Not in inventory — create a harvested word.
    word = {
      id: uid(),
      baku: clean,
      pos: 'phrase',
      gloss_en: gloss ?? '',
      example_baku: '',
      tags: ['harvested'],
      source: 'harvested',
      addedAt: Date.now(),
    }
    await db.words.add(word)
  }
  const existingCard = await db.cards.where('wordId').equals(word.id).first()
  if (existingCard) return 'already'

  const budget = await newWordBudgetRemaining()
  if (budget > 0) {
    await introduceWords([word])
    return 'added'
  }
  await db.words.put({ ...word, queuedAt: Date.now() })
  return 'queued'
}

/** A day counts toward the weekly rhythm if any session row exists with work done. */
export function sessionCounts(s: Session): boolean {
  return s.reviewsDone > 0 || s.newWordsLearned > 0 || s.type === 'full'
}

export interface WeekRhythm {
  daysDone: number
  target: number
  /** Mon..Sun for the current week; true = counted day, null = future. */
  days: (boolean | null)[]
}

export async function weekRhythm(): Promise<WeekRhythm> {
  const settings = await getSettings()
  const now = new Date()
  const dow = (now.getDay() + 6) % 7 // Monday = 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - dow)
  const days: (boolean | null)[] = []
  let daysDone = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    if (i > dow) {
      days.push(null)
      continue
    }
    const s = await db.sessions.where('date').equals(todayStr(d)).first()
    const done = Boolean(s && sessionCounts(s))
    if (done) daysDone++
    days.push(done)
  }
  return { daysDone, target: settings.weeklyTargetDays, days }
}

/** Full session history for the footpath: date → counted. */
export async function historyDays(): Promise<{ date: string; counted: boolean }[]> {
  const sessions = await db.sessions.orderBy('date').toArray()
  return sessions.map((s) => ({ date: s.date, counted: sessionCounts(s) }))
}
