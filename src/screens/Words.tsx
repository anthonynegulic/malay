import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { CardState, Word } from '../db/types'
import { RegisterChip, VariantChips } from '../components/RegisterChip'
import { Label, SpeakerIcon } from '../components/ui'
import { speak, ttsAvailable } from '../lib/tts'

/** Study-state chip (P1.5): BARU = backlog, BELAJAR = in learning, MATANG = mature. */
function StatusChip({ state }: { state: CardState | undefined }) {
  const [label, cls] =
    state === undefined
      ? ['BARU', 'border border-hairline text-muted']
      : state === 'review'
        ? ['MATANG', 'bg-indigo text-plaster']
        : ['BELAJAR', 'bg-oxblood text-plaster']
  return <span className={`mono-sm rounded-[2px] px-1.5 py-0.5 ${cls}`}>{label}</span>
}

const TAG_FILTERS = ['survival', 'food', 'market', 'masjid', 'family', 'numbers', 'time', 'transport', 'school']

export function Words() {
  const [words, setWords] = useState<Word[]>([])
  const [cardStates, setCardStates] = useState<Map<string, CardState>>(new Map())
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'studied' | 'backlog' | 'variants' | 'harvested'>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    db.words.orderBy('addedAt').toArray().then(setWords)
    db.cards.toArray().then((cs) => setCardStates(new Map(cs.map((c) => [c.wordId, c.state]))))
  }, [])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return words.filter((w) => {
      if (needle && !`${w.baku} ${w.colloquial ?? ''} ${w.utara ?? ''} ${w.gloss_en}`.toLowerCase().includes(needle))
        return false
      if (tag && !w.tags.includes(tag)) return false
      switch (filter) {
        case 'studied':
          return cardStates.has(w.id)
        case 'backlog':
          return !cardStates.has(w.id)
        case 'variants':
          return Boolean(w.colloquial || w.utara)
        case 'harvested':
          return w.source === 'harvested'
        default:
          return true
      }
    })
  }, [words, q, tag, filter, cardStates])

  return (
    <div className="max-w-md mx-auto pb-24">
      <header className="bg-indigo text-plaster px-5 pt-6 pb-5">
        <Label ms="Kata" en="words" color="indigo-hi" />
        <div className="display text-plaster mt-1" style={{ fontSize: 40 }}>
          {words.length}
        </div>
        <div className="text-indigo-hi text-sm">
          {cardStates.size} sedang dipelajari · being studied
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari… · search"
          className="mt-4 w-full border-[1.5px] border-indigo-rl bg-indigo text-plaster placeholder:text-indigo-lo px-4 py-2.5 rounded-[4px] focus:border-gold"
        />
      </header>

      <div className="px-5">
        <div className="flex gap-2 overflow-x-auto py-3 -mx-5 px-5">
          {(
            [
              ['all', 'semua · all'],
              ['studied', 'dipelajari · studied'],
              ['backlog', 'backlog'],
              ['variants', 'ada loghat · variants'],
              ['harvested', 'dituai · harvested'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 mono rounded-[2px] px-2.5 py-1.5 border ${
                filter === k ? 'bg-charcoal text-plaster border-charcoal' : 'border-hairline text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-5 px-5">
          {TAG_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className={`shrink-0 mono rounded-[2px] px-2.5 py-1.5 border ${
                tag === t ? 'bg-oxblood text-plaster border-oxblood' : 'border-hairline text-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <ul className="mt-2 divide-y divide-hairline border-y border-hairline">
          {shown.map((w) => (
            <li key={w.id}>
              <button
                onClick={() => setOpenId(openId === w.id ? null : w.id)}
                className="w-full flex items-center justify-between gap-2 py-3 text-left"
              >
                <div className="min-w-0">
                  <span className="font-semibold">{w.baku}</span>
                  <span className="text-muted text-sm ml-2">{w.gloss_en}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {w.arabic_cognate && <span className="text-gold text-xs mr-0.5">ع</span>}
                  <VariantChips colloquial={w.colloquial} utara={w.utara} />
                  <StatusChip state={cardStates.get(w.id)} />
                </div>
              </button>
              {openId === w.id && (
                <div className="fade-in pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label ms={`${w.pos} · ${w.tags.join(', ')}`} en={w.source} color="muted" />
                    {ttsAvailable() && (
                      <button onClick={() => speak(w.baku)} className="text-gold">
                        <SpeakerIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="flex items-center gap-1.5">
                      <RegisterChip kind="baku" />
                      <span className="font-medium">{w.baku}</span>
                    </span>
                    {w.colloquial && (
                      <span className="flex items-center gap-1.5">
                        <RegisterChip kind="colloq" />
                        <span className="font-medium">{w.colloquial}</span>
                      </span>
                    )}
                    {w.utara && (
                      <span className="flex items-center gap-1.5">
                        <RegisterChip kind="utara" />
                        <span className="font-medium">{w.utara}</span>
                      </span>
                    )}
                  </div>
                  {w.arabic_cognate && (
                    <div className="text-gold text-lg" dir="rtl">
                      {w.arabic_cognate}
                    </div>
                  )}
                  {w.example_baku && (
                    <div className="italic text-sm text-muted border-l-2 border-hairline pl-3">
                      {w.example_baku}
                      {w.example_colloq && <div className="not-italic mt-1">{w.example_colloq}</div>}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
          {shown.length === 0 && (
            <li className="text-center text-muted py-10">
              Tiada padanan · no matches — try another search.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
