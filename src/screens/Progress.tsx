import { useEffect, useState } from 'react'
import { db } from '../db/db'
import { dueCount } from '../lib/fsrs'
import { historyDays, MILESTONES, nextMilestone, weekRhythm, type WeekRhythm } from '../lib/session'
import { Label } from '../components/ui'

interface Stats {
  studied: number
  inventory: number
  due: number
  debtTrend: number[]
  coverage: number
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

  const target = nextMilestone(stats.studied)
  const maxDebt = Math.max(1, ...stats.debtTrend)

  return (
    <div className="max-w-md mx-auto pb-24">
      <header className="bg-indigo text-plaster px-5 pt-6 pb-6">
        <Label ms="Kemajuan" en="progress" color="indigo-hi" />
        <div className="display text-plaster mt-2" style={{ fontSize: 64 }}>
          {stats.studied}
        </div>
        <div className="text-indigo-hi">kata dipelajari · words learned</div>
      </header>

      <div className="px-5">
        {/* milestone bar */}
        <div className="pt-6">
          <div className="flex items-baseline justify-between mb-2">
            <Label ms="jalan ke puncak" en="road to the summit" color="muted" />
            <span className="mono text-muted">
              {stats.studied} / {target}
            </span>
          </div>
          <div className="relative h-2 bg-hairline">
            <div
              className="absolute inset-y-0 left-0 bg-oxblood"
              style={{ width: `${Math.min(100, (stats.studied / 1000) * 100)}%` }}
            />
            {MILESTONES.map((m) => (
              <span
                key={m}
                className="absolute top-[-3px] w-px h-[14px] bg-charcoal"
                style={{ left: `${(m / 1000) * 100}%` }}
                title={`${m}`}
              />
            ))}
          </div>
          <div className="flex justify-between mono-sm text-muted mt-1.5">
            {MILESTONES.map((m) => (
              <span key={m} className={stats.studied >= m ? 'text-oxblood' : ''}>
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* weekly rhythm + review debt, ledger between rules */}
        {rhythm && (
          <div className="mt-6 border-y-[1.5px] border-charcoal">
            <div className="grid grid-cols-2 divide-x divide-hairline">
              <div className="py-3 pr-4">
                <div className="display text-2xl text-charcoal">
                  {rhythm.daysDone}
                  <span className="text-muted font-body font-normal text-base"> / {rhythm.target}</span>
                </div>
                <Label ms="rentak minggu" en="weekly rhythm" color="muted" />
              </div>
              <div className="py-3 pl-4">
                <div className="display text-2xl text-charcoal">{stats.due}</div>
                <Label ms="hutang ulangkaji" en="review debt" color="muted" />
              </div>
            </div>
          </div>
        )}

        {/* review-debt trend */}
        {stats.debtTrend.length > 1 && (
          <div className="mt-5">
            <Label ms="aliran hutang" en="debt trend" color="muted" className="block mb-2" />
            <div className="flex items-end gap-0.5 h-10 border-b border-hairline">
              {stats.debtTrend.map((d, i) => (
                <div
                  key={i}
                  className="flex-1 bg-oxblood/70"
                  style={{ height: `${Math.max(6, (d / maxDebt) * 100)}%` }}
                  title={`${d}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* register coverage — hidden until 20 studied (P2) */}
        <div className="mt-5">
          <Label ms="liputan loghat" en="register coverage" color="muted" className="block mb-1.5" />
          {stats.studied >= 20 ? (
            <div className="flex items-baseline gap-2">
              <span className="display text-2xl text-charcoal">{stats.coverage}%</span>
              <span className="text-muted text-sm">of studied words have colloquial / northern variants</span>
            </div>
          ) : (
            <div className="text-muted text-sm">Unlocks at 20 studied words — {20 - stats.studied} to go.</div>
          )}
        </div>

        {/* footpath — ruled row of practised days, gaps visible */}
        {history.length > 0 && (
          <div className="mt-6 border-t-[1.5px] border-charcoal pt-4">
            <Label ms="laluan" en="the footpath — full history" color="muted" className="block mb-3" />
            <div className="flex flex-wrap gap-1.5">
              {history.map((d) => (
                <span
                  key={d.date}
                  title={d.date}
                  className={`w-3.5 h-3.5 ${d.counted ? 'bg-indigo' : 'border border-hairline'}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <div className="text-muted text-sm italic">sedikit-sedikit, lama-lama jadi bukit</div>
          <div className="mono-sm text-muted/70 mt-1">little by little, it becomes a hill</div>
        </div>
      </div>
    </div>
  )
}
