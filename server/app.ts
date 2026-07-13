/**
 * Bukit API — the Hono app, shared by the local dev server (server/index.ts)
 * and the Vercel serverless function (api/index.ts).
 *
 * Routes are mounted under basePath('/api') so both `/api/generate` on Vercel
 * and the Vite dev proxy resolve identically. Env is read at request time
 * (not module load) so Vercel dashboard vars and the local .env both work.
 */
import { Hono } from 'hono'
import { noticeValid, validatePassage, type PassageLine } from './validate.js'
import { FUNCTION_WORDS } from '../src/lib/tier.js'

function config() {
  return {
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    passphrase: process.env.APP_PASSPHRASE, // optional; when set, gates /generate + /grade
  }
}

const GENERATE_SYSTEM = `You are a Malay-language content generator for a beginner preparing to live in
Penang, Malaysia. You will receive an explicit difficulty tier with hard
constraints — obey them exactly; they matter more than making elegant prose.

Vocabulary discipline is ABSOLUTE. You may use ONLY:
- "studied_words" (words the learner actually knows)
- "new_words" (today's new words — each must appear at least
  "min_occurrences_per_new_word" times)
- these function words: ${FUNCTION_WORDS.join(', ')}
- proper nouns (Penang, Georgetown, personal names) and numerals.
If "allow_sparing_extras" is true you may additionally use a small number of
common words beyond the lists (at most 1 in 20 tokens), and every such word
MUST appear in the glossary. If it is false, use strictly nothing outside the
lists — write short, simple, repetitive lines instead of reaching for new
vocabulary.

Format: if "format" is "dialogue", write a natural mini-dialogue between two
speakers labelled A and B (one utterance per line). If "prose", write a short
scene split into sentences. Respect "length_words" (total Malay word count)
exactly — shorter is always safer than vocabulary leakage.

Register: if "baku", standard Malay with full affixation; if "colloquial",
natural everyday Malaysian Malay (nak, tak, dah, lah/kan) but NO northern
dialect forms unless they appear in the vocabulary lists.

The comprehension question language is given as "question_language":
"english" = ask and answer in English; "bilingual" or "malay" = ask and answer
in simple Malay using only allowed vocabulary, and also provide "prompt_en".

Include exactly ONE "notice" — a grammar whisper: one short observation about a
form that actually appears in your passage, in plain language with no
terminology, e.g. {"form": "nak", "note": "nak = want to — you'll hear this
constantly"}. The "form" must appear verbatim in the passage text.

Respond with STRICT JSON only. No markdown, no preamble. Shape:
{"format": "dialogue"|"prose",
 "lines": [{"speaker": "A"|"B"|null, "text": "<one Malay line/sentence>",
            "gloss": "<natural English translation of that line>"}],
 "translation": "<English translation of the whole passage>",
 "glossary": [{"word": "...", "gloss": "..."}],
 "question": {"prompt": "...", "prompt_en": "...", "answer": "..."},
 "notice": {"form": "...", "note": "..."}}`

const GRADE_SYSTEM = `You are a warm, encouraging Malay tutor. The learner is a beginner. Grade for
COMMUNICATION, not perfection. If the meaning would be understood by a patient
native speaker, say so first. Return STRICT JSON:
{ "understood": true|false, "corrected": "...", "encouragement": "...",
  "notes": ["...", "..."] }
"notes" has at most 2 entries, each one concrete fix. Never return more than 2
notes. Never lecture. No markdown, no preamble.
Notes prioritise WORD CHOICE, WORD ORDER, and USEFUL PATTERNS the learner can
reuse (e.g. adding a time marker like "tadi") over capitalisation, punctuation
or spelling. Never comment on capitalisation, punctuation or spelling unless it
changes the meaning — and even then at most ONE such note, and only when no
more useful language-level note exists.`

async function callClaude(system: string, user: string): Promise<string> {
  const { model, apiKey } = config()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`)
  }
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> }
  const text = data.content.find((b) => b.type === 'text')?.text
  if (!text) throw new Error('Empty response from model')
  return text
}

function parseStrictJson(text: string): unknown {
  let t = text.trim()
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) t = fence[1]
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start > 0 && end > start) t = t.slice(start, end + 1)
  return JSON.parse(t)
}

async function callAndParse(system: string, user: string): Promise<unknown> {
  try {
    return parseStrictJson(await callClaude(system, user))
  } catch {
    return parseStrictJson(await callClaude(system, user))
  }
}

interface GenOut {
  format: 'dialogue' | 'prose'
  lines: PassageLine[]
  translation: string
  glossary: { word: string; gloss: string }[]
  question: { prompt: string; prompt_en?: string; answer: string }
  notice?: { form: string; note: string }
}

function normaliseGenOut(raw: Record<string, unknown>): GenOut {
  const lines = Array.isArray(raw.lines)
    ? (raw.lines as PassageLine[]).filter((l) => l && typeof l.text === 'string')
    : []
  if (!lines.length) throw new Error('Malformed generation output: no lines')
  const q = (raw.question ?? {}) as Record<string, string>
  const n = raw.notice as { form?: unknown; note?: unknown } | undefined
  const notice =
    n && typeof n.form === 'string' && n.form && typeof n.note === 'string' && n.note
      ? { form: n.form, note: n.note }
      : undefined
  return {
    ...(notice ? { notice } : {}),
    format: raw.format === 'dialogue' ? 'dialogue' : 'prose',
    lines: lines.map((l) => ({
      speaker: l.speaker === 'A' || l.speaker === 'B' ? l.speaker : null,
      text: String(l.text),
      gloss: typeof l.gloss === 'string' ? l.gloss : '',
    })),
    translation: typeof raw.translation === 'string' ? raw.translation : '',
    glossary: Array.isArray(raw.glossary)
      ? (raw.glossary as { word: string; gloss: string }[]).filter(
          (g) => g && typeof g.word === 'string',
        )
      : [],
    question: {
      prompt: q.prompt ?? '',
      prompt_en: q.prompt_en ?? '',
      answer: q.answer ?? '',
    },
  }
}

const app = new Hono().basePath('/api')

// Optional passphrase gate: no-op unless APP_PASSPHRASE is set. When set, the
// client must send a matching x-bukit-pass header (see src/lib/api.ts).
app.use('/generate', passGuard)
app.use('/grade', passGuard)

async function passGuard(c: import('hono').Context, next: () => Promise<void>) {
  const { passphrase } = config()
  if (passphrase && c.req.header('x-bukit-pass') !== passphrase) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}

app.post('/generate', async (c) => {
  if (!config().apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  const body = await c.req.json()

  const tier = {
    id: Number(body.tier?.id ?? 3),
    format: body.tier?.format === 'dialogue' ? 'dialogue' : 'either',
    lengthWords: Array.isArray(body.tier?.length_words) ? body.tier.length_words : [60, 110],
    containment: Number(body.tier?.containment ?? 0.9),
    minOccurrences: Number(body.tier?.min_occurrences ?? 2),
    questionLanguage: String(body.tier?.question_language ?? 'malay'),
  }
  const studied: string[] = Array.isArray(body.studied_words) ? body.studied_words : []
  const newWords: string[] = Array.isArray(body.new_words) ? body.new_words : []
  const allowExtras = tier.containment < 1

  const payload = {
    tier: tier.id,
    format:
      tier.format === 'dialogue' ? 'dialogue' : body.register === 'colloquial' ? 'dialogue' : 'prose',
    length_words: `${tier.lengthWords[0]}-${tier.lengthWords[1]}`,
    min_occurrences_per_new_word: tier.minOccurrences,
    allow_sparing_extras: allowExtras,
    question_language: tier.questionLanguage,
    studied_words: studied,
    new_words: newWords,
    register: body.register === 'colloquial' ? 'colloquial' : 'baku',
    topic: String(body.topic ?? 'pasar'),
    user_context: String(body.user_context ?? ''),
  }

  const validate = (out: GenOut) =>
    validatePassage({
      lines: out.lines,
      allowed: [...studied, ...newWords],
      newWords,
      functionWords: FUNCTION_WORDS,
      containment: tier.containment,
      minOccurrences: tier.minOccurrences,
    })

  try {
    const first = normaliseGenOut(
      (await callAndParse(GENERATE_SYSTEM, JSON.stringify(payload))) as Record<string, unknown>,
    )
    let chosen = first
    let check = validate(first)
    let firstNoticeOk = noticeValid(first.notice, first.lines)

    if (!check.ok || !firstNoticeOk) {
      const feedback = {
        ...payload,
        previous_attempt_rejected: true,
        do_not_use_these_words: check.violations,
        new_words_needing_more_repetition: check.underused,
        notice_problem: firstNoticeOk
          ? undefined
          : 'Your notice was missing or its form does not appear in the passage. ' +
            'Include exactly one notice whose form appears verbatim in the text.',
        instruction:
          'Your previous attempt broke the constraints. Regenerate. ' +
          'Do NOT use the listed forbidden words. Repeat each listed new word at ' +
          'least the required number of times. Shorter and more repetitive is fine.',
      }
      const second = normaliseGenOut(
        (await callAndParse(GENERATE_SYSTEM, JSON.stringify(feedback))) as Record<string, unknown>,
      )
      const secondCheck = validate(second)
      // Vocabulary containment outranks the notice: take the retry only when
      // it is at least as clean on vocab (strictly better when the first
      // attempt failed vocab; not worse when we retried for the notice alone).
      const takeSecond = check.ok
        ? secondCheck.ok
        : secondCheck.ok ||
          secondCheck.violations.length + secondCheck.underused.length <
            check.violations.length + check.underused.length
      if (takeSecond) {
        chosen = second
        check = secondCheck
      }
      if (!check.ok) {
        console.warn('[generate] containment violations accepted for QA:', {
          ratio: check.containmentRatio.toFixed(3),
          violations: check.violations,
          underused: check.underused,
        })
        const glossed = new Set(chosen.glossary.map((g) => g.word.toLowerCase()))
        for (const v of check.violations) {
          if (!glossed.has(v.toLowerCase())) chosen.glossary.push({ word: v, gloss: '' })
        }
      }
    }

    // A notice whose form never made it into the text is dropped, not shipped —
    // the whisper is optional; a wrong whisper is not.
    if (chosen.notice && !noticeValid(chosen.notice, chosen.lines)) {
      console.warn('[generate] dropping invalid notice:', chosen.notice)
      delete chosen.notice
    }
    return c.json({ ...chosen, containment: check.containmentRatio })
  } catch (e) {
    console.error('[generate]', e)
    return c.json({ error: 'generation_failed' }, 502)
  }
})

app.post('/grade', async (c) => {
  if (!config().apiKey) return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
  const body = await c.req.json()
  const payload = {
    task_prompt: String(body.prompt ?? ''),
    learner_response: String(body.response ?? ''),
  }
  try {
    const out = (await callAndParse(GRADE_SYSTEM, JSON.stringify(payload))) as Record<
      string,
      unknown
    >
    if (typeof out.corrected !== 'string') throw new Error('Malformed grading output')
    return c.json(out)
  } catch (e) {
    console.error('[grade]', e)
    return c.json({ error: 'grading_failed' }, 502)
  }
})

app.get('/health', (c) => {
  const { model, apiKey, passphrase } = config()
  return c.json({ ok: true, model, keyConfigured: Boolean(apiKey), gated: Boolean(passphrase) })
})

export default app
