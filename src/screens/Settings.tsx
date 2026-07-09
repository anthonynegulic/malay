import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, saveSettings } from '../db/db'
import type { Settings as SettingsT } from '../db/types'
import { exportBackup, importBackup } from '../lib/backup'
import { Label } from '../components/ui'

export function Settings() {
  const navigate = useNavigate()
  const [s, setS] = useState<SettingsT | null>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getSettings().then(setS)
  }, [])

  async function patch(p: Partial<SettingsT>) {
    await saveSettings(p)
    setS(await getSettings())
  }

  async function onImport(f: File | undefined) {
    if (!f) return
    try {
      await importBackup(f)
      setMsg('Import selesai · all data replaced.')
      setS(await getSettings())
    } catch {
      setMsg('Import failed — not a valid Bukit backup file.')
    }
  }

  if (!s) return null

  return (
    <div className="max-w-md mx-auto pb-24">
      <header className="bg-indigo text-plaster px-5 pt-6 pb-5 flex items-end justify-between">
        <div>
          <Label ms="Tetapan" en="settings" color="indigo-hi" />
          <div className="display text-plaster mt-1 text-3xl">Tetapan</div>
        </div>
        <button onClick={() => navigate(-1)} className="mono text-indigo-hi">
          tutup · close
        </button>
      </header>

      <div className="px-5 divide-y divide-hairline">
        <Row label="Kata baru sehari" en="new words per day" value={s.newWordsPerDay}>
          <input
            type="range"
            min={3}
            max={10}
            value={s.newWordsPerDay}
            onChange={(e) => patch({ newWordsPerDay: Number(e.target.value) })}
            className="w-full mt-2 accent-oxblood"
          />
          <p className="text-muted text-sm mt-1">
            Shared between scheduled and harvested words; overflow queues for tomorrow.
          </p>
        </Row>

        <Row label="Rentak mingguan" en="weekly rhythm target" value={`${s.weeklyTargetDays} hari`}>
          <input
            type="range"
            min={3}
            max={7}
            value={s.weeklyTargetDays}
            onChange={(e) => patch({ weeklyTargetDays: Number(e.target.value) })}
            className="w-full mt-2 accent-oxblood"
          />
        </Row>

        <div className="py-4 flex items-center justify-between">
          <Label ms="Register bacaan" en="reading register" color="charcoal" />
          <div className="flex border-[1.5px] border-charcoal rounded-[4px] overflow-hidden mono">
            {(['baku', 'colloquial'] as const).map((r) => (
              <button
                key={r}
                onClick={() => patch({ registerPreference: r })}
                className={`px-3 py-1.5 ${
                  s.registerPreference === r ? 'bg-charcoal text-plaster' : 'text-muted'
                }`}
              >
                {r === 'baku' ? 'BAKU' : 'COLLOQ'}
              </button>
            ))}
          </div>
        </div>

        <div className="py-4 flex items-center justify-between">
          <Label ms="Audio (TTS)" en="spoken pronunciation" color="charcoal" />
          <button
            onClick={() => patch({ ttsEnabled: !s.ttsEnabled })}
            className={`w-12 h-7 relative border-[1.5px] border-charcoal rounded-full ${
              s.ttsEnabled ? 'bg-jade' : 'bg-transparent'
            }`}
            aria-pressed={s.ttsEnabled}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-charcoal transition-all ${
                s.ttsEnabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        <div className="py-4">
          <Label ms="Konteks anda" en="about you" color="charcoal" />
          <textarea
            value={s.userContext}
            onChange={(e) => setS({ ...s, userContext: e.target.value })}
            onBlur={() => patch({ userContext: s.userContext })}
            rows={3}
            className="mt-2 w-full border-[1.5px] border-charcoal bg-plaster p-3 text-sm rounded-[4px] focus:border-gold"
          />
          <p className="text-muted text-sm">Used to personalise the topics of your generated reading.</p>
        </div>

        <div className="py-4">
          <Label ms="Penilaian semula" en="reassess" color="charcoal" className="block mb-2" />
          <p className="text-muted text-sm mb-2">
            Know more Malay than your reviews suggest? Re-run the know / don&rsquo;t-know pass over the
            backlog.
          </p>
          <button
            onClick={() => navigate('/onboarding?redo=1')}
            className="w-full py-3 border-[1.5px] border-charcoal text-charcoal rounded-[4px]"
          >
            Tanda kata yang anda tahu <span className="mono-sm text-muted">mark words you know</span>
          </button>
        </div>

        <div className="py-4">
          <Label ms="Sandaran" en="backup" color="charcoal" className="block mb-2" />
          <p className="text-muted text-sm mb-2">
            Your learning data lives in this browser. Export a backup now and then.
          </p>
          <button
            onClick={exportBackup}
            className="w-full py-3 bg-gold text-gold-ink border-[1.5px] border-charcoal rounded-[4px] font-medium"
          >
            Eksport JSON <span className="mono-sm text-gold-ink/70">download a backup</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-2 w-full py-3 border-[1.5px] border-charcoal text-charcoal rounded-[4px]"
          >
            Import JSON <span className="mono-sm text-muted">replaces all current data</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => onImport(e.target.files?.[0])}
          />
          {msg && <div className="text-sm text-muted mt-2">{msg}</div>}
        </div>
      </div>
    </div>
  )
}

function Row({
  label,
  en,
  value,
  children,
}: {
  label: string
  en: string
  value: string | number
  children: React.ReactNode
}) {
  return (
    <div className="py-4">
      <div className="flex items-baseline justify-between">
        <Label ms={label} en={en} color="charcoal" />
        <span className="display text-lg text-charcoal">{value}</span>
      </div>
      {children}
    </div>
  )
}
