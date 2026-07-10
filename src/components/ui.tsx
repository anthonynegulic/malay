/** Shared "Mansion" design-system pieces (v1.1 P1). No illustration; identity is
 *  typography, colour-as-architecture, and hairline rules. */

const LABEL_COLORS = {
  charcoal: 'text-charcoal/70',
  muted: 'text-muted',
  gold: 'text-gold',
  oxblood: 'text-oxblood',
  jade: 'text-jade-ink',
  'indigo-hi': 'text-indigo-hi',
  'indigo-lo': 'text-indigo-lo',
} as const

/** Signage label: `KATA BARU · NEW WORDS` — Malay primary, English secondary (P1.2). */
export function Label({
  ms,
  en,
  color = 'muted',
  className = '',
}: {
  ms: string
  en?: string
  color?: keyof typeof LABEL_COLORS
  className?: string
}) {
  return (
    <span className={`mono ${LABEL_COLORS[color]} ${className}`}>
      {ms}
      {en ? <span className="opacity-60"> · {en}</span> : null}
    </span>
  )
}

/* ————— Line icons (P1: no emoji). Inherit colour via currentColor. ————— */

const svg = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function TodayIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="1.5" />
      <path d="M4 9h16M8 3v4M16 3v4" />
    </svg>
  )
}

export function BookIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M12 6 C10 4.5 7 4.5 4 5.5 V18.5 C7 17.5 10 17.5 12 19 C14 17.5 17 17.5 20 18.5 V5.5 C17 4.5 14 4.5 12 6 Z" />
      <path d="M12 6 V19" />
    </svg>
  )
}

export function ChartIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M4 20 V4" />
      <path d="M4 20 H20" />
      <rect x="7.5" y="12" width="2.5" height="5" />
      <rect x="12" y="8.5" width="2.5" height="8.5" />
      <rect x="16.5" y="5.5" width="2.5" height="11.5" />
    </svg>
  )
}

export function SpeakerIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M18.8 6a8 8 0 0 1 0 12" />
    </svg>
  )
}

export function MuteIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" />
    </svg>
  )
}

export function CloudIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <path d="M6 15 A4 4 0 0 1 7 7.2 A5 5 0 0 1 16.6 8.5 A3.5 3.5 0 0 1 17 15.5 Z" />
      <path d="M8 18.5 l-1 2.2 M12 18.5 l-1 2.2 M16 18.5 l-1 2.2" />
    </svg>
  )
}

export function GearIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg {...svg} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </svg>
  )
}
