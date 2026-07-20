/** TTS-as-exposure (D7): browser SpeechSynthesis, ms-MY where available, graceful absence otherwise. */

let cachedVoice: SpeechSynthesisVoice | null | undefined

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
  }
}

export function ttsAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && malayVoice() !== null
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
