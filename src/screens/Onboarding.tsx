import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, saveSettings } from '../db/db'
import type { Word } from '../db/types'
import { knownCard } from '../lib/fsrs'
import { RegisterChip } from '../components/RegisterChip'

/**
 * One-time self-assessment: swipe the seed deck marking words you already know.
 * Known words enter the SRS as studied. Re-runnable from Settings (?redo=1),
 * where it walks only the backlog.
 */
export function Onboarding() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redo = params.get('redo') === '1'
  const [words, setWords] = useState<Word[] | null>(null)
  const [i, setI] = useState(0)
  const [knownCount, setKnownCount] = useState(0)

  useEffect(() => {
    ;(async () => {
      const all = await db.words.orderBy('addedAt').toArray()
      if (!redo) return setWords(all)
      const withCard = new Set((await db.cards.toArray()).map((c) => c.wordId))
      setWords(all.filter((w) => !withCard.has(w.id)))
    })()
  }, [redo])

  async function finish() {
    if (!redo) await saveSettings({ onboarded: true })
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

  useEffect(() => {
    if (words && words.length === 0) navigate('/', { replace: true })
  }, [words, navigate])

  if (!words || words.length === 0 || i >= words.length) return null
  const w = words[i]

  return (
    <div className="min-h-dvh flex flex-col max-w-md mx-auto">
      <header className="bg-indigo text-plaster px-5 pt-6 pb-5">
        <div className="mono text-gold">
          {redo ? 'PENILAIAN SEMULA · REASSESS' : 'SELAMAT DATANG · WELCOME'}
        </div>
        <h1 className="display text-plaster text-2xl mt-2">
          {redo ? 'Tanda kata yang anda tahu' : 'Selamat datang ke Bukit'}
        </h1>
        <p className="text-indigo-hi text-sm mt-1">
          {redo
            ? 'Mark any backlog words you already know — they join your reviews as studied.'
            : 'Mark the words you already know. They join your review pile; everything else waits in the backlog.'}
        </p>
        <div className="mono-sm text-indigo-lo mt-3">
          {i + 1} / {words.length} · {knownCount} known
        </div>
        <div className="h-1 bg-indigo-rl mt-1.5">
          <div className="h-full bg-gold" style={{ width: `${((i + 1) / words.length) * 100}%` }} />
        </div>
      </header>

      <div key={w.id} className="fade-in flex-1 flex flex-col justify-center text-center px-6 py-8">
        <div className="display text-indigo" style={{ fontSize: 'clamp(44px, 15vw, 68px)' }}>
          {w.baku}
        </div>
        {w.arabic_cognate && (
          <div className="text-gold text-2xl mt-2" dir="rtl">
            {w.arabic_cognate}
          </div>
        )}
        <div className="text-muted mt-3">{w.gloss_en}</div>
        <div className="mt-4 flex flex-wrap justify-center items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5">
            <RegisterChip kind="baku" />
            <span className="font-medium">{w.baku}</span>
          </span>
          {w.colloquial && (
            <span className="flex items-center gap-1.5">
              <RegisterChip kind="colloq" />
              <span className="font-medium">{w.colloquial}</span>
            </span>
          )}
          {w.utara && (
            <span className="flex items-center gap-1.5">
              <RegisterChip kind="utara" />
              <span className="font-medium">{w.utara}</span>
            </span>
          )}
        </div>
      </div>

      <div className="px-5 pb-6">
        <div className="grid grid-cols-2 border-[1.5px] border-charcoal rounded-[4px] overflow-hidden">
          <button
            onClick={() => mark(false)}
            className="py-4 bg-transparent text-charcoal border-r-[1.5px] border-charcoal active:bg-charcoal/5"
          >
            <span className="font-semibold">Belum</span>
            <span className="mono-sm block text-muted mt-0.5">not yet</span>
          </button>
          <button
            onClick={() => mark(true)}
            className="py-4 bg-jade text-jade-ink active:opacity-90"
          >
            <span className="font-semibold">Tahu</span>
            <span className="mono-sm block text-jade-ink/70 mt-0.5">I know this</span>
          </button>
        </div>
        <button onClick={finish} className="mt-4 w-full text-muted text-sm">
          {redo ? 'Selesai · done' : 'Skip the rest — everything else goes to the backlog'}
        </button>
      </div>
    </div>
  )
}
