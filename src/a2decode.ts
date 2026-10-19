import { AppError } from './errors'
import { type A2Bank, type A2Program, CHAIN_RAW_BYTES, programName, unpackKorg } from './a2sysex'
import { EFFECT_GROUPS, type EffectGroup, INTERNAL_BLOCK_GROUPS, INTERNAL_CHAINS, MODULE_NAME_GROUPS, type ParamDef } from './a2effects'
import { chainLabel, isExternalChain } from './librarian'

/**
 * Decoding of a full dump for display and effect editing. Layout of the chain area (not in the
 * Korg docs, reconstructed from the factory cards): "KORG" magic, 8 effect-module
 * pointers at 0x20 (address − 0x8000 = offset), 10 chain blocks of 0x42 bytes at 0x100
 * (one 8-byte record per FX slot, first byte = block id: ≥0x80 card module, else built-in).
 */

const FX_SLOTS = 8
const MODULE_POINTERS = 0x20
const CHAIN_BLOCKS = 0x100
const CHAIN_BLOCK_BYTES = 0x42

export type CardModule = { index: number; names: string[]; labels: string[] }
/** `module` is set for effects supplied by the card; `name` is the documented effect name when known. */
export type ChainSlot = { name: string; group?: EffectGroup; module?: CardModule }
export type ChainInfo = { chain: number; label: string; slots: (ChainSlot | null)[]; programs: number[] }
/** `def` is set when the parameter is documented: it gives the valid range and the display format. */
export type EffectParam = { index: number; label: string; value: string; raw: number; def?: ParamDef }
/** `off` is bit 3 of the variation nibble (undocumented: inferred from the factory cards). */
export type EffectInfo = { fx: number; name: string; params: EffectParam[]; variation: number; variants: string[]; off: boolean }
export type ProgramInfo = { slot: number; name: string; chain: number; volume: number; threshold: number; effects: EffectInfo[] }
/** `chains`: the card chains and the internal chains its programs use; `available`: every chain a program can select. */
export type CardInfo = { modules: CardModule[]; chains: ChainInfo[]; available: ChainInfo[]; programs: ProgramInfo[] }

const text = (bytes: Uint8Array) => String.fromCharCode(...bytes)
const printable = (bytes: Uint8Array) => bytes.every((b) => b >= 0x20 && b < 0x7f)

function parseModule(area: Uint8Array, index: number): CardModule {
  const base = (area[MODULE_POINTERS + index * 2] | (area[MODULE_POINTERS + index * 2 + 1] << 8)) - 0x8000
  const header = area.slice(base + 8, base + 48)
  // A valid module starts with its 40-char parameter label line: 10 spaces, ':' and 6 columns of 5 chars.
  if (base < 0 || header.length < 40 || !printable(header) || text(header).slice(0, 11) !== '          :') return { index, names: [], labels: [] }
  const columns = text(header).slice(11)
  const labels = Array.from({ length: 6 }, (_, i) => columns.slice(i * 5, i * 5 + 5).trim())
  const names: string[] = []
  for (let offset = base + 0x49; offset + 7 <= area.length; offset += 7) {
    const chunk = area.slice(offset, offset + 7)
    if (!printable(chunk)) break
    names.push(text(chunk).trimEnd())
  }
  return { index, names, labels }
}

function moduleGroup(module: CardModule) {
  const key = MODULE_NAME_GROUPS.find(([pattern]) => pattern.test(module.names[0] ?? ''))?.[1]
  return key ? EFFECT_GROUPS[key] : undefined
}

function blockSlot(id: number, modules: CardModule[]): ChainSlot {
  if (id >= 0x80) {
    const module = modules[id - 0x80]
    if (!module?.names.length) return { name: `Card module ${id - 0x80}` }
    const group = moduleGroup(module)
    return { name: group?.name ?? module.names[0], module, group }
  }
  const group = EFFECT_GROUPS[INTERNAL_BLOCK_GROUPS[id]]
  return group ? { name: group.name, group } : { name: `Internal block ${id.toString(16).toUpperCase().padStart(2, '0')}` }
}

/** Effects of the 8 FX slots of a chain: built-in table for internal chains, chain area for external ones. */
function chainSlots(chain: number, external: (ChainSlot | null)[][]): (ChainSlot | null)[] {
  if (isExternalChain(chain)) return external[chain - 0x80] ?? Array(FX_SLOTS).fill(null)
  const groups = INTERNAL_CHAINS[chain]
  if (!groups) return Array(FX_SLOTS).fill(null)
  return groups.map((key) => (key ? { name: EFFECT_GROUPS[key].name, group: EFFECT_GROUPS[key] } : null))
}

const VARIATION_BYTE = 5
const PARAM_BYTE = 16
const OFF_BIT = 0x08

const nibble = (raw: Uint8Array, fx: number) => (raw[VARIATION_BYTE + (fx >> 1)] >> ((fx & 1) * 4)) & 0x0f

function setNibble(program: A2Program, fx: number, value: number): A2Program {
  const raw = program.raw.slice()
  const index = VARIATION_BYTE + (fx >> 1)
  const shift = (fx & 1) * 4
  raw[index] = (raw[index] & ~(0x0f << shift)) | ((value & 0x0f) << shift)
  return { ...program, raw }
}

const slotVariants = (slot: ChainSlot) => slot.module?.names.length ? slot.module.names : slot.group?.variants ?? []

function decodeEffect(program: A2Program, fx: number, slot: ChainSlot): EffectInfo {
  const bits = nibble(program.raw, fx)
  const variation = bits & 0x07
  const variants = slotVariants(slot)
  const bytes = program.raw.slice(PARAM_BYTE + fx * 6, PARAM_BYTE + 6 + fx * 6)
  const variant = variants[variation] ?? variants[0]
  const name = variant && variant !== slot.name ? `${slot.name} · ${variant}` : slot.name
  const params = [...bytes].flatMap((raw, index): EffectParam[] => {
    const def = slot.group?.params[index] ?? undefined
    const label = slot.module ? slot.module.labels[index] : def?.label
    if (!slot.group && !slot.module) return [{ index, label: `#${index + 1}`, value: `${raw}`, raw }]
    return label ? [{ index, label, value: def ? def.format(raw) : `${raw}`, raw, def }] : []
  })
  return { fx, name, params, variation, variants, off: Boolean(bits & OFF_BIT) }
}

export function setEffectOff(program: A2Program, fx: number, off: boolean): A2Program {
  const bits = nibble(program.raw, fx)
  return setNibble(program, fx, off ? bits | OFF_BIT : bits & ~OFF_BIT)
}

export function setEffectVariation(program: A2Program, fx: number, variation: number): A2Program {
  return setNibble(program, fx, (nibble(program.raw, fx) & OFF_BIT) | (variation & 0x07))
}

export function setEffectParam(program: A2Program, fx: number, index: number, value: number): A2Program {
  const raw = program.raw.slice()
  raw[PARAM_BYTE + fx * 6 + index] = value & 0xff
  return { ...program, raw }
}

/**
 * Selects another chain. Parameters are reinterpreted by the new effects, so every value
 * (and variation) is clamped into the range the new effect accepts.
 */
export function setProgramChain(program: A2Program, chain: number, info: CardInfo): A2Program {
  const target = info.available.find((c) => c.chain === chain)
  if (!target) throw new AppError('chainUnavailable', { chain: chainLabel(chain) })
  let next: A2Program = { ...program, raw: program.raw.slice() }
  next.raw[0] = chain
  target.slots.forEach((slot, fx) => {
    if (!slot) return
    const variants = slotVariants(slot)
    const bits = nibble(next.raw, fx)
    if (variants.length && (bits & 0x07) >= variants.length) next = setEffectVariation(next, fx, 0)
    slot.group?.params.forEach((def, index) => {
      if (!def) return
      const value = next.raw[PARAM_BYTE + fx * 6 + index]
      if (value < def.min || value > def.max) next = setEffectParam(next, fx, index, Math.min(def.max, Math.max(def.min, value)))
    })
  })
  return next
}

export function decodeCard(bank: A2Bank): CardInfo {
  const area = unpackKorg(bank.chainPacked, CHAIN_RAW_BYTES)
  const hasChains = text(area.slice(0, 4)) === 'KORG'
  const modules = hasChains ? Array.from({ length: 8 }, (_, i) => parseModule(area, i)) : []
  const external = hasChains
    ? Array.from({ length: 10 }, (_, k) => Array.from({ length: FX_SLOTS }, (_, fx) => {
        const id = area[CHAIN_BLOCKS + k * CHAIN_BLOCK_BYTES + 2 + fx * 8]
        return id ? blockSlot(id, modules) : null
      }))
    : []

  const programs = bank.programs.map((program): ProgramInfo => {
    const chain = program.raw[0]
    const slots = chainSlots(chain, external)
    return {
      slot: program.slot,
      name: programName(program),
      chain,
      volume: program.raw[2],
      threshold: program.raw[3],
      effects: slots.flatMap((slot, fx) => (slot ? [decodeEffect(program, fx, slot)] : [])),
    }
  })

  const chainInfo = (chain: number): ChainInfo => ({
    chain,
    label: chainLabel(chain),
    slots: chainSlots(chain, external),
    programs: programs.filter((p) => p.chain === chain).map((p) => p.slot),
  })
  const cardChains = hasChains ? Array.from({ length: 10 }, (_, k) => 0x80 + k) : []
  const available = [...Object.keys(INTERNAL_CHAINS).map(Number), ...cardChains].map(chainInfo)
  // Every external chain of the card, plus the internal chains its programs use.
  const used = new Set(programs.map((p) => p.chain))
  const unknown = [...used].filter((c) => !available.some((a) => a.chain === c)).map(chainInfo)
  const chains = [...available.filter((c) => isExternalChain(c.chain) || used.has(c.chain)), ...unknown].sort((a, b) => a.chain - b.chain)
  return { modules, chains, available, programs }
}
