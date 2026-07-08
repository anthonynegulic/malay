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

const DAY_LABELS = ['I', 'S', 'R', 'K', 'J', 'S', 'A'] // Isnin..Ahad

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
      setHistory((await historyDays()).slice(-12).map((d) => d.counted))
    })()
  }, [done])

  const today = new Date().toLocaleDateString('ms-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-28 fade-in">
      <header className="flex items-start justify-between">
        <div>
          <div className="text-sm text-ink/60 capitalize">{today}</div>
          <h1 className="font-display font-extrabold text-3xl tracking-tight text-ink">
            {done ? 'Siap! 🎉' : 'Selamat datang balik'}
          </h1>
          <div className="text-xs text-ink/40">{done ? 'done!' : 'welcome back'}</div>
        </div>
        <Link to="/settings" aria-label="Settings" className="text-ink/50 text-xl p-1">
          ⚙
        </Link>
      </header>

      <div className="mt-4 -mx-2">
        <Hill wordCount={studied} history={history} grow={Boolean(done)} />
      </div>

      {rhythm && (
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {rhythm.days.map((d, i) => (
              <span
                key={i}
                className={`w-7 h-7 rounded-full grid place-items-center text-[10px] font-mono ${
                  d === true
                    ? 'bg-shutter text-limewash'
                    : d === false
                      ? 'bg-ink/5 text-ink/40'
                      : 'border border-dashed border-ink/20 text-ink/30'
                }`}
              >
                {DAY_LABELS[i]}
              </span>
            ))}
          </div>
          <div className="text-xs font-mono text-ink/60 text-right">
            {rhythm.daysDone}/{rhythm.target} minggu ini
            <span className="block text-[10px] text-ink/40">days this week</span>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-ink/10 p-4">
          <div className="font-mono text-2xl font-medium text-mansion">{due}</div>
          <div className="text-xs text-ink/60 mt-0.5">kad untuk diulang</div>
          <div className="text-[10px] text-ink/40">cards to review</div>
        </div>
        <div className="bg-white rounded-xl border border-ink/10 p-4">
          <div className="font-mono text-2xl font-medium text-shutter">{budget}</div>
          <div className="text-xs text-ink/60 mt-0.5">kata baru hari ini</div>
          <div className="text-[10px] text-ink/40">new words left today</div>
        </div>
      </div>

      {done ? (
        <div className="mt-8 text-center text-ink/70 text-sm">
          {done === 'sikit'
            ? 'Sikit je pun kira. Jumpa esok.'
            : 'Sesi penuh selesai. Bukit itu tumbuh sedikit lagi.'}
          <div className="text-xs text-ink/40 mt-1">
            {done === 'sikit'
              ? 'A little still counts. See you tomorrow.'
              : 'Full session complete. The hill grew a little.'}
          </div>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <button
            onClick={() => navigate('/review?mode=full')}
            className="w-full py-4 rounded-2xl bg-mansion text-limewash font-display font-extrabold text-xl tracking-tight active:scale-[0.98] shadow-sm"
          >
            Mula
            <span className="block font-body font-normal text-xs text-limewash/70 tracking-normal">
              start today&rsquo;s session
            </span>
          </button>
          <button
            onClick={() => navigate('/review?mode=sikit')}
            className="w-full py-3 rounded-2xl bg-transparent border border-ink/15 text-ink/70 font-medium active:scale-[0.98]"
          >
            Sikit je <span className="text-ink/40 text-sm">— reviews only, ~5 min</span>
          </button>
        </div>
      )}
    </div>
  )
}
