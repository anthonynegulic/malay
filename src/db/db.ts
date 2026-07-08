import Dexie, { type Table } from 'dexie'
import type { Card, Passage, Session, Settings, Word } from './types'
import { DEFAULT_SETTINGS } from './types'
import seed from '../data/seed.json'

class BukitDB extends Dexie {
  words!: Table<Word, string>
  cards!: Table<Card, string>
  passages!: Table<Passage, string>
  sessions!: Table<Session, string>
  settings!: Table<Settings, string>

  constructor() {
    super('bukit')
    this.version(1).stores({
      words: 'id, baku, source, queuedAt, addedAt, *tags',
      cards: 'id, wordId, due, state',
      passages: 'id, date, [date+register]',
      sessions: 'id, date',
      settings: 'id',
    })
  }
}

export const db = new BukitDB()

export function uid(): string {
  return crypto.randomUUID()
}

/**
 * Import the seed deck on first run. Idempotent even under React StrictMode's
 * doubled effects: deterministic ids + bulkPut inside a transaction.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.words, async () => {
    const count = await db.words.count()
    if (count > 0) return
    const now = Date.now()
    const words: Word[] = (seed as Omit<Word, 'id' | 'addedAt'>[]).map((w, i) => ({
      ...w,
      id: `seed-${i}`,
      // Preserve seed order for new-word priority: earlier = higher priority.
      addedAt: now + i,
    }))
    await db.words.bulkPut(words)
  })
}

export async function getSettings(): Promise<Settings> {
  const s = await db.settings.get('settings')
  if (s) return { ...DEFAULT_SETTINGS, ...s }
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const s = await getSettings()
  await db.settings.put({ ...s, ...patch, id: 'settings' })
}
