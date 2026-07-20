/**
 * December checkpoint (pedagogy-response §4.2): the relocation-recon trip is
 * the app's built-in exam. A list and a date — no gamification. The owner
 * marks the function checklist in Penang.
 */
export const CHECKPOINT = {
  date: '2026-12-01',
  label: '1 Disember 2026 — Pulau Pinang',
  /** Owner-adjustable volume target (suggested 400–500 ≈ 5–7 words/day × 5 days/week). */
  targetWords: 450,
  checklist: [
    { ms: 'Pesan makanan untuk keluarga', en: 'order food for the family' },
    { ms: 'Beri arah kepada pemandu Grab', en: 'direct a Grab driver' },
    { ms: 'Beri salam dan berbual di masjid', en: 'greet and small-talk at the masjid' },
    { ms: 'Beli-belah di pasar, termasuk harga', en: 'handle a market purchase incl. prices' },
    { ms: 'Faham perbualan ringkas yang terdengar', en: 'understand a simple overheard exchange' },
  ],
} as const
