import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Word } from '../db/types'
import { getOrCreateTodaySession, updateSession } from '../lib/session'
import { FlipDeck } from '../components/FlipDeck'
import { ttsAvailable } from '../lib/tts'

/**
 * Ulangkaji bebas (feedback-002 R4): Quizlet-style flipping through
 * already-studied words, entered from the Kata screen with its filters
 * applied. Zero FSRS writes — non-negotiable: low-effort same-day flips would
 * corrupt the scheduler (same principle as the recall-pass ruling). The only
 * data written is a session-log counter for the Kemajuan screen.
 */
export function Practice() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [words, setWords] = useState<Word[] | null>(null)
  const [started, setStarted] = useState(false)
  const [tts, setTts] = useState(false)

  useEffect(() => {
    ;(async () => {
      const settings = await getSettings()
      setTts(settings.ttsEnabled && ttsAvailable())
      const cards = await db.cards.toArray()
      const studiedIds = new Set(cards.map((c) => c.wordId))
      const tag = params.get('tag')
      const filter = params.get('filter')
      let deck = (await db.words.toArray()).filter((w) => studiedIds.has(w.id))
      if (tag) deck = deck.filter((w) => w.tags.includes(tag))
      if (filter === 'variants') deck = deck.filter((w) => w.colloquial || w.utara)
      if (filter === 'harvested') deck = deck.filter((w) => w.source === 'harvested')
      // Shuffle (Fisher–Yates) — a fresh order every session.
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[deck[i], deck[j]] = [deck[j], deck[i]]
      }
      setWords(deck)
    })()
  }, [params])

  async function logRun() {
    const s = await getOrCreateTodaySession()
    await updateSession({ freePracticeRuns: (s.freePracticeRuns ?? 0) + 1 })
  }

  function exit() {
    navigate('/words', { replace: true })
  }

  if (!words) return null

  if (words.length === 0) {
    return (
      <div className="min-h-dvh grid place-items-center bg-indigo text-plaster px-6 text-center">
        <div>
          <p>
            Tiada kata dipelajari dalam tapisan ini{' '}
            <span className="text-indigo-lo">(no studied words match these filters)</span>
          </p>
          <button
            onClick={exit}
            className="mt-5 px-5 py-2.5 border-[1.5px] border-plaster/50 rounded-[4px]"
          >
            Kembali <span className="text-indigo-lo">(back)</span>
          </button>
        </div>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6">
          <span className="mono text-gold-hi">ULANGKAJI BEBAS · FREE PRACTICE</span>
        </div>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div>
            <div className="display text-plaster text-3xl">{words.length} kata</div>
            <p className="text-indigo-hi mt-3">
              Latihan sahaja — tidak mengubah jadual ulangkaji{' '}
              <span className="text-indigo-lo">
                (practice only — doesn&rsquo;t change your review schedule)
              </span>
            </p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <button
            onClick={() => setStarted(true)}
            className="w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium active:opacity-90"
          >
            Mula <span className="mono-sm text-gold-ink/70">(start)</span>
          </button>
          <button onClick={exit} className="w-full py-2 text-indigo-hi text-sm">
            Kembali <span className="text-indigo-lo">(back)</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <FlipDeck
      words={words}
      headerMs="latihan sahaja"
      headerEn="doesn't change your schedule"
      tts={tts}
      onDone={() => {
        void logRun()
        exit()
      }}
      onExit={exit}
    />
  )
}
