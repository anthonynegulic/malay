import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import type { GradeResult } from '../db/types'
import { gradeResponse, outputPrompt } from '../lib/api'
import { todayStr, updateSession } from '../lib/session'
import { Label } from '../components/ui'

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
    <div className="min-h-dvh max-w-md mx-auto flex flex-col">
      <header className="bg-indigo text-plaster px-5 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="mono text-indigo-hi">
          ← keluar · exit
        </button>
        <Label ms="cakap / tulis" en="speak / write" color="indigo-lo" />
      </header>

      <div className="flex-1 px-5 py-5">
        <div className="border-y-[1.5px] border-charcoal py-4">
          <Label ms="situasi" en="the situation" color="muted" className="block mb-2" />
          <div className="font-medium text-lg">{prompt}</div>
        </div>

        {!result && (
          <>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Jawab dalam Bahasa Melayu… (answer in Malay — imperfect is fine)"
              rows={4}
              className="mt-4 w-full border-[1.5px] border-charcoal bg-plaster p-4 passage rounded-[4px] focus:border-gold"
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
              className="mt-4 w-full bg-gold text-gold-ink py-4 rounded-[4px] border-[1.5px] border-charcoal font-medium disabled:opacity-40"
            >
              {busy ? 'Menyemak… · checking…' : 'Hantar · send'}
            </button>
            <button onClick={finish} className="mt-3 w-full py-2 text-muted text-sm">
              Langkau hari ini · skip today, no guilt
            </button>
          </>
        )}

        {result && (
          <div className="fade-in mt-4 space-y-4">
            <div className="border-y-[1.5px] border-charcoal py-4">
              <div className="text-sm text-muted line-through">{answer}</div>
              <div className="passage mt-2 text-oxblood font-medium">{result.corrected}</div>
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
              className="w-full bg-gold text-gold-ink py-4 rounded-[4px] border-[1.5px] border-charcoal font-medium"
            >
              Selesai hari ini · done for today
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
