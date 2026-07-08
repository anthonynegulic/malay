import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Card, Word } from '../db/types'
import { dueCards, gradeCard, previewIntervals, Rating, type Grade } from '../lib/fsrs'
import { getOrCreateTodaySession, updateSession } from '../lib/session'
import { VariantRow } from '../components/RegisterChip'
import { CornerMotif } from '../components/ui'
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
  const [tts, setTts] = useState(false)

  useEffect(() => {
    ;(async () => {
      await getOrCreateTodaySession()
      const settings = await getSettings()
      setTts(settings.ttsEnabled && ttsAvailable())
      const cards = await dueCards(sikit ? SIKIT_CAP : undefined)
      const items: QueueItem[] = []
      for (const card of cards) {
        const word = await db.words.get(card.wordId)
        if (word) items.push({ card, word })
      }
      setQueue(items)
    })()
  }, [sikit])

  const current = queue?.[0]
  const intervals = useMemo(
    () => (current ? previewIntervals(current.card) : null),
    [current],
  )

  async function finish() {
    if (sikit) {
      navigate('/?done=sikit', { replace: true })
    } else {
      navigate('/read', { replace: true })
    }
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
    // Learning-step cards graded Again/Hard can come back within this session.
    if (updated.due <= Date.now() + 10 * 60 * 1000 && updated.state !== 'review') {
      next = [...next, { card: updated, word: current.word }]
    }
    if (next.length === 0) await finish()
    else setQueue(next)
  }

  if (!queue) return null

  if (queue.length === 0) {
    return (
      <div className="min-h-dvh max-w-md mx-auto px-5 py-10 flex flex-col fade-in">
        <h1 className="font-display font-extrabold text-2xl tracking-tight">Ulangkaji</h1>
        <div className="text-xs text-ink/40">review</div>
        <div className="flex-1 grid place-items-center text-center text-ink/60">
          <div>Tiada kad hari ini — the queue is clear.</div>
        </div>
        <button
          onClick={finish}
          className="w-full py-4 rounded-2xl bg-mansion text-limewash font-semibold"
        >
          {sikit ? 'Selesai' : 'Teruskan ke bacaan'}
          <span className="block text-xs font-normal text-limewash/70">
            {sikit ? 'finish' : 'continue to reading'}
          </span>
        </button>
      </div>
    )
  }

  const { card, word } = current!

  return (
    <div className="min-h-dvh max-w-md mx-auto px-5 py-6 flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/')} className="text-ink/50 text-sm">
          ← keluar <span className="text-ink/35">· exit</span>
        </button>
        <div className="font-mono text-xs text-ink/60">
          {graded} siap · {queue.length} lagi{sikit ? ` (sikit je)` : ''}
          <span className="block text-[10px] text-ink/40 text-right">done · left</span>
        </div>
      </header>

      <div className="flip-scene relative flex-1" style={{ minHeight: 400 }}>
        <div className={`flip-inner absolute inset-0 ${flipped ? 'flipped' : ''}`}>
          {/* front */}
          <button
            onClick={() => setFlipped(true)}
            className="flip-face paper absolute inset-0 w-full grid place-items-center px-4"
          >
            <CornerMotif className="absolute top-0 right-0" />
            <div className="text-center">
              <div className="headword text-mansion break-words">{word.baku}</div>
              <div className="mt-6 text-ink/40 text-sm">
                ketuk untuk buka <span className="text-ink/30">· tap to reveal</span>
              </div>
            </div>
          </button>

          {/* back */}
          <div className="flip-face flip-back paper absolute inset-0 w-full px-6 py-8 overflow-y-auto">
            {flipped && (
              <div className="flex flex-col gap-5 h-full">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-extrabold text-3xl tracking-tight text-mansion">
                      {word.baku}
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mt-1">
                      {word.pos}
                    </div>
                  </div>
                  {tts && (
                    <button
                      onClick={() => speak(word.example_baku || word.baku)}
                      aria-label="Play audio"
                      className="w-11 h-11 rounded-full bg-shutter text-limewash grid place-items-center text-lg shrink-0"
                    >
                      ▶
                    </button>
                  )}
                </div>

                <div className="text-lg">{word.gloss_en}</div>

                {word.arabic_cognate && (
                  <div className="text-sm text-ink/70">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-brass mr-2">
                      Arabic
                    </span>
                    <span className="text-xl text-brass" dir="rtl">
                      {word.arabic_cognate}
                    </span>
                  </div>
                )}

                {word.example_baku && (
                  <div className="text-ink/80 italic border-l-2 border-mansion/30 pl-3">
                    {word.example_baku}
                    {word.example_colloq && (
                      <div className="not-italic text-sm text-ink/60 mt-1">
                        {word.example_colloq}
                      </div>
                    )}
                  </div>
                )}

                {(word.colloquial || word.utara) && (
                  <VariantRow
                    baku={word.baku}
                    colloquial={word.colloquial}
                    utara={word.utara}
                    animate
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* thumb-reachable grading */}
      <div className="mt-5 pb-2">
        {flipped && intervals ? (
          <div className="grid grid-cols-4 gap-2 fade-in">
            <GradeBtn label="Lagi" sub={`again · ${intervals.again}`} color="bg-nyonya text-ink" onClick={() => grade(Rating.Again)} />
            <GradeBtn label="Susah" sub={`hard · ${intervals.hard}`} color="bg-ink/10 text-ink" onClick={() => grade(Rating.Hard)} />
            <GradeBtn label="Okey" sub={`good · ${intervals.good}`} color="bg-mansion text-limewash" onClick={() => grade(Rating.Good)} />
            <GradeBtn label="Senang" sub={`easy · ${intervals.easy}`} color="bg-shutter text-limewash" onClick={() => grade(Rating.Easy)} />
          </div>
        ) : (
          <button
            onClick={() => setFlipped(true)}
            className="w-full py-4 rounded-2xl bg-mansion text-limewash font-semibold active:scale-[0.98]"
          >
            Buka jawapan
            <span className="block text-xs font-normal text-limewash/70">show answer</span>
          </button>
        )}
      </div>
    </div>
  )
}

function GradeBtn({
  label,
  sub,
  color,
  onClick,
}: {
  label: string
  sub: string
  color: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className={`py-3.5 rounded-xl font-semibold active:scale-[0.97] ${color}`}>
      {label}
      <span className="block font-mono text-[10px] font-normal opacity-70">{sub}</span>
    </button>
  )
}
