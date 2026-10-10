/**
 * Thin wrapper over the browser's speechSynthesis. Two things the raw API
 * gets wrong that made the Settings voice test unreliable:
 *  - Chrome silently drops speak() called in the same tick as cancel(), so
 *    restarts are deferred a moment.
 *  - With no explicit voice, some browsers ignore utterance.lang and read
 *    Hindi text in an English voice (or not at all), so a voice whose lang
 *    matches is picked explicitly.
 */

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis
  const now = synth.getVoices()
  if (now.length) return Promise.resolve(now)
  // Voices load asynchronously in Chrome; wait for them (with a timeout so
  // we still speak with the default voice if the event never fires).
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', done)
    setTimeout(done, 1000)
  })
}

export function hasVoiceFor(voices: SpeechSynthesisVoice[], lang: string) {
  const base = lang.split('-')[0].toLowerCase()
  return voices.some((v) => v.lang.toLowerCase().startsWith(base))
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel()
}

/** Speaks `text`; resolves to false if no installed voice matches `lang`. */
export async function speak(text: string, lang: string, rate: number, onEnd?: () => void): Promise<boolean> {
  if (!speechSupported()) return false
  const synth = window.speechSynthesis
  const voices = await loadVoices()
  const base = lang.split('-')[0].toLowerCase()
  const voice =
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))

  synth.cancel()
  await new Promise((r) => setTimeout(r, 60))

  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = lang
  msg.rate = rate
  if (voice) msg.voice = voice
  msg.onend = () => onEnd?.()
  msg.onerror = () => onEnd?.()
  synth.speak(msg)
  return !!voice || !voices.length
}
