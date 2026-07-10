import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import type { Word } from '../db/types'
import { addPhaseMs, todaysNewWords, todayStr, updateSession } from '../lib/session'
import { Label, SpeakerIcon } from '../components/ui'
import { isMuted, speak, stopSpeaking, ttsAvailable } from '../lib/tts'

/** Hard cap (§4.1): the pass never runs past this, ending at a card boundary. */
const CAP_MS = 60_000

/**
 * Ungraded end-of-lesson recall pass (pedagogy response §1-Q1): today's new
 * words — try to recall, tap to reveal, move on. It must not touch the
 * scheduler: no grade buttons, no FSRS writes; the first *graded* test is
 * still tomorrow. Writes only a session-log flag and its duration.
 */
export function Recall() {
  const navigate = useNavigate()
  const [words, setWords] = useState<Word[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [glossary, setGlossary] = useState<Map<string, string>>(new Map())
  const startedAt = useRef(Date.now())

  useEffect(() => {
    ;(async () => {
      const todays = await todaysNewWords()
      // Harvested words can lack a stored gloss — fall back to the passage
      // glossary, and skip anything with no gloss at all (a blank back teaches
      // nothing).
      const g = new Map<string, string>()
      const passages = await db.passages.where('date').equals(todayStr()).toArray()
      for (const p of passages) {
        for (const entry of p.glossary) g.set(entry.word.toLowerCase(), entry.gloss)
      }
      setGlossary(g)
      const usable = todays.filter((w) => w.gloss_en || g.get(w.baku.toLowerCase()))
      if (!usable.length) {
        navigate('/?done=full', { replace: true })
        return
      }
      setWords(usable)
    })()
    return () => stopSpeaking()
  }, [])

  if (!words) return null

  async function finish(completed: boolean) {
    stopSpeaking()
    await addPhaseMs('recallMs', Date.now() - startedAt.current)
    if (completed) await updateSession({ recallDone: true })
    navigate('/?done=full', { replace: true })
  }

  function next() {
    // The 60s cap ends the pass at a card boundary — never mid-card.
    if (index + 1 >= words!.length || Date.now() - startedAt.current > CAP_MS) {
      void finish(true)
      return
    }
    setIndex(index + 1)
    setRevealed(false)
  }

  const word = words[index]
  const gloss = word.gloss_en || glossary.get(word.baku.toLowerCase()) || ''
  const audio = ttsAvailable() && !isMuted()

  return (
    <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
      <div className="px-5 pt-6 flex items-center justify-between">
        <Label ms="ingat sekejap" en="quick recall — no grades" color="indigo-lo" />
        <span className="mono text-gold">
          {index + 1} / {words.length}
        </span>
      </div>

      <div className="flex-1 grid place-items-center px-5">
        <div className="text-center">
          <button
            onClick={() => setRevealed(true)}
            className="headword text-plaster break-words block"
          >
            {word.baku}
          </button>
          {revealed ? (
            <div className="fade-in mt-6">
              <div className="text-indigo-hi text-xl">{gloss}</div>
              {word.example_baku && (
                <div className="text-indigo-lo mt-3 italic">{word.example_baku}</div>
              )}
              {audio && (
                <button
                  onClick={() => speak(word.example_baku || word.baku)}
                  aria-label="Main audio"
                  className="text-gold mt-5"
                >
                  <SpeakerIcon className="w-7 h-7 mx-auto" />
                </button>
              )}
            </div>
          ) : (
            <div className="mono text-indigo-lo mt-6">cuba ingat · try to recall, then tap</div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-3">
        {revealed ? (
          <button
            onClick={next}
            className="w-full bg-plaster text-charcoal py-4 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
          >
            <span className="font-medium">
              {index + 1 >= words.length ? 'Selesai' : 'Seterusnya'}
            </span>
            <span className="mono-sm text-muted block mt-0.5">
              {index + 1 >= words.length ? 'done for today' : 'next'}
            </span>
          </button>
        ) : (
          <button
            onClick={() => setRevealed(true)}
            className="w-full border-[1.5px] border-plaster/50 text-plaster py-4 rounded-[4px]"
          >
            <span className="font-medium">Tunjuk</span>
            <span className="mono-sm text-indigo-lo block mt-0.5">reveal</span>
          </button>
        )}
        <button onClick={() => finish(false)} className="w-full py-2 text-indigo-lo text-sm">
          Langkau · skip, no guilt
        </button>
      </div>
    </div>
  )
}
