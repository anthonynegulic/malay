/**
 * Day-boundary + FSRS scheduling tests. These lock the behaviour that a
 * timezone change (e.g. relocating to Penang, UTC+8) or a future refactor
 * could silently break: how "today" is derived, when new cards first come due,
 * what counts as a practised day, and the shape of the FSRS progression.
 * Run: npx tsx tests/scheduler.test.ts
 */
import assert from 'node:assert'
import { todayStr, tomorrowStart, sessionCounts, nextMilestone } from '../src/lib/session'
import { newCard, gradeCard, knownCard, previewIntervals, Rating } from '../src/lib/fsrs'
import type { Session } from '../src/db/types'

// ————— todayStr: local calendar date, zero-padded, stable through a day —————
{
  assert.equal(todayStr(new Date(2026, 0, 5)), '2026-01-05', 'single-digit month/day zero-pad')
  assert.equal(todayStr(new Date(2026, 11, 31)), '2026-12-31', 'december')
  // Same calendar day at different clock times → same string (no UTC shift).
  assert.equal(
    todayStr(new Date(2026, 6, 20, 0, 30)),
    todayStr(new Date(2026, 6, 20, 23, 30)),
    'stable from 00:30 to 23:30 local',
  )
  // Uses local components, so it matches the device wall clock the app shows.
  const d = new Date(2026, 2, 9, 14, 0)
  assert.equal(todayStr(d), `2026-03-09`)
}

// ————— tomorrowStart: next calendar day at 04:00 local —————
{
  const t = tomorrowStart()
  assert.equal(t.getHours(), 4, '04:00 so late-night sessions do not self-trigger')
  assert.equal(t.getMinutes(), 0)
  assert.equal(t.getSeconds(), 0)
  const expected = new Date()
  expected.setDate(expected.getDate() + 1)
  assert.equal(todayStr(t), todayStr(expected), 'lands on the next calendar day')
  assert.ok(t.getTime() > Date.now(), 'strictly in the future')
}

// ————— sessionCounts: any real work marks the day —————
{
  const base: Session = {
    id: '2026-07-20',
    date: '2026-07-20',
    type: 'reviews_only',
    reviewsDone: 0,
    newWordsLearned: 0,
    outputAttempted: false,
    dueAtStart: 0,
  }
  assert.equal(sessionCounts(base), false, 'empty reviews_only session does not count')
  assert.equal(sessionCounts({ ...base, reviewsDone: 1 }), true, 'a graded review counts')
  assert.equal(sessionCounts({ ...base, newWordsLearned: 1 }), true, 'a new word counts')
  assert.equal(sessionCounts({ ...base, type: 'full' }), true, 'a full session always counts')
}

// ————— nextMilestone: strict "next above", clamped at the top —————
{
  assert.equal(nextMilestone(0), 100)
  assert.equal(nextMilestone(99), 100)
  assert.equal(nextMilestone(100), 250, 'at a milestone, aim for the next one')
  assert.equal(nextMilestone(600), 1000)
  assert.equal(nextMilestone(1000), 1000, 'clamps at the final milestone')
  assert.equal(nextMilestone(5000), 1000)
}

// ————— newCard: brand new, due at the requested time —————
{
  const now = newCard('w1')
  assert.equal(now.state, 'new')
  assert.equal(now.reps, 0)
  const due = tomorrowStart()
  const scheduled = newCard('w2', due)
  assert.equal(scheduled.due, due.getTime(), 'honours an explicit due date (new words debut tomorrow)')
}

// ————— gradeCard: the intended FSRS progression (fuzz on → assert shape) —————
{
  const card = newCard('w3')
  const good1 = gradeCard(card, Rating.Good)
  assert.ok(good1.reps > card.reps, 'a grade advances reps')
  assert.notEqual(good1.state, 'new', 'grading leaves the new state')

  // Again on a fresh card keeps it in minutes, not days (re-queued same session).
  const again = gradeCard(card, Rating.Good === Rating.Again ? Rating.Hard : Rating.Again)
  const againMins = (again.due - Date.now()) / 60000
  assert.ok(againMins < 60, `Again stays sub-hour (${againMins.toFixed(1)}m)`)

  // Easy graduates straight past a day.
  const easy = gradeCard(card, Rating.Easy)
  const easyDays = (easy.due - Date.now()) / 86_400_000
  assert.ok(easyDays >= 1, `Easy graduates to >=1 day (${easyDays.toFixed(1)}d)`)
  assert.equal(easy.state, 'review', 'Easy on a new card graduates to review')

  // Interval ordering: Again ≤ Hard ≤ Good ≤ Easy (never inverted).
  const due = (r: 0 | 1 | 2 | 3) => gradeCard(card, r as never).due
  assert.ok(due(Rating.Again) <= due(Rating.Hard), 'again ≤ hard')
  assert.ok(due(Rating.Hard) <= due(Rating.Good), 'hard ≤ good')
  assert.ok(due(Rating.Good) <= due(Rating.Easy), 'good ≤ easy')
}

// ————— knownCard: onboarding "I know this" → mature, jittered within 2 weeks —————
{
  for (let i = 0; i < 50; i++) {
    const k = knownCard('w4')
    assert.equal(k.state, 'review', 'a known word starts mature, not new')
    const days = (k.due - Date.now()) / 86_400_000
    assert.ok(days >= 0 && days <= 30, `jittered due within range (${days.toFixed(1)}d)`)
  }
}

// ————— previewIntervals: four labels, human units —————
{
  const p = previewIntervals(newCard('w5'))
  for (const k of ['again', 'hard', 'good', 'easy'] as const) {
    assert.match(p[k], /^\d+(m|h|d|mo)$/, `${k} label "${p[k]}" is a unit string`)
  }
}

console.log('all scheduler tests passed ✓')
