import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, saveSettings } from '../db/db'
import type { Word } from '../db/types'
import { knownCard } from '../lib/fsrs'
import { VariantRow } from '../components/RegisterChip'

/**
 * One-time self-assessment: swipe through the seed deck marking words you
 * already know. Known words enter the SRS as studied — day-one reviews are
 * honest (prior Ling exposure + Arabic loanwords count for something).
 */
export function Onboarding() {
  const navigate = useNavigate()
  const [words, setWords] = useState<Word[] | null>(null)
  const [i, setI] = useState(0)
  const [knownCount, setKnownCount] = useState(0)

  useEffect(() => {
    db.words.orderBy('addedAt').toArray().then(setWords)
  }, [])

  async function finish() {
    await saveSettings({ onboarded: true })
    navigate('/', { replace: true })
  }

  async function mark(known: boolean) {
    if (!words) return
    const w = words[i]
    if (known) {
      await db.cards.add(knownCard(w.id))
      setKnownCount((c) => c + 1)
    }
    if (i + 1 >= words.length) await finish()
    else setI(i + 1)
  }

  if (!words) return null
  const w = words[i]

  return (
    <div className="min-h-dvh flex flex-col max-w-md mx-auto px-5 py-8">
      <header className="mb-6">
        <h1 className="font-display font-extrabold text-2xl tracking-tight">
          Selamat datang ke Bukit
        </h1>
        <p className="text-ink/70 mt-1 text-sm">
          One-time setup: mark the words you already know. They join your review pile as studied —
          everything else waits in the backlog.
        </p>
      </header>

      <div className="text-xs font-mono text-ink/60 mb-2">
        {i + 1} / {words.length} · {knownCount} known
      </div>
      <div className="h-1.5 bg-ink/10 rounded-full mb-6">
        <div
          className="h-full bg-shutter rounded-full transition-all"
          style={{ width: `${((i + 1) / words.length) * 100}%` }}
        />
      </div>

      <div key={w.id} className="fade-in bg-white rounded-2xl shadow-sm border border-ink/10 p-6 flex-1 flex flex-col justify-center text-center">
        <div className="headword text-mansion" style={{ fontSize: 'clamp(2.4rem, 12vw, 4rem)' }}>
          {w.baku}
        </div>
        {w.arabic_cognate && (
          <div className="text-brass text-2xl mt-1" dir="rtl">
            {w.arabic_cognate}
          </div>
        )}
        <div className="text-ink/70 mt-3">{w.gloss_en}</div>
        <div className="mt-4 flex justify-center">
          <VariantRow baku={w.baku} colloquial={w.colloquial} utara={w.utara} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-6">
        <button
          onClick={() => mark(false)}
          className="py-4 rounded-xl bg-ink/5 text-ink font-semibold active:scale-[0.98]"
        >
          Belum
          <span className="block text-xs font-normal text-ink/50">not yet</span>
        </button>
        <button
          onClick={() => mark(true)}
          className="py-4 rounded-xl bg-shutter text-limewash font-semibold active:scale-[0.98]"
        >
          Tahu
          <span className="block text-xs font-normal text-limewash/70">I know this</span>
        </button>
      </div>
      <button onClick={finish} className="mt-4 text-sm text-ink/50 underline underline-offset-2">
        Skip the rest — everything else goes to the backlog
      </button>
    </div>
  )
}
