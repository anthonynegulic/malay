import { useState } from 'react'
import type { Word } from '../db/types'
import { ExampleBlock, VariantLedger } from './RegisterChip'
import { Bi, Headword, Label, SpeakerIcon } from './ui'
import { speak } from '../lib/tts'

/**
 * Ungraded flip-through over a fixed word deck — the shared engine of the
 * recall pass (pedagogy-response §1-Q1) and free practice (feedback-002 R4).
 * Card front → try to recall → tap to reveal → next. By construction it never
 * imports the scheduler: no grade buttons, no due-date changes, no FSRS
 * writes. Guess, reveal, move on.
 */
export function FlipDeck({
  words,
  headerMs,
  headerEn,
  tts,
  onDone,
  onExit,
}: {
  words: Word[]
  headerMs: string
  headerEn: string
  tts: boolean
  onDone: () => void
  onExit: () => void
}) {
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const word = words[i]

  function next() {
    setFlipped(false)
    if (i + 1 >= words.length) onDone()
    else setI(i + 1)
  }

  if (!word) return null

  if (!flipped) {
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6 flex items-center justify-between">
          <button onClick={onExit} className="mono text-indigo-hi">
            ← keluar · exit
          </button>
          <span className="mono text-gold">
            {i + 1} / {words.length} · {headerMs.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 grid place-items-center px-5 w-full">
          <div className="text-center w-full min-w-0">
            <button onClick={() => setFlipped(true)} className="block w-full">
              <Headword text={word.baku} maxPx={96} className="headword text-plaster" />
            </button>
            {tts && (
              <button
                onClick={() => speak(word.example_baku || word.baku)}
                aria-label="Main audio"
                className="text-gold mt-8"
              >
                <SpeakerIcon className="w-8 h-8 mx-auto" />
              </button>
            )}
          </div>
        </div>
        <div className="p-5">
          <button
            onClick={() => setFlipped(true)}
            className="w-full bg-plaster text-charcoal py-4 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
          >
            <span className="font-medium">Cuba ingat, kemudian tunjuk</span>
            <span className="mono-sm text-muted block mt-0.5">(try to recall, then reveal)</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col bg-plaster">
      <div className="bg-indigo text-plaster px-5 pt-6 pb-5">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onExit} className="mono text-indigo-hi">
            ← keluar · exit
          </button>
          <span className="mono text-gold">
            {i + 1} / {words.length}
          </span>
        </div>
        <Headword text={word.baku} maxPx={44} className="reveal-head display text-plaster" />
        <div className="flex items-center gap-3 mt-1">
          <span className="text-indigo-hi">{word.gloss_en}</span>
          <span className="mono text-indigo-lo">{word.pos}</span>
        </div>
      </div>

      <div className="reveal-body flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {word.example_baku && (
          <div>
            <div className="flex items-center justify-between">
              <Label ms="contoh" en="example" color="muted" />
              {tts && (
                <button
                  onClick={() => speak(word.example_baku)}
                  aria-label="Main audio"
                  className="text-gold"
                >
                  <SpeakerIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <ExampleBlock word={word} className="mt-1.5" />
          </div>
        )}

        {(word.colloquial || word.utara) && (
          <div>
            <Label ms="loghat" en="register" color="muted" className="block mb-1" />
            <VariantLedger
              baku={word.baku}
              colloquial={word.colloquial}
              utara={word.utara}
              exampleBaku={word.example_baku}
              exampleColloq={word.example_colloq}
            />
          </div>
        )}

        {word.arabic_cognate && (
          <div>
            <Label ms="arab" en="arabic" color="gold" className="block mb-1" />
            <div className="text-2xl text-charcoal" dir="rtl">
              {word.arabic_cognate}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 pb-5 pt-3 border-t-[1.5px] border-charcoal">
        <button
          onClick={next}
          className="w-full bg-gold text-gold-ink py-4 rounded-[4px] border-[1.5px] border-charcoal font-medium active:opacity-90"
        >
          {i + 1 >= words.length ? (
            <Bi ms="Selesai" en="done" enClass="text-gold-ink/70" />
          ) : (
            <Bi ms="Seterusnya" en="next" enClass="text-gold-ink/70" />
          )}
        </button>
        <div className="mono-sm text-muted text-center mt-2">
          {headerMs} · {headerEn}
        </div>
      </div>
    </div>
  )
}
