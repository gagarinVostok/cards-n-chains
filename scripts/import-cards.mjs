#!/usr/bin/env node
/**
 * Copies Korg A2 card dumps into assets/cards/ with the file names the app expects.
 * The dumps are not in the repository: download "Korg A2 Complete files" from
 * https://korgaseries.info, extract it, then run:
 *
 *   npm run import-cards -- "/path/to/Korg_A2_Complete_files"
 *
 * Files are recognised by their name (see CARDS below); every file must be a full A2
 * dump (16,684 bytes, header F0 42 3n 2D 4C). Existing files are not overwritten.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CARDS = [
  ['GUIT1.SYX', /guitar\s*spc0?1|^guit1\.syx$/i],
  ['STUDIO.SYX', /studio\s*spc0?2|^studio\.syx$/i],
  ['GPURP.SYX', /gen\s*purpose|^gpurp\.syx$/i],
  ['GUIT2.SYX', /guitar\s*spc0?4|^guit2\.syx$/i],
  ['KEYBD.SYX', /keyboard\s*spc0?5|^keybd\.syx$/i],
  ['NYC.SYX', /nyc\s*spc0?6|^nyc\.syx$/i],
  ['NASHVI.SYX', /nashville|^nashvi\.syx$/i],
  ['SHOWE.SYX', /steve\s*howe\s*spc|^showe\.syx$/i],
  ['EASTON.SYX', /easton\s*spc|^easton\.syx$/i],
  ['GHERO.SYX', /guitar\s*heroes|^ghero\.syx$/i],
  ['INTERN.SYX', /^intern\.syx$/i],
  ['ORIGA3.SYX', /korga3patches|^origa3\.syx$/i],
  ['DISTORCHAINS.SYX', /distor\s*chain/i],
  ['NATURALCHAINS.SYX', /natural\s*chains/i],
  ['A3PATCHBOOK.SYX', /a3\s*patchbook\s*for\s*a2|^a3patchbook\.syx$/i],
  ['NOI5E.SYX', /noi5e\s*maker\s*patches|^noi5e\.syx$/i],
  ['STOREDEMO.SYX', /music\s*store\s*demo\s*for\s*a2|^storedemo\.syx$/i],
]
const DUMP_BYTES = 16684

const source = process.argv[2]
if (!source || !existsSync(source)) {
  console.error('Usage: npm run import-cards -- <folder with the .syx dumps>')
  process.exit(1)
}
const target = fileURLToPath(new URL('../assets/cards/', import.meta.url))
mkdirSync(target, { recursive: true })

const isA2Dump = (b) => b.length === DUMP_BYTES && b[0] === 0xf0 && b[1] === 0x42 && (b[2] & 0xf0) === 0x30 && b[3] === 0x2d && b[4] === 0x4c && b.at(-1) === 0xf7

let imported = 0
for (const file of readdirSync(source).filter((f) => /\.syx$/i.test(f))) {
  const match = CARDS.find(([, pattern]) => pattern.test(basename(file)))
  if (!match) { console.log(`  skip   ${file} (not a known card)`); continue }
  const [name] = match
  const bytes = readFileSync(join(source, file))
  if (!isA2Dump(bytes)) { console.log(`  skip   ${file} (not a full A2 dump)`); continue }
  const out = join(target, name)
  if (existsSync(out)) { console.log(`  exists ${name}`); continue }
  writeFileSync(out, bytes)
  chmodSync(out, 0o444) // the library treats the original cards as read-only
  console.log(`  added  ${name}  ←  ${file}`)
  imported += 1
}
console.log(`\n${imported} card(s) imported into assets/cards/.`)
