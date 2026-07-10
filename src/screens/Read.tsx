import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, getSettings } from '../db/db'
import type { Passage, PassageLine, Register, Word } from '../db/types'
import { getOrGeneratePassage } from '../lib/api'
import {
  addPhaseMs,
  currentTier,
  harvestWord,
  pickNewWords,
  todayStr,
  updateSession,
  type HarvestResult,
} from '../lib/session'
import { RegisterChip } from '../components/RegisterChip'
import { CloudIcon, Label, MuteIcon, SpeakerIcon } from '../components/ui'
import { activeVoice, isMuted, setMuted, speak, stopSpeaking, ttsAvailable } from '../lib/tts'

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

const VOICE_NOTICE_KEY = 'bukit_id_voice_noticed'
const NO_VOICE_NOTICE_KEY = 'bukit_no_voice_noticed'

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
  const [ttsOn, setTtsOn] = useState(false) // settings toggle + a usable voice
  const [muted, setMutedState] = useState(isMuted())
  const [tierId, setTierId] = useState<0 | 1 | 2 | 3>(3)
  // Pre-teach (§1a): today's new words as intro cards before the passage.
  const [introWords, setIntroWords] = useState<Word[]>([])
  const [introOpen, setIntroOpen] = useState(false)
  // Tier-0 tap-to-advance (audio ruling Q1): count of revealed lines.
  const [revealed, setRevealed] = useState(0)
  const [voiceNotice, setVoiceNotice] = useState(false)
  const [noVoiceNotice, setNoVoiceNotice] = useState(false)
  const startedAt = useRef(Date.now())

  async function load(reg: Register) {
    setLoading(true)
    setError(false)
    setPopover(null)
    setShowAnswer(false)
    setTypedAnswer('')
    setMarked(null)
    setOpenGlosses(new Set())
    setRevealed(0)
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
    ;(async () => {
      const s = await getSettings()
      const tier = await currentTier()
      setTierId(tier.id)
      // Tier 0 is all baku — the register concept debuts at tier 1 (§2.3).
      const reg = tier.id === 0 ? 'baku' : s.registerPreference
      setRegister(reg)
      setTtsOn(s.ttsEnabled && ttsAvailable())
      if (s.ttsEnabled && !ttsAvailable() && !localStorage.getItem(NO_VOICE_NOTICE_KEY)) {
        setNoVoiceNotice(true)
      }
      // Pre-teach only on the first generation of the day: the selection is
      // deterministic, so the preview matches what the passage introduces, and
      // the intro cards double as the generation-latency screen.
      const existing = await db.passages.where('date').equals(todayStr()).count()
      if (existing === 0) {
        const preview = await pickNewWords()
        if (preview.length) {
          setIntroWords(preview)
          setIntroOpen(true)
        }
      }
      void load(reg)
    })()
    return () => stopSpeaking()
  }, [])

  // Wraps speak() so the one-time Indonesian-voice note fires on first playback.
  function play(text: string, onend?: () => void) {
    const ok = speak(text, onend)
    if (ok && activeVoice()?.kind === 'id' && !localStorage.getItem(VOICE_NOTICE_KEY)) {
      setVoiceNotice(true)
    }
    return ok
  }

  const newSurfaces = useMemo(() => new Set(newWords.map((w) => w.baku.toLowerCase())), [newWords])

  const lines: PassageLine[] = useMemo(() => {
    if (!passage) return []
    if (passage.lines?.length) return passage.lines
    return [{ speaker: null, text: passage.text, gloss: passage.translation }]
  }, [passage])

  const tier = passage?.tier ?? tierId
  const glossMode = GLOSS_MODE[tier] ?? 'toggle'
  const audioOn = ttsOn && !muted
  // Tap-to-advance reveal is tier 0 only, and only while audio is live —
  // muted/senyap or no voice falls back to full render, never gating reading
  // on audio (Q1 fallback ruling).
  const tapMode = tier === 0 && audioOn
  const visibleLines = tapMode ? revealed : lines.length
  const readingDone = !tapMode || revealed >= lines.length

  function advance() {
    const i = revealed
    if (i >= lines.length) return
    setRevealed(i + 1)
    play(lines[i].text)
  }

  function toggleMute() {
    const next = !muted
    if (next) stopSpeaking()
    setMuted(next)
    setMutedState(next)
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
    stopSpeaking()
    await addPhaseMs('readMs', Date.now() - startedAt.current)
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

  const showIntro = introOpen && introWords.length > 0 && !error

  return (
    <div className="min-h-dvh max-w-md mx-auto flex flex-col">
      <header className="bg-indigo text-plaster px-5 py-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="mono text-indigo-hi">
          ← keluar · exit
        </button>
        <div className="flex items-center gap-4">
          {ttsOn && (
            <button
              onClick={toggleMute}
              className="flex items-center gap-1.5 mono text-indigo-hi"
              aria-pressed={muted}
              title={muted ? 'Sound back on' : 'Quiet mode — no audio this session'}
            >
              {muted ? <MuteIcon className="w-5 h-5" /> : <SpeakerIcon className="w-5 h-5" />}
              {muted ? 'senyap' : 'audio'}
            </button>
          )}
          {/* Register is a tier-1 concept (§2.3) — no control below 25 studied. */}
          {tierId >= 1 && (
            <button
              onClick={toggleRegister}
              disabled={loading}
              className="flex items-center gap-2 disabled:opacity-40"
              title="Regenerate this passage in the other register"
            >
              <RegisterChip kind={register === 'baku' ? 'baku' : 'colloq'} />
              <span className="mono text-indigo-hi">tukar · switch</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 px-5 py-5">
        {/* ————— pre-teach: today's words, shown while the reading is written ————— */}
        {showIntro && (
          <div className="fade-in pb-6">
            <Label ms="kata baru hari ini" en="today's new words" color="muted" />
            <div className="mt-3 space-y-3">
              {introWords.map((w) => (
                <div key={w.id} className="border-y-[1.5px] border-charcoal py-3">
                  <div className="flex items-end justify-between gap-3">
                    <div className="display text-charcoal break-words" style={{ fontSize: 'clamp(34px, 10vw, 46px)' }}>
                      {w.baku}
                    </div>
                    {audioOn && (
                      <button
                        onClick={() => play(w.baku)}
                        aria-label={`Main audio: ${w.baku}`}
                        className="text-gold shrink-0 mb-1.5"
                      >
                        <SpeakerIcon className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <RegisterChip kind="baku" />
                    <span className="text-charcoal">{w.gloss_en}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted mt-3">
              You&rsquo;ll meet these in today&rsquo;s reading — underlined, in context. Their cards
              join your reviews tomorrow.
            </p>
            {loading ? (
              <div className="mt-5 flex items-center gap-3 text-muted">
                <span className="spinner" />
                <Label ms="menjana bacaan" en="writing today's reading" color="muted" />
              </div>
            ) : (
              <button
                onClick={() => setIntroOpen(false)}
                className="mt-5 w-full bg-gold text-gold-ink py-4 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
              >
                <span className="font-medium">Baca sekarang</span>
                <span className="mono-sm text-gold-ink/70 block mt-0.5">start the reading</span>
              </button>
            )}
          </div>
        )}

        {loading && !showIntro && (
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

        {passage && !loading && !error && !showIntro && (
          <div className="fade-in pb-6">
            <div className="flex items-center justify-between mb-2">
              <Label ms={passage.topic} en={passage.date} color="muted" />
            </div>

            {noVoiceNotice && (
              <div className="mb-3 border-l-2 border-hairline pl-3 text-sm text-muted flex items-start justify-between gap-3">
                <span>
                  No Malay voice on this device, so audio is hidden. Reading works exactly the
                  same without it.
                </span>
                <button
                  onClick={() => {
                    localStorage.setItem(NO_VOICE_NOTICE_KEY, '1')
                    setNoVoiceNotice(false)
                  }}
                  className="mono text-muted shrink-0"
                >
                  ok
                </button>
              </div>
            )}
            {voiceNotice && (
              <div className="mb-3 border-l-2 border-gold pl-3 text-sm text-muted flex items-start justify-between gap-3">
                <span>
                  Audio is using an Indonesian voice — very close to Malay, with small
                  pronunciation differences.
                </span>
                <button
                  onClick={() => {
                    localStorage.setItem(VOICE_NOTICE_KEY, '1')
                    setVoiceNotice(false)
                  }}
                  className="mono text-muted shrink-0"
                >
                  ok
                </button>
              </div>
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
                  {lines.slice(0, visibleLines).map((line, i) => (
                    <div key={i} className={tapMode ? 'fade-in' : ''}>
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
                        {audioOn && (
                          <button
                            onClick={() => play(line.text)}
                            aria-label="Main audio"
                            className="text-gold shrink-0 self-center"
                          >
                            <SpeakerIcon className="w-4.5 h-4.5" />
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

                  {/* tier-0 tap-to-advance: listen starts, each tap reveals + plays */}
                  {tapMode && !readingDone && (
                    <button
                      onClick={advance}
                      className="w-full py-3.5 rounded-[4px] border-[1.5px] border-charcoal text-charcoal active:bg-charcoal/5 flex items-center justify-center gap-2"
                    >
                      <SpeakerIcon className="w-5 h-5 text-gold" />
                      <span className="font-medium">
                        {revealed === 0 ? 'Dengar' : 'Seterusnya'}
                      </span>
                      <span className="mono-sm text-muted">
                        {revealed === 0 ? 'listen' : `next line · ${revealed} / ${lines.length}`}
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {audioOn && (
                    <button
                      onClick={() => play(passage.text)}
                      className="flex items-center gap-1.5 text-gold mb-2"
                    >
                      <SpeakerIcon className="w-5 h-5" />
                      <span className="mono">dengar · listen</span>
                    </button>
                  )}
                  <p className="passage">{renderWords(lines.map((l) => l.text).join(' '))}</p>
                </div>
              )}
            </div>

            {readingDone && (
              <div className={tapMode ? 'fade-in' : ''}>
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

                {/* grammar whisper (§3.4): one quiet line, drawn from this passage */}
                {passage.notice && (
                  <div className="mt-4 border-l-2 border-hairline pl-3">
                    <Label ms="perhatikan" en="notice" color="muted" className="block" />
                    <div className="text-sm text-charcoal mt-0.5">
                      <span className="font-medium">{passage.notice.form}</span> —{' '}
                      {passage.notice.note}
                    </div>
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
                            Semak · check
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
                  className="mt-6 w-full bg-gold text-gold-ink py-4 rounded-[4px] border-[1.5px] border-charcoal active:opacity-90"
                >
                  <span className="font-medium">Teruskan — cakap sikit</span>
                  <span className="mono-sm text-gold-ink/70 block mt-0.5">continue — a short speaking task</span>
                </button>
              </div>
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
