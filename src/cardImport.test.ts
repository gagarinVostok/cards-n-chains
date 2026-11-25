import { describe, expect, it } from 'vitest'
import { serializeA2AllDump } from './a2sysex'
import { libraryFileName, selectCardFiles } from './cardImport'
import { syntheticBank } from './test-fixtures'

const dump = () => serializeA2AllDump(syntheticBank())

describe('libraryFileName', () => {
  it('maps the korgaseries.info collection to the library names', () => {
    expect(libraryFileName('1 -Guitar SPC01.syx')).toBe('GUIT1.SYX')
    expect(libraryFileName('Korg_A2_Complete_files/2-Studio SPC02.syx')).toBe('STUDIO.SYX')
    expect(libraryFileName('15 -Noi5e Maker Patches 260604.syx')).toBe('NOI5E.SYX')
    expect(libraryFileName('12- Korg A2 Natural Chains.syx')).toBe('NATURALCHAINS.SYX')
    expect(libraryFileName('guit2.syx')).toBe('GUIT2.SYX')
  })

  it('keeps unknown dumps under their own (sanitised) name', () => {
    expect(libraryFileName('My live set.syx')).toBe('MY_LIVE_SET.SYX')
  })
})

describe('selectCardFiles', () => {
  it('keeps full A2 dumps and skips everything else', () => {
    const result = selectCardFiles([
      { name: '1 -Guitar SPC01.syx', bytes: dump() },
      { name: 'notes.txt', bytes: dump() },
      { name: 'short.syx', bytes: new Uint8Array(100) },
      { name: 'broken.syx', bytes: dump().fill(0) },
    ])
    expect(result.cards.map((c) => c.file)).toEqual(['GUIT1.SYX'])
    expect(result.skipped).toEqual(['notes.txt', 'short.syx', 'broken.syx'])
  })

  it('imports a card once even if it appears twice', () => {
    expect(selectCardFiles([{ name: 'GUIT1.SYX', bytes: dump() }, { name: '1 -Guitar SPC01.syx', bytes: dump() }]).cards).toHaveLength(1)
  })
})
