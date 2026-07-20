import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getSettings, saveSettings } from '../db/db'
import type { Passage, PassageLine, Register, Word } from '../db/types'
import { getOrGeneratePassage } from '../lib/api'
import { addPhaseTime, harvestWord, todayStr, updateSession, type HarvestResult } from '../lib/session'
import { ExampleBlock, RegisterChip } from '../components/RegisterChip'
import { Bi, CloudIcon, Headword, Label, MuteIcon, SpeakerIcon } from '../components/ui'
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

const introKey = () => `bukit-intro-${todayStr()}`

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
  const [typedAnswer, setTypedAnswer] = useState('')
  const [marked, setMarked] = useState<'betul' | 'tak' | null>(null)
  const [newWords, setNewWords] = useState<Word[]>([])
  // Pre-teach intro cards (pedagogy-response §1a): exposure before context.
  const [intro, setIntro] = useState(false)
  const [introIdx, setIntroIdx] = useState(0)
  // Tier-0 tap-to-advance: lines reveal one at a time; null = all visible.
  const [visibleLines, setVisibleLines] = useState<number | null>(null)
  // Audio: user toggle (persisted) × voice availability (device).
  const [ttsOn, setTtsOn] = useState(false)
  const [voiceOk, setVoiceOk] = useState(false)
  const [noVoiceNote, setNoVoiceNote] = useState(false)
  const tts = ttsOn && voiceOk
  const startedAt = useRef(Date.now())

  async function load(reg: Register) {
    setLoading(true)
    setError(false)
    setPopover(null)
    setShowAnswer(false)
    setTypedAnswer('')
    setMarked(null)
    setOpenGlosses(new Set())
    try {
      const p = await getOrGeneratePassage(reg)
      setPassage(p)
      const words = ((await db.words.bulkGet(p.newWordIds)).filter(Boolean) as Word[]) ?? []
      setNewWords(words)
      if (words.length > 0 && localStorage.getItem(introKey()) !== '1') {
        setIntro(true)
        setIntroIdx(0)
      }
      setVisibleLines(p.tier === 0 ? 1 : null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getSettings().then((s) => {
      setRegister(s.registerPreference)
      setTtsOn(s.ttsEnabled)
      const ok = ttsAvailable()
      setVoiceOk(ok)
      // Degrade gracefully when no Malay voice exists: hide the controls and
      // say so once (pedagogy-response §1-Q2).
      if (s.ttsEnabled && !ok && localStorage.getItem('bukit-novoice') !== '1') {
        setNoVoiceNote(true)
        localStorage.setItem('bukit-novoice', '1')
      }
      void load(s.registerPreference)
    })
  }, [])

  const newSurfaces = useMemo(() => new Set(newWords.map((w) => w.baku.toLowerCase())), [newWords])
  // Glossed words carry a dotted underline so tappability is visible, not
  // explained (UI-REVIEW-001 §4); new words keep the gold mark alone.
  const glossSurfaces = useMemo(
    () => new Set((passage?.glossary ?? []).map((g) => cleanToken(g.word))),
    [passage],
  )

  const lines: PassageLine[] = useMemo(() => {
    if (!passage) return []
    if (passage.lines?.length) return passage.lines
    return [{ speaker: null, text: passage.text, gloss: passage.translation }]
  }, [passage])

  const tier = passage?.tier ?? 3
  const glossMode = GLOSS_MODE[tier] ?? 'toggle'
  const shownLines = visibleLines === null ? lines : lines.slice(0, visibleLines)
  const allRevealed = visibleLines === null || visibleLines >= lines.length

  // Tier 0: audio leads — each line auto-plays exactly once as it appears
  // (tap its speaker to replay). Muted or voiceless devices skip silently.
  const autoplayedRef = useRef(-1)
  useEffect(() => {
    if (intro || tier !== 0 || !tts || visibleLines === null) return
    const idx = visibleLines - 1
    if (idx <= autoplayedRef.current) return
    const line = lines[idx]
    if (line) {
      autoplayedRef.current = idx
      speak(line.text)
    }
  }, [intro, tier, tts, visibleLines, lines])

  function exit() {
    void addPhaseTime('readMs', startedAt.current)
    navigate('/')
  }

  async function toggleMute() {
    const next = !ttsOn
    setTtsOn(next)
    await saveSettings({ ttsEnabled: next })
  }

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
    void addPhaseTime('readMs', startedAt.current)
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
          className={`active:bg-gold/15 ${
            newSurfaces.has(cleanToken(tok))
              ? 'mark-new'
              : glossSurfaces.has(cleanToken(tok))
                ? 'tap-hint'
                : ''
          }`}
        >
          {tok}
        </button>
      ),
    )
  }

  /* ——— pre-teach intro cards: "here are your words today", ten seconds ——— */
  if (passage && !loading && !error && intro && newWords.length > 0) {
    const w = newWords[introIdx]
    const last = introIdx + 1 >= newWords.length
    const done = () => {
      localStorage.setItem(introKey(), '1')
      setIntro(false)
    }
    return (
      <div className="min-h-dvh flex flex-col bg-indigo text-plaster">
        <div className="px-5 pt-6 flex items-center justify-between">
          <button onClick={exit} className="mono text-indigo-hi hit">
            ← keluar · exit
          </button>
          <span className="mono text-gold-hi">
            KATA BARU {introIdx + 1} / {newWords.length}
          </span>
        </div>
        <div key={w.id} className="fade-in flex-1 flex flex-col justify-center px-6">
          <Label ms="kata baru hari ini" en="today's new word" color="indigo-hi" />
          <div className="flex items-end justify-between gap-3 mt-2">
            <Headword text={w.baku} maxPx={60} className="display text-plaster" />
            {tts && (
              <button
                onClick={() => speak(w.baku)}
                aria-label="Main audio"
                className="text-gold-hi shrink-0 mb-2 hit"
              >
                <SpeakerIcon className="w-7 h-7" />
              </button>
            )}
          </div>
          <div className="text-indigo-hi mt-1">({w.gloss_en})</div>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
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
          {w.example_baku && (
            <div className="border-t border-indigo-rl mt-5 pt-4">
              <ExampleBlock word={w} tone="indigo" />
            </div>
          )}
        </div>
        <div className="p-5">
          <button
            onClick={() => (last ? done() : setIntroIdx(introIdx + 1))}
            className="w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal font-medium active:opacity-90"
          >
            {last ? (
              <Bi ms="Mula membaca" en="start reading" enClass="text-gold-ink/70" />
            ) : (
              <Bi ms="Seterusnya" en="next" enClass="text-gold-ink/70" />
            )}
          </button>
        </div>
      </div>
    )
  }

  const question = passage?.question
  const questionPrimary = tier === 0 ? question?.promptEn || question?.prompt : question?.prompt
  const questionSecondary = tier === 1 || tier === 2 ? question?.promptEn : undefined

  return (
    <div className="min-h-dvh max-w-md mx-auto flex flex-col">
      <header className="bg-indigo text-plaster px-5 py-4 flex items-center justify-between">
        <button onClick={exit} className="mono text-indigo-hi hit">
          ← keluar · exit
        </button>
        <div className="flex items-center gap-4">
          {/* global mute, one tap from the reading (pedagogy-response §1-Q2) */}
          {voiceOk && (
            <button
              onClick={toggleMute}
              aria-label={ttsOn ? 'Senyapkan audio' : 'Buka audio'}
              aria-pressed={!ttsOn}
              className={`hit ${ttsOn ? 'text-gold-hi' : 'text-indigo-lo'}`}
            >
              {ttsOn ? <SpeakerIcon className="w-5 h-5" /> : <MuteIcon className="w-5 h-5" />}
            </button>
          )}
          {/* register toggle debuts at tier 1 — meaningless jargon on day one (§2.3) */}
          {tier >= 1 && (
            <button
              onClick={toggleRegister}
              disabled={loading}
              className="flex items-center gap-2 disabled:opacity-40 hit"
              title="Regenerate this passage in the other register"
            >
              <RegisterChip kind={register === 'baku' ? 'baku' : 'colloq'} />
              <span className="mono text-indigo-hi">tukar · switch</span>
            </button>
          )}
        </div>
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
                Could not generate today&rsquo;s reading. Check your connection and try again — if
                it keeps failing, the server&rsquo;s ANTHROPIC_API_KEY may be missing or invalid.
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => load(register)}
                  className="px-5 py-2.5 rounded-[4px] bg-gold text-gold-ink border-[1.5px] border-charcoal font-medium"
                >
                  Cuba lagi <span className="mono-sm text-gold-ink/70 block mt-0.5">(try again)</span>
                </button>
                <button
                  onClick={() => navigate('/?done=sikit', { replace: true })}
                  className="px-5 py-2.5 rounded-[4px] border-[1.5px] border-charcoal text-charcoal"
                >
                  Selesai <span className="mono-sm text-muted block mt-0.5">(finish)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {passage && !loading && !error && (
          <div className="fade-in pb-6">
            <div className="flex items-center justify-between mb-2">
              <Label ms={passage.topic} en={passage.date} color="muted" />
              {tts && (
                <button onClick={() => speak(passage.text)} className="flex items-center gap-1.5 text-gold hit">
                  <SpeakerIcon className="w-5 h-5" />
                  <span className="mono">dengar · listen</span>
                </button>
              )}
            </div>

            {noVoiceNote && (
              <p className="text-sm text-muted mb-3">
                <Bi
                  ms="Tiada suara Melayu pada peranti ini"
                  en="no Malay voice on this device — audio controls are hidden"
                />
              </p>
            )}

            <p className="text-sm text-muted mb-3">
              A short reading written just for you — today&rsquo;s{' '}
              <span className="mark-new text-charcoal">new words</span> are underlined; everything
              else uses only words you&rsquo;ve already studied. Tap any word for its meaning.
            </p>

            {/* passage on plaster, framed by charcoal rules */}
            <div className="border-y-[1.5px] border-charcoal py-4">
              {passage.format === 'dialogue' || glossMode !== 'toggle' ? (
                <div className="space-y-4">
                  {shownLines.map((line, i) => (
                    <div key={i} className={tier === 0 ? 'fade-in' : ''}>
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
                        {/* per-line audio at every tier (D7, finally in the reading) */}
                        {tts && (
                          <button
                            onClick={() => speak(line.text)}
                            aria-label="Main audio baris"
                            className="text-gold shrink-0 self-center hit"
                          >
                            <SpeakerIcon className="w-4 h-4" />
                          </button>
                        )}
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
                            className={`mono-sm rounded-[2px] px-1.5 py-1 shrink-0 self-center ${
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
                          ({line.gloss})
                        </div>
                      )}
                    </div>
                  ))}
                  {/* tier-0 tap-to-advance: reveal (and hear) one line at a time */}
                  {!allRevealed && (
                    <button
                      onClick={() => setVisibleLines((v) => (v ?? 0) + 1)}
                      className="w-full py-3 px-4 border-[1.5px] border-charcoal rounded-[4px] text-charcoal active:bg-charcoal/5"
                    >
                      <Bi ms="Baris seterusnya" en="next line" className="font-medium" />
                    </button>
                  )}
                </div>
              ) : (
                <p className="passage">
                  {lines.map((l, i) => (
                    <span key={i}>
                      {i > 0 ? ' ' : ''}
                      {renderWords(l.text)}
                      {tts && (
                        <button
                          onClick={() => speak(l.text)}
                          aria-label="Main audio ayat"
                          className="text-gold align-baseline ml-1"
                        >
                          <SpeakerIcon className="w-4 h-4 inline" />
                        </button>
                      )}
                    </span>
                  ))}
                </p>
              )}
            </div>

            {allRevealed && (
              <>
                {newWords.length > 0 && (
                  <div className="mt-3 text-sm text-muted">
                    <Label ms="baru" en="new" color="muted" className="mr-2" />
                    {newWords.map((w) => (
                      <span key={w.id} className="mark-new mr-1.5 text-charcoal">
                        {w.baku}
                      </span>
                    ))}
                    <span className="text-muted/70">(cards start tomorrow)</span>
                  </div>
                )}

                {/* grammar whisper — one noticed form per passage (§3.4) */}
                {passage.notice && (
                  <div className="mt-5 border-l-2 border-gold pl-3">
                    <Label ms="perhatikan" en="notice" color="gold" className="block mb-1" />
                    <div className="text-sm text-charcoal">{passage.notice.note}</div>
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
                        ({passage.translation})
                      </p>
                    )}
                  </>
                )}

                {questionPrimary && (
                  <div className="mt-6 border-t-[1.5px] border-charcoal pt-4">
                    <Label ms="soalan" en="question" color="muted" className="block mb-2" />
                    <div className="font-medium">{questionPrimary}</div>
                    {questionSecondary && (
                      <div className="text-sm text-muted mt-0.5">({questionSecondary})</div>
                    )}
                    {showAnswer ? (
                      <div className="fade-in mt-3">
                        {typedAnswer.trim() && (
                          <div className="mb-2">
                            <Label ms="jawapan anda" en="your answer" color="muted" className="block" />
                            <div className="text-charcoal">{typedAnswer.trim()}</div>
                          </div>
                        )}
                        <Label ms="jawapan" en="answer" color="muted" className="block" />
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
                              Betul <span className="text-jade-ink/70">(I had it)</span>
                            </button>
                            <button
                              onClick={() => selfMark('tak')}
                              className="px-4 py-1.5 rounded-[4px] border-[1.5px] border-charcoal text-muted text-sm"
                            >
                              Tak <span className="text-muted/70">(missed it)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3">
                        <input
                          type="text"
                          value={typedAnswer}
                          onChange={(e) => setTypedAnswer(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && typedAnswer.trim() && setShowAnswer(true)}
                          placeholder="Taip jawapan anda… (type your answer, then check)"
                          className="w-full border-[1.5px] border-charcoal bg-plaster px-3 py-2.5 rounded-[4px] focus:border-gold"
                        />
                        <div className="mt-2.5 flex items-center gap-4">
                          <button
                            onClick={() => setShowAnswer(true)}
                            disabled={!typedAnswer.trim()}
                            className="px-4 py-1.5 rounded-[4px] bg-gold text-gold-ink border-[1.5px] border-charcoal text-sm font-medium disabled:opacity-40"
                          >
                            Semak <span className="text-gold-ink/70">(check)</span>
                          </button>
                          <button onClick={() => setShowAnswer(true)} className="mono text-oxblood">
                            tunjuk jawapan · just show it
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={continueOn}
                  className="mt-6 w-full bg-gold text-gold-ink py-4 px-4 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
                >
                  <span className="font-medium">Teruskan — cakap sikit</span>
                  <span className="mono-sm text-gold-ink/70 block mt-0.5">
                    (continue — a short speaking task)
                  </span>
                </button>
              </>
            )}
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
            <div className="flex items-start justify-between gap-3">
              <div className="display text-3xl text-charcoal">{popover.token}</div>
              {tts && (
                <button
                  onClick={() => speak(popover.token)}
                  aria-label="Main audio"
                  className="text-gold mt-1 hit"
                >
                  <SpeakerIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="mt-2 text-muted">
              {popover.gloss ? `(${popover.gloss})` : 'No gloss available.'}
            </div>
            <div className="mt-5">
              {popover.status === 'added' && (
                <div className="text-oxblood font-medium">
                  Ditambah — kad mula esok. ✓
                  <div className="text-muted text-sm font-normal">(added — card starts tomorrow)</div>
                </div>
              )}
              {popover.status === 'queued' && (
                <div className="text-gold font-medium">
                  Kuota penuh — giliran esok.
                  <div className="text-muted text-sm font-normal">(cap full — queued for tomorrow)</div>
                </div>
              )}
              {(popover.hasCard || popover.status === 'already') && !popover.status && (
                <div className="text-muted text-sm">
                  <Bi ms="Sudah dalam ulangkaji" en="already in reviews" />
                </div>
              )}
              {!popover.hasCard && !popover.status && (
                <button
                  onClick={tambah}
                  className="w-full py-3.5 px-4 rounded-[4px] bg-gold text-gold-ink border-[1.5px] border-charcoal font-medium"
                >
                  Tambah <span className="mono-sm text-gold-ink/70">(add to my words)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
