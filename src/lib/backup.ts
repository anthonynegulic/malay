import { db } from '../db/db'

interface Backup {
  app: 'bukit'
  version: 1
  exportedAt: string
  words: unknown[]
  cards: unknown[]
  passages: unknown[]
  sessions: unknown[]
  settings: unknown[]
}

export async function exportBackup(): Promise<void> {
  const backup: Backup = {
    app: 'bukit',
    version: 1,
    exportedAt: new Date().toISOString(),
    words: await db.words.toArray(),
    cards: await db.cards.toArray(),
    passages: await db.passages.toArray(),
    sessions: await db.sessions.toArray(),
    settings: await db.settings.toArray(),
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bukit-backup-${backup.exportedAt.slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<void> {
  const data = JSON.parse(await file.text()) as Backup
  if (data.app !== 'bukit') throw new Error('Not a Bukit backup file')
  await db.transaction('rw', [db.words, db.cards, db.passages, db.sessions, db.settings], async () => {
    await Promise.all([
      db.words.clear(),
      db.cards.clear(),
      db.passages.clear(),
      db.sessions.clear(),
      db.settings.clear(),
    ])
    await db.words.bulkAdd(data.words as never[])
    await db.cards.bulkAdd(data.cards as never[])
    await db.passages.bulkAdd(data.passages as never[])
    await db.sessions.bulkAdd(data.sessions as never[])
    await db.settings.bulkAdd(data.settings as never[])
  })
}
