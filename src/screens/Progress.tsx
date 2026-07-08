import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { dueCount } from '../lib/fsrs'
import { historyDays, weekRhythm, type WeekRhythm } from '../lib/session'
import { Hill } from '../components/Hill'

interface Stats {
  studied: number
  inventory: number
  due: number
  debtTrend: number[] // dueAtStart across recent sessions
  coverage: number // % of studied words with colloquial/utara variants
}

export function Progress() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [rhythm, setRhythm] = useState<WeekRhythm | null>(null)
  const [history, setHistory] = useState<{ date: string; counted: boolean }[]>([])

  useEffect(() => {
    ;(async () => {
      const cards = await db.cards.toArray()
      const studiedIds = new Set(cards.map((c) => c.wordId))
      const words = await db.words.toArray()
      const studiedWords = words.filter((w) => studiedIds.has(w.id))
      const withVariants = studiedWords.filter((w) => w.colloquial || w.utara).length
      const sessions = await db.sessions.orderBy('date').reverse().limit(14).toArray()
      setStats({
        studied: cards.length,
        inventory: words.length,
        due: await dueCount(),
        debtTrend: sessions.reverse().map((s) => s.dueAtStart),
        coverage: studiedWords.length ? Math.round((withVariants / studiedWords.length) * 100) : 0,
      })
      setRhythm(await weekRhythm())
      setHistory(await historyDays())
    })()
  }, [])

  if (!stats) return null

  const maxDebt = Math.max(1, ...stats.debtTrend)

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-28 fade-in">
      <h1 className="font-display font-extrabold text-3xl tracking-tight">Bukit anda</h1>
      <div className="text-xs text-ink/40">your hill</div>
      <div className="text-sm text-ink/60 mt-1">
        {stats.studied} kata sedang dipelajari · {stats.inventory} dalam inventori
        <span className="block text-xs text-ink/40">words being studied · in inventory</span>
      </div>

      <div className="mt-4 -mx-2">
        <Hill
          wordCount={stats.studied}
          history={history.slice(-12).map((d) => d.counted)}
          full
        />
      </div>

      {rhythm && (
        <div className="mt-5 bg-white rounded-2xl border border-ink/10 p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-2">
            rentak mingguan · weekly rhythm
          </div>
          <div className="text-2xl font-display font-extrabold tracking-tight">
            {rhythm.daysDone}
            <span className="text-ink/40">/{rhythm.target} hari</span>
          </div>
          <div className="text-xs text-ink/50 mt-1">
            No streaks, no guilt — just a rhythm. Gaps stay visible, and the hill never shrinks.
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-ink/10 p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-1">
            hutang ulangkaji · review debt
          </div>
          <div className="text-2xl font-display font-extrabold tracking-tight text-mansion">
            {stats.due}
          </div>
          {stats.debtTrend.length > 1 && (
            <div className="mt-2 flex items-end gap-0.5 h-8">
              {stats.debtTrend.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 bg-mansion/30 rounded-sm"
                  style={{ height: `${Math.max(8, (d / maxDebt) * 100)}%` }}
                  title={`${d}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-ink/10 p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-1">
            liputan loghat · registers
          </div>
          <div className="text-2xl font-display font-extrabold tracking-tight text-shutter">
            {stats.coverage}%
          </div>
          <div className="text-xs text-ink/50 mt-1">
            of studied words have colloquial / northern variants
          </div>
        </div>
      </div>

      {history.length > 0 && (
        <div className="mt-3 bg-white rounded-2xl border border-ink/10 p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40 mb-3">
            laluan · the footpath — full history, gaps and all
          </div>
          <div className="flex flex-wrap gap-1.5">
            {history.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={`w-3.5 h-3.5 rounded-full ${
                  d.counted ? 'bg-shutter' : 'border border-ink/20'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
