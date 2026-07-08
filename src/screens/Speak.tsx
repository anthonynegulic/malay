import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import type { GradeResult } from '../db/types'
import { gradeResponse, outputPrompt } from '../lib/api'
import { todayStr, updateSession } from '../lib/session'

export function Speak() {
  const navigate = useNavigate()
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GradeResult | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    db.passages
      .where('date')
      .equals(todayStr())
      .first()
      .then((p) => setPrompt(outputPrompt(p?.topic ?? 'pasar')))
  }, [])

  async function submit() {
    if (!answer.trim() || busy) return
    setBusy(true)
    setError(false)
    try {
      const r = await gradeResponse(prompt, answer.trim())
      setResult(r)
      await updateSession({ outputAttempted: true })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function finish() {
    navigate('/?done=full', { replace: true })
  }

  return (
    <div className="min-h-dvh max-w-md mx-auto px-5 py-6 flex flex-col">
      <header className="flex items-center justify-between mb-5">
        <button onClick={() => navigate('/')} className="text-ink/50 text-sm">
          ← keluar <span className="text-ink/35">· exit</span>
        </button>
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
          cakap / tulis · speak / write
        </div>
      </header>

      <div className="bg-white rounded-2xl border border-ink/10 p-5">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-2">
          situasi · the situation
        </div>
        <div className="font-medium text-lg">{prompt}</div>
      </div>

      {!result && (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Jawab dalam Bahasa Melayu… (answer in Malay — imperfect is fine)"
            rows={4}
            className="mt-4 w-full rounded-2xl border border-ink/15 bg-white p-4 passage focus:border-mansion"
          />
          {error && (
            <div className="mt-2 text-sm text-ink/70">
              Tak boleh semak sekarang — cuba lagi. <span className="text-ink/40">(Could not check right now — try again.)</span>
            </div>
          )}
          <div className="mt-4 space-y-3">
            <button
              onClick={submit}
              disabled={busy || !answer.trim()}
              className="w-full py-4 rounded-2xl bg-mansion text-limewash font-semibold disabled:opacity-40 active:scale-[0.98]"
            >
              {busy ? 'Menyemak… (checking…)' : 'Hantar'}
              {!busy && (
                <span className="block text-xs font-normal text-limewash/70">send</span>
              )}
            </button>
            <button onClick={finish} className="w-full py-2 text-ink/50 text-sm">
              Langkau hari ini — tak apa <span className="text-ink/35">· skip today, no guilt</span>
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="fade-in mt-4 space-y-4">
          <div className="bg-white rounded-2xl border border-ink/10 p-5">
            <div className="text-sm text-ink/50 line-through">{answer}</div>
            <div className="passage mt-2 text-shutter font-medium">{result.corrected}</div>
          </div>
          <div className="bg-shutter/10 rounded-2xl p-5">
            <div className="font-medium">
              {result.understood ? '✓ ' : ''}
              {result.encouragement}
            </div>
            {result.notes.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm text-ink/70 list-disc list-inside">
                {result.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={finish}
            className="w-full py-4 rounded-2xl bg-mansion text-limewash font-semibold active:scale-[0.98]"
          >
            Selesai hari ini
            <span className="block text-xs font-normal text-limewash/70">done for today</span>
          </button>
        </div>
      )}
    </div>
  )
}
