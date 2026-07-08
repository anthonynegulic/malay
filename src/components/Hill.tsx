import { useId, useMemo } from 'react'

/**
 * The Hill, v1.1 (remediation P1.1) — metaphor the right way up.
 *
 * - The EARNED MOUND: a small solid foreground hill that scales with
 *   studied-word count. At day zero it is genuinely small — that's the point.
 * - The ASPIRATION SILHOUETTE: a faint dashed outline of the full 1000-word
 *   bukit behind it. Growth = the solid shape filling the ghost.
 * - Footpath stones wind up the earned mound, one per practised day; gaps stay
 *   visible as missing stones (A3 unchanged).
 * - Passed milestones become brass flags on the mound; the next milestone is
 *   labelled on the ghost.
 * - The 1.2s growth animation on session completion targets the mound only.
 */

const MILESTONES = [
  { m: 100, label: 'bukit kecil' },
  { m: 250, label: 'cerun' },
  { m: 500, label: 'lereng' },
  { m: 1000, label: 'puncak' },
]
const PROVERB = 'sedikit-sedikit, lama-lama jadi bukit'

const W = 360
const GROUND = 196
const APEX_X = 190
const GHOST_APEX_Y = 46
const GHOST_HALF = 150

/** 0..1 progress toward the 1000-word summit; sqrt so early growth is visible. */
function progress(count: number): number {
  return Math.min(1, Math.sqrt(Math.max(0, count) / 1000))
}

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

/** Smooth asymmetric hill path with given apex height and half-width. */
function hillPath(apexY: number, half: number): string {
  const lx = APEX_X - half
  const rx = APEX_X + half
  return [
    `M ${lx.toFixed(1)} ${GROUND}`,
    `C ${(APEX_X - half * 0.45).toFixed(1)} ${GROUND}, ${(APEX_X - half * 0.34).toFixed(1)} ${apexY.toFixed(1)}, ${APEX_X} ${apexY.toFixed(1)}`,
    `C ${(APEX_X + half * 0.38).toFixed(1)} ${apexY.toFixed(1)}, ${(APEX_X + half * 0.5).toFixed(1)} ${GROUND}, ${rx.toFixed(1)} ${GROUND}`,
    'Z',
  ].join(' ')
}

/** Point on the mound's left slope at fraction t (0 = base, 1 = apex). Cheap approximation. */
function leftSlopePoint(apexY: number, half: number, t: number): { x: number; y: number } {
  const ease = t * t * 0.4 + t * 0.6
  return {
    x: APEX_X - half * (1 - ease * 0.92),
    y: GROUND - (GROUND - apexY) * (t * t * 0.85 + t * 0.15) * 0.96,
  }
}

/** X on the ghost's right slope at a given height (linear approximation). */
function ghostRightX(y: number): number {
  const t = (y - GHOST_APEX_Y) / (GROUND - GHOST_APEX_Y)
  return APEX_X + GHOST_HALF * (0.18 + 0.82 * t)
}

export function Hill({
  wordCount,
  history = [],
  grow = false,
  full = false,
}: {
  wordCount: number
  /** Practised-day history, oldest first: true = counted, false = gap. */
  history?: boolean[]
  /** Play the one extravagant animation (session completion). */
  grow?: boolean
  /** Full-size mode with proverb + all milestone labels (Progress screen). */
  full?: boolean
}) {
  const uid = useId().replace(/:/g, '')

  const scene = useMemo(() => {
    const p = progress(wordCount)
    const rand = mulberry(1 + wordCount)

    const apexY = GROUND - (GROUND - GHOST_APEX_Y - 8) * p - 10 // ≥10px mound even at zero
    const half = 26 + (GHOST_HALF - 26) * p
    const mound = hillPath(apexY, half)
    const ghost = hillPath(GHOST_APEX_Y, GHOST_HALF)

    // Background ridgelines — atmospheric depth, further = lighter.
    const farRidge = `M 0 ${GROUND} L 0 168 Q 90 ${128 + rand() * 14} 190 ${150 + rand() * 10} T ${W} 160 L ${W} ${GROUND} Z`
    const nearRidge = `M 0 ${GROUND} L 0 182 Q 120 ${152 + rand() * 12} 240 ${168 + rand() * 8} T ${W} 176 L ${W} ${GROUND} Z`

    // Footpath stones up the mound's left slope, most recent nearest the apex.
    const days = history.slice(-14)
    const stones = days.map((counted, i) => {
      const t = (i + 1) / (days.length + 1)
      const pt = leftSlopePoint(apexY, half, t)
      return { ...pt, x: pt.x + (i % 2 === 0 ? 3 : -3), counted }
    })

    // Milestones: passed → brass flag on the mound; next → label on the ghost.
    const markers = MILESTONES.map(({ m, label }) => {
      const t = progress(m)
      const y = GROUND - (GROUND - GHOST_APEX_Y - 8) * t - 10
      return { m, label, y, reached: wordCount >= m }
    })
    const next = markers.find((mk) => !mk.reached)

    return { p, apexY, half, mound, ghost, farRidge, nearRidge, stones, markers, next }
  }, [wordCount, history])

  // Compact mode crops empty sky; full mode leaves room for the proverb below.
  const top = full ? 0 : 22
  const H = full ? 236 : 212 - top

  return (
    <svg
      viewBox={`0 ${top} ${W} ${H}`}
      className="w-full select-none"
      role="img"
      aria-label={`The Hill: ${wordCount} words studied`}
    >
      <defs>
        <clipPath id={`mound-${uid}`}>
          <path d={scene.mound} />
        </clipPath>
        <filter id={`grain-${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.06  0 0 0 0 0.09  0 0 0 0 0.2  0 0 0 0.35 0"
          />
        </filter>
      </defs>

      {/* pale sky band — a barely-blue tint of limewash, not white */}
      <rect
        x="0"
        y="0"
        width={W}
        height={GROUND}
        fill="color-mix(in srgb, var(--color-mansion) 5%, var(--color-limewash))"
      />

      {/* brass sun */}
      <circle cx={262} cy={44} r={13} fill="var(--color-brass)" opacity={0.92} />

      {/* atmospheric ridgelines: further = lighter */}
      <path d={scene.farRidge} fill="var(--color-shutter)" opacity={0.13} />
      <path d={scene.nearRidge} fill="var(--color-mansion)" opacity={0.15} />

      {/* the aspiration silhouette — what he's climbing toward */}
      <path
        d={scene.ghost}
        fill="none"
        stroke="var(--color-ink)"
        strokeOpacity={0.32}
        strokeWidth={1.4}
        strokeDasharray="3 5"
      />

      {/* next milestone, labelled on the ghost */}
      {scene.next && (
        <g opacity={0.75}>
          <circle
            cx={ghostRightX(scene.next.y)}
            cy={scene.next.y}
            r={3.4}
            fill="var(--color-limewash)"
            stroke="var(--color-brass)"
            strokeWidth={1.4}
          />
          <text
            x={Math.min(ghostRightX(scene.next.y) - 8, W - 8)}
            y={scene.next.y - 7}
            textAnchor="end"
            fontSize={10}
            fontFamily="var(--font-mono)"
            fill="var(--color-ink)"
            opacity={0.7}
          >
            {scene.next.m} · {scene.next.label}
          </text>
        </g>
      )}

      {/* ————— the earned mound (the only thing the growth animation touches) ————— */}
      <g className={grow ? 'hill-grow' : undefined}>
        <path d={scene.mound} fill="var(--color-mansion)" />
        <rect
          x="0"
          y="0"
          width={W}
          height={GROUND}
          clipPath={`url(#mound-${uid})`}
          filter={`url(#grain-${uid})`}
        />

        {/* passed milestones → small brass flags planted on the mound */}
        {scene.markers
          .filter((mk) => mk.reached)
          .map((mk) => {
            const y = Math.max(mk.y, scene.apexY + 4)
            return (
              <g key={mk.m}>
                <line
                  x1={APEX_X}
                  y1={y}
                  x2={APEX_X}
                  y2={y - 12}
                  stroke="var(--color-brass)"
                  strokeWidth={1.6}
                />
                <path
                  d={`M ${APEX_X} ${y - 12} l 9 3 l -9 3 Z`}
                  fill="var(--color-brass)"
                />
              </g>
            )
          })}

        {/* footpath — one stone per practised day, gaps stay visible */}
        {scene.stones.map((s, i) => (
          <ellipse
            key={i}
            cx={s.x}
            cy={s.y}
            rx={3.6}
            ry={2.4}
            fill={s.counted ? 'var(--color-limewash)' : 'none'}
            stroke="var(--color-limewash)"
            strokeWidth={1}
            strokeDasharray={s.counted ? undefined : '2 2'}
            opacity={s.counted ? 0.95 : 0.45}
          />
        ))}
      </g>

      {/* ground line */}
      <line x1="0" y1={GROUND} x2={W} y2={GROUND} stroke="var(--color-ink)" strokeOpacity={0.15} />

      {full && (
        <text
          x={W / 2}
          y={GROUND + 24}
          textAnchor="middle"
          fontSize={11}
          fontStyle="italic"
          fontFamily="var(--font-body)"
          fill="var(--color-ink)"
          opacity={0.7}
        >
          {PROVERB}
        </text>
      )}
    </svg>
  )
}
