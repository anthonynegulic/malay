/** The three-colour register language (P1.4): BAKU jade, COLLOQ oxblood, UTARA gold.
 *  Mono, uppercase, tiny, flat. */

const STYLES = {
  baku: 'bg-jade text-jade-ink',
  colloq: 'bg-oxblood text-plaster',
  utara: 'bg-gold text-gold-ink',
} as const

export function RegisterChip({ kind }: { kind: keyof typeof STYLES }) {
  return <span className={`mono-sm rounded-[2px] px-1.5 py-0.5 ${STYLES[kind]}`}>{kind}</span>
}

/** A hairline-ruled ledger of register variants (Review back — the PDR-001 payoff). */
export function VariantLedger({
  baku,
  colloquial,
  utara,
  exampleBaku,
  exampleColloq,
}: {
  baku: string
  colloquial?: string
  utara?: string
  exampleBaku?: string
  exampleColloq?: string
}) {
  const rows: { kind: keyof typeof STYLES; form: string; ctx?: string }[] = [
    { kind: 'baku', form: baku, ctx: exampleBaku },
  ]
  if (colloquial) rows.push({ kind: 'colloq', form: colloquial, ctx: exampleColloq })
  if (utara) rows.push({ kind: 'utara', form: utara })
  return (
    <div className="border-t border-hairline">
      {rows.map((r) => (
        <div key={r.kind} className="flex items-baseline gap-3 py-2 border-b border-hairline">
          <RegisterChip kind={r.kind} />
          <span className="font-medium">{r.form}</span>
          {r.ctx && <span className="text-muted text-sm truncate ml-auto text-right">{r.ctx}</span>}
        </div>
      ))}
    </div>
  )
}

/**
 * R1+R2: the example block, self-explanatory without scrolling. Sentences are
 * chip-labelled inline when a second register is present; a one-word
 * difference is bolded in both; identical sentences render once; every block
 * carries its English gloss (bracketed roman, per R3). The second sentence's
 * chip honours example_colloq_kind — northern-form sentences say UTARA, not
 * COLLOQ (Q2 ruling).
 */
export function ExampleBlock({
  word,
  tone = 'plaster',
  className = '',
}: {
  word: Pick<
    import('../db/types').Word,
    'example_baku' | 'example_colloq' | 'example_en' | 'example_colloq_kind' | 'example_colloq_en'
  >
  /** Ground the block sits on: plaster (default) or indigo. */
  tone?: 'plaster' | 'indigo'
  className?: string
}) {
  const baku = word.example_baku
  if (!baku) return null
  const colloq =
    word.example_colloq && word.example_colloq !== baku ? word.example_colloq : undefined
  const secondKind: keyof typeof STYLES = word.example_colloq_kind === 'utara' ? 'utara' : 'colloq'
  const diff = colloq ? oneWordDiff(baku, colloq) : null
  const msClass = tone === 'indigo' ? 'text-plaster' : 'text-charcoal'
  const enClass = tone === 'indigo' ? 'text-indigo-lo' : 'text-muted'

  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        {colloq && <RegisterChip kind="baku" />}
        <BoldDiffSentence text={baku} boldIndex={diff} className={`italic ${msClass}`} />
      </div>
      {word.example_en && (
        <div className={`${enClass} text-sm mt-0.5`}>({word.example_en})</div>
      )}
      {colloq && (
        <>
          <div className="flex items-baseline gap-2 mt-2">
            <RegisterChip kind={secondKind} />
            <BoldDiffSentence text={colloq} boldIndex={diff} className={`italic ${msClass}`} />
          </div>
          {word.example_colloq_en && (
            <div className={`${enClass} text-sm mt-0.5`}>({word.example_colloq_en})</div>
          )}
        </>
      )}
    </div>
  )
}

/** Index of the single differing word between two sentences, or null when they
 *  differ by more (or fewer) than one word. */
function oneWordDiff(a: string, b: string): number | null {
  const ta = a.split(' ')
  const tb = b.split(' ')
  if (ta.length !== tb.length) return null
  let idx: number | null = null
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] !== tb[i]) {
      if (idx !== null) return null
      idx = i
    }
  }
  return idx
}

function BoldDiffSentence({
  text,
  boldIndex,
  className,
}: {
  text: string
  boldIndex: number | null
  className?: string
}) {
  if (boldIndex === null) return <span className={className}>{text}</span>
  return (
    <span className={className}>
      {text.split(' ').map((tok, i) => (
        <span key={i}>
          {i > 0 ? ' ' : ''}
          {i === boldIndex ? <strong className="font-bold">{tok}</strong> : tok}
        </span>
      ))}
    </span>
  )
}

/** Inline register chips (Words list) — just the chips, no forms. */
export function VariantChips({ colloquial, utara }: { colloquial?: string; utara?: string }) {
  return (
    <>
      {colloquial && <RegisterChip kind="colloq" />}
      {utara && <RegisterChip kind="utara" />}
    </>
  )
}
