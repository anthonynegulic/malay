import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { db } from '../db/db'
import { dueCount } from '../lib/fsrs'
import {
  getOrCreateTodaySession,
  newWordBudgetRemaining,
  weekRhythm,
  historyDays,
  type WeekRhythm,
} from '../lib/session'
import { Hill } from '../components/Hill'
import { CornerMotif } from '../components/ui'

const DAY_LABELS = ['I', 'S', 'R', 'K', 'J', 'S', 'A'] // Isnin..Ahad

/** Weekday indicator drawn as a footpath stone, matching the Hill's language (P1.3). */
function DayStone({ state, label }: { state: boolean | null; label: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <svg viewBox="0 0 20 14" className="w-6 h-4" aria-hidden>
        <ellipse
          cx="10"
          cy="7"
          rx="8.5"
          ry="5.5"
          fill={state === true ? 'var(--color-shutter)' : 'none'}
          stroke={state === true ? 'var(--color-shutter)' : 'var(--color-ink)'}
          strokeOpacity={state === true ? 1 : state === false ? 0.35 : 0.2}
          strokeWidth="1.4"
          strokeDasharray={state === false ? '2.5 2.5' : undefined}
        />
      </svg>
      <span className="font-mono text-[9px] text-ink/40">{label}</span>
    </span>
  )
}

export function Today() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const done = params.get('done') // 'full' | 'sikit' | null — plays the Hill's growth moment

  const [due, setDue] = useState(0)
  const [budget, setBudget] = useState(0)
  const [studied, setStudied] = useState(0)
  const [rhythm, setRhythm] = useState<WeekRhythm | null>(null)
  const [history, setHistory] = useState<boolean[]>([])

  useEffect(() => {
    ;(async () => {
      await getOrCreateTodaySession()
      setDue(await dueCount())
      setBudget(await newWordBudgetRemaining())
      setStudied(await db.cards.count())
      setRhythm(await weekRhythm())
      setHistory((await historyDays()).slice(-14).map((d) => d.counted))
    })()
  }, [done])

  const today = new Date().toLocaleDateString('ms-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="max-w-md mx-auto pb-24 fade-in">
      {/* hill scene anchored full-bleed to the top — no floating */}
      <div className="relative">
        <Hill wordCount={studied} history={history} grow={Boolean(done)} />
        <header className="absolute top-0 inset-x-0 px-5 pt-6 flex items-start justify-between">
          <div>
            <div className="text-xs text-ink/55 capitalize">{today}</div>
            <h1 className="font-display font-extrabold text-2xl tracking-tight text-ink">
              {done ? 'Siap!' : 'Selamat datang balik'}
            </h1>
            <div className="text-[11px] text-ink/40">{done ? 'done!' : 'welcome back'}</div>
          </div>
          <Link to="/settings" aria-label="Settings" className="text-ink/45 p-1">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
            </svg>
          </Link>
        </header>
      </div>

      <div className="px-5">
        {/* weekday footpath stones */}
        {rhythm && (
          <div className="mt-3 flex items-end justify-between">
            <div className="flex gap-1.5">
              {rhythm.days.map((d, i) => (
                <DayStone key={i} state={d} label={DAY_LABELS[i]} />
              ))}
            </div>
            <div className="font-mono text-[10px] text-ink/50 text-right pb-0.5">
              {rhythm.daysDone}/{rhythm.target} minggu ini
              <span className="block text-ink/35">days this week</span>
            </div>
          </div>
        )}

        {/* one compact stat strip */}
        <div className="panel mt-5 grid grid-cols-2 divide-x divide-ink/10">
          <div className="px-4 py-3">
            <span className="font-mono text-xl text-mansion">{due}</span>
            <span className="block font-mono text-[9px] uppercase tracking-widest text-ink/45 mt-0.5">
              kad diulang · due
            </span>
          </div>
          <div className="px-4 py-3">
            <span className="font-mono text-xl text-shutter">{budget}</span>
            <span className="block font-mono text-[9px] uppercase tracking-widest text-ink/45 mt-0.5">
              kata baru · new left
            </span>
          </div>
        </div>

        {done ? (
          <div className="panel-m relative mt-5 px-5 py-6 text-center">
            <CornerMotif className="absolute top-0 right-0 w-9 h-9" />
            <div className="text-ink/80 text-sm">
              {done === 'sikit'
                ? 'Sikit je pun kira. Jumpa esok.'
                : 'Sesi penuh selesai. Bukit itu tumbuh sedikit lagi.'}
            </div>
            <div className="text-xs text-ink/45 mt-1">
              {done === 'sikit'
                ? 'A little still counts. See you tomorrow.'
                : 'Full session complete. The hill grew a little.'}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <button
              onClick={() => navigate('/review?mode=full')}
              className="w-full py-4 rounded-2xl bg-mansion text-limewash font-display font-extrabold text-xl tracking-tight active:scale-[0.98]"
            >
              Mula
              <span className="block font-body font-normal text-xs text-limewash/70 tracking-normal">
                start today&rsquo;s session
              </span>
            </button>
            <button
              onClick={() => navigate('/review?mode=sikit')}
              className="w-full py-3 rounded-2xl border border-ink/20 text-ink/70 font-medium active:scale-[0.98]"
            >
              Sikit je <span className="text-ink/40 text-sm">— reviews only, ~5 min</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
