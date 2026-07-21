import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Word } from '../db/types'
import { getOrCreateTodaySession, updateSession } from '../lib/session'
import { FlipDeck } from '../components/FlipDeck'
import { Bi, Label } from '../components/ui'
import { useVoiceReady } from '../lib/tts'

/**
 * Ulangkaji bebas (feedback-002 R4): Quizlet-style flipping through
 * already-studied words, entered from the Kata screen with its filters
 * applied. Zero FSRS writes — non-negotiable: low-effort same-day flips would
 * corrupt the scheduler (same principle as the recall-pass ruling). The only
 * data written is a session-log counter for the Kemajuan screen.
 *
 * The deck is drilled in user-sized batches (IMG_8313 request): pick how many
 * to flip through at once, and each "continue" advances to the NEXT slice —
 * words already drilled this session are excluded until the pool is exhausted.
 * Batching is session-scoped only; nothing persists across visits (free
 * practice stays deliberately stateless — the real reviews are the scheduler).
 *
 * Deck source (Anki "custom study", made safe): 'all' = every studied word
 * (honouring the Kata filters you arrived with); 'hard' = your weak spots,
 * most-forgotten first (by lapses, then FSRS difficulty, then low stability).
 * We deliberately do NOT offer a "today's due cards" source: cramming the due
 * queue here and then grading it Easy in the real review minutes later feeds
 * FSRS crammed short-term recall and blows the intervals out — the exact
 * corruption this write-free surface exists to avoid.
 */
type Source = 'all' | 'hard'

const BATCH_KEY = 'bukit-practice-batch'
const BATCH_MIN = 5
const BATCH_DEFAULT = 10
// Step 1 (like the Settings sliders) so every count is reachable, including
// the full deck — a coarser step can't land on a non-multiple total.
const SLIDER_STEP = 1

export function Practice() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [words, setWords] = useState<Word[] | null>(null)
  const [ttsPref, setTtsPref] = useState(false)
  const voiceReady = useVoiceReady()
  const tts = ttsPref && voiceReady
  // 'setup' picks batch size; 'run' drills a slice; 'pause' sits between batches.
  const [mode, setMode] = useState<'setup' | 'run' | 'pause'>('setup')
  const [cursor, setCursor] = useState(0)
  const [batch, setBatch] = useState(BATCH_DEFAULT)
  const [source, setSource] = useState<Source>('all')

  useEffect(() => {
    ;(async () => {
      const settings = await getSettings()
      setTtsPref(settings.ttsEnabled)
      const cards = await db.cards.toArray()
      const cardByWord = new Map(cards.map((c) => [c.wordId, c]))
      const studiedIds = new Set(cards.map((c) => c.wordId))
      const tag = params.get('tag')
      const filter = params.get('filter')
      let deck = (await db.words.toArray()).filter((w) => studiedIds.has(w.id))

      if (source === 'hard') {
        // Weak spots: most-forgotten first. Lapses dominate, then FSRS
        // difficulty, then low stability as a fine tiebreak. No shuffle — the
        // whole point is hardest-first. (Kata filters are ignored here: weak
        // spots are a cross-cutting SRS view, not a tag slice.)
        const hardness = (w: Word) => {
          const c = cardByWord.get(w.id)
          if (!c) return -1
          return c.lapses * 100 + c.difficulty + Math.max(0, 5 - Math.min(5, c.stability)) * 0.1
        }
        deck.sort((a, b) => hardness(b) - hardness(a))
      } else {
        if (tag) deck = deck.filter((w) => w.tags.includes(tag))
        if (filter === 'variants') deck = deck.filter((w) => w.colloquial || w.utara)
        if (filter === 'harvested') deck = deck.filter((w) => w.source === 'harvested')
        shuffle(deck)
      }

      setWords(deck)
      // Restore the last chosen batch size, clamped to this deck.
      const saved = Number(localStorage.getItem(BATCH_KEY) || BATCH_DEFAULT)
      setBatch(Math.max(BATCH_MIN, Math.min(saved || BATCH_DEFAULT, deck.length)))
    })()
  }, [params, source])

  async function logRun() {
    const s = await getOrCreateTodaySession()
    await updateSession({ freePracticeRuns: (s.freePracticeRuns ?? 0) + 1 })
  }

  function exit() {
    navigate('/words', { replace: true })
  }

  function setBatchSize(n: number) {
    setBatch(n)
    localStorage.setItem(BATCH_KEY, String(n))
  }

  /** Finished a batch: log it, then pause between slices (or at the end). */
  function batchDone() {
    void logRun()
    setMode('pause')
  }

  function nextBatch() {
    setCursor((c) => c + batch)
    setMode('run')
  }

  /** Re-drill the SAME slice (cursor unchanged), reshuffled so it isn't rote
   *  order — the point of batches: stay on a set until it sticks. */
  function repeatBatch() {
    if (words) {
      const copy = [...words]
      const start = cursor
      const end = Math.min(cursor + batch, copy.length)
      for (let i = end - 1; i > start; i--) {
        const j = start + Math.floor(Math.random() * (i - start + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
      }
      setWords(copy)
    }
    setMode('run')
  }

  /** Drill the whole deck again from a fresh shuffle. */
  function again() {
    if (words) {
      const reshuffled = [...words]
      shuffle(reshuffled)
      setWords(reshuffled)
    }
    setCursor(0)
    setMode('run')
  }

  if (!words) return null

  const total = words.length
  const empty = total === 0
  // Small decks aren't worth batching — drill the lot, hide the slider.
  const canBatch = total > BATCH_MIN
  const effBatch = canBatch ? batch : total
  const sliderMax = Math.max(BATCH_MIN, total)

  // ————— setup: choose the source and how many to drill —————
  if (mode === 'setup') {
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6">
          <span className="mono text-gold-hi">ULANGKAJI BEBAS · FREE PRACTICE</span>
        </div>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div className="w-full max-w-xs">
            <div className="display text-plaster text-3xl">
              {empty ? 'Tiada kata' : `${total} kata`}
            </div>
            <p className="text-indigo-hi mt-3">
              Latihan sahaja — tidak mengubah jadual ulangkaji{' '}
              <span className="text-indigo-lo">
                (practice only — doesn&rsquo;t change your review schedule)
              </span>
            </p>

            {/* source: all studied words vs your weak spots */}
            <div className="mt-8 text-left">
              <Label ms="Apa nak diulang?" en="what to drill" color="indigo-hi" className="block mb-2" />
              <div className="grid grid-cols-2 border-[1.5px] border-plaster/40 rounded-[4px] overflow-hidden">
                {(
                  [
                    ['all', 'Semua', 'all studied'],
                    ['hard', 'Paling susah', 'weak spots'],
                  ] as const
                ).map(([key, ms, en]) => (
                  <button
                    key={key}
                    onClick={() => setSource(key)}
                    className={`py-2.5 px-2 ${
                      source === key ? 'bg-plaster text-indigo' : 'text-plaster active:bg-plaster/10'
                    }`}
                  >
                    <span className="font-medium block leading-tight">{ms}</span>
                    <span className="mono-sm opacity-70">{en}</span>
                  </button>
                ))}
              </div>
              <div className="mono-sm text-indigo-lo mt-2">
                {source === 'hard'
                  ? 'kata paling kerap terlupa dahulu · most-forgotten first'
                  : 'semua kata yang dipelajari · everything you have studied'}
              </div>
            </div>

            {empty && (
              <p className="text-indigo-hi text-sm mt-6">
                <Bi
                  ms="Tiada kata dalam tapisan ini"
                  en={
                    source === 'hard'
                      ? 'nothing studied yet'
                      : 'no studied words match these filters — try weak spots'
                  }
                  enClass="text-indigo-lo"
                />
              </p>
            )}

            {canBatch && (
              <div className="mt-8 text-left">
                <div className="flex items-baseline justify-between">
                  <Label ms="Berapa kata?" en="how many to drill" color="indigo-hi" />
                  <span className="display text-plaster text-2xl">{effBatch}</span>
                </div>
                <input
                  type="range"
                  min={BATCH_MIN}
                  max={sliderMax}
                  step={SLIDER_STEP}
                  value={Math.min(effBatch, sliderMax)}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full mt-3"
                  aria-label="Words per batch"
                />
                <div className="mono-sm text-indigo-lo mt-2">
                  {effBatch >= total
                    ? 'semua sekali gus · all at once'
                    : `${Math.ceil(total / effBatch)} pusingan · ${Math.ceil(total / effBatch)} batches to cover all ${total}`}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 space-y-3">
          <button
            disabled={empty}
            onClick={() => {
              setCursor(0)
              setMode('run')
            }}
            className="w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium active:opacity-90 disabled:opacity-40"
          >
            Mula <span className="mono-sm text-gold-ink/70">(start{!empty && canBatch ? ` — ${effBatch} kata` : ''})</span>
          </button>
          <button onClick={exit} className="w-full py-2 text-indigo-hi text-sm">
            Kembali <span className="text-indigo-lo">(back)</span>
          </button>
        </div>
      </div>
    )
  }

  // ————— pause: between batches, or the whole deck done —————
  if (mode === 'pause') {
    const drilled = Math.min(cursor + effBatch, total)
    const left = total - drilled
    const allDone = left <= 0
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6">
          <span className="mono text-gold-hi">ULANGKAJI BEBAS · FREE PRACTICE</span>
        </div>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div>
            <div className="display text-plaster text-3xl">
              {allDone ? `Semua ${total} selesai` : `${drilled} selesai`}
            </div>
            <p className="text-indigo-hi mt-3">
              {allDone ? (
                <Bi
                  ms="Anda telah lalui seluruh set"
                  en="you've been through the whole set"
                  enClass="text-indigo-lo"
                />
              ) : (
                <Bi
                  ms={`${left} kata lagi belum diulang`}
                  en={`${left} not drilled yet — the next batch skips what you just did`}
                  enClass="text-indigo-lo"
                />
              )}
            </p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          {allDone ? (
            <button
              onClick={again}
              className="w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium active:opacity-90"
            >
              Ulang semula <span className="mono-sm text-gold-ink/70">(drill all again, reshuffled)</span>
            </button>
          ) : (
            <>
              <button
                onClick={repeatBatch}
                className="w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium active:opacity-90"
              >
                Ulang set ini
                <span className="mono-sm text-gold-ink/70"> (repeat these {Math.min(effBatch, drilled - cursor)} until they stick)</span>
              </button>
              <button
                onClick={nextBatch}
                className="w-full py-3.5 px-4 rounded-[4px] border-[1.5px] border-plaster/40 text-plaster active:bg-plaster/10"
              >
                Teruskan
                <span className="mono-sm text-indigo-lo"> (continue — next {Math.min(effBatch, left)})</span>
              </button>
            </>
          )}
          <button onClick={exit} className="w-full py-2 text-indigo-hi text-sm">
            Selesai <span className="text-indigo-lo">(done)</span>
          </button>
        </div>
      </div>
    )
  }

  // ————— run: drill the current slice —————
  const slice = words.slice(cursor, cursor + effBatch)
  const batchNo = Math.floor(cursor / effBatch) + 1
  const batchCount = Math.ceil(total / effBatch)
  return (
    <FlipDeck
      words={slice}
      headerMs={batchCount > 1 ? `set ${batchNo}/${batchCount}` : 'latihan sahaja'}
      headerEn="doesn't change your schedule"
      tts={tts}
      onDone={batchDone}
      onExit={exit}
    />
  )
}

/** Fisher–Yates in place — a fresh order every session. */
function shuffle(deck: Word[]): void {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
}
