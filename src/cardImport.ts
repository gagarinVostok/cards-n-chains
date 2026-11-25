import { A2_ALL_DUMP_BYTES, parseA2AllDump } from './a2sysex'

/**
 * Recognises the card dumps of "Korg A2 Complete files" (korgaseries.info) by file name and
 * gives them the names the library expects. Keep in sync with scripts/import-cards.mjs.
 */
const CARD_FILES: [string, RegExp][] = [
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

/** Library name for an imported file: the known card name, or the file's own name in upper case. */
export function libraryFileName(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() ?? fileName
  const known = CARD_FILES.find(([, pattern]) => pattern.test(base))?.[0]
  return known ?? base.replace(/\.syx$/i, '').replace(/[^\w.-]+/g, '_').toUpperCase() + '.SYX'
}

export type ImportedCard = { file: string; bytes: Uint8Array }
export type ImportResult = { cards: ImportedCard[]; skipped: string[] }

/** Keeps the files that are full A2 dumps (the only format the library reads), one per library name. */
export function selectCardFiles(files: { name: string; bytes: Uint8Array }[]): ImportResult {
  const cards = new Map<string, ImportedCard>()
  const skipped: string[] = []
  for (const { name, bytes } of files) {
    if (!/\.syx$/i.test(name) || bytes.length !== A2_ALL_DUMP_BYTES) {
      skipped.push(name)
      continue
    }
    try {
      parseA2AllDump(bytes.slice().buffer)
    } catch {
      skipped.push(name)
      continue
    }
    const file = libraryFileName(name)
    if (!cards.has(file)) cards.set(file, { file, bytes })
  }
  return { cards: [...cards.values()], skipped }
}
