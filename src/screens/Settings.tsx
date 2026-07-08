import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSettings, saveSettings } from '../db/db'
import type { Settings as SettingsT } from '../db/types'
import { exportBackup, importBackup } from '../lib/backup'

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
      setMsg('Import selesai ✓ — all data replaced.')
      setS(await getSettings())
    } catch {
      setMsg('Import failed — not a valid Bukit backup file.')
    }
  }

  if (!s) return null

  return (
    <div className="max-w-md mx-auto px-5 pt-8 pb-28 fade-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-extrabold text-3xl tracking-tight">Tetapan</h1>
          <div className="text-xs text-ink/40">settings</div>
        </div>
        <button onClick={() => navigate(-1)} className="text-ink/50 text-sm">
          tutup ✕ <span className="text-ink/35">close</span>
        </button>
      </header>

      <section className="mt-6 panel p-5 space-y-5">
        <div>
          <label className="font-medium">
            Kata baru sehari — {s.newWordsPerDay}
            <span className="block text-xs font-normal text-ink/40">new words per day</span>
          </label>
          <input
            type="range"
            min={3}
            max={10}
            value={s.newWordsPerDay}
            onChange={(e) => patch({ newWordsPerDay: Number(e.target.value) })}
            className="w-full mt-2 accent-mansion"
          />
          <div className="text-xs text-ink/50">
            The daily quota is shared between scheduled and harvested words; overflow queues for
            tomorrow.
          </div>
        </div>

        <div>
          <label className="font-medium">
            Rentak mingguan — {s.weeklyTargetDays} hari
            <span className="block text-xs font-normal text-ink/40">
              weekly rhythm target (days per week)
            </span>
          </label>
          <input
            type="range"
            min={3}
            max={7}
            value={s.weeklyTargetDays}
            onChange={(e) => patch({ weeklyTargetDays: Number(e.target.value) })}
            className="w-full mt-2 accent-shutter"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="font-medium">
            Register bacaan
            <span className="block text-xs font-normal text-ink/40">
              reading register — standard vs everyday Malay
            </span>
          </label>
          <div className="flex rounded-full border border-ink/15 overflow-hidden text-xs font-mono">
            {(['baku', 'colloquial'] as const).map((r) => (
              <button
                key={r}
                onClick={() => patch({ registerPreference: r })}
                className={`px-3 py-1.5 ${
                  s.registerPreference === r ? 'bg-mansion text-limewash' : 'text-ink/60'
                }`}
              >
                {r === 'baku' ? 'BAKU' : 'COLLOQ'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="font-medium">
            Audio (TTS)
            <span className="block text-xs font-normal text-ink/40">spoken pronunciation</span>
          </label>
          <button
            onClick={() => patch({ ttsEnabled: !s.ttsEnabled })}
            className={`w-12 h-7 rounded-full transition-colors relative ${
              s.ttsEnabled ? 'bg-shutter' : 'bg-ink/15'
            }`}
            aria-pressed={s.ttsEnabled}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${
                s.ttsEnabled ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div>
          <label className="font-medium">
            Konteks anda
            <span className="block text-xs font-normal text-ink/40">about you</span>
          </label>
          <textarea
            value={s.userContext}
            onChange={(e) => setS({ ...s, userContext: e.target.value })}
            onBlur={() => patch({ userContext: s.userContext })}
            rows={3}
            className="mt-2 w-full rounded-xl border border-ink/15 p-3 text-sm"
          />
          <div className="text-xs text-ink/50">
            Used to personalise the topics of your generated reading.
          </div>
        </div>
      </section>

      <section className="mt-4 panel p-5 space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
          penilaian semula · reassess
        </div>
        <div className="text-xs text-ink/50">
          Know more Malay than your reviews suggest? Re-run the know / don&rsquo;t-know pass over
          the words still in the backlog.
        </div>
        <button
          onClick={() => navigate('/onboarding?redo=1')}
          className="w-full py-3 rounded-xl border border-ink/20 text-ink/70 font-medium"
        >
          Tanda kata yang anda tahu
          <span className="block text-xs font-normal text-ink/40">mark words you know</span>
        </button>
      </section>

      <section className="mt-4 panel p-5 space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-widest text-ink/40">
          sandaran · backup
        </div>
        <div className="text-xs text-ink/50">
          Your learning data lives in this browser. Export a backup file now and then.
        </div>
        <button
          onClick={exportBackup}
          className="w-full py-3 rounded-xl bg-mansion text-limewash font-medium"
        >
          Eksport JSON
          <span className="block text-xs font-normal text-limewash/70">download a backup</span>
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-3 rounded-xl border border-ink/15 text-ink/70 font-medium"
        >
          Import JSON
          <span className="block text-xs font-normal text-ink/40">
            restore a backup — replaces all current data
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => onImport(e.target.files?.[0])}
        />
        {msg && <div className="text-sm text-ink/70">{msg}</div>}
      </section>
    </div>
  )
}
