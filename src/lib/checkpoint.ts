/**
 * December checkpoint (pedagogy response §4.2) — the relocation-recon trip is
 * the app's built-in exam. A static definition, shown on Kemajuan: a list and
 * a date, no gamification. The owner marks the self-test in Penang.
 */

export interface ChecklistItem {
  id: string
  ms: string
  en: string
}

export const CHECKPOINT = {
  /** 1 December 2026 — the recon trip. */
  date: '2026-12-01',
  labelMs: 'Pulau Pinang, Disember',
  labelEn: 'the December trip',
  /** Studied-word volume target by the date (owner-set, 10 Jul 2026). */
  targetWords: 450,
  /** Weekly-rhythm trend window shown alongside (trailing weeks). */
  rhythmWeeks: 12,
  /** Function self-test: checklist rendered in-app, self-marked. */
  checklist: [
    { id: 'food', ms: 'Pesan makanan untuk keluarga', en: 'order food for the family' },
    { id: 'grab', ms: 'Tunjuk jalan kepada pemandu Grab', en: 'direct a Grab driver' },
    { id: 'masjid', ms: 'Beri salam dan berbual di masjid', en: 'greet and small-talk at the masjid' },
    { id: 'market', ms: 'Beli barang di pasar — termasuk harga', en: 'a market purchase, prices included' },
    { id: 'listen', ms: 'Faham perbualan ringkas yang didengar', en: 'understand a simple overheard exchange' },
  ] as ChecklistItem[],
}

export function daysUntilCheckpoint(now = new Date()): number {
  const target = new Date(`${CHECKPOINT.date}T00:00:00`)
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / 86_400_000))
}
