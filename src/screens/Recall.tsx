import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings } from '../db/db'
import type { Word } from '../db/types'
import { todaysNewWords, updateSession } from '../lib/session'
import { FlipDeck } from '../components/FlipDeck'
import { useVoiceReady } from '../lib/tts'

/**
 * End-of-lesson recall pass (pedagogy-response §1-Q1): a short, no-stakes
 * retrieval over today's new words (scheduled + harvested) that primes
 * tomorrow's scheduled review without touching the scheduler. Guess, reveal,
 * move on — no grade buttons, no FSRS writes; the only data written is the
 * session's recallDone flag. Skippable, no guilt, same pattern as the
 * speaking task. The first *graded* test stays tomorrow.
 */
export function Recall() {
  const navigate = useNavigate()
  const [words, setWords] = useState<Word[] | null>(null)
  const [started, setStarted] = useState(false)
  const [ttsPref, setTtsPref] = useState(false)
  const voiceReady = useVoiceReady()
  const tts = ttsPref && voiceReady

  useEffect(() => {
    ;(async () => {
      const settings = await getSettings()
      setTtsPref(settings.ttsEnabled)
      setWords(await todaysNewWords())
    })()
  }, [])

  function finish(done: boolean) {
    if (done) void updateSession({ recallDone: true })
    navigate('/?done=full', { replace: true })
  }

  // Nothing introduced today — nothing to recall; close the lesson directly.
  useEffect(() => {
    if (words && words.length === 0) navigate('/?done=full', { replace: true })
  }, [words, navigate])

  if (!words || words.length === 0) return null

  if (!started) {
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6">
          <span className="mono text-gold-hi">IMBAS KEMBALI · RECALL</span>
        </div>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div>
            <div className="display text-plaster text-3xl">
              Kata baru hari ini — masih ingat?
            </div>
            <p className="text-indigo-hi mt-3">
              ({words.length} new {words.length === 1 ? 'word' : 'words'} today — try to recall
              each before revealing. Ungraded; your first real test is tomorrow.)
            </p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <button
            onClick={() => setStarted(true)}
            className="w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium active:opacity-90"
          >
            Mula imbasan
            <span className="mono-sm block text-gold-ink/70 mt-0.5">(start — under a minute)</span>
          </button>
          <button onClick={() => finish(false)} className="w-full py-2 text-indigo-hi text-sm">
            Langkau hari ini <span className="text-indigo-lo">(skip today, no guilt)</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <FlipDeck
      words={words}
      headerMs="imbas kembali"
      headerEn="ungraded recall"
      tts={tts}
      onDone={() => finish(true)}
      onExit={() => finish(false)}
    />
  )
}
