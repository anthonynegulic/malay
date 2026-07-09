import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Passage, PassageLine, Register, Word } from '../db/types'
import { getOrGeneratePassage } from '../lib/api'
import { harvestWord, updateSession, type HarvestResult } from '../lib/session'
import { RegisterChip } from '../components/RegisterChip'
import { CloudIcon, Label, SpeakerIcon } from '../components/ui'
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

  const newSurfaces = useMemo(() => new Set(newWords.map((w) => w.baku.toLowerCase())), [newWords])

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
    setPopover({ ...popover, status: await harvestWord(popover.token, popover.gloss) })
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
          className={`active:bg-gold/15 ${newSurfaces.has(cleanToken(tok)) ? 'mark-new' : ''}`}
        >
          {tok}
        </button>
      ),
    )
  }

  const question = passage?.question
  const questionPrimary = tier === 0 ? question?.promptEn || question?.prompt : question?.prompt
  const questionSecondary = tier === 1 || tier === 2 ? question?.promptEn : undefined

  return (
    <div className="min-h-dvh max-w-md mx-auto flex flex-col">
      <header className="bg-indigo text-plaster px-5 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="mono text-indigo-hi">
          ← keluar · exit
        </button>
        <button
          onClick={toggleRegister}
          disabled={loading}
          className="flex items-center gap-2 disabled:opacity-40"
          title="Regenerate this passage in the other register"
        >
          <RegisterChip kind={register === 'baku' ? 'baku' : 'colloq'} />
          <span className="mono text-indigo-hi">tukar · switch</span>
        </button>
      </header>

      <div className="flex-1 px-5 py-5">
        {loading && (
          <div className="h-full grid place-items-center text-center text-muted fade-in">
            <div className="flex flex-col items-center gap-3">
              <span className="spinner" />
              <Label ms="menjana bacaan" en="writing today's reading" color="muted" />
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="h-full grid place-items-center text-center fade-in">
            <div className="flex flex-col items-center">
              <CloudIcon className="w-9 h-9 text-muted mb-3" />
              <div className="font-medium">Tak boleh jana hari ini — cuba lagi.</div>
              <div className="text-muted text-sm mt-1 max-w-xs">
                Could not generate today&rsquo;s reading. Check the API server is running and your
                ANTHROPIC_API_KEY is set in .env (restart npm run dev after editing it).
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => load(register)}
                  className="px-5 py-2.5 rounded-[4px] bg-gold text-gold-ink border-[1.5px] border-charcoal font-medium"
                >
                  Cuba lagi · try again
                </button>
                <button
                  onClick={() => navigate('/?done=sikit', { replace: true })}
                  className="px-5 py-2.5 rounded-[4px] border-[1.5px] border-charcoal text-charcoal"
                >
                  Selesai · finish
                </button>
              </div>
            </div>
          </div>
        )}

        {passage && !loading && !error && (
          <div className="fade-in pb-6">
            <div className="flex items-center justify-between mb-3">
              <Label ms={passage.topic} en={passage.date} color="muted" />
              {tts && (
                <button onClick={() => speak(passage.text)} className="flex items-center gap-1.5 text-gold">
                  <SpeakerIcon className="w-5 h-5" />
                  <span className="mono">dengar · listen</span>
                </button>
              )}
            </div>

            {/* passage on plaster, framed by charcoal rules */}
            <div className="border-y-[1.5px] border-charcoal py-4">
              {passage.format === 'dialogue' || glossMode !== 'toggle' ? (
                <div className="space-y-4">
                  {lines.map((line, i) => (
                    <div key={i}>
                      <div className="passage flex gap-2.5 items-baseline">
                        {line.speaker && (
                          <span
                            className={`mono-sm rounded-[2px] px-1 py-0.5 shrink-0 ${
                              line.speaker === 'A' ? 'bg-indigo text-plaster' : 'bg-oxblood text-plaster'
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
                                n.has(i) ? n.delete(i) : n.add(i)
                                return n
                              })
                            }
                            aria-label="Toggle English gloss"
                            className={`mono-sm rounded-[2px] px-1 py-0.5 shrink-0 self-center ${
                              openGlosses.has(i) ? 'bg-charcoal text-plaster' : 'border border-hairline text-muted'
                            }`}
                          >
                            EN
                          </button>
                        )}
                      </div>
                      {line.gloss && (glossMode === 'always' || openGlosses.has(i)) && (
                        <div
                          className={`text-sm text-muted mt-1 ${line.speaker ? 'pl-7' : ''} ${
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
              <div className="mt-3 text-sm text-muted">
                <Label ms="baru" en="new" color="muted" className="mr-2" />
                {newWords.map((w) => (
                  <span key={w.id} className="mark-new mr-1.5 text-charcoal">
                    {w.baku}
                  </span>
                ))}
                <span className="text-muted/70">— cards start tomorrow</span>
              </div>
            )}

            {glossMode === 'toggle' && (
              <>
                <button
                  onClick={() => setShowTranslation((s) => !s)}
                  className="mono text-oxblood mt-4"
                >
                  {showTranslation ? 'sembunyi' : 'tunjuk'} terjemahan · {showTranslation ? 'hide' : 'show'} translation
                </button>
                {showTranslation && (
                  <p className="fade-in mt-2 text-sm text-muted border-l-2 border-hairline pl-3">
                    {passage.translation}
                  </p>
                )}
              </>
            )}

            {questionPrimary && (
              <div className="mt-6 border-t-[1.5px] border-charcoal pt-4">
                <Label ms="soalan" en="question" color="muted" className="block mb-2" />
                <div className="font-medium">{questionPrimary}</div>
                {questionSecondary && <div className="text-sm text-muted mt-0.5">{questionSecondary}</div>}
                {showAnswer ? (
                  <div className="fade-in mt-3">
                    <div className="text-oxblood font-medium">{question?.answer}</div>
                    {marked ? (
                      <div className="mono-sm text-muted mt-2">
                        {marked === 'betul' ? 'dicatat · logged' : 'dicatat — esok lebih baik'}
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => selfMark('betul')}
                          className="px-4 py-1.5 rounded-[4px] bg-jade text-jade-ink text-sm font-medium"
                        >
                          Betul · I had it
                        </button>
                        <button
                          onClick={() => selfMark('tak')}
                          className="px-4 py-1.5 rounded-[4px] border-[1.5px] border-charcoal text-muted text-sm"
                        >
                          Tak · missed it
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button onClick={() => setShowAnswer(true)} className="mono text-oxblood mt-3">
                    tunjuk jawapan · show answer
                  </button>
                )}
              </div>
            )}

            <button
              onClick={continueOn}
              className="mt-6 w-full bg-gold text-gold-ink py-4 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
            >
              <span className="font-medium">Teruskan — cakap sikit</span>
              <span className="mono-sm text-gold-ink/70 block mt-0.5">continue — a short speaking task</span>
            </button>
          </div>
        )}
      </div>

      {popover && (
        <div
          className="fixed inset-0 bg-charcoal/40 grid place-items-end sm:place-items-center z-20"
          onClick={() => setPopover(null)}
        >
          <div
            className="fade-in bg-plaster border-t-[1.5px] sm:border-[1.5px] border-charcoal w-full sm:max-w-sm sm:rounded-[4px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="display text-3xl text-charcoal">{popover.token}</div>
            <div className="mt-2 text-charcoal">{popover.gloss || 'No gloss available.'}</div>
            <div className="mt-5">
              {popover.status === 'added' && (
                <div className="text-oxblood font-medium">
                  Ditambah — kad mula esok. ✓
                  <div className="mono-sm text-muted font-normal">added — card starts tomorrow</div>
                </div>
              )}
              {popover.status === 'queued' && (
                <div className="text-gold font-medium">
                  Kuota penuh — giliran esok.
                  <div className="mono-sm text-muted font-normal">cap full — queued for tomorrow</div>
                </div>
              )}
              {(popover.hasCard || popover.status === 'already') && !popover.status && (
                <div className="text-muted text-sm">Sudah dalam ulangkaji · already in reviews</div>
              )}
              {!popover.hasCard && !popover.status && (
                <button
                  onClick={tambah}
                  className="w-full py-3.5 rounded-[4px] bg-gold text-gold-ink border-[1.5px] border-charcoal font-medium"
                >
                  Tambah <span className="mono-sm text-gold-ink/70">add to my words</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
