import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { A2_ALL_DUMP_BYTES, CHAIN_PACKED_BYTES, PROGRAM_PACKED_BYTES, PROGRAM_RAW_BYTES, createInitializedBank, packKorg, parseA2AllDump, programName, serializeA2AllDump, setProgramName, unpackKorg } from './a2sysex'
import { syntheticBank } from './test-fixtures'

describe('Korg 8→7 bit packing', () => {
  it('puts the MSB of byte 7n+k in bit k of the mask byte', () => {
    const packed = packKorg(Uint8Array.from([0x80, 0x01, 0x82, 0, 0, 0, 0xff]))
    expect([...packed]).toEqual([0b1000101, 0x00, 0x01, 0x02, 0, 0, 0, 0x7f])
  })

  it('produces only 7-bit data', () => {
    expect(packKorg(Uint8Array.from({ length: 300 }, (_, i) => i & 0xff)).every((b) => b < 0x80)).toBe(true)
  })

  it('round-trips the documented chain and program sizes', () => {
    for (const [raw, packed] of [[8192, CHAIN_PACKED_BYTES], [PROGRAM_RAW_BYTES, PROGRAM_PACKED_BYTES]]) {
      const data = Uint8Array.from({ length: raw }, (_, i) => (i * 37) & 0xff)
      const encoded = packKorg(data)
      expect(encoded.length).toBe(packed)
      expect(unpackKorg(encoded, raw)).toEqual(data)
    }
  })
})

describe('full dump parsing', () => {
  it('round-trips a dump byte for byte', () => {
    const dump = serializeA2AllDump(syntheticBank(3))
    expect(dump.length).toBe(A2_ALL_DUMP_BYTES)
    expect(serializeA2AllDump(parseA2AllDump(dump.slice().buffer))).toEqual(dump)
  })

  it('keeps the MIDI channel from the header', () => {
    const dump = serializeA2AllDump(syntheticBank())
    dump[2] = 0x35
    const bank = parseA2AllDump(dump.buffer)
    expect(bank.channel).toBe(5)
    expect(serializeA2AllDump(bank)[2]).toBe(0x35)
  })

  it('rejects wrong sizes and headers', () => {
    expect(() => parseA2AllDump(new Uint8Array(100).buffer)).toThrow(/Unexpected size/)
    const dump = serializeA2AllDump(syntheticBank())
    dump[4] = 0x40
    expect(() => parseA2AllDump(dump.buffer)).toThrow(/header/)
  })

  it('changes only the program bytes involved in an edit', () => {
    const bank = syntheticBank()
    const before = serializeA2AllDump(bank)
    const programs = bank.programs.slice()
    programs[0] = setProgramName(programs[0], 'NEW')
    const after = serializeA2AllDump({ ...bank, programs })
    const changed = [...after].flatMap((b, i) => (b === before[i] ? [] : [i]))
    expect(changed.length).toBeGreaterThan(0)
    // Program I00 occupies the first 10 packed groups (64 bytes / 7) of the program area.
    expect(changed.every((i) => i >= 5 + CHAIN_PACKED_BYTES && i < 5 + CHAIN_PACKED_BYTES + 80)).toBe(true)
  })
})

describe('program names', () => {
  it('pads to 7 characters and replaces non-ASCII', () => {
    const program = setProgramName(syntheticBank().programs[0], 'Città')
    expect([...program.raw.slice(9, 16)]).toEqual([...'Citt?  '].map((c) => c.charCodeAt(0)))
    expect(programName(program)).toBe('Citt?')
  })

  it('truncates long names without touching other bytes', () => {
    const original = syntheticBank().programs[0]
    const renamed = setProgramName(original, 'TOOLONGNAME')
    expect(programName(renamed)).toBe('TOOLONG')
    expect([...renamed.raw.slice(0, 9), ...renamed.raw.slice(16)]).toEqual([...original.raw.slice(0, 9), ...original.raw.slice(16)])
  })
})

describe('createInitializedBank', () => {
  it('keeps the source chains and names 100 slots INIT nn', () => {
    const source = syntheticBank()
    const fresh = createInitializedBank(source)
    expect(fresh.chainPacked).toEqual(source.chainPacked)
    expect(fresh.programs.map(programName)).toEqual(Array.from({ length: 100 }, (_, i) => `INIT ${String(i).padStart(2, '0')}`))
  })
})

// Real card dumps bundled with the app (read-only).
const realDumps = fileURLToPath(new URL('../assets/cards', import.meta.url))
const syxFiles = existsSync(realDumps) ? readdirSync(realDumps).filter((f) => /\.syx$/i.test(f)) : []

describe.skipIf(syxFiles.length === 0)('real A2 card dumps', () => {
  it.each(syxFiles)('%s round-trips byte for byte', (file) => {
    const input = new Uint8Array(readFileSync(join(realDumps, file)))
    expect(serializeA2AllDump(parseA2AllDump(input.slice().buffer))).toEqual(input)
  })

  it.skipIf(!syxFiles.includes('GUIT1.SYX'))('reads the GUIT1 preset names', () => {
    const bank = parseA2AllDump(new Uint8Array(readFileSync(join(realDumps, 'GUIT1.SYX'))).buffer)
    expect(bank.programs.slice(0, 3).map(programName)).toEqual(['VALVES1', 'VALVES2', 'PROCESD'])
    expect(bank.programs[0].raw[0]).toBe(0x81)
  })
})
