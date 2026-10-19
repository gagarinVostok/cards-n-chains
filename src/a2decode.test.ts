import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { decodeCard, setEffectOff, setEffectParam, setEffectVariation, setProgramChain } from './a2decode'
import { parseA2AllDump } from './a2sysex'
import { chainLabel } from './librarian'
import { syntheticBank } from './test-fixtures'

// Real card dumps are not in the repository (see assets/cards/README.md): these tests run only where they were imported.
const cardPath = (file: string) => fileURLToPath(new URL(`../assets/cards/${file}`, import.meta.url))
const hasCard = (file: string) => existsSync(cardPath(file))
/** Falls back to a synthetic bank so the (skipped) suites can still be collected without the dumps. */
const loadBank = (file: string) => (hasCard(file) ? parseA2AllDump(new Uint8Array(readFileSync(cardPath(file))).buffer) : syntheticBank())
const card = (file: string) => decodeCard(loadBank(file))

describe('chainLabel', () => {
  it('shows internal chains as decimal numbers and card chains as C0–C9', () => {
    expect([0x01, 0x10, 0x34, 0x80, 0x89].map(chainLabel)).toEqual(['01', '16', '52', 'C0', 'C9'])
  })
})

describe.skipIf(!hasCard('GUIT1.SYX'))('decodeCard (real GUIT1 dump)', () => {
  const guit1 = card('GUIT1.SYX')

  it('reads the card effect modules from the chain area', () => {
    expect(guit1.modules[0].names).toEqual(['eXCITer'])
    expect(guit1.modules[1]).toMatchObject({ names: ['H DiST', 'Tube|OD'], labels: ['DRIV', 'LEVL', 'BASS', 'M-Fc', 'MID', 'TRBL'] })
  })

  it('lists the 10 card chains with their effects', () => {
    const c1 = guit1.chains.find((c) => c.label === 'C1')!
    expect(c1.slots.map((s) => s?.name ?? null)).toEqual(['Hard Distortion', 'Exciter', null, null, 'Delay', 'Modulation', 'Reverb', null])
    expect(c1.slots[0]?.module?.names).toEqual(['H DiST', 'Tube|OD'])
    expect(c1.programs).toContain(0)
    expect(guit1.chains.filter((c) => c.chain >= 0x80)).toHaveLength(10)
  })

  it('decodes program effects with documented units', () => {
    const valves = guit1.programs[0]
    expect(valves).toMatchObject({ name: 'VALVES1', chain: 0x81 })
    expect(valves.effects.map((e) => e.fx)).toEqual([0, 1, 4, 5, 6])
    const reverb = valves.effects.find((e) => e.name.startsWith('Reverb'))!
    expect(reverb.params.map((p) => p.label)).toEqual(['RevT', 'DAMP', 'PreD', 'L.EQ', 'H.EQ', 'EBAL'])
    expect(reverb.params[0].value).toMatch(/^\d\.\d s$/)
  })

  it.skipIf(!hasCard('INTERN.SYX'))('uses the built-in chain table for internal chains', () => {
    const intern = card('INTERN.SYX')
    expect(intern.modules).toEqual([])
    const chain1 = intern.chains.find((c) => c.chain === 1)
    if (chain1) expect(chain1.slots.map((s) => s?.name ?? null)).toEqual(['Compressor', 'Distortion', null, null, 'Exciter', 'Delay', 'Modulation', 'Reverb'])
    expect(intern.programs.every((p) => p.effects.length > 0)).toBe(true)
  })
})

describe.skipIf(!hasCard('GUIT1.SYX'))('effect editing (real GUIT1 dump)', () => {
  const bank = loadBank('GUIT1.SYX')
  const info = decodeCard(bank)
  const valves = bank.programs[0]
  const effect = (program: typeof valves, fx: number) => decodeCard({ ...bank, programs: bank.programs.map((p) => (p.slot === 0 ? program : p)) }).programs[0].effects.find((e) => e.fx === fx)!

  it('lists every internal chain and the card chains as selectable', () => {
    expect(info.available.map((c) => c.label)).toEqual([...Array.from({ length: 97 }, (_, i) => String(i + 1).padStart(2, '0')), ...Array.from({ length: 10 }, (_, k) => `C${k}`)])
  })

  it('turns an effect off and on through bit 3 of its variation nibble', () => {
    const off = setEffectOff(valves, 6, true)
    expect(effect(off, 6).off).toBe(true)
    expect(effect(off, 6).variation).toBe(effect(valves, 6).variation)
    expect(setEffectOff(off, 6, false).raw).toEqual(valves.raw)
  })

  it('changes the variation without touching the other slot in the same byte', () => {
    const changed = setEffectVariation(valves, 6, 4)
    expect(effect(changed, 6).name).toBe('Reverb · PL1')
    expect(effect(changed, 7)).toBeUndefined()
    expect(changed.raw[8] >> 4).toBe(valves.raw[8] >> 4)
  })

  it('writes a parameter byte', () => {
    const changed = setEffectParam(valves, 6, 0, 25)
    expect(effect(changed, 6).params[0].value).toBe('2.5 s')
  })

  it('clamps values into the new effects ranges when the chain changes', () => {
    const changed = setProgramChain(valves, 1, info)
    expect(changed.raw[0]).toBe(1)
    const decoded = decodeCard({ ...bank, programs: bank.programs.map((p) => (p.slot === 0 ? changed : p)) }).programs[0]
    for (const e of decoded.effects) for (const p of e.params) if (p.def) expect(p.raw).toBeGreaterThanOrEqual(p.def.min), expect(p.raw).toBeLessThanOrEqual(p.def.max)
    expect(() => setProgramChain(valves, 99, info)).toThrow(/not available/)
  })
})
