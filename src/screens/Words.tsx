import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Word } from '../db/types'
import { VariantRow } from '../components/RegisterChip'
import { speak, ttsAvailable } from '../lib/tts'

const TAG_FILTERS = [
  'survival',
  'food',
  'market',
  'masjid',
  'family',
  'numbers',
  'time',
  'transport',
  'school',
]

export function Words() {
  const [words, setWords] = useState<Word[]>([])
  const [studiedIds, setStudiedIds] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'studied' | 'backlog' | 'variants' | 'harvested'>(
    'all',
  )
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    db.words.orderBy('addedAt').toArray().then(setWords)
    db.cards.toArray().then((cs) => setStudiedIds(new Set(cs.map((c) => c.wordId))))
  }, [])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return words.filter((w) => {
      if (needle && !`${w.baku} ${w.colloquial ?? ''} ${w.utara ?? ''} ${w.gloss_en}`.toLowerCase().includes(needle))
        return false
      if (tag && !w.tags.includes(tag)) return false
      switch (filter) {
        case 'studied':
          return studiedIds.has(w.id)
        case 'backlog':
          return !studiedIds.has(w.id)
        case 'variants':
          return Boolean(w.colloquial || w.utara)
        case 'harvested':
          return w.source === 'harvested'
        default:
          return true
      }
    })
  }, [words, q, tag, filter, studiedIds])

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-28">
      <h1 className="font-display font-extrabold text-3xl tracking-tight">Kata</h1>
      <div className="text-sm text-ink/60 mt-1">
        {words.length} dalam inventori · {studiedIds.size} sedang dipelajari
        <span className="block text-xs text-ink/40">words in inventory · being studied</span>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari… (search)"
        className="mt-4 w-full rounded-xl border border-ink/15 bg-white px-4 py-3"
      />

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
        {(
          [
            ['all', 'semua · all'],
            ['studied', 'dipelajari · studied'],
            ['backlog', 'backlog'],
            ['variants', 'ada loghat · has variants'],
            ['harvested', 'dituai · harvested'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-mono ${
              filter === k ? 'bg-mansion text-limewash' : 'bg-ink/5 text-ink/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
        {TAG_FILTERS.map((t) => (
          <button
            key={t}
            onClick={() => setTag(tag === t ? null : t)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-mono ${
              tag === t ? 'bg-shutter text-limewash' : 'bg-ink/5 text-ink/60'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {shown.map((w) => (
          <li key={w.id} className="bg-white rounded-xl border border-ink/10">
            <button
              onClick={() => setOpenId(openId === w.id ? null : w.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <span className="font-semibold">{w.baku}</span>
                <span className="text-ink/50 text-sm ml-2">{w.gloss_en}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {w.arabic_cognate && <span className="text-brass text-xs">ع</span>}
                {(w.colloquial || w.utara) && (
                  <span className="w-2 h-2 rounded-full bg-nyonya inline-block" />
                )}
                <span
                  className={`w-2 h-2 rounded-full inline-block ${
                    studiedIds.has(w.id) ? 'bg-shutter' : 'bg-ink/15'
                  }`}
                />
              </div>
            </button>
            {openId === w.id && (
              <div className="fade-in px-4 pb-4 space-y-3 border-t border-ink/5 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
                    {w.pos} · {w.tags.join(', ')} · {w.source}
                  </span>
                  {ttsAvailable() && (
                    <button onClick={() => speak(w.baku)} className="text-shutter text-sm">
                      ▶
                    </button>
                  )}
                </div>
                <VariantRow baku={w.baku} colloquial={w.colloquial} utara={w.utara} />
                {w.arabic_cognate && (
                  <div className="text-brass text-lg" dir="rtl">
                    {w.arabic_cognate}
                  </div>
                )}
                {w.example_baku && (
                  <div className="italic text-sm text-ink/70 border-l-2 border-mansion/30 pl-3">
                    {w.example_baku}
                    {w.example_colloq && (
                      <div className="not-italic text-ink/50 mt-1">{w.example_colloq}</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {shown.length === 0 && (
          <li className="text-center text-ink/50 py-10">
            Tiada padanan — cuba carian lain.
            <span className="block text-xs text-ink/35">No matches — try another search.</span>
          </li>
        )}
      </ul>
    </div>
  )
}
