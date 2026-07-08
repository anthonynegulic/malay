import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Passage, PassageLine, Register, Word } from '../db/types'
import { getOrGeneratePassage } from '../lib/api'
import { harvestWord, updateSession, type HarvestResult } from '../lib/session'
import { RegisterChip } from '../components/RegisterChip'
import { CloudIcon, SectionLabel } from '../components/ui'
import { speak, ttsAvailable } from '../lib/tts'

function cleanToken(t: string): string {
  return t.toLowerCase().replace(/[^a-zà-ɏ'-]/gi, '')
}

interface Popover {
  token: string
  gloss?: string
  status?: HarvestResult
  hasCard: boolean
}

type GlossMode = 'always' | 'tap' | 'toggle'
const GLOSS_MODE: Record<number, GlossMode> = { 0: 'always', 1: 'tap', 2: 'tap', 3: 'toggle' }

export function Read() {
  const navigate = useNavigate()
  const [register, setRegister] = useState<Register>('baku')
  const [passage, setPassage] = useState<Passage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [popover, setPopover] = useState<Popover | null>(null)
  const [showTranslation, setShowTranslation] = useState(false)
  const [openGlosses, setOpenGlosses] = useState<Set<number>>(new Set())
  const [showAnswer, setShowAnswer] = useState(false)
  const [marked, setMarked] = useState<'betul' | 'tak' | null>(null)
  const [newWords, setNewWords] = useState<Word[]>([])
  const [tts, setTts] = useState(false)

  async function load(reg: Register) {
    setLoading(true)
    setError(false)
    setPopover(null)
    setShowAnswer(false)
    setMarked(null)
    setOpenGlosses(new Set())
    try {
      const p = await getOrGeneratePassage(reg)
      setPassage(p)
      setNewWords(((await db.words.bulkGet(p.newWordIds)).filter(Boolean) as Word[]) ?? [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getSettings().then((s) => {
      setRegister(s.registerPreference)
      setTts(s.ttsEnabled && ttsAvailable())
      void load(s.registerPreference)
    })
  }, [])

  const newSurfaces = useMemo(
    () => new Set(newWords.map((w) => w.baku.toLowerCase())),
    [newWords],
  )

  // Old cached passages (pre-v1.1) have no lines — degrade to one prose block.
  const lines: PassageLine[] = useMemo(() => {
    if (!passage) return []
    if (passage.lines?.length) return passage.lines
    return [{ speaker: null, text: passage.text, gloss: passage.translation }]
  }, [passage])

  const tier = passage?.tier ?? 3
  const glossMode = GLOSS_MODE[tier] ?? 'toggle'

  async function tapWord(token: string) {
    if (!passage) return
    const clean = cleanToken(token)
    if (!clean) return
    const glossEntry = passage.glossary.find((g) => cleanToken(g.word) === clean)
    const inv = await db.words.where('baku').equals(clean).first()
    const hasCard = inv ? Boolean(await db.cards.where('wordId').equals(inv.id).first()) : false
    setPopover({ token: clean, gloss: glossEntry?.gloss ?? inv?.gloss_en, hasCard })
  }

  async function tambah() {
    if (!popover) return
    const status = await harvestWord(popover.token, popover.gloss)
    setPopover({ ...popover, status })
  }

  function toggleRegister() {
    const next: Register = register === 'baku' ? 'colloquial' : 'baku'
    setRegister(next)
    void load(next)
  }

  async function selfMark(mark: 'betul' | 'tak') {
    setMarked(mark)
    await updateSession({ comprehension: mark })
  }

  async function continueOn() {
    await updateSession({ type: 'full' })
    navigate('/speak', { replace: true })
  }

  function renderWords(text: string) {
    return text.split(/(\s+)/).map((tok, i) =>
      /\s/.test(tok) || !cleanToken(tok) ? (
        <span key={i}>{tok}</span>
      ) : (
        <button
          key={i}
          onClick={() => tapWord(tok)}
          className={`rounded-sm active:bg-mansion/10 ${
            newSurfaces.has(cleanToken(tok)) ? 'mark-new' : ''
          }`}
        >
          {tok}
        </button>
      ),
    )
  }

  const question = passage?.question
  const questionPrimary =
    tier === 0 ? question?.promptEn || question?.prompt : question?.prompt
  const questionSecondary = tier === 1 || tier === 2 ? question?.promptEn : undefined

  return (
    <div className="min-h-dvh max-w-md mx-auto px-5 py-6 flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/')} className="text-ink/50 text-sm">
          ← keluar <span className="text-ink/35">· exit</span>
        </button>
        <button
          onClick={toggleRegister}
          disabled={loading}
          className="flex items-center gap-2 border border-ink/20 rounded-full px-3 py-1.5 text-xs font-mono disabled:opacity-40"
          title="Regenerate this passage in the other register"
        >
          <RegisterChip kind={register === 'baku' ? 'baku' : 'colloq'} />
          tukar ↺ <span className="text-ink/40">switch</span>
        </button>
      </header>

      {loading && (
        <div className="flex-1 grid place-items-center text-center text-ink/60 fade-in">
          <div className="flex flex-col items-center gap-3">
            <span className="spinner" />
            <div>
              Menjana bacaan hari ini…
              <div className="text-xs text-ink/40 mt-1">writing today&rsquo;s reading…</div>
            </div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 grid place-items-center text-center fade-in">
          <div className="flex flex-col items-center">
            <CloudIcon className="w-9 h-9 text-ink/35 mb-3" />
            <div className="text-ink/80 font-medium">Tak boleh jana hari ini — cuba lagi.</div>
            <div className="text-ink/50 text-sm mt-1 max-w-xs">
              Could not generate today&rsquo;s reading. Check that the API server is running and
              your ANTHROPIC_API_KEY is set in .env (restart npm run dev after editing it).
            </div>
            <div className="mt-5 flex gap-3 justify-center">
              <button
                onClick={() => load(register)}
                className="px-5 py-2.5 rounded-xl bg-mansion text-limewash font-medium"
              >
                Cuba lagi
                <span className="block text-xs font-normal text-limewash/70">try again</span>
              </button>
              <button
                onClick={() => navigate('/?done=sikit', { replace: true })}
                className="px-5 py-2.5 rounded-xl border border-ink/20 text-ink/70"
              >
                Selesai tanpa bacaan
                <span className="block text-xs text-ink/40">finish without reading</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {passage && !loading && !error && (
        <div className="fade-in pb-6">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel ms={passage.topic} en={passage.date} color="ink" />
            {tts && (
              <button
                onClick={() => speak(passage.text)}
                className="text-shutter text-sm font-medium shrink-0"
              >
                ▶ dengar <span className="opacity-60">· listen</span>
              </button>
            )}
          </div>

          {/* the passage — white is reserved for "paper" like this */}
          <div className="paper p-5">
            {passage.format === 'dialogue' || glossMode !== 'toggle' ? (
              <div className="space-y-4">
                {lines.map((line, i) => (
                  <div key={i}>
                    <div className="passage flex gap-2.5 items-baseline">
                      {line.speaker && (
                        <span
                          className={`font-mono text-[10px] font-medium rounded px-1 py-0.5 shrink-0 ${
                            line.speaker === 'A'
                              ? 'bg-mansion text-limewash'
                              : 'bg-shutter text-limewash'
                          }`}
                        >
                          {line.speaker}
                        </span>
                      )}
                      <span className="flex-1">{renderWords(line.text)}</span>
                      {glossMode === 'tap' && line.gloss && (
                        <button
                          onClick={() =>
                            setOpenGlosses((s) => {
                              const n = new Set(s)
                              if (n.has(i)) n.delete(i)
                              else n.add(i)
                              return n
                            })
                          }
                          aria-label="Toggle English gloss"
                          className={`font-mono text-[9px] rounded px-1 py-0.5 shrink-0 self-center ${
                            openGlosses.has(i) ? 'bg-ink/10 text-ink/70' : 'text-ink/35 border border-ink/15'
                          }`}
                        >
                          EN
                        </button>
                      )}
                    </div>
                    {line.gloss && (glossMode === 'always' || openGlosses.has(i)) && (
                      <div
                        className={`text-sm text-ink/55 mt-1 ${line.speaker ? 'pl-7' : ''} ${
                          glossMode === 'tap' ? 'fade-in' : ''
                        }`}
                      >
                        {line.gloss}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="passage">{renderWords(lines.map((l) => l.text).join(' '))}</p>
            )}
          </div>

          {newWords.length > 0 && (
            <div className="mt-3 text-xs text-ink/60">
              <span className="font-mono uppercase tracking-widest text-[10px] text-ink/40 mr-2">
                baru · new
              </span>
              {newWords.map((w) => (
                <span key={w.id} className="mark-new mr-1.5">
                  {w.baku}
                </span>
              ))}
              <span className="text-ink/40">— their review cards start tomorrow</span>
            </div>
          )}

          {glossMode === 'toggle' && (
            <>
              <button
                onClick={() => setShowTranslation((s) => !s)}
                className="mt-4 text-sm text-mansion font-medium"
              >
                {showTranslation ? 'Sembunyi terjemahan' : 'Tunjuk terjemahan'}
                <span className="text-mansion/50">
                  {' '}
                  · {showTranslation ? 'hide' : 'show'} translation
                </span>
              </button>
              {showTranslation && (
                <p className="fade-in mt-2 text-sm text-ink/70 panel-m p-4">
                  {passage.translation}
                </p>
              )}
            </>
          )}

          {questionPrimary && (
            <div className="panel-s mt-6 p-5">
              <SectionLabel ms="soalan" en="question" color="shutter" className="mb-2" />
              <div className="font-medium">{questionPrimary}</div>
              {questionSecondary && (
                <div className="text-xs text-ink/45 mt-0.5">{questionSecondary}</div>
              )}
              {showAnswer ? (
                <div className="fade-in mt-3">
                  <div className="text-shutter font-medium">{question?.answer}</div>
                  {/* honest self-mark — data only, no gating (P2) */}
                  {marked ? (
                    <div className="text-xs text-ink/45 mt-2">
                      {marked === 'betul' ? 'Dicatat ✓' : 'Dicatat — esok lebih baik.'}
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => selfMark('betul')}
                        className="px-4 py-1.5 rounded-full bg-shutter text-limewash text-sm font-medium"
                      >
                        Betul ✓<span className="opacity-70 font-normal"> I had it</span>
                      </button>
                      <button
                        onClick={() => selfMark('tak')}
                        className="px-4 py-1.5 rounded-full border border-ink/20 text-ink/60 text-sm"
                      >
                        Tak<span className="opacity-70"> — missed it</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="mt-3 text-sm text-mansion font-medium"
                >
                  Tunjuk jawapan <span className="text-mansion/50">· show answer</span>
                </button>
              )}
            </div>
          )}

          <button
            onClick={continueOn}
            className="mt-6 w-full py-4 rounded-2xl bg-mansion text-limewash font-semibold active:scale-[0.98]"
          >
            Teruskan — cakap sikit
            <span className="block text-xs font-normal text-limewash/70">
              continue — a short speaking task
            </span>
          </button>
        </div>
      )}

      {/* harvest popover */}
      {popover && (
        <div
          className="fixed inset-0 bg-ink/30 grid place-items-end sm:place-items-center z-20"
          onClick={() => setPopover(null)}
        >
          <div
            className="fade-in panel bg-limewash w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-display font-extrabold text-3xl tracking-tight text-mansion">
              {popover.token}
            </div>
            <div className="mt-2 text-ink/80">{popover.gloss || 'No gloss available.'}</div>
            <div className="mt-5">
              {popover.status === 'added' && (
                <div className="text-shutter font-medium">
                  Ditambah — kad mula esok. ✓
                  <div className="text-xs font-normal text-ink/50">
                    Added — its review card starts tomorrow.
                  </div>
                </div>
              )}
              {popover.status === 'queued' && (
                <div className="text-brass font-medium">
                  Kuota hari ini penuh — masuk giliran esok.
                  <div className="text-xs font-normal text-ink/50">
                    Today&rsquo;s new-word cap is full — queued for tomorrow.
                  </div>
                </div>
              )}
              {(popover.hasCard || popover.status === 'already') && !popover.status && (
                <div className="text-ink/50 text-sm">
                  Sudah dalam ulangkaji. <span className="text-ink/35">· already in reviews</span>
                </div>
              )}
              {!popover.hasCard && !popover.status && (
                <button
                  onClick={tambah}
                  className="w-full py-3.5 rounded-xl bg-shutter text-limewash font-semibold"
                >
                  Tambah
                  <span className="block text-xs font-normal text-limewash/70">
                    add to my words
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
