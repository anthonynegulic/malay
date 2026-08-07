#!/usr/bin/env node
// Generates docs/WORD-LIST.md from src/data/seed.json.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const seedPath = join(__dirname, '..', 'src', 'data', 'seed.json')
const outPath = join(__dirname, '..', 'docs', 'WORD-LIST.md')

const words = JSON.parse(readFileSync(seedPath, 'utf8'))

const esc = (s) => (s ?? '').replace(/\|/g, '\\|')

const tagCounts = new Map()
const posCounts = new Map()
for (const w of words) {
  for (const t of w.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  posCounts.set(w.pos, (posCounts.get(w.pos) ?? 0) + 1)
}

const sorted = [...words].sort((a, b) => a.baku.localeCompare(b.baku, 'ms'))

const lines = []
lines.push('# Malay Word List')
lines.push('')
lines.push(`Generated from \`src/data/seed.json\`. **${words.length} words.**`)
lines.push('')
lines.push('Columns: **Baku** (standard/formal register), **Colloquial** (everyday spoken), **Utara** (northern/Penang dialect), **POS** (part of speech), **Tags**, **Gloss** (English).')
lines.push('')

lines.push('## By tag')
lines.push('')
lines.push('| Tag | Count |')
lines.push('| --- | ---: |')
for (const [tag, count] of [...tagCounts.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${tag} | ${count} |`)
}
lines.push('')

lines.push('## By part of speech')
lines.push('')
lines.push('| POS | Count |')
lines.push('| --- | ---: |')
for (const [pos, count] of [...posCounts.entries()].sort((a, b) => b[1] - a[1])) {
  lines.push(`| ${pos} | ${count} |`)
}
lines.push('')

lines.push('## Full list (alphabetical by baku)')
lines.push('')
lines.push('| # | Baku | Colloquial | Utara | POS | Tags | Arabic | Gloss (EN) |')
lines.push('| ---: | --- | --- | --- | --- | --- | --- | --- |')
sorted.forEach((w, i) => {
  lines.push(
    `| ${i + 1} | ${esc(w.baku)} | ${esc(w.colloquial)} | ${esc(w.utara)} | ${w.pos} | ${w.tags.join(', ')} | ${esc(w.arabic_cognate)} | ${esc(w.gloss_en)} |`,
  )
})
lines.push('')

writeFileSync(outPath, lines.join('\n'), 'utf8')
console.log(`Wrote ${outPath} (${words.length} words)`)
