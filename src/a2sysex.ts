import { AppError } from './errors'

export const A2_HEADER = [0xf0, 0x42] as const
export const A2_MODEL = 0x2d
export const ALL_DUMP = 0x4c
export const PROGRAM_BYTES = 64
export const PROGRAMS = 100
export const CHAIN_RAW_BYTES = 8192
export const CHAIN_PACKED_BYTES = 9363
export const PROGRAM_RAW_BYTES = PROGRAMS * PROGRAM_BYTES
export const PROGRAM_PACKED_BYTES = 7315
export const A2_ALL_DUMP_BYTES = 5 + CHAIN_PACKED_BYTES + PROGRAM_PACKED_BYTES + 1

export type A2Program = { raw: Uint8Array; slot: number }
export type A2Bank = { bytes: Uint8Array; channel: number; chainPacked: Uint8Array; programs: A2Program[] }

function encodeAscii(name: string) {
  const clean = name.replace(/[^\x20-\x7e]/g, '?').slice(0, 7).padEnd(7, ' ')
  return Uint8Array.from([...clean].map((char) => char.charCodeAt(0)))
}

export function programName(program: A2Program) {
  return String.fromCharCode(...program.raw.slice(9, 16)).trimEnd()
}

export function setProgramName(program: A2Program, name: string): A2Program {
  const raw = program.raw.slice()
  raw.set(encodeAscii(name), 9)
  return { ...program, raw }
}

/** Korg 8-bit to MIDI-safe 7-bit encoding: mask bit n is source-byte n's MSB. */
export function unpackKorg(source: Uint8Array, outputLength: number) {
  const output = new Uint8Array(outputLength)
  let read = 0
  let write = 0
  while (write < outputLength) {
    const mask = source[read++]
    for (let bit = 0; bit < 7 && write < outputLength; bit += 1) {
      output[write++] = source[read++] | (((mask >> bit) & 1) << 7)
    }
  }
  return output
}

export function packKorg(source: Uint8Array) {
  const output: number[] = []
  for (let start = 0; start < source.length; start += 7) {
    let mask = 0
    const group = source.slice(start, start + 7)
    group.forEach((byte, bit) => { mask |= ((byte >> 7) & 1) << bit })
    output.push(mask, ...group.map((byte) => byte & 0x7f))
  }
  return Uint8Array.from(output)
}

export function parseA2AllDump(input: ArrayBuffer): A2Bank {
  const bytes = new Uint8Array(input)
  if (bytes.length !== A2_ALL_DUMP_BYTES) throw new AppError('badSize', { size: bytes.length, expected: A2_ALL_DUMP_BYTES })
  if (bytes[0] !== 0xf0 || bytes[1] !== 0x42 || bytes[3] !== A2_MODEL || bytes[4] !== ALL_DUMP || bytes.at(-1) !== 0xf7) {
    throw new AppError('badHeader')
  }
  const packed = bytes.slice(5, -1)
  const raw = unpackKorg(packed.slice(CHAIN_PACKED_BYTES), PROGRAM_RAW_BYTES)
  return {
    bytes,
    channel: bytes[2] & 0x0f,
    chainPacked: packed.slice(0, CHAIN_PACKED_BYTES),
    programs: Array.from({ length: PROGRAMS }, (_, slot) => ({ slot, raw: raw.slice(slot * PROGRAM_BYTES, (slot + 1) * PROGRAM_BYTES) })),
  }
}

export function serializeA2AllDump(bank: A2Bank) {
  const rawPrograms = new Uint8Array(PROGRAM_RAW_BYTES)
  bank.programs.forEach((program, slot) => rawPrograms.set(program.raw, slot * PROGRAM_BYTES))
  const packedPrograms = packKorg(rawPrograms)
  const output = new Uint8Array(A2_ALL_DUMP_BYTES)
  output.set([0xf0, 0x42, 0x30 | bank.channel, A2_MODEL, ALL_DUMP])
  output.set(bank.chainPacked, 5)
  output.set(packedPrograms, 5 + CHAIN_PACKED_BYTES)
  output[output.length - 1] = 0xf7
  return output
}

/** Creates a structurally valid working card using source chains and a known-good preset template. */
export function createInitializedBank(source: A2Bank, templateSlot = 0): A2Bank {
  const template = source.programs[templateSlot]?.raw
  if (!template) throw new AppError('noTemplate')
  return {
    ...source,
    bytes: source.bytes.slice(),
    chainPacked: source.chainPacked.slice(),
    programs: Array.from({ length: PROGRAMS }, (_, slot) => ({
      slot,
      raw: setProgramName({ slot, raw: template.slice() }, `INIT ${String(slot).padStart(2, '0')}`).raw,
    })),
  }
}
