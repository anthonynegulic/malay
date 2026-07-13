import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, saveSettings } from '../db/db'
import type { Word } from '../db/types'
import { knownCard } from '../lib/fsrs'
import { RegisterChip } from '../components/RegisterChip'

const BATCH = 30

/**
 * Onboarding (feedback 001): complete beginners answer one question and go
 * straight in at zero words — no 400-card review. People who already know
 * some Malay get the self-assessment, dealt in batches of 30 with a clear
 * "that's enough" exit after each batch. Re-runnable from Settings (?redo=1),
 * where it walks only the backlog.
 */
export function Onboarding() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const redo = params.get('redo') === '1'
  const [phase, setPhase] = useState<'ask' | 'review'>(redo ? 'review' : 'ask')
  const [words, setWords] = useState<Word[] | null>(null)
  const [i, setI] = useState(0)
  const [knownCount, setKnownCount] = useState(0)
  const [paused, setPaused] = useState(false)

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
    const next = i + 1
    if (next >= words.length) return finish()
    if (next % BATCH === 0) setPaused(true)
    setI(next)
  }

  useEffect(() => {
    if (redo && words && words.length === 0) navigate('/', { replace: true })
  }, [redo, words, navigate])

  if (!words) return null

  /* ——— first question: brand new, or knows some? ——— */
  if (phase === 'ask') {
    return (
      <div className="min-h-dvh flex flex-col max-w-md mx-auto">
        <header className="bg-indigo text-plaster px-5 pt-6 pb-6">
          <div className="mono text-gold">SELAMAT DATANG · WELCOME</div>
          <h1 className="display text-plaster text-2xl mt-2">Selamat datang ke Bukit</h1>
          <p className="text-indigo-hi text-sm mt-1">One question before we start.</p>
        </header>

        <div className="flex-1 flex flex-col justify-center px-5">
          <div className="display text-charcoal text-2xl text-center">
            Pernah belajar Bahasa Melayu?
          </div>
          <div className="text-muted text-center mt-1">Have you studied Malay before?</div>

          <div className="mt-8 space-y-3">
            <button
              onClick={finish}
              className="w-full bg-gold text-gold-ink py-5 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
            >
              <span className="display text-xl">Belum — saya baru bermula</span>
              <span className="mono-sm block text-gold-ink/70 mt-1">
                (no — I&rsquo;m brand new. start from zero)
              </span>
            </button>
            <button
              onClick={() => setPhase('review')}
              className="w-full py-5 rounded-[4px] border-[1.5px] border-charcoal text-charcoal active:bg-charcoal/5"
            >
              <span className="display text-xl">Tahu sikit-sikit</span>
              <span className="mono-sm block text-muted mt-1">
                (I know some — let me mark the words I know)
              </span>
            </button>
          </div>

          <p className="text-muted text-sm text-center mt-6 max-w-xs mx-auto">
            Brand new is the normal answer — the app introduces everything gradually. You can
            re-assess any time from Settings.
          </p>
        </div>
      </div>
    )
  }

  if (words.length === 0 || i >= words.length) return null

  /* ——— batch pause: keep going or stop here? ——— */
  if (paused) {
    return (
      <div className="min-h-dvh flex flex-col max-w-md mx-auto">
        <header className="bg-indigo text-plaster px-5 pt-6 pb-6">
          <div className="mono text-gold">REHAT SEBENTAR · QUICK PAUSE</div>
          <h1 className="display text-plaster text-2xl mt-2">
            {i} kata disemak — {knownCount} tahu
          </h1>
          <p className="text-indigo-hi text-sm mt-1">
            {i} words checked, {knownCount} marked known. {words.length - i} remain.
          </p>
        </header>

        <div className="flex-1 flex flex-col justify-center px-5">
          <div className="space-y-3">
            <button
              onClick={finish}
              className="w-full bg-gold text-gold-ink py-5 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
            >
              <span className="display text-xl">Cukup — mula belajar</span>
              <span className="mono-sm block text-gold-ink/70 mt-1">
                (that&rsquo;s enough — start learning. the rest goes to the backlog)
              </span>
            </button>
            <button
              onClick={() => setPaused(false)}
              className="w-full py-5 rounded-[4px] border-[1.5px] border-charcoal text-charcoal active:bg-charcoal/5"
            >
              <span className="display text-xl">Teruskan</span>
              <span className="mono-sm block text-muted mt-1">(keep marking — {BATCH} more)</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  const w = words[i]

  return (
    <div className="min-h-dvh flex flex-col max-w-md mx-auto">
      <header className="bg-indigo text-plaster px-5 pt-6 pb-5">
        <div className="mono text-gold">
          {redo ? 'PENILAIAN SEMULA · REASSESS' : 'SELAMAT DATANG · WELCOME'}
        </div>
        <h1 className="display text-plaster text-2xl mt-2">Tanda kata yang anda tahu</h1>
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
        <div className="text-muted mt-3">({w.gloss_en})</div>
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
            <span className="mono-sm block text-muted mt-0.5">(not yet)</span>
          </button>
          <button
            onClick={() => mark(true)}
            className="py-4 bg-jade text-jade-ink active:opacity-90"
          >
            <span className="font-semibold">Tahu</span>
            <span className="mono-sm block text-jade-ink/70 mt-0.5">(I know this)</span>
          </button>
        </div>
        <button onClick={finish} className="mt-4 w-full text-muted text-sm">
          {redo ? 'Selesai (done)' : 'Berhenti di sini (stop here — the rest goes to the backlog)'}
        </button>
      </div>
    </div>
  )
}
