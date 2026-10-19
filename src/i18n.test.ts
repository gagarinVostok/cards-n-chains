import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppError, errorMessage } from './errors'
import { STRINGS, initialLang } from './i18n'

const setLanguages = (languages: string[]) => vi.stubGlobal('navigator', { languages, language: languages[0] })
const storage = (saved: string | null) => vi.stubGlobal('localStorage', { getItem: () => saved, setItem: () => {} })

afterEach(() => vi.unstubAllGlobals())

describe('initialLang', () => {
  it('follows the browser: Italian when Italian comes first, English otherwise', () => {
    storage(null)
    setLanguages(['it-IT', 'en-US'])
    expect(initialLang()).toBe('it')
    setLanguages(['en-GB', 'it'])
    expect(initialLang()).toBe('en')
    setLanguages(['fr-FR', 'de'])
    expect(initialLang()).toBe('en')
    setLanguages(['fr-FR', 'it'])
    expect(initialLang()).toBe('it')
  })

  it('prefers the language the user picked', () => {
    storage('en')
    setLanguages(['it-IT'])
    expect(initialLang()).toBe('en')
  })

  it('falls back to detection when storage is unavailable', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') } })
    setLanguages(['it'])
    expect(initialLang()).toBe('it')
  })
})

describe('translations', () => {
  it('has the same keys in both languages', () => {
    expect(Object.keys(STRINGS.en).sort()).toEqual(Object.keys(STRINGS.it).sort())
    expect(Object.keys(STRINGS.en.errors).sort()).toEqual(Object.keys(STRINGS.it.errors).sort())
  })

  it('translates library errors into the UI language', () => {
    const error = new AppError('chainConflict', { name: 'VALVES1', from: { side: 'source', slot: 0 }, chain: 'C1' })
    expect(error.message).toMatch(/uses card chain C1/)
    expect(errorMessage(error, STRINGS.it, '')).toBe('VALVES1 (slot 00 della sorgente) usa la chain esterna C1, ma la card di destinazione ha chain diverse: operazione bloccata.')
    expect(errorMessage(new Error('plain'), STRINGS.it, 'fallback')).toBe('plain')
    expect(errorMessage('x', STRINGS.en, 'fallback')).toBe('fallback')
  })

  it('builds slot phrases in each language', () => {
    expect(STRINGS.it.copiedTo('AutoWah', { side: 'destination', slot: 12 })).toBe('AutoWah copiato nello slot 12 della destinazione.')
    expect(STRINGS.en.copiedTo('AutoWah', { side: 'destination', slot: 12 })).toBe('AutoWah copied to slot 12 of the destination.')
  })
})
