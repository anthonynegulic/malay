/** TTS-as-exposure (D7): browser SpeechSynthesis, ms-MY where available, graceful absence otherwise. */

import { useEffect, useState } from 'react'

let cachedVoice: SpeechSynthesisVoice | null | undefined
/** Components that snapshot voice availability subscribe here so a late voice
 *  load can re-check (see useVoiceReady). */
const voiceListeners = new Set<() => void>()

function malayVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice
  if (!('speechSynthesis' in window)) {
    cachedVoice = null
    return null
  }
  const voices = window.speechSynthesis.getVoices()
  cachedVoice =
    voices.find((v) => v.lang.toLowerCase().startsWith('ms')) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('id')) ?? // Indonesian is a close fallback
    null
  return cachedVoice
}

// Voices load asynchronously in some browsers.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined
    voiceListeners.forEach((cb) => cb())
  }
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && malayVoice() !== null
}

/**
 * Reactive voice availability for React screens.
 *
 * `getVoices()` returns an empty list until the browser has loaded voices,
 * which can happen after a component mounts. A one-shot `ttsAvailable()` at
 * mount therefore reports `false` and never recovers, silently hiding every
 * audio control until a full reload. This hook re-checks when the voice list
 * changes so the controls appear as soon as a voice is ready.
 */
export function useVoiceReady(): boolean {
  const [ready, setReady] = useState(ttsAvailable)
  useEffect(() => {
    if (ready) return
    const recheck = () => setReady(ttsAvailable())
    voiceListeners.add(recheck)
    // Some browsers only begin populating voices on first access.
    if ('speechSynthesis' in window) window.speechSynthesis.getVoices()
    return () => {
      voiceListeners.delete(recheck)
    }
  }, [ready])
  return ready
}

export function speak(text: string): void {
  if (!('speechSynthesis' in window)) return
  const voice = malayVoice()
  if (!voice) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.voice = voice
  u.lang = voice.lang
  u.rate = 0.88
  window.speechSynthesis.speak(u)
}
