import { useEffect, useState } from 'react'
import { db, getSettings, saveSettings } from '../db/db'
import { dueCount } from '../lib/fsrs'
import {
  historyDays,
  MILESTONES,
  nextMilestone,
  trailingWeeks,
  weekRhythm,
  type WeekRhythm,
} from '../lib/session'
import { CHECKPOINT, daysUntilCheckpoint } from '../lib/checkpoint'
import { Label } from '../components/ui'

interface Stats {
  studied: number
  inventory: number
  due: number
  debtTrend: number[]
  coverage: number
  /** Average per-phase minutes over recent sessions that logged them (§4.1). */
  phaseAvgMin: { review: number; read: number; speak: number; total: number } | null
}

function phaseAverages(
  sessions: { reviewMs?: number; readMs?: number; speakMs?: number; recallMs?: number }[],
): Stats['phaseAvgMin'] {
  const logged = sessions.filter(
    (s) => (s.reviewMs ?? 0) + (s.readMs ?? 0) + (s.speakMs ?? 0) + (s.recallMs ?? 0) > 0,
  )
  if (!logged.length) return null
  const avg = (pick: (s: (typeof logged)[number]) => number) =>
    logged.reduce((a, s) => a + pick(s), 0) / logged.length / 60_000
  const review = avg((s) => s.reviewMs ?? 0)
  const read = avg((s) => s.readMs ?? 0)
  // Recall belongs to the lesson close — fold it into speak's slot for display.
  const speak = avg((s) => (s.speakMs ?? 0) + (s.recallMs ?? 0))
  return { review, read, speak, total: review + read + speak }
}

export function Progress() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [rhythm, setRhythm] = useState<WeekRhythm | null>(null)
  const [history, setHistory] = useState<{ date: string; counted: boolean }[]>([])
  const [weeks, setWeeks] = useState<number[]>([])
  const [checkedOff, setCheckedOff] = useState<string[]>([])

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
        debtTrend: sessions.slice().reverse().map((s) => s.dueAtStart),
        coverage: studiedWords.length ? Math.round((withVariants / studiedWords.length) * 100) : 0,
        phaseAvgMin: phaseAverages(sessions),
      })
      setRhythm(await weekRhythm())
      setHistory(await historyDays())
      setWeeks(await trailingWeeks(CHECKPOINT.rhythmWeeks))
      setCheckedOff((await getSettings()).checkpointDone ?? [])
    })()
  }, [])

  async function toggleChecklist(id: string) {
    const next = checkedOff.includes(id)
      ? checkedOff.filter((c) => c !== id)
      : [...checkedOff, id]
    setCheckedOff(next)
    await saveSettings({ checkpointDone: next })
  }

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

        {/* session time — §4.1: drift visible here, not discovered by resentment */}
        {stats.phaseAvgMin && (
          <div className="mt-5">
            <Label ms="masa sesi" en="session time, recent average" color="muted" className="block mb-1.5" />
            <div className="flex items-baseline gap-2">
              <span className="display text-2xl text-charcoal">
                {Math.round(stats.phaseAvgMin.total)} min
              </span>
              <span className="mono-sm text-muted">
                ulangkaji {stats.phaseAvgMin.review.toFixed(1)} · baca{' '}
                {stats.phaseAvgMin.read.toFixed(1)} · cakap {stats.phaseAvgMin.speak.toFixed(1)}
              </span>
            </div>
          </div>
        )}

        {/* ————— December checkpoint (§4.2): a list and a date ————— */}
        <div className="mt-6 border-t-[1.5px] border-charcoal pt-4">
          <div className="flex items-baseline justify-between">
            <Label ms="penanda disember" en="the december checkpoint" color="oxblood" />
            <span className="mono text-muted">{daysUntilCheckpoint()} hari lagi</span>
          </div>
          <div className="mt-2 text-sm text-muted">
            {CHECKPOINT.labelMs} · {CHECKPOINT.labelEn} — 1 Dis 2026
          </div>

          {/* volume */}
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <span className="display text-2xl text-charcoal">
                {stats.studied}
                <span className="text-muted font-body font-normal text-base">
                  {' '}/ {CHECKPOINT.targetWords} kata
                </span>
              </span>
              <Label ms="sasaran" en="target" color="muted" />
            </div>
            <div className="mt-1.5 h-1.5 bg-hairline relative">
              <div
                className="absolute inset-y-0 left-0 bg-oxblood"
                style={{ width: `${Math.min(100, (stats.studied / CHECKPOINT.targetWords) * 100)}%` }}
              />
            </div>
          </div>

          {/* consistency: trailing-12-week rhythm trend */}
          {weeks.length > 0 && (
            <div className="mt-4">
              <Label ms="rentak 12 minggu" en="weekly rhythm, trailing" color="muted" className="block mb-1.5" />
              <div className="flex items-end gap-1 h-9 border-b border-hairline">
                {weeks.map((d, i) => (
                  <div
                    key={i}
                    className={`flex-1 ${d > 0 ? 'bg-indigo' : 'bg-hairline'}`}
                    style={{ height: `${Math.max(8, (d / 7) * 100)}%` }}
                    title={`${d} / 7`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* function: the self-test, marked in Penang */}
          <div className="mt-4">
            <Label ms="ujian diri" en="the self-test — mark it in Penang" color="muted" className="block mb-2" />
            <div className="divide-y divide-hairline border-y border-hairline">
              {CHECKPOINT.checklist.map((item) => {
                const done = checkedOff.includes(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklist(item.id)}
                    className="w-full py-2.5 flex items-center gap-3 text-left"
                    aria-pressed={done}
                  >
                    <span
                      className={`w-4.5 h-4.5 shrink-0 border-[1.5px] ${
                        done ? 'bg-jade border-jade' : 'border-charcoal'
                      }`}
                    />
                    <span className={done ? 'text-muted line-through' : 'text-charcoal'}>
                      {item.ms}
                      <span className="mono-sm text-muted block">{item.en}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
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
