/**
 * TTS-as-exposure (D7, audio ruling Q2): browser SpeechSynthesis.
 * Voice preference order: ms-MY → any ms → id (Indonesian — phonemes near-
 * identical to Malay; TTS here is phoneme-mapping exposure, not listening
 * training). The selected kind is tracked so the UI can disclose fallbacks.
 * Buttons are hidden only when NO ms or id voice exists.
 */

export type VoiceKind = 'ms-MY' | 'ms' | 'id'

export interface ActiveVoice {
  voice: SpeechSynthesisVoice
  kind: VoiceKind
}

let cached: ActiveVoice | null | undefined

function pickVoice(): ActiveVoice | null {
  if (cached !== undefined) return cached
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    cached = null
    return null
  }
  const voices = window.speechSynthesis.getVoices()
  const lang = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace('_', '-')
  const msMY = voices.find((v) => lang(v).startsWith('ms-my'))
  const ms = voices.find((v) => lang(v).startsWith('ms'))
  const id = voices.find((v) => lang(v).startsWith('id'))
  cached = msMY
    ? { voice: msMY, kind: 'ms-MY' }
    : ms
      ? { voice: ms, kind: 'ms' }
      : id
        ? { voice: id, kind: 'id' }
        : null
  return cached
}

// Voices load asynchronously in some browsers.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cached = undefined
  }
}

/** The voice playback will use, or null when none qualifies — inspectable from Settings. */
export function activeVoice(): ActiveVoice | null {
  return pickVoice()
}

export function ttsAvailable(): boolean {
  return pickVoice() !== null
}

/**
 * Session-scoped quiet mode ("senyap") — one tap from the reading screen,
 * remembers itself for the rest of the browser session (sessions happen around
 * a sleeping infant). Distinct from the persistent Settings TTS toggle.
 */
const MUTE_KEY = 'bukit_senyap'

export function isMuted(): boolean {
  try {
    return sessionStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted: boolean): void {
  try {
    if (muted) sessionStorage.setItem(MUTE_KEY, '1')
    else sessionStorage.removeItem(MUTE_KEY)
  } catch {
    /* private mode — mute just won't persist */
  }
}

/** Speak one line. Cancels anything in flight; `onend` fires when playback
 *  finishes or errors (never when the call is a silent no-op returning false). */
export function speak(text: string, onend?: () => void): boolean {
  const active = pickVoice()
  if (!active || isMuted()) return false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = active.voice
  u.lang = active.voice.lang
  u.rate = 0.88
  if (onend) {
    u.onend = () => onend()
    u.onerror = () => onend()
  }
  window.speechSynthesis.speak(u)
  return true
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
