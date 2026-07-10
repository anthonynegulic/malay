import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Word } from '../db/types'
import { dueCount } from '../lib/fsrs'
import {
  getOrCreateTodaySession,
  historyDays,
  newWordBudgetRemaining,
  nextMilestone,
  todayStr,
  weekRhythm,
  wordOfTheDay,
  type WeekRhythm,
} from '../lib/session'
import { Label, SpeakerIcon } from '../components/ui'
import { RegisterChip } from '../components/RegisterChip'
import { speak, ttsAvailable } from '../lib/tts'

const DAY_LABELS = ['I', 'S', 'R', 'K', 'J', 'S', 'A'] // Isnin..Ahad

export function Today() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const done = params.get('done') // 'full' | 'sikit' | null

  const [due, setDue] = useState(0)
  const [budget, setBudget] = useState(0)
  const [studied, setStudied] = useState(0)
  const [rhythm, setRhythm] = useState<WeekRhythm | null>(null)
  const [history, setHistory] = useState<boolean[]>([])
  const [word, setWord] = useState<Word | null>(null)
  const [tts, setTts] = useState(false)

  useEffect(() => {
    ;(async () => {
      await getOrCreateTodaySession()
      setDue(await dueCount())
      setBudget(await newWordBudgetRemaining())
      setStudied(await db.cards.count())
      setRhythm(await weekRhythm())
      setHistory((await historyDays()).slice(-14).map((d) => d.counted))
      setWord((await wordOfTheDay()) ?? null)
      const s = await getSettings()
      setTts(s.ttsEnabled && ttsAvailable())
    })()
  }, [done])

  const dateLabel = new Date()
    .toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long' })
    .toUpperCase()

  const target = nextMilestone(studied)
  const pct = Math.min(100, (studied / target) * 100)

  return (
    <div className="max-w-md mx-auto pb-24">
      {/* ————— indigo header floods the top third ————— */}
      <header className="bg-indigo text-plaster px-5 pt-6 pb-7">
        <div className="flex items-start justify-between">
          <span className="mono text-gold">{dateLabel}</span>
          <Link to="/settings" className="mono text-indigo-hi">
            tetapan · settings
          </Link>
        </div>

        {done ? (
          <div className="mt-8 mb-2">
            <div className="display text-plaster" style={{ fontSize: 46 }}>
              Siap.
            </div>
            <p className="text-indigo-hi mt-2">
              {done === 'sikit'
                ? 'Sikit je pun kira. Jumpa esok.'
                : 'Sesi penuh selesai. Sedikit-sedikit.'}
            </p>
            <p className="text-indigo-lo text-sm">
              {done === 'sikit'
                ? 'A little still counts. See you tomorrow.'
                : 'Full session complete. Little by little.'}
            </p>
          </div>
        ) : (
          word && (
            <div className="mt-5">
              <Label ms="Kata hari ini" en="word of the day" color="indigo-hi" />
              <div className="flex items-end justify-between gap-3 mt-2">
                <div className="display text-plaster break-words" style={{ fontSize: 'clamp(46px, 15vw, 66px)' }}>
                  {word.baku}
                </div>
                {tts && (
                  <button
                    onClick={() => speak(word.example_baku || word.baku)}
                    aria-label="Main audio"
                    className="text-gold shrink-0 mb-1"
                  >
                    <SpeakerIcon className="w-7 h-7" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <RegisterChip kind="baku" />
                <span className="text-indigo-hi">{word.gloss_en}</span>
              </div>
              {word.example_baku && (
                <div className="border-t border-indigo-rl mt-4 pt-3">
                  <div className="text-plaster">{word.example_baku}</div>
                </div>
              )}
            </div>
          )
        )}
      </header>

      {/* ————— plaster content, separated by rules not cards ————— */}
      <div className="px-5">
        {/* progress row */}
        <div className="pt-5">
          <div className="flex items-baseline justify-between">
            <span className="display text-charcoal text-xl">
              {studied} <span className="text-muted font-body font-normal text-base">/ {target} kata</span>
            </span>
            <span className="mono text-muted">
              next · {target}
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-hairline relative">
            <div className="absolute inset-y-0 left-0 bg-oxblood" style={{ width: `${pct}%` }} />
          </div>
          <div className="mono text-muted mt-1.5">{studied} words learned</div>
        </div>

        {/* weekday row — practised / today / future, gaps visible */}
        {rhythm && (
          <div className="mt-5 flex items-end justify-between">
            <div className="flex gap-1.5">
              {rhythm.days.map((d, i) => (
                <span key={i} className="flex flex-col items-center gap-1">
                  <span
                    className={`w-6 h-6 ${
                      d === true
                        ? 'bg-indigo'
                        : i === rhythm.todayIndex
                          ? 'border-[1.5px] border-oxblood'
                          : 'border-[1.5px] border-hairline'
                    }`}
                  />
                  <span className="mono-sm text-muted">{DAY_LABELS[i]}</span>
                </span>
              ))}
            </div>
            <span className="mono text-oxblood text-right">
              {rhythm.daysDone} / {rhythm.target} hari
              <span className="block text-muted">days this week</span>
            </span>
          </div>
        )}

        {/* stat ledger between charcoal rules */}
        <div className="mt-6 border-y-[1.5px] border-charcoal">
          <div className="grid grid-cols-2 divide-x divide-hairline">
            <div className="py-3 pr-4">
              <div className="display text-2xl text-charcoal">{due}</div>
              <Label ms="kad diulang" en="due" color="muted" />
            </div>
            <div className="py-3 pl-4">
              <div className="display text-2xl text-charcoal">{budget}</div>
              <Label ms="kata baru" en="new left" color="muted" />
            </div>
          </div>
        </div>

        {/* primary action + secondary sharing its lower edge */}
        {!done && (
          <div className="mt-6 border-[1.5px] border-charcoal rounded-[4px] overflow-hidden">
            <button
              onClick={() => navigate('/review?mode=full')}
              className="w-full bg-gold text-gold-ink py-4 border-b-[1.5px] border-charcoal active:opacity-90"
            >
              <span className="display text-xl">Mula</span>
              <span className="block mono-sm text-gold-ink/70 mt-0.5">start today&rsquo;s session</span>
            </button>
            <button
              onClick={() => navigate('/review?mode=sikit')}
              className="w-full bg-transparent text-charcoal py-3 active:bg-charcoal/5"
            >
              <span className="font-medium">Sikit je</span>
              <span className="text-muted text-sm"> — reviews only, ~5 min</span>
            </button>
          </div>
        )}

        {/* proverb signature line */}
        <div className="mt-8 text-center">
          <div className="text-muted text-sm italic">sedikit-sedikit, lama-lama jadi bukit</div>
          <div className="mono-sm text-muted/70 mt-1">little by little, it becomes a hill</div>
        </div>
      </div>
    </div>
  )
}
