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

/** Inline register chips (Words list) — just the chips, no forms. */
export function VariantChips({ colloquial, utara }: { colloquial?: string; utara?: string }) {
  return (
    <>
      {colloquial && <RegisterChip kind="colloq" />}
      {utara && <RegisterChip kind="utara" />}
    </>
  )
}
