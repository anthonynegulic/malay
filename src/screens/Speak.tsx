import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { GradeResult } from '../db/types'
import { gradeResponse, outputPrompt, type SpeakTask } from '../lib/api'
import { addPhaseTime, todayStr, updateSession } from '../lib/session'
import { tierFor } from '../lib/tier'
import { Label, SpeakerIcon } from '../components/ui'
import { speak, ttsAvailable } from '../lib/tts'

export function Speak() {
  const navigate = useNavigate()
  const [task, setTask] = useState<SpeakTask | null>(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [error, setError] = useState(false)
  const [tts, setTts] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    ;(async () => {
      const p = await db.passages.where('date').equals(todayStr()).first()
      const tier = tierFor(await db.cards.count())
      setTask(outputPrompt(p?.topic ?? 'pasar', tier.id))
      const s = await getSettings()
      setTts(s.ttsEnabled && ttsAvailable())
    })()
  }, [])

  async function submit() {
    if (!task || !answer.trim() || busy) return
    setBusy(true)
    setError(false)
    try {
      // Give the grader the scaffold so it judges against the intended task,
      // not an imagined harder one.
      const gradePrompt = task.scaffold
        ? `${task.situation} (The learner was shown this model to adapt: "${task.scaffold}")`
        : task.situation
      const r = await gradeResponse(gradePrompt, answer.trim())
      setResult(r)
      await updateSession({ outputAttempted: true })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    void addPhaseTime('speakMs', startedAt.current)
    // The lesson closes with the ungraded recall pass over today's new words
    // (pedagogy-response §1) — Recall routes home itself when there are none.
    navigate('/recall', { replace: true })
  }

  return (
    <div className="min-h-dvh max-w-md mx-auto flex flex-col">
      <header className="bg-indigo text-plaster px-5 py-4 flex items-center justify-between">
        <button
          onClick={() => {
            void addPhaseTime('speakMs', startedAt.current)
            navigate('/')
          }}
          className="mono text-indigo-hi hit"
        >
          ← keluar · exit
        </button>
        <Label ms="cakap / tulis" en="speak / write" color="indigo-lo" />
      </header>

      <div className="flex-1 px-5 py-5">
        <div className="border-y-[1.5px] border-charcoal py-4">
          <Label ms="situasi" en="the situation" color="muted" className="block mb-2" />
          <div className="font-medium text-lg">{task?.situation}</div>

          {task?.scaffold && (
            <div className="mt-4 border-l-2 border-gold pl-3">
              <Label
                ms={task.mode === 'pattern' ? 'pola — isi tempat kosong' : 'mula dengan'}
                en={task.mode === 'pattern' ? 'pattern — fill in the blank' : 'start with'}
                color="muted"
                className="block mb-1"
              />
              <div className="passage text-charcoal">{task.scaffold}</div>
              {task.scaffoldGloss && (
                <div className="text-sm text-muted mt-0.5">({task.scaffoldGloss})</div>
              )}
            </div>
          )}
        </div>

        {!result && (
          <>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={
                task?.mode === 'pattern'
                  ? 'Tulis ayat anda… (write your version of the pattern)'
                  : 'Jawab dalam Bahasa Melayu… (answer in Malay — imperfect is fine)'
              }
              rows={4}
              className="mt-4 w-full resize-none border-[1.5px] border-charcoal bg-plaster p-4 passage rounded-[4px] focus:border-gold"
            />
            {error && (
              <div className="mt-2 text-sm text-muted">
                Tak boleh semak sekarang — cuba lagi.{' '}
                <span className="opacity-70">(Could not check right now — try again.)</span>
              </div>
            )}
            <button
              onClick={submit}
              disabled={busy || !answer.trim()}
              className="mt-4 w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium disabled:opacity-40"
            >
              {busy ? 'Menyemak… (checking…)' : 'Hantar (send)'}
            </button>
            <button onClick={finish} className="mt-3 w-full py-2 text-muted text-sm">
              Langkau hari ini (skip today, no guilt)
            </button>
          </>
        )}

        {result && (
          <div className="fade-in mt-4 space-y-4">
            <div className="border-y-[1.5px] border-charcoal py-4">
              <div className="text-sm text-muted line-through">{answer}</div>
              <div className="mt-2 flex items-start justify-between gap-3">
                <div className="passage text-oxblood font-medium">{result.corrected}</div>
                {/* R8: the corrected sentence is exactly what the learner should hear */}
                {tts && result.corrected && (
                  <button
                    onClick={() => speak(result.corrected)}
                    aria-label="Main audio"
                    className="text-gold shrink-0 mt-1 hit"
                  >
                    <SpeakerIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <div className="border-l-2 border-jade pl-4">
              <div className="font-medium">
                {result.understood ? '✓ ' : ''}
                {result.encouragement}
              </div>
              {result.notes.length > 0 && (
                <ul className="mt-3 space-y-1.5 text-sm text-muted list-disc list-inside">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={finish}
              className="w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium"
            >
              Selesai hari ini <span className="mono-sm text-gold-ink/70">(done for today)</span>
            </button>
            {/* the pedagogical moment: say it right this time (UX M9) */}
            <button onClick={() => setResult(null)} className="w-full py-2 text-muted text-sm">
              Cuba lagi <span className="text-muted/70">(edit your answer and resend)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
