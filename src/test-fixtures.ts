import { type A2Bank, CHAIN_RAW_BYTES, PROGRAM_BYTES, PROGRAMS, packKorg, parseA2AllDump, serializeA2AllDump, setProgramName } from './a2sysex'

/** Deterministic pseudo-random bytes, so fixtures exercise every bit (including MSBs). */
function bytes(length: number, seed: number) {
  let state = seed
  return Uint8Array.from({ length }, () => (state = (state * 1103515245 + 12345) & 0x7fffffff) >> 16 & 0xff)
}

/** Builds a synthetic full dump: `chains` lists each slot's chain byte (default: internal 0x01). */
export function syntheticBank(seed = 1, chains: number[] = []): A2Bank {
  const chainPacked = packKorg(bytes(CHAIN_RAW_BYTES, seed))
  const programs = Array.from({ length: PROGRAMS }, (_, slot) => {
    const raw = bytes(PROGRAM_BYTES, seed * 1000 + slot)
    raw[0] = chains[slot] ?? 0x01
    return setProgramName({ slot, raw }, `P${seed}-${String(slot).padStart(2, '0')}`)
  })
  const bank = { bytes: new Uint8Array(), channel: 0, chainPacked, programs }
  const dump = serializeA2AllDump(bank)
  return parseA2AllDump(dump.buffer)
}
