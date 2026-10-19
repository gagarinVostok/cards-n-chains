import { describe, expect, it } from 'vitest'
import { setProgramName } from './a2sysex'
import type { LoadedCard } from './cards'
import { buildPreviewIndex, computePeaks, soundKey } from './previews'
import { syntheticBank } from './test-fixtures'

const card = (file: string, seed: number): LoadedCard => ({ file, url: '', bank: syntheticBank(seed), externalChains: 0 })

describe('audio previews', () => {
  it('ignores the name when identifying a patch sound', () => {
    const program = syntheticBank().programs[0]
    expect(soundKey(setProgramName(program, 'OTHER').raw)).toBe(soundKey(program.raw))
    const edited = program.raw.slice()
    edited[20] ^= 1
    expect(soundKey(edited)).not.toBe(soundKey(program.raw))
  })

  it('indexes only the slots that have a file, by card folder and slot number', () => {
    const guit1 = card('GUIT1.SYX', 1)
    const index = buildPreviewIndex([guit1, card('NYC.SYX', 2)], { 'GUIT1/00': 'valves.m4a', 'GUIT1/42': 'other.m4a' })
    expect(index.size).toBe(2)
    expect(index.get(soundKey(guit1.bank.programs[0].raw))).toBe('valves.m4a')
    expect(index.get(soundKey(guit1.bank.programs[1].raw))).toBeUndefined()
  })
})

describe('computePeaks', () => {
  it('keeps the loudest sample of each bucket, scaled to the loudest bar', () => {
    const left = Float32Array.from([0.1, -0.5, 0.2, 0.25, 0, 0])
    const right = Float32Array.from([0, 0.1, -0.1, 0.1, 0.05, 0])
    const peaks = computePeaks([left, right], 3)
    expect(peaks).toHaveLength(3)
    ;[1, 0.5, 0.1].forEach((expected, i) => expect(peaks[i]).toBeCloseTo(expected, 5))
  })

  it('handles silence, uneven lengths and empty input', () => {
    expect(computePeaks([new Float32Array(10)], 4)).toEqual([0, 0, 0, 0])
    expect(computePeaks([Float32Array.from([1, 1, 1, 1, 1])], 2)).toHaveLength(2)
    expect(computePeaks([], 10)).toEqual([])
  })
})
