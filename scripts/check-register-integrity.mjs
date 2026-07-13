#!/usr/bin/env node
/**
 * R7 data sweep: a chip is a promise. Chips render iff the underlying field is
 * non-empty, so the data must never contain a value that is chip-truthy but
 * content-empty (whitespace), a duplicate example, or a mislabelled register.
 * Exits non-zero on findings so it can gate CI or a pre-commit run.
 */
import { readFileSync } from 'node:fs'

const seed = JSON.parse(readFileSync('src/data/seed.json', 'utf8'))
const problems = []

// Strong northern markers — presence in example_colloq without the utara label
// means the sentence is mislabelled (Q2 ruling: honest labels).
const UTARA_MARKERS =
  /\b(hang|depa|cek|mai|awat|habaq)\b|\bpi\b(?!\w)|\b\w+aq\b|\bbetui\b/i

seed.forEach((w, i) => {
  const at = `#${i} ${w.baku}`
  for (const field of ['colloquial', 'utara', 'example_colloq', 'example_en', 'example_colloq_en']) {
    if (field in w && typeof w[field] === 'string' && w[field].trim() === '') {
      problems.push(`${at}: ${field} is empty/whitespace — chip-truthy but contentless`)
    }
  }
  if (!w.example_baku?.trim()) problems.push(`${at}: missing example_baku`)
  if (!w.example_en?.trim()) problems.push(`${at}: missing example_en gloss (R2)`)
  if (w.example_colloq && w.example_colloq === w.example_baku) {
    problems.push(`${at}: example_colloq duplicates example_baku — render once instead (R1)`)
  }
  if (w.example_colloq && UTARA_MARKERS.test(w.example_colloq) && w.example_colloq_kind !== 'utara') {
    problems.push(`${at}: example_colloq looks utara ("${w.example_colloq}") but not labelled utara`)
  }
  if (w.example_colloq_kind && !w.example_colloq) {
    problems.push(`${at}: example_colloq_kind set with no example_colloq`)
  }
})

if (problems.length) {
  console.error(`${problems.length} register-integrity problems:`)
  for (const p of problems) console.error('  ' + p)
  process.exit(1)
}
console.log(`OK — ${seed.length} rows, zero chip/field mismatches.`)
