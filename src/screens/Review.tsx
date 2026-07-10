import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Card, Word } from '../db/types'
import { dueCards, gradeCard, previewIntervals, Rating, type Grade } from '../lib/fsrs'
import {
  addPhaseMs,
  getOrCreateTodaySession,
  hasEverCompletedSession,
  updateSession,
} from '../lib/session'
import { VariantLedger } from '../components/RegisterChip'
import { Label, SpeakerIcon } from '../components/ui'
import { speak, ttsAvailable } from '../lib/tts'

const SIKIT_CAP = 20

interface QueueItem {
  card: Card
  word: Word
}

export function Review() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const sikit = params.get('mode') === 'sikit'

  const [queue, setQueue] = useState<QueueItem[] | null>(null)
  const [flipped, setFlipped] = useState(false)
  const [graded, setGraded] = useState(0)
  const [total, setTotal] = useState(0)
  const [tts, setTts] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    ;(async () => {
      await getOrCreateTodaySession()
      const settings = await getSettings()
      setTts(settings.ttsEnabled && ttsAvailable())
      const cards = await dueCards(sikit ? SIKIT_CAP : undefined)
      // Day-0 fast path (first-run ruling §2.1): an empty queue before any day
      // has ever counted is a system the user hasn't met — route straight into
      // the reading. On later days the friendly empty state stays.
      if (!sikit && cards.length === 0 && !(await hasEverCompletedSession())) {
        navigate('/read', { replace: true })
        return
      }
      const items: QueueItem[] = []
      for (const card of cards) {
        const word = await db.words.get(card.wordId)
        if (word) items.push({ card, word })
      }
      setQueue(items)
      setTotal(items.length)
    })()
  }, [sikit])

  const current = queue?.[0]
  const intervals = useMemo(() => (current ? previewIntervals(current.card) : null), [current])

  function finish() {
    void addPhaseMs('reviewMs', Date.now() - startedAt.current)
    if (sikit) navigate('/?done=sikit', { replace: true })
    else navigate('/read', { replace: true })
  }

  async function grade(rating: Grade) {
    if (!queue || !current) return
    const updated = gradeCard(current.card, rating)
    await db.cards.put(updated)
    const s = await getOrCreateTodaySession()
    await updateSession({ reviewsDone: s.reviewsDone + 1 })
    setGraded((g) => g + 1)
    setFlipped(false)

    let next = queue.slice(1)
    if (updated.due <= Date.now() + 10 * 60 * 1000 && updated.state !== 'review') {
      next = [...next, { card: updated, word: current.word }]
    }
    if (next.length === 0) finish()
    else setQueue(next)
  }

  if (!queue) return null

  if (queue.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6">
          <button onClick={() => navigate('/')} className="mono text-indigo-hi">
            ← keluar · exit
          </button>
        </div>
        <div className="flex-1 grid place-items-center text-center px-6">
          <div>
            <Label ms="ulangkaji" en="review" color="indigo-lo" />
            <p className="text-indigo-hi mt-3">Tiada kad hari ini — the queue is clear.</p>
          </div>
        </div>
        <div className="p-5">
          <button
            onClick={finish}
            className="w-full border-[1.5px] border-plaster/50 text-plaster py-4 rounded-[4px]"
          >
            {sikit ? 'Selesai · finish' : 'Teruskan ke bacaan · continue to reading'}
          </button>
        </div>
      </div>
    )
  }

  const { card, word } = current!

  // ————— front: indigo full-bleed, headword alone —————
  if (!flipped) {
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="mono text-indigo-hi">
            ← keluar · exit
          </button>
          <span className="mono text-gold">
            {graded + 1} / {total}
            {sikit ? ' · sikit je' : ''}
          </span>
        </div>

        <div className="flex-1 grid place-items-center px-5">
          <div className="text-center">
            <button
              onClick={() => setFlipped(true)}
              className="headword text-plaster break-words block"
            >
              {word.baku}
            </button>
            {tts && (
              <button
                onClick={() => speak(word.example_baku || word.baku)}
                aria-label="Main audio"
                className="text-gold mt-8"
              >
                <SpeakerIcon className="w-8 h-8 mx-auto" />
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          <button
            onClick={() => setFlipped(true)}
            className="w-full bg-plaster text-charcoal py-4 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
          >
            <span className="font-medium">Tunjuk</span>
            <span className="mono-sm text-muted block mt-0.5">tap to reveal</span>
          </button>
        </div>
      </div>
    )
  }

  // ————— back: shrunk headword on indigo, ledger on plaster —————
  return (
    <div className="min-h-dvh flex flex-col bg-plaster">
      <div className="bg-indigo text-plaster px-5 pt-6 pb-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate('/')} className="mono text-indigo-hi">
            ← keluar · exit
          </button>
          <span className="mono text-gold">
            {graded + 1} / {total}
          </span>
        </div>
        <div className="reveal-head display text-plaster" style={{ fontSize: 44 }}>
          {word.baku}
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-indigo-hi">{word.gloss_en}</span>
          <span className="mono text-indigo-lo">{word.pos}</span>
        </div>
      </div>

      <div className="reveal-body flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {word.example_baku && (
          <div>
            <div className="flex items-center justify-between">
              <Label ms="contoh" en="example" color="muted" />
              {tts && (
                <button onClick={() => speak(word.example_baku)} aria-label="Main audio" className="text-gold">
                  <SpeakerIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="mt-1.5 italic">{word.example_baku}</div>
            {word.example_colloq && <div className="text-muted text-sm mt-0.5">{word.example_colloq}</div>}
          </div>
        )}

        {(word.colloquial || word.utara) && (
          <div>
            <Label ms="loghat" en="register" color="muted" className="block mb-1" />
            <VariantLedger
              baku={word.baku}
              colloquial={word.colloquial}
              utara={word.utara}
              exampleBaku={word.example_baku}
              exampleColloq={word.example_colloq}
            />
          </div>
        )}

        {word.arabic_cognate && (
          <div>
            <Label ms="arab" en="arabic" color="gold" className="block mb-1" />
            <div className="text-2xl text-charcoal" dir="rtl">
              {word.arabic_cognate}
            </div>
          </div>
        )}
      </div>

      {/* grades */}
      {intervals && (
        <div className="px-5 pb-5 pt-3 border-t-[1.5px] border-charcoal">
          <Label ms="ingat?" en="how well?" color="muted" className="block mb-2" />
          <div className="grid grid-cols-2 gap-2">
            <GradeBtn label="Lagi" en="again" sub={intervals.again} cls="border-[1.5px] border-oxblood text-oxblood" onClick={() => grade(Rating.Again)} />
            <GradeBtn label="Susah" en="hard" sub={intervals.hard} cls="border-[1.5px] border-charcoal text-charcoal" onClick={() => grade(Rating.Hard)} />
            <GradeBtn label="Okey" en="good" sub={intervals.good} cls="border-[1.5px] border-charcoal text-charcoal" onClick={() => grade(Rating.Good)} />
            <GradeBtn label="Senang" en="easy" sub={intervals.easy} cls="bg-jade text-jade-ink border-[1.5px] border-jade" onClick={() => grade(Rating.Easy)} />
          </div>
        </div>
      )}
    </div>
  )
}

function GradeBtn({
  label,
  en,
  sub,
  cls,
  onClick,
}: {
  label: string
  en: string
  sub: string
  cls: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`py-3 rounded-[4px] active:opacity-90 ${cls}`}>
      <span className="font-medium">{label}</span>
      <span className="mono-sm block mt-0.5 opacity-70">
        {en} · {sub}
      </span>
    </button>
  )
}
