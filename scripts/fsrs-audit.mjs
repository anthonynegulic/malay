#!/usr/bin/env node
/**
 * R6 audit: log the button→interval table for a fresh card, a 1-day card and a
 * 7-day card, and verify graduation — Good on a fresh card must reach ≥1 day
 * within the configured learning steps. Run with: node scripts/fsrs-audit.mjs
 * (fuzz disabled here so the table is deterministic; the app enables fuzz).
 */
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'

const params = generatorParameters({ request_retention: 0.9, enable_fuzz: false })
const scheduler = fsrs(params)
console.log(`ts-fsrs v5 · request_retention ${params.request_retention}`)
console.log(`learning_steps ${JSON.stringify(params.learning_steps)} · relearning_steps ${JSON.stringify(params.relearning_steps)}\n`)

const fmt = (ms) => {
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m}m`
  if (m < 60 * 24) return `${Math.round(m / 60)}h`
  return `${Math.round(m / (60 * 24))}d`
}
const stateName = (s) => ({ [State.New]: 'new', [State.Learning]: 'learning', [State.Review]: 'review', [State.Relearning]: 'relearning' })[s]

function table(label, card, now) {
  console.log(`${label} (state: ${stateName(card.state)}, step ${card.learning_steps}):`)
  for (const [name, r] of [['Lagi/Again', Rating.Again], ['Susah/Hard', Rating.Hard], ['Okey/Good', Rating.Good], ['Senang/Easy', Rating.Easy]]) {
    const { card: next } = scheduler.next(card, now, r)
    console.log(`  ${name.padEnd(11)} → ${fmt(next.due - now)} (${stateName(next.state)})`)
  }
  console.log()
}

const now = new Date()
const fresh = createEmptyCard(now)
table('Fresh card', fresh, now)

// Graduation path: fresh card graded Good repeatedly.
let c = fresh
let t = now
const path = []
for (let i = 0; i < 4; i++) {
  const { card: next } = scheduler.next(c, t, Rating.Good)
  path.push(`Good #${i + 1} → due +${fmt(next.due - t)} (${stateName(next.state)})`)
  t = next.due
  c = next
}
console.log('Good-path graduation from fresh:')
for (const p of path) console.log('  ' + p)
const graduated = path.findIndex((p) => p.includes('review'))
console.log(
  graduated >= 0 && graduated <= params.learning_steps.length
    ? `\n✓ graduates to the review state (≥1d) after ${graduated + 1} Good grades — within the ${params.learning_steps.length} learning steps.\n`
    : '\n✗ NOT graduating within the configured learning steps — investigate.\n',
)

// 1-day and 7-day review-state cards.
function reviewCardOfStability(days) {
  let card = createEmptyCard(new Date(now - days * 2 * 86400000))
  let when = new Date(now - days * 2 * 86400000)
  // Good through learning steps into review, then age it.
  for (let i = 0; i < 3; i++) {
    const { card: next } = scheduler.next(card, when, Rating.Good)
    card = next
    when = next.due
  }
  card.stability = days
  card.due = now.getTime()
  card.scheduled_days = days
  return card
}
table('1-day card', reviewCardOfStability(1), now)
table('7-day card', reviewCardOfStability(7), now)
