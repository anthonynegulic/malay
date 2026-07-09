import { db, getSettings, uid } from '../db/db'
import type { GradeResult, Passage, PassageLine, Register, Word } from '../db/types'
import { currentTier, introduceWords, pickNewWords, todayStr } from './session'

/**
 * POST to the API proxy. If the deployment sets APP_PASSPHRASE, the server
 * returns 401 until the client sends a matching x-bukit-pass header; we prompt
 * for it once, store it, and retry. When no passphrase is configured this is a
 * plain POST.
 */
async function postApi(path: string, body: unknown): Promise<Response> {
  const send = () => {
    const pass = localStorage.getItem('bukit_pass')
    return fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(pass ? { 'x-bukit-pass': pass } : {}) },
      body: JSON.stringify(body),
    })
  }
  let res = await send()
  if (res.status === 401 && typeof window !== 'undefined') {
    const entered = window.prompt('Enter your Bukit passphrase:')
    if (entered) {
      localStorage.setItem('bukit_pass', entered)
      res = await send()
    }
  }
  return res
}

/** Topic rotation — avoid repeating within 7 days (§5.2). */
const TOPICS = [
  'pasar',
  'kopitiam',
  'teksi-Grab',
  'masjid',
  'sekolah',
  'cuaca',
  'keluarga',
  'makanan',
  'kejiranan',
  'urusan',
]

async function pickTopic(): Promise<string> {
  const recent = await db.passages.orderBy('date').reverse().limit(14).toArray()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const recentTopics = new Set(
    recent.filter((p) => p.date >= todayStr(cutoff)).map((p) => p.topic),
  )
  const fresh = TOPICS.filter((t) => !recentTopics.has(t))
  const pool = fresh.length ? fresh : TOPICS
  return pool[Math.floor(Math.random() * pool.length)]
}

export class GenerationError extends Error {}

interface GenerateResponse {
  format: 'dialogue' | 'prose'
  lines: { speaker: 'A' | 'B' | null; text: string; gloss: string }[]
  translation: string
  glossary: { word: string; gloss: string }[]
  question: { prompt: string; prompt_en?: string; answer: string }
}

/**
 * Get today's passage in the given register. Cached per (date, register).
 * When neither register exists yet, this picks topic + new words and
 * introduces them (cards due tomorrow). The register toggle re-generates the
 * SAME content parameters in the other register and caches it too (D1 payoff).
 */
export async function getOrGeneratePassage(register: Register): Promise<Passage> {
  const date = todayStr()
  const cached = await db.passages.where('[date+register]').equals([date, register]).first()
  if (cached) return cached

  // If the other register already exists today, reuse its topic + new words.
  const sibling = await db.passages.where('date').equals(date).first()

  let topic: string
  let newWords: Word[]
  if (sibling) {
    topic = sibling.topic
    newWords = (await db.words.bulkGet(sibling.newWordIds)).filter(Boolean) as Word[]
  } else {
    topic = await pickTopic()
    newWords = await pickNewWords()
  }

  const settings = await getSettings()
  const tier = await currentTier()
  const cards = await db.cards.toArray()
  const studiedIds = new Set(cards.map((c) => c.wordId))
  const newIds = new Set(newWords.map((w) => w.id))
  const all = await db.words.toArray()
  const studied = all.filter((w) => studiedIds.has(w.id) && !newIds.has(w.id)).map((w) => w.baku)

  const res = await postApi('/api/generate', {
    // The tier and its constraints are sent explicitly (P0.1) — the model
    // never infers level from list sizes, and the server validates against
    // these same numbers.
    tier: {
      id: tier.id,
      format: tier.format,
      length_words: tier.lengthWords,
      containment: tier.containment,
      min_occurrences: tier.minOccurrences,
      question_language: tier.questionLanguage,
    },
    studied_words: studied,
    new_words: newWords.map((w) => w.baku),
    register,
    topic,
    user_context: settings.userContext,
  })
  if (!res.ok) throw new GenerationError('Tak boleh jana hari ini — cuba lagi.')
  const out = (await res.json()) as GenerateResponse

  const lines: PassageLine[] = (out.lines ?? []).map((l) => ({
    speaker: l.speaker === 'A' || l.speaker === 'B' ? l.speaker : null,
    text: l.text ?? '',
    gloss: l.gloss ?? '',
  }))
  const passage: Passage = {
    id: uid(),
    date,
    register,
    topic,
    text: lines.map((l) => l.text).join(' '),
    format: out.format === 'dialogue' ? 'dialogue' : 'prose',
    lines,
    tier: tier.id,
    translation: out.translation ?? '',
    glossary: Array.isArray(out.glossary) ? out.glossary : [],
    question: {
      prompt: out.question?.prompt ?? '',
      promptEn: out.question?.prompt_en ?? '',
      answer: out.question?.answer ?? '',
    },
    newWordIds: newWords.map((w) => w.id),
  }
  await db.passages.add(passage)

  // Introduce new words only once per day (on the first successful generation).
  if (!sibling && newWords.length) await introduceWords(newWords)

  return passage
}

export async function gradeResponse(prompt: string, response: string): Promise<GradeResult> {
  const res = await postApi('/api/grade', { prompt, response })
  if (!res.ok) throw new GenerationError('Tak boleh semak sekarang — cuba lagi.')
  const out = (await res.json()) as GradeResult
  return {
    understood: Boolean(out.understood),
    corrected: out.corrected ?? '',
    encouragement: out.encouragement ?? '',
    notes: Array.isArray(out.notes) ? out.notes.slice(0, 2) : [],
  }
}

/** Situation prompts for the output micro-task, keyed by passage topic. */
const OUTPUT_PROMPTS: Record<string, string[]> = {
  pasar: [
    'The mak cik at the pasar asks how many children you have. Answer in Malay.',
    'Ask the trader how much the fish costs, and say it is too expensive.',
  ],
  kopitiam: [
    'Order a kopi and something to eat at the kopitiam. Be polite.',
    'The uncle asks if you want your coffee sweet. Answer, and ask for the bill.',
  ],
  'teksi-Grab': [
    'Tell the Grab driver where you want to go and ask how long it will take.',
    'The driver asks where you are from. Answer in Malay, briefly.',
  ],
  masjid: [
    'A brother at the masjid greets you after prayer. Return the greeting and introduce yourself.',
    'Ask what time isyak prayer is tonight.',
  ],
  sekolah: [
    "A teacher asks about your son. Say his name and age in Malay.",
    'Ask when school finishes today.',
  ],
  cuaca: [
    'Tell a neighbour the weather is very hot today and you want a cold drink.',
    'Say you think it will rain this evening.',
  ],
  keluarga: [
    'Describe your family in two sentences: who is in it, and where you live.',
    'A friend asks how old your children are. Answer in Malay.',
  ],
  makanan: [
    'Say what you ate today and whether it was spicy.',
    'Recommend your favourite food to a friend and say why you like it.',
  ],
  kejiranan: [
    'Greet a new neighbour and say which house you live in.',
    'Ask your neighbour where the nearest kedai is.',
  ],
  urusan: [
    'At the counter, say you want to pay and ask if you can pay cash.',
    'Say you do not understand and politely ask the officer to repeat slowly.',
  ],
}

export function outputPrompt(topic: string): string {
  const pool = OUTPUT_PROMPTS[topic] ?? OUTPUT_PROMPTS.pasar
  return pool[Math.floor(Math.random() * pool.length)]
}
