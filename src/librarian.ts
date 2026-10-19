import { AppError } from './errors'
import { type A2Bank, type A2Program, programName, setProgramName } from './a2sysex'

export type Side = 'source' | 'destination'
export type Banks = Record<Side, A2Bank | null>
export type SlotRef = { side: Side; slot: number }
/**
 * Snapshot of a copied preset, with the chain area of the card it came from.
 * A cut clip is pasted as a move: the origin slot is emptied only at paste time.
 */
export type Clip = { from: SlotRef; program: A2Program; chainPacked: Uint8Array; cut?: boolean }

export class ChainConflictError extends AppError<'chainConflict'> {}

export const slotNumber = (slot: number) => String(slot).padStart(2, '0')
/**
 * Chain byte: internal chains 1–97 are stored as plain numbers (0x10 = chain 16), card chains as
 * 0x80–0x89. Card chains are labelled C0–C9 so they cannot be mistaken for internal chains 80–89.
 */
export const chainLabel = (chain: number) => (chain >= 0x80 ? `C${chain - 0x80}` : String(chain).padStart(2, '0'))
export const isExternalChain = (chain: number) => chain >= 0x80

/**
 * The A2 has no "empty" preset: empty slots hold a valid template named INIT / INIT nn
 * (new card, Inizializza slot, origin of Sposta). No factory card uses these names.
 */
export const isEmptyProgram = (program: A2Program) => /^INIT( \d{2})?$/.test(programName(program))

const NAME_BYTES = [9, 16]

/** True when two programs sound the same: every byte matches except the 7-char name. */
export function sameSound(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, i) => byte === b[i] || (i >= NAME_BYTES[0] && i < NAME_BYTES[1]))
}

/** Restores the sound of `original` (chain, effects, parameters) while keeping the current name. */
export function revertSound(current: A2Program, original: Uint8Array): A2Program {
  const raw = original.slice()
  raw.set(current.raw.slice(NAME_BYTES[0], NAME_BYTES[1]), NAME_BYTES[0])
  return { ...current, raw }
}

export function sameChainArea(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

export function copyClip(banks: Banks, from: SlotRef, cut = false): Clip {
  const bank = banks[from.side]
  if (!bank) throw new AppError('noCard')
  const program = bank.programs[from.slot]
  return { from, program: { ...program, raw: program.raw.slice() }, chainPacked: bank.chainPacked, cut }
}

/**
 * External chains (80–89) live in the card's chain area, so a preset using one is only safe
 * on a card with an identical chain area. Internal chains (01–63) are built into the A2.
 */
export function assertChainCompatible(clip: Clip, target: A2Bank) {
  const chain = clip.program.raw[0]
  if (!isExternalChain(chain) || sameChainArea(clip.chainPacked, target.chainPacked)) return
  throw new ChainConflictError('chainConflict', { name: programName(clip.program), from: clip.from, chain: chainLabel(chain) })
}

export function replaceProgram(bank: A2Bank, slot: number, program: A2Program): A2Bank {
  const programs = bank.programs.slice()
  programs[slot] = { ...program, slot }
  return { ...bank, programs }
}

export function pasteProgram(banks: Banks, clip: Clip, to: SlotRef): Banks {
  const target = banks[to.side]
  if (!target) throw new AppError('noCard')
  assertChainCompatible(clip, target)
  return { ...banks, [to.side]: replaceProgram(target, to.slot, clip.program) }
}

export type DropMode = 'copy' | 'move'

/**
 * Drag and drop rules: source → destination copies; inside the destination it moves,
 * or copies with Option/Alt held. The source card is never a drop target.
 */
export function dropMode(from: SlotRef, to: SlotRef, alt: boolean): DropMode | null {
  if (to.side !== 'destination') return null
  if (from.side === 'source') return 'copy'
  if (from.slot === to.slot) return null
  return alt ? 'copy' : 'move'
}

/** Pastes the clip into `to`, then marks the origin slot as INIT (on either card). */
export function moveProgram(banks: Banks, clip: Clip, to: SlotRef): Banks {
  if (clip.from.side === to.side && clip.from.slot === to.slot) return banks
  const pasted = pasteProgram(banks, clip, to)
  const origin = pasted[clip.from.side]
  if (!origin) throw new AppError('originClosed')
  const cleared = setProgramName(origin.programs[clip.from.slot], 'INIT')
  return { ...pasted, [clip.from.side]: replaceProgram(origin, clip.from.slot, cleared) }
}
