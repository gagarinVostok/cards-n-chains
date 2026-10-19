import { AppError } from './errors'
import { type A2Bank, parseA2AllDump } from './a2sysex'
import { isExternalChain } from './librarian'

/** Read-only card dumps bundled with the app (assets/cards). */
const urls = import.meta.glob('/assets/cards/*.SYX', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export type CardGroup = 'A3' | 'A2' | 'custom' | 'chains'
export const CARD_GROUPS: { id: CardGroup; label: string }[] = [
  { id: 'A3', label: 'A3' },
  { id: 'A2', label: 'A2' },
  { id: 'custom', label: 'Custom' },
  { id: 'chains', label: 'Chains only' },
]

/**
 * Full name of each bundled card and, for original Korg cards, its code and label colour
 * (from photos of the SPC cards). `groups`: the unit printed on the Korg label (SPC-01…05
 * say "A3", SPC-06…09 "A2/A3"); non-Korg cards are "custom"; chain
 * demonstration dumps (one program per chain) are "chains".
 */
const CARD_INFO: Record<string, { name: string; groups: CardGroup[]; code?: string; color?: string }> = {
  'GUIT1.SYX': { name: 'Guitar I', groups: ['A3'], code: 'SPC-01', color: '#e8402e' },
  'STUDIO.SYX': { name: 'Studio', groups: ['A3'], code: 'SPC-02', color: '#f2b51c' },
  'GPURP.SYX': { name: 'General Purpose', groups: ['A3'], code: 'SPC-03', color: '#7cc242' },
  'GUIT2.SYX': { name: 'Guitar II', groups: ['A3'], code: 'SPC-04', color: '#1fae8c' },
  'KEYBD.SYX': { name: 'Keyboard', groups: ['A3'], code: 'SPC-05', color: '#2f6fe0' },
  'NYC.SYX': { name: 'New York City', groups: ['A2', 'A3'], code: 'SPC-06', color: '#8fc3d6' },
  'NASHVI.SYX': { name: 'Nashville', groups: ['A2', 'A3'], code: 'SPC-07' },
  'SHOWE.SYX': { name: 'Steve Howe', groups: ['A2', 'A3'], code: 'SPC-08', color: '#b9dcb0' },
  'EASTON.SYX': { name: 'Elliot Easton', groups: ['A2', 'A3'], code: 'SPC-09', color: '#9a93c9' },
  'INTERN.SYX': { name: 'A2 Internal Programs', groups: ['A2'] },
  'ORIGA3.SYX': { name: 'A3 Original Programs', groups: ['A3'] },
  'DISTORCHAINS.SYX': { name: 'A2 Distortion Chains', groups: ['chains'], color: '#7d4ed8' },
  'NATURALCHAINS.SYX': { name: 'A2 Natural Chains', groups: ['chains'], color: '#d6c9a0' },
  // Third-party and community cards (no Korg label): colours chosen to differ from the Korg ones.
  'GHERO.SYX': { name: 'Guitar Heroes', groups: ['custom'] },
  'NOI5E.SYX': { name: 'Noi5e Maker Live Card', groups: ['custom'], color: '#b0683a' },
  'A3PATCHBOOK.SYX': { name: 'A3 Patchbook', groups: ['custom'], color: '#e45aa8' },
  'STOREDEMO.SYX': { name: 'Store Demo', groups: ['custom'], color: '#c3c9cf' },
}

export const cardInfo = (file: string) => CARD_INFO[file.toUpperCase()]
/** Full card name when known, otherwise the file name without extension. */
export const cardName = (file: string) => cardInfo(file)?.name ?? file.replace(/\.syx$/i, '')
/** Cards not listed above (e.g. a file added to assets later) count as custom. */
export const cardGroups = (file: string): CardGroup[] => cardInfo(file)?.groups ?? ['custom']

export type LibraryCard = { file: string; url: string }
export type LoadedCard = LibraryCard & { bank: A2Bank; externalChains: number }

export const libraryCards: LibraryCard[] = Object.entries(urls)
  .map(([path, url]) => ({ file: path.split('/').pop()!, url }))
  .sort((a, b) => cardName(a.file).localeCompare(cardName(b.file), 'it'))

export async function loadCard(card: LibraryCard): Promise<LoadedCard> {
  const response = await fetch(card.url)
  if (!response.ok) throw new AppError('loadFailed', { file: card.file })
  const bank = parseA2AllDump(await response.arrayBuffer())
  const externalChains = new Set(bank.programs.map((p) => p.raw[0]).filter(isExternalChain)).size
  return { ...card, bank, externalChains }
}
