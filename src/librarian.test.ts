import { describe, expect, it } from 'vitest'
import { createInitializedBank, programName, setProgramName } from './a2sysex'
import { type Banks, ChainConflictError, copyClip, dropMode, isEmptyProgram, moveProgram, pasteProgram, revertSound, sameSound } from './librarian'
import { syntheticBank } from './test-fixtures'

const EXTERNAL = 0x81
const twoCards = (destination = syntheticBank(2)): Banks => ({ source: syntheticBank(1, [EXTERNAL]), destination })
const names = (banks: Banks, side: 'source' | 'destination') => banks[side]!.programs.map(programName)

describe('moveProgram', () => {
  it('moves within the same card: target gets the preset, origin becomes INIT', () => {
    const banks = twoCards()
    const original = banks.source!.programs[3]
    const clip = copyClip(banks, { side: 'source', slot: 3 })
    const result = moveProgram(banks, clip, { side: 'source', slot: 99 })
    expect(result.source!.programs[99].raw).toEqual(original.raw)
    expect(result.source!.programs[99].slot).toBe(99)
    expect(programName(result.source!.programs[3])).toBe('INIT')
    expect(names(result, 'source').filter((n) => n === 'P1-03')).toHaveLength(1)
  })

  it('moves across cards and marks the origin as INIT', () => {
    const banks = twoCards(createInitializedBank(syntheticBank(1)))
    const clip = copyClip(banks, { side: 'source', slot: 5 })
    const result = moveProgram(banks, clip, { side: 'destination', slot: 0 })
    expect(programName(result.destination!.programs[0])).toBe('P1-05')
    expect(programName(result.source!.programs[5])).toBe('INIT')
  })

  it('does nothing when target and origin are the same slot', () => {
    const banks = twoCards()
    const clip = copyClip(banks, { side: 'source', slot: 4 })
    expect(moveProgram(banks, clip, { side: 'source', slot: 4 })).toBe(banks)
  })

  it('leaves both cards untouched when blocked by a chain conflict', () => {
    const banks = twoCards()
    const clip = copyClip(banks, { side: 'source', slot: 0 })
    expect(() => moveProgram(banks, clip, { side: 'destination', slot: 0 })).toThrow(ChainConflictError)
    expect(programName(banks.source!.programs[0])).toBe('P1-00')
  })
})

describe('external chain protection', () => {
  it('blocks a preset with an external chain on a card with different chains', () => {
    const banks = twoCards()
    const clip = copyClip(banks, { side: 'source', slot: 0 })
    expect(() => pasteProgram(banks, clip, { side: 'destination', slot: 0 })).toThrow(/card chain C1/)
  })

  it('allows it on a card with identical chains', () => {
    const banks = twoCards(createInitializedBank(syntheticBank(1)))
    const clip = copyClip(banks, { side: 'source', slot: 0 })
    expect(pasteProgram(banks, clip, { side: 'destination', slot: 7 }).destination!.programs[7].raw[0]).toBe(EXTERNAL)
  })

  it('always allows internal chains', () => {
    const banks = twoCards()
    const clip = copyClip(banks, { side: 'source', slot: 1 })
    expect(programName(pasteProgram(banks, clip, { side: 'destination', slot: 0 }).destination!.programs[0])).toBe('P1-01')
  })

  it('allows external chains within the same card', () => {
    const banks = twoCards()
    const clip = copyClip(banks, { side: 'source', slot: 0 })
    expect(pasteProgram(banks, clip, { side: 'source', slot: 50 }).source!.programs[50].raw[0]).toBe(EXTERNAL)
  })
})

describe('copyClip', () => {
  it('marks cut clips, so paste can move instead of copy', () => {
    const banks = twoCards()
    expect(copyClip(banks, { side: 'destination', slot: 1 }).cut).toBe(false)
    expect(copyClip(banks, { side: 'destination', slot: 1 }, true).cut).toBe(true)
  })

  it('snapshots the preset so later edits to the card do not change it', () => {
    const banks = twoCards()
    const clip = copyClip(banks, { side: 'source', slot: 2 })
    banks.source!.programs[2].raw[9] = 0x5a
    expect(clip.program.raw[9]).not.toBe(0x5a)
  })
})

describe('isEmptyProgram', () => {
  it('treats INIT and INIT nn as empty slots', () => {
    const fresh = createInitializedBank(syntheticBank())
    expect(fresh.programs.every(isEmptyProgram)).toBe(true)
  })

  it('treats the origin of a move as empty, and real names as presets', () => {
    const banks = twoCards()
    const result = moveProgram(banks, copyClip(banks, { side: 'source', slot: 3 }), { side: 'source', slot: 99 })
    expect(isEmptyProgram(result.source!.programs[3])).toBe(true)
    expect(isEmptyProgram(result.source!.programs[99])).toBe(false)
    expect(['INITIAL', 'INIT 1', 'MY INIT'].map((name) => isEmptyProgram(setProgramName(banks.source!.programs[0], name)))).toEqual([false, false, false])
  })
})

describe('dropMode', () => {
  const src = (slot: number) => ({ side: 'source' as const, slot })
  const dst = (slot: number) => ({ side: 'destination' as const, slot })

  it('copies from source to destination, with or without Option', () => {
    expect(dropMode(src(0), dst(0), false)).toBe('copy')
    expect(dropMode(src(0), dst(5), true)).toBe('copy')
  })

  it('moves inside the destination, and copies with Option', () => {
    expect(dropMode(dst(0), dst(5), false)).toBe('move')
    expect(dropMode(dst(0), dst(5), true)).toBe('copy')
  })

  it('never drops onto the source or onto the same slot', () => {
    expect(dropMode(src(0), src(5), false)).toBeNull()
    expect(dropMode(dst(0), src(5), false)).toBeNull()
    expect(dropMode(dst(3), dst(3), true)).toBeNull()
  })
})

describe('sameSound', () => {
  it('ignores the name but not chain, variations or parameters', () => {
    const program = syntheticBank().programs[0]
    expect(sameSound(program.raw, setProgramName(program, 'OTHER').raw)).toBe(true)
    for (const index of [0, 5, 16, 63]) {
      const raw = program.raw.slice()
      raw[index] ^= 1
      expect(sameSound(program.raw, raw)).toBe(false)
    }
  })
})

describe('revertSound', () => {
  it('restores chain, effects and parameters but keeps the current name', () => {
    const original = syntheticBank().programs[0]
    const edited = setProgramName(original, 'MINE')
    edited.raw[0] = 7
    edited.raw[30] ^= 0xff
    const reverted = revertSound(edited, original.raw)
    expect(sameSound(reverted.raw, original.raw)).toBe(true)
    expect(programName(reverted)).toBe('MINE')
  })
})
