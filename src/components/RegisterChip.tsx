const STYLES = {
  baku: 'bg-mansion text-limewash',
  colloq: 'bg-shutter text-limewash',
  utara: 'bg-nyonya text-ink',
} as const

export function RegisterChip({ kind }: { kind: keyof typeof STYLES }) {
  return (
    <span
      className={`font-mono text-[10px] font-medium tracking-widest uppercase rounded px-1.5 py-0.5 ${STYLES[kind]}`}
    >
      {kind}
    </span>
  )
}

export function VariantRow({
  baku,
  colloquial,
  utara,
  animate = false,
}: {
  baku: string
  colloquial?: string
  utara?: string
  animate?: boolean
}) {
  const cls = animate ? 'shutter flex items-center gap-1.5' : 'flex items-center gap-1.5'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <span className={cls}>
        <RegisterChip kind="baku" />
        <span className="font-medium">{baku}</span>
      </span>
      {colloquial && (
        <span className={cls}>
          <RegisterChip kind="colloq" />
          <span className="font-medium">{colloquial}</span>
        </span>
      )}
      {utara && (
        <span className={cls}>
          <RegisterChip kind="utara" />
          <span className="font-medium">{utara}</span>
        </span>
      )}
    </div>
  )
}
