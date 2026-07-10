import { db, getSettings, uid } from '../db/db'
import type { Session, Word } from '../db/types'
import { dueCount, newCard } from './fsrs'
import { pickDiverse } from './select'
import { tierFor, type Tier } from './tier'

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

/** Accumulate a per-phase duration on today's session row (§4.1: drift must be
 *  visible on Kemajuan). Accumulated, not overwritten — phases can be revisited. */
export async function addPhaseMs(
  field: 'reviewMs' | 'readMs' | 'speakMs' | 'recallMs',
  ms: number,
): Promise<void> {
  if (ms <= 0) return
  const s = await getOrCreateTodaySession()
  await updateSession({ [field]: (s[field] ?? 0) + ms })
}

/** True once any day has ever counted — gate for the day-0 fast path. */
export async function hasEverCompletedSession(): Promise<boolean> {
  const sessions = await db.sessions.toArray()
  return sessions.some(sessionCounts)
}

/**
 * Today's introduced words (scheduled + harvested): their cards exist with zero
 * reps and a future due date (tomorrow 4am) — yesterday's unreviewed cards are
 * due in the past, so they can't leak in. Powers the ungraded recall pass.
 */
export async function todaysNewWords(): Promise<Word[]> {
  const now = Date.now()
  const cards = await db.cards.toArray()
  const ids = cards.filter((c) => c.reps === 0 && c.due > now).map((c) => c.wordId)
  return ((await db.words.bulkGet(ids)).filter(Boolean) as Word[]) ?? []
}

/**
 * Projected full-session length (§4.1): due count × observed per-card time,
 * plus observed read/speak time. Trailing averages from logged phase durations;
 * conservative priors before any data exists. Powers a gentle pre-session note
 * offering Sikit je — never a block.
 */
export async function projectedSessionMs(): Promise<number> {
  const due = await dueCount()
  const recent = await db.sessions.orderBy('date').reverse().limit(14).toArray()
  const reviewed = recent.filter((s) => (s.reviewMs ?? 0) > 0 && s.reviewsDone > 0)
  const perCardMs = reviewed.length
    ? reviewed.reduce((a, s) => a + (s.reviewMs ?? 0), 0) /
      reviewed.reduce((a, s) => a + s.reviewsDone, 0)
    : 6_000
  const avg = (field: 'readMs' | 'speakMs', prior: number) => {
    const logged = recent.map((s) => s[field] ?? 0).filter((v) => v > 0)
    return logged.length ? logged.reduce((a, v) => a + v, 0) / logged.length : prior
  }
  return due * perCardMs + avg('readMs', 5 * 60_000) + avg('speakMs', 3 * 60_000)
}

/** Days counted per trailing week (oldest first, current week last) — the
 *  December-checkpoint consistency trend. */
export async function trailingWeeks(n: number): Promise<number[]> {
  const now = new Date()
  const dow = (now.getDay() + 6) % 7 // Monday = 0
  const monday = new Date(now)
  monday.setDate(now.getDate() - dow)
  monday.setHours(0, 0, 0, 0)
  const sessions = await db.sessions.toArray()
  const counted = new Set(sessions.filter(sessionCounts).map((s) => s.date))
  const weeks: number[] = []
  for (let w = n - 1; w >= 0; w--) {
    let done = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() - w * 7 + i)
      if (counted.has(todayStr(d))) done++
    }
    weeks.push(done)
  }
  return weeks
}

/** Words already introduced today (cards created today), counted against the cap. */
export async function newWordsUsedToday(): Promise<number> {
  const s = await getOrCreateTodaySession()
  return s.newWordsLearned
}

export async function studiedCount(): Promise<number> {
  return db.cards.count()
}

export async function currentTier(): Promise<Tier> {
  return tierFor(await studiedCount())
}

/**
 * Daily new-word budget: the user setting capped by the tier's daily maximum
 * (P0.1) — shared between scheduled new words and harvesting.
 */
export async function newWordBudgetRemaining(): Promise<number> {
  const settings = await getSettings()
  const tier = await currentTier()
  const cap = Math.min(settings.newWordsPerDay, tier.maxNewWordsPerDay)
  const used = await newWordsUsedToday()
  return Math.max(0, cap - used)
}

/** Words with no card yet = the backlog (unsorted; selection sorts). */
export async function backlogWords(): Promise<Word[]> {
  const cards = await db.cards.toArray()
  const withCard = new Set(cards.map((c) => c.wordId))
  const all = await db.words.toArray()
  return all.filter((w) => !withCard.has(w.id))
}

/**
 * Pick today's new words for the passage, capped by remaining budget and the
 * tier's passage count, with P0.3 diversity constraints (max 2 per POS, no
 * contrast pairs, concrete-first while studied < 50). Does NOT create cards —
 * cards are created once the passage actually generates (introduceWords), so a
 * failed generation doesn't burn budget.
 */
export async function pickNewWords(): Promise<Word[]> {
  const budget = await newWordBudgetRemaining()
  if (budget <= 0) return []
  const tier = await currentTier()
  const n = Math.min(tier.passageNewWords, budget)
  const backlog = await backlogWords()
  const studied = await studiedCount()

  // Words already introduced today (harvests) count toward diversity limits.
  const s = await getOrCreateTodaySession()
  let introducedToday: Word[] = []
  if (s.newWordsLearned > 0) {
    const cards = await db.cards.toArray()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayIds = cards
      .filter((c) => c.reps === 0 && c.due > todayStart.getTime())
      .map((c) => c.wordId)
    introducedToday = ((await db.words.bulkGet(todayIds)).filter(Boolean) as Word[]) ?? []
  }

  return pickDiverse(backlog, n, studied, introducedToday)
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
  /** Mon..Sun for the current week; true = counted day, false = past gap, null = future. */
  days: (boolean | null)[]
  /** Index (Mon=0) of today, so the UI can mark it distinctly. */
  todayIndex: number
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
  return { daysDone, target: settings.weeklyTargetDays, days, todayIndex: dow }
}

/** Full session history for the footpath: date → counted. */
export async function historyDays(): Promise<{ date: string; counted: boolean }[]> {
  const sessions = await db.sessions.orderBy('date').toArray()
  return sessions.map((s) => ({ date: s.date, counted: sessionCounts(s) }))
}

export const MILESTONES = [100, 250, 500, 1000]

export function nextMilestone(count: number): number {
  return MILESTONES.find((m) => count < m) ?? MILESTONES[MILESTONES.length - 1]
}

/**
 * Word of the day for the Today header — deterministic by date so it's stable
 * through the day and rotates daily. Drawn from studied words (reinforcement).
 * Before any word is studied, it previews today's first upcoming new word
 * instead ("caption, don't suppress" — first-run ruling §2.4): pickDiverse is
 * deterministic and pickNewWords creates no cards, so the preview costs nothing
 * and matches what the passage will introduce.
 */
export async function wordOfTheDay(
  date = todayStr(),
): Promise<{ word: Word; first: boolean } | undefined> {
  const cards = await db.cards.toArray()
  const studiedIds = new Set(cards.map((c) => c.wordId))
  const all = await db.words.orderBy('addedAt').toArray()
  const pool = all.filter((w) => studiedIds.has(w.id))
  if (!pool.length) {
    const upcoming = await pickNewWords()
    if (upcoming.length) return { word: upcoming[0], first: true }
    const seedPool = all.filter((w) => w.source === 'seed')
    if (!seedPool.length) return undefined
    let h = 0
    for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0
    return { word: seedPool[h % seedPool.length], first: false }
  }
  let h = 0
  for (let i = 0; i < date.length; i++) h = (h * 31 + date.charCodeAt(i)) >>> 0
  return { word: pool[h % pool.length], first: false }
}
