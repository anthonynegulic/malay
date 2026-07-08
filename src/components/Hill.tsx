import { useMemo } from 'react'

/**
 * The Hill — a generative SVG landscape whose structure encodes the data:
 * the hills literally grow with the number of words being studied.
 * Milestones at 100 / 250 / 500 / 1000; the 1000 marker carries the proverb.
 * The footpath renders recent history with visible gaps — nothing resets.
 */

const MILESTONES = [100, 250, 500, 1000]
const PROVERB = 'sedikit-sedikit, lama-lama jadi bukit'

// Deterministic pseudo-random from a seed, so the landscape is stable per count.
function mulberry(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 0..1 progress toward the 1000-word summit, eased so early growth is visible. */
function progress(count: number): number {
  return Math.min(1, Math.sqrt(count / 1000))
}

function ridge(
  rand: () => number,
  baseY: number,
  height: number,
  bumps: number,
  W: number,
): string {
  let d = `M0 ${baseY.toFixed(1)}`
  const seg = W / bumps
  for (let i = 0; i < bumps; i++) {
    const cx = seg * i + seg / 2 + (rand() - 0.5) * seg * 0.4
    const cy = baseY - height * (0.55 + rand() * 0.45)
    const ex = seg * (i + 1)
    const ey = baseY - height * (i === bumps - 1 ? 0.15 : 0.1 + rand() * 0.3)
    d += ` Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`
  }
  d += ` L ${W} 200 L 0 200 Z`
  return d
}

export function Hill({
  wordCount,
  history = [],
  grow = false,
  full = false,
}: {
  wordCount: number
  /** Recent days, oldest first: true = counted, false = gap. */
  history?: boolean[]
  /** Play the one extravagant animation (session completion). */
  grow?: boolean
  /** Full-size mode with milestone labels (Progress screen). */
  full?: boolean
}) {
  const W = 360
  const H = full ? 230 : 180

  const { back, mid, front, sunX, stones, markers } = useMemo(() => {
    const p = progress(wordCount)
    const rand = mulberry(1 + wordCount)
    const back = ridge(rand, 168, 68 + 60 * p, 2 + Math.floor(p * 2), W)
    const mid = ridge(rand, 182, 52 + 50 * p, 3, W)
    const front = ridge(rand, 200, 40 + 42 * p, 2, W)
    const sunX = 60 + 240 * p

    // Footpath stones climb the front slope, most recent nearest the top.
    const days = history.slice(-12)
    const stones = days.map((counted, i) => {
      const t = (i + 1) / (days.length + 1)
      return {
        x: 30 + t * (W * 0.55),
        y: 194 - t * (34 + 34 * p),
        counted,
      }
    })

    // Milestone markers along the ridge line toward the summit.
    const markers = MILESTONES.map((m) => {
      const t = Math.sqrt(m / 1000)
      return {
        m,
        x: 24 + t * (W - 60),
        y: 172 - t * (56 + 52 * p),
        reached: wordCount >= m,
      }
    })
    return { back, mid, front, sunX, stones, markers }
  }, [wordCount, history, W])

  return (
    <svg
      viewBox={`0 ${full ? -30 : 0} ${W} ${H}`}
      className="w-full select-none"
      role="img"
      aria-label={`The Hill: ${wordCount} words`}
    >
      {/* daylight-tropical sun — brass, sparing */}
      <circle cx={sunX} cy={full ? 8 : 32} r={14} fill="var(--color-brass)" opacity={0.9} />

      <g className={grow ? 'hill-grow' : undefined}>
        <path d={back} fill="var(--color-shutter)" opacity={0.28} />
        <path d={mid} fill="var(--color-mansion)" opacity={0.55} />
        <path d={front} fill="var(--color-mansion)" />

        {/* footpath */}
        {stones.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={3.4}
            fill={s.counted ? 'var(--color-limewash)' : 'transparent'}
            stroke="var(--color-limewash)"
            strokeWidth={1}
            opacity={s.counted ? 0.95 : 0.4}
          />
        ))}
      </g>

      {/* milestones */}
      {markers.map((mk) => (
        <g key={mk.m}>
          <circle
            cx={mk.x}
            cy={mk.y}
            r={4.5}
            fill={mk.reached ? 'var(--color-brass)' : 'var(--color-limewash)'}
            stroke="var(--color-brass)"
            strokeWidth={1.5}
          />
          {full && (
            <text
              x={mk.x}
              y={mk.y - 10}
              textAnchor="middle"
              fontSize={11}
              fontFamily="var(--font-mono)"
              fill="var(--color-ink)"
              opacity={mk.reached ? 1 : 0.55}
            >
              {mk.m}
            </text>
          )}
        </g>
      ))}

      {full && (
        <text
          x={W - 6}
          y={-16}
          textAnchor="end"
          fontSize={10.5}
          fontStyle="italic"
          fontFamily="var(--font-body)"
          fill="var(--color-ink)"
          opacity={0.75}
        >
          {PROVERB}
        </text>
      )}
    </svg>
  )
}
