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
 * Version of the seed content. Bump when seed.json rows change so existing
 * installs get patched in place (feedback-002 Q1 ruling): the seed only
 * imports on first run, so without this, data fixes never reach a live device.
 *   v1 — original deck
 *   v2 — example_en glosses on every row; example_colloq_kind (utara labels);
 *        example_colloq_en for divergent-meaning colloquial sentences
 */
export const SEED_VERSION = 2

/**
 * Import the seed deck on first run. Idempotent even under React StrictMode's
 * doubled effects: deterministic ids + bulkPut inside a transaction.
 */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.words, db.settings, async () => {
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
    const s = await db.settings.get('settings')
    if (s) await db.settings.put({ ...s, seedVersion: SEED_VERSION })
  })
}

/**
 * Patch seed-* word rows in place when the seed content version has moved on.
 * Cards and FSRS state are untouched (cards reference wordId, which is stable).
 * Identity fields (id, addedAt, queuedAt) survive; every content field is
 * replaced wholesale so removed optional fields don't linger. Patched rows are
 * logged so the upgrade is auditable from the console.
 */
export async function migrateSeed(): Promise<void> {
  const s = await getSettings()
  if ((s.seedVersion ?? 1) >= SEED_VERSION) return

  const patched: string[] = []
  await db.transaction('rw', db.words, db.settings, async () => {
    const rows = seed as Omit<Word, 'id' | 'addedAt'>[]
    for (let i = 0; i < rows.length; i++) {
      const id = `seed-${i}`
      const existing = await db.words.get(id)
      if (!existing) {
        // Seed grew: new rows join the backlog at the end.
        await db.words.put({ ...rows[i], id, addedAt: Date.now() + i })
        patched.push(`${rows[i].baku} (new)`)
        continue
      }
      const next: Word = {
        ...rows[i],
        id,
        addedAt: existing.addedAt,
        ...(existing.queuedAt !== undefined ? { queuedAt: existing.queuedAt } : {}),
      }
      if (JSON.stringify(next) !== JSON.stringify(existing)) {
        await db.words.put(next)
        patched.push(existing.baku)
      }
    }
    const cur = await db.settings.get('settings')
    await db.settings.put({ ...(cur ?? DEFAULT_SETTINGS), seedVersion: SEED_VERSION })
  })
  if (patched.length) {
    console.info(
      `[seed] migrated to v${SEED_VERSION}: patched ${patched.length} rows`,
      patched,
    )
  }
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
