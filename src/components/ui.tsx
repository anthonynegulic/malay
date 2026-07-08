/** Small shared design-system pieces (remediation P1.2). */

const LABEL_COLORS = {
  ink: 'text-ink/45',
  mansion: 'text-mansion/80',
  shutter: 'text-shutter/90',
} as const

/** Mono section label with a short rule: `SITUASI · THE SITUATION ———` */
export function SectionLabel({
  ms,
  en,
  color = 'ink',
  className = '',
}: {
  ms: string
  en?: string
  color?: keyof typeof LABEL_COLORS
  className?: string
}) {
  return (
    <div className={`flex items-center gap-2.5 overflow-hidden ${className}`}>
      <span
        className={`font-mono text-[10px] uppercase tracking-widest whitespace-nowrap truncate min-w-0 ${LABEL_COLORS[color]}`}
      >
        {ms}
        {en ? ` · ${en}` : ''}
      </span>
      <span className={`h-px w-8 shrink-0 bg-current opacity-25 ${LABEL_COLORS[color]}`} aria-hidden />
    </div>
  )
}

/**
 * Peranakan tile-corner ornament: two concentric quarter-arcs, mansion + nyonya.
 * Used on exactly two surfaces — the review tile and the session-complete
 * moment (P1.2). Do not sprinkle it anywhere else.
 */
export function CornerMotif({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`w-10 h-10 ${className}`}
      aria-hidden
      fill="none"
    >
      <path d="M48 4 A44 44 0 0 0 4 48" stroke="var(--color-mansion)" strokeWidth="2.5" />
      <path d="M48 18 A30 30 0 0 0 18 48" stroke="var(--color-nyonya)" strokeWidth="2.5" />
      <circle cx="41" cy="41" r="2.5" fill="var(--color-brass)" />
    </svg>
  )
}

/* ————— Tab-bar line icons (P1.4: no emoji) ————— */

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function HillIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <path d="M2 19 Q8 7 12 12 T22 19 Z" />
      <circle cx="18.5" cy="6" r="2" />
    </svg>
  )
}

export function BookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <path d="M12 6 C10 4.5 7 4.5 4 5.5 V18.5 C7 17.5 10 17.5 12 19 C14 17.5 17 17.5 20 18.5 V5.5 C17 4.5 14 4.5 12 6 Z" />
      <path d="M12 6 V19" />
    </svg>
  )
}

export function StonesIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <ellipse cx="8" cy="17" rx="5" ry="3.2" />
      <ellipse cx="16.5" cy="12" rx="3.6" ry="2.4" />
      <ellipse cx="10" cy="7.5" rx="2.6" ry="1.8" />
    </svg>
  )
}

export function CloudIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg {...iconProps} className={className} aria-hidden>
      <path d="M6 15 A4 4 0 0 1 7 7.2 A5 5 0 0 1 16.6 8.5 A3.5 3.5 0 0 1 17 15.5 Z" />
      <path d="M8 18.5 l-1 2.2 M12 18.5 l-1 2.2 M16 18.5 l-1 2.2" />
    </svg>
  )
}
