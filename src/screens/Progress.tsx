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
import { CHECKPOINT } from '../lib/checkpoint'
import { Bi, Label } from '../components/ui'

interface Stats {
  studied: number
  inventory: number
  due: number
  debtTrend: number[]
  coverage: number
  /** Mean per-phase minutes over recent sessions (§4.1 — drift made visible). */
  phaseMins: { review: number; read: number; speak: number } | null
}

export function Progress() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [rhythm, setRhythm] = useState<WeekRhythm | null>(null)
  const [history, setHistory] = useState<{ date: string; counted: boolean }[]>([])
  const [weeks, setWeeks] = useState<number[]>([])
  const [marks, setMarks] = useState<boolean[]>([])

  useEffect(() => {
    ;(async () => {
      const cards = await db.cards.toArray()
      const studiedIds = new Set(cards.map((c) => c.wordId))
      const words = await db.words.toArray()
      const studiedWords = words.filter((w) => studiedIds.has(w.id))
      const withVariants = studiedWords.filter((w) => w.colloquial || w.utara).length
      const sessions = await db.sessions.orderBy('date').reverse().limit(14).toArray()
      const mean = (field: 'reviewMs' | 'readMs' | 'speakMs') => {
        const rows = sessions.filter((s) => (s[field] ?? 0) > 0)
        return rows.length
          ? rows.reduce((a, s) => a + s[field]!, 0) / rows.length / 60000
          : 0
      }
      const phase = { review: mean('reviewMs'), read: mean('readMs'), speak: mean('speakMs') }
      setStats({
        studied: cards.length,
        inventory: words.length,
        due: await dueCount(),
        debtTrend: sessions.reverse().map((s) => s.dueAtStart),
        coverage: studiedWords.length ? Math.round((withVariants / studiedWords.length) * 100) : 0,
        phaseMins: phase.review + phase.read + phase.speak > 0 ? phase : null,
      })
      setRhythm(await weekRhythm())
      setHistory(await historyDays())
      setWeeks(await trailingWeeks(12))
      const settings = await getSettings()
      setMarks(settings.checkpointMarks ?? CHECKPOINT.checklist.map(() => false))
    })()
  }, [])

  async function toggleMark(i: number) {
    const next = marks.map((m, j) => (j === i ? !m : m))
    setMarks(next)
    await saveSettings({ checkpointMarks: next })
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
        <div className="text-indigo-hi">
          <Bi ms="kata dipelajari" en="words learned" enClass="text-indigo-lo" />
        </div>
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

        {/* per-phase time, recent mean — the 15-minute ceiling made visible (§4.1) */}
        {stats.phaseMins && (
          <div className="mt-5">
            <Label ms="masa sesi" en="session time, recent average" color="muted" className="block mb-1.5" />
            <div className="flex gap-4 text-sm text-charcoal">
              <span>
                {stats.phaseMins.review.toFixed(1)}m <span className="text-muted">ulangkaji</span>
              </span>
              <span>
                {stats.phaseMins.read.toFixed(1)}m <span className="text-muted">baca</span>
              </span>
              <span>
                {stats.phaseMins.speak.toFixed(1)}m <span className="text-muted">cakap</span>
              </span>
            </div>
          </div>
        )}

        {/* ——— December checkpoint: a list and a date (pedagogy-response §4.2) ——— */}
        <div className="mt-6 border-t-[1.5px] border-charcoal pt-4">
          <div className="flex items-baseline justify-between">
            <Label ms="titik semak Disember" en="december checkpoint" color="oxblood" />
            <span className="mono text-muted">{CHECKPOINT.label}</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="display text-2xl text-charcoal">
              {stats.studied} <span className="text-muted font-body font-normal text-base">/ {CHECKPOINT.targetWords}</span>
            </span>
            <Label ms="kata menjelang trip" en="words by the trip" color="muted" />
          </div>
          <div className="mt-2 h-1.5 bg-hairline relative">
            <div
              className="absolute inset-y-0 left-0 bg-indigo"
              style={{ width: `${Math.min(100, (stats.studied / CHECKPOINT.targetWords) * 100)}%` }}
            />
          </div>
          {weeks.length > 0 && (
            <div className="mt-4">
              <Label ms="rentak 12 minggu" en="trailing rhythm" color="muted" className="block mb-1.5" />
              <div className="flex items-end gap-1 h-8 border-b border-hairline">
                {weeks.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-indigo/70"
                    style={{ height: `${Math.max(6, (d / 7) * 100)}%` }}
                    title={`${d} hari`}
                  />
                ))}
              </div>
            </div>
          )}
          <div className="mt-4">
            <Label ms="ujian fungsi — tanda di Pulau Pinang" en="function self-test" color="muted" className="block mb-2" />
            <ul className="divide-y divide-hairline border-y border-hairline">
              {CHECKPOINT.checklist.map((item, i) => (
                <li key={i}>
                  <button
                    onClick={() => toggleMark(i)}
                    className="w-full flex items-center gap-3 py-2.5 text-left"
                    aria-pressed={marks[i] ?? false}
                  >
                    <span
                      className={`w-4 h-4 shrink-0 border-[1.5px] border-charcoal ${
                        marks[i] ? 'bg-jade' : 'bg-transparent'
                      }`}
                    />
                    <Bi ms={item.ms} en={item.en} className="text-sm" />
                  </button>
                </li>
              ))}
            </ul>
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
          <div className="text-muted/70 text-sm mt-1">(little by little, it becomes a hill)</div>
        </div>
      </div>
    </div>
  )
}
