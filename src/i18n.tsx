import { type ReactNode, createContext, useContext } from 'react'

/**
 * Italian / English UI strings. Card and effect names stay in English (Korg names).
 * Messages that mention a slot take a `Ref` and build the phrase in their own language.
 */
export type Lang = 'it' | 'en'
type Ref = { side: 'source' | 'destination'; slot: number }
type Keys = { copy: string; cut: string; paste: string; alt: string; del: string }

const pad = (slot: number) => String(slot).padStart(2, '0')

const itSlot = ({ side, slot }: Ref) => `slot ${pad(slot)} della ${side === 'source' ? 'sorgente' : 'destinazione'}`
const enSlot = ({ side, slot }: Ref) => `slot ${pad(slot)} of the ${side === 'source' ? 'source' : 'destination'}`
const kbd = (k: string) => <kbd>{k}</kbd>

const it = {
  // Header and layout
  languageLabel: 'Lingua',
  betaTitle: 'Versione di prova: alcune funzioni sono sperimentali. Fai sempre un backup dell’A2.',
  source: 'Sorgente',
  destination: 'Destinazione',
  hint: (k: Keys): ReactNode => <>{kbd(k.copy)} {kbd(k.cut)} {kbd(k.paste)} · Trascina: sorgente → destinazione copia · nella destinazione sposta, {kbd(k.alt)} per copiare · doppio clic rinomina · {kbd(k.del)} svuota</>,
  madeBy: 'Realizzato da Gabriele Peirolo con Claude Code · Versione 1.0',
  thanks: (link: ReactNode): ReactNode => <>Grazie a {link} per i dump delle card e la documentazione sulla serie Korg A</>,
  previewCredits: (work: ReactNode, license: ReactNode): ReactNode => <>Anteprima audio di prova (Guitar I · 00): {work} di Deltabeignet, {license}, via Wikimedia Commons, convertita in AAC.</>,
  disclaimer: 'Progetto indipendente, non affiliato né approvato da Korg. Korg e i nomi dei prodotti citati sono marchi dei rispettivi proprietari. Il software è fornito “così com’è”, senza garanzie di alcun tipo: l’autore non risponde di eventuali danni a dati, card o apparecchiature derivanti dal suo uso. Prima di inviare dump all’hardware, fai sempre un backup.',

  // Library
  libraryTitle: 'LIBRERIA CARD ORIGINALI',
  filterLabel: 'Filtra le card',
  filterAll: 'Tutte',
  unreadable: (files: string) => `Non leggibili: ${files}`,
  loadInto: (name: string, meta: string) => `Carica ${name} nella sorgente (${meta})`,
  externalChains: (n: number) => `${n} chain esterne`,
  internalOnly: 'solo chain interne',
  detailsOf: (name: string) => `Dettagli di ${name}`,
  programsAndChains: 'Programmi e chain',
  libraryEmpty: (site: ReactNode): ReactNode => <>La libreria è vuota. Scarica “Korg A2 Complete files” da {site}, estrai l’archivio e aggiungi i file .syx con “Aggiungi card”: restano salvati solo in questo browser. Puoi anche aprire un singolo dump con “Apri dump”.</>,
  addCards: 'Aggiungi card',
  deleteCard: (name: string) => `Rimuovi ${name} dal browser`,
  deleteTitle: (name: string) => `Rimuovere ${name} dal browser?`,
  deleteBody: 'La card verrà cancellata dalla libreria di questo browser. Il file sul tuo computer non viene toccato.',
  deleteConfirm: 'Rimuovi',
  deleted: (name: string) => `${name} rimossa dal browser.`,
  importTitle: 'Aggiungi card alla libreria',
  importIntro: (site: ReactNode): ReactNode => <>Seleziona i file .syx dei dump completi del Korg A2, ad esempio quelli di “Korg A2 Complete files” scaricabili da {site} (estrai prima l’archivio). Le card vengono riconosciute dal nome del file; gli altri dump compaiono tra le Custom.</>,
  importPrivacy: 'I file restano solo in questo browser: non vengono caricati su nessun server.',
  importConsent: 'Confermo di avere il diritto di usare questi file e me ne assumo la piena responsabilità. Cards n’ Chains non fornisce né distribuisce i dump delle card.',
  chooseFiles: 'Scegli file…',
  chooseFolder: 'Scegli cartella…',
  importDone: (added: number, skipped: number) => `${added === 1 ? '1 card aggiunta' : `${added} card aggiunte`} alla libreria${skipped ? ` · ${skipped} file ignorati (non sono dump A2 completi)` : ''}.`,
  importNone: 'Nessun dump A2 completo tra i file scelti.',
  importFailed: 'Impossibile salvare le card in questo browser (ad esempio in una finestra privata).',

  // Banks and slots
  openDump: 'Apri dump',
  newCard: 'Nuova card vuota',
  export: 'Esporta',
  exportTitle: 'Scarica la destinazione come NEWCRD.SYX',
  modifiedPatch: 'Patch modificata',
  emptySlot: 'Slot vuoto',
  effectChain: 'Catena effetti',
  emptySourceTitle: 'Apri una card sorgente',
  emptySourceText: 'Usa un dump completo A2 come GUIT1.SYX.',
  emptyDestinationTitle: 'Apri un dump o crea una card',
  emptyDestinationText: 'La nuova card conserva le chain della sorgente e inizializza tutti gli slot con un preset-base valido.',

  // Messages (toast)
  operationFailed: 'Operazione non riuscita.',
  cannotRead: 'Impossibile leggere il file.',
  loaded: (side: Ref['side'], file: string) => `${side === 'source' ? 'Sorgente caricata' : 'Destinazione caricata'}: ${file}.`,
  sourceReadOnlyCut: (shortcut: string) => `La sorgente non si modifica: usa Copia (${shortcut}).`,
  sourceReadOnly: (shortcut: string) => `La sorgente non si modifica: copia i preset nella destinazione (${shortcut} o trascinamento).`,
  cutFrom: (name: string, ref: Ref) => `${name} tagliato dallo ${itSlot(ref)}: incollalo in un altro slot per spostarlo.`,
  copiedFrom: (name: string, ref: Ref) => `${name} copiato dallo ${itSlot(ref)}.`,
  copiedTo: (name: string, ref: Ref) => `${name} copiato nello ${itSlot(ref)}.`,
  moved: (name: string, from: Ref, to: Ref) => `${name} spostato dallo ${from.side === to.side ? `slot ${pad(from.slot)}` : itSlot(from)} allo ${itSlot(to)}.`,
  renamed: (before: string, after: string, ref: Ref) => `${before} rinominato in ${after} nello ${itSlot(ref)}.`,
  cleared: (name: string, ref: Ref) => `${name} eliminato dallo ${itSlot(ref)}.`,
  cutCancelled: 'Taglio annullato.',
  saved: (name: string, ref: Ref) => `Modifiche registrate in ${name} (${itSlot(ref)}).`,
  reverted: (name: string, ref: Ref) => `${name} riportato allo stato originale (${itSlot(ref)}).`,
  newCardReady: 'Nuova card pronta: chain della sorgente e 100 slot vuoti.',
  exported: 'Esportato NEWCRD.SYX.',
  chainChanged: (label: string) => `Chain ${label} selezionata: i parametri fuori intervallo sono stati adattati ai nuovi effetti.`,

  // Audio previews
  playPreview: 'Ascolta anteprima',
  pausePreview: 'Metti in pausa',
  previewPosition: 'Posizione nell’anteprima',
  loadingWaveform: 'Caricamento della forma d’onda…',
  previewOf: (name: string) => `Anteprima audio di ${name}`,
  previewFailed: 'Impossibile riprodurre l’anteprima.',
  previewModified: 'Patch modificata · anteprima disattivata',

  // Dialogs
  cancel: 'Annulla',
  loadTitle: (name: string) => `Caricare ${name} nella sorgente?`,
  loadBody: (current?: string) => `La sorgente attuale${current ? ` (${current})` : ''} verrà sostituita.`,
  loadConfirm: 'Carica',
  renameTitle: (ref: Ref) => `Rinomina lo ${itSlot(ref)}`,
  renameBody: 'Massimo 7 caratteri ASCII.',
  renameConfirm: 'Rinomina',
  newCardTitle: 'Creare una nuova card vuota?',
  newCardBody: (n: number) => `La destinazione contiene ${n === 1 ? '1 patch che verrà sostituita' : `${n} patch che verranno sostituite`} da 100 slot vuoti. Usa Esporta prima, se vuoi conservarle.`,
  newCardConfirm: 'Crea card vuota',
  closeNotification: 'Chiudi notifica',

  // Side panels
  closePanel: 'Chiudi pannello',
  readOnly: 'SOLA LETTURA',
  cardDetails: (name: string) => `Dettagli della card ${name}`,
  programsCount: (n: number) => `${n} programmi`,
  cardChainsCount: (n: number) => `${n} chain della card`,
  internalChainsCount: (n: number) => `${n} chain interne usate`,
  tabPrograms: 'Programmi',
  tabChains: 'Chain',
  placeSource: (name?: string) => `Sorgente${name ? ` · ${name}` : ''}`,
  placeDestination: 'Destinazione',
  programDetails: (name: string) => `Dettagli del programma ${name}`,
  modifiedTag: 'MODIFICATA',
  editableTag: 'MODIFICABILE',
  save: 'Registra',
  revert: 'Ripristina',
  revertTitle: 'Annulla le modifiche e torna alla patch originale',
  programSummary: (chain: string, card: boolean, volume: number, threshold: number) => `Chain ${chain} · ${card ? 'della card' : 'interna'} · Volume ${volume} · Threshold ${threshold}`,
  unknownChain: 'Chain sconosciuta',
  unknownOption: 'sconosciuta',
  unused: 'non usato',
  cardChainsGroup: 'Chain della card',
  internalChainsGroup: 'Chain interne del Korg A2',
  cardModule: 'modulo card',
  effectOffTitle: 'Effetto spento: clicca per accenderlo',
  effectOnTitle: 'Effetto acceso: clicca per spegnerlo',
  variant: 'Variante',
  variants: (list: string) => `Varianti: ${list}`,
  undocumented: 'non documentato, non modificabile',
  outOfRange: 'Valore originale fuori dall’intervallo documentato',
  volumeThreshold: (volume: number, threshold: number) => `Volume ${volume} · Threshold ${threshold}`,
  programsShort: (n: number) => `${n} prog.`,
  chainUnused: 'non usata',
  cardChainNote: 'Chain della card (definita nel dump)',
  internalChainNote: 'Chain interna del Korg A2',
  usedBy: (list: string) => `Usata da: ${list}`,

  // Errors raised by the dump / librarian code (see errors.ts)
  errors: {
    noCard: () => 'Nessuna card aperta.',
    originClosed: () => 'La card di origine non è più aperta.',
    chainConflict: (p: { name: string; from: Ref; chain: string }) => `${p.name} (${itSlot(p.from)}) usa la chain esterna ${p.chain}, ma la card di destinazione ha chain diverse: operazione bloccata.`,
    chainUnavailable: (p: { chain: string }) => `Chain ${p.chain} non disponibile in questa card.`,
    badSize: (p: { size: number; expected: number }) => `Dimensione inattesa: ${p.size} byte (attesi ${p.expected}).`,
    badHeader: () => 'Non è un dump completo Korg A2 (header F0 42 3n 2D 4C).',
    noTemplate: () => 'Preset-base non disponibile.',
    loadFailed: (p: { file: string }) => `Impossibile caricare ${p.file}.`,
  },
}

export type Strings = typeof it

const en: Strings = {
  languageLabel: 'Language',
  betaTitle: 'Test version: some features are experimental. Always back up your A2.',
  source: 'Source',
  destination: 'Destination',
  hint: (k) => <>{kbd(k.copy)} {kbd(k.cut)} {kbd(k.paste)} · Drag: source → destination copies · within the destination moves, {kbd(k.alt)} to copy · double-click renames · {kbd(k.del)} clears</>,
  madeBy: 'Made by Gabriele Peirolo using Claude Code · Version 1.0',
  thanks: (link) => <>Thanks to {link} for the card dumps and the Korg A-series documentation</>,
  previewCredits: (work, license) => <>Test audio preview (Guitar I · 00): {work} by Deltabeignet, {license}, via Wikimedia Commons, converted to AAC.</>,
  disclaimer: 'Independent project, not affiliated with or endorsed by Korg. Korg and the product names mentioned are trademarks of their respective owners. The software is provided “as is”, without warranty of any kind: the author is not liable for any damage to data, cards or equipment resulting from its use. Always make a backup before sending dumps to the hardware.',

  libraryTitle: 'ORIGINAL CARD LIBRARY',
  filterLabel: 'Filter cards',
  filterAll: 'All',
  unreadable: (files) => `Unreadable: ${files}`,
  loadInto: (name, meta) => `Load ${name} into the source (${meta})`,
  externalChains: (n) => `${n} card chains`,
  internalOnly: 'internal chains only',
  detailsOf: (name) => `Details of ${name}`,
  programsAndChains: 'Programs and chains',
  libraryEmpty: (site) => <>The library is empty. Download “Korg A2 Complete files” from {site}, extract the archive and add the .syx files with “Add cards”: they are stored in this browser only. You can also open a single dump with “Open dump”.</>,
  addCards: 'Add cards',
  deleteCard: (name) => `Remove ${name} from this browser`,
  deleteTitle: (name) => `Remove ${name} from this browser?`,
  deleteBody: 'The card will be deleted from this browser’s library. The file on your computer is not touched.',
  deleteConfirm: 'Remove',
  deleted: (name) => `${name} removed from this browser.`,
  importTitle: 'Add cards to the library',
  importIntro: (site) => <>Select the .syx files of full Korg A2 dumps, for example those of “Korg A2 Complete files” available from {site} (extract the archive first). Cards are recognised by their file name; other dumps appear under Custom.</>,
  importPrivacy: 'The files stay in this browser only: nothing is uploaded to any server.',
  importConsent: 'I confirm I have the right to use these files and take full responsibility for them. Cards n’ Chains does not provide or distribute card dumps.',
  chooseFiles: 'Choose files…',
  chooseFolder: 'Choose folder…',
  importDone: (added, skipped) => `${added === 1 ? '1 card' : `${added} cards`} added to the library${skipped ? ` · ${skipped} files ignored (not full A2 dumps)` : ''}.`,
  importNone: 'None of the selected files is a full A2 dump.',
  importFailed: 'Unable to store the cards in this browser (for example in a private window).',

  openDump: 'Open dump',
  newCard: 'New empty card',
  export: 'Export',
  exportTitle: 'Download the destination as NEWCRD.SYX',
  modifiedPatch: 'Modified patch',
  emptySlot: 'Empty slot',
  effectChain: 'Effect chain',
  emptySourceTitle: 'Open a source card',
  emptySourceText: 'Use a full A2 dump such as GUIT1.SYX.',
  emptyDestinationTitle: 'Open a dump or create a card',
  emptyDestinationText: 'The new card keeps the source chains and initialises every slot with a valid base preset.',

  operationFailed: 'Operation failed.',
  cannotRead: 'Unable to read the file.',
  loaded: (side, file) => `${side === 'source' ? 'Source' : 'Destination'} loaded: ${file}.`,
  sourceReadOnlyCut: (shortcut) => `The source is read-only: use Copy (${shortcut}).`,
  sourceReadOnly: (shortcut) => `The source is read-only: copy presets into the destination (${shortcut} or drag).`,
  cutFrom: (name, ref) => `${name} cut from ${enSlot(ref)}: paste it into another slot to move it.`,
  copiedFrom: (name, ref) => `${name} copied from ${enSlot(ref)}.`,
  copiedTo: (name, ref) => `${name} copied to ${enSlot(ref)}.`,
  moved: (name, from, to) => `${name} moved from ${from.side === to.side ? `slot ${pad(from.slot)}` : enSlot(from)} to ${enSlot(to)}.`,
  renamed: (before, after, ref) => `${before} renamed to ${after} in ${enSlot(ref)}.`,
  cleared: (name, ref) => `${name} removed from ${enSlot(ref)}.`,
  cutCancelled: 'Cut cancelled.',
  saved: (name, ref) => `Changes saved to ${name} (${enSlot(ref)}).`,
  reverted: (name, ref) => `${name} reverted to its original state (${enSlot(ref)}).`,
  newCardReady: 'New card ready: source chains and 100 empty slots.',
  exported: 'Exported NEWCRD.SYX.',
  chainChanged: (label) => `Chain ${label} selected: out-of-range parameters were adapted to the new effects.`,

  playPreview: 'Play preview',
  pausePreview: 'Pause',
  previewPosition: 'Preview position',
  loadingWaveform: 'Loading waveform…',
  previewOf: (name) => `Audio preview of ${name}`,
  previewFailed: 'Unable to play the preview.',
  previewModified: 'Patch modified · preview disabled',

  cancel: 'Cancel',
  loadTitle: (name) => `Load ${name} into the source?`,
  loadBody: (current) => `The current source${current ? ` (${current})` : ''} will be replaced.`,
  loadConfirm: 'Load',
  renameTitle: (ref) => `Rename ${enSlot(ref)}`,
  renameBody: 'Up to 7 ASCII characters.',
  renameConfirm: 'Rename',
  newCardTitle: 'Create a new empty card?',
  newCardBody: (n) => `The destination holds ${n === 1 ? '1 patch that will be replaced' : `${n} patches that will be replaced`} by 100 empty slots. Use Export first if you want to keep them.`,
  newCardConfirm: 'Create empty card',
  closeNotification: 'Close notification',

  closePanel: 'Close panel',
  readOnly: 'READ-ONLY',
  cardDetails: (name) => `Details of card ${name}`,
  programsCount: (n) => `${n} programs`,
  cardChainsCount: (n) => `${n} card chains`,
  internalChainsCount: (n) => `${n} internal chains used`,
  tabPrograms: 'Programs',
  tabChains: 'Chains',
  placeSource: (name) => `Source${name ? ` · ${name}` : ''}`,
  placeDestination: 'Destination',
  programDetails: (name) => `Details of program ${name}`,
  modifiedTag: 'MODIFIED',
  editableTag: 'EDITABLE',
  save: 'Save',
  revert: 'Revert',
  revertTitle: 'Discard the changes and go back to the original patch',
  programSummary: (chain, card, volume, threshold) => `Chain ${chain} · ${card ? 'card' : 'internal'} · Volume ${volume} · Threshold ${threshold}`,
  unknownChain: 'Unknown chain',
  unknownOption: 'unknown',
  unused: 'unused',
  cardChainsGroup: 'Card chains',
  internalChainsGroup: 'Korg A2 internal chains',
  cardModule: 'card module',
  effectOffTitle: 'Effect off: click to turn it on',
  effectOnTitle: 'Effect on: click to turn it off',
  variant: 'Variant',
  variants: (list) => `Variants: ${list}`,
  undocumented: 'undocumented, not editable',
  outOfRange: 'Original value outside the documented range',
  volumeThreshold: (volume, threshold) => `Volume ${volume} · Threshold ${threshold}`,
  programsShort: (n) => `${n} prog.`,
  chainUnused: 'unused',
  cardChainNote: 'Card chain (defined in the dump)',
  internalChainNote: 'Korg A2 internal chain',
  usedBy: (list) => `Used by: ${list}`,

  errors: {
    noCard: () => 'No card open.',
    originClosed: () => 'The origin card is no longer open.',
    chainConflict: (p) => `${p.name} (${enSlot(p.from)}) uses card chain ${p.chain}, but the destination card has different chains: operation blocked.`,
    chainUnavailable: (p) => `Chain ${p.chain} is not available on this card.`,
    badSize: (p) => `Unexpected size: ${p.size} bytes (expected ${p.expected}).`,
    badHeader: () => 'Not a full Korg A2 dump (header F0 42 3n 2D 4C).',
    noTemplate: () => 'Base preset not available.',
    loadFailed: (p) => `Unable to load ${p.file}.`,
  },
}

export const STRINGS: Record<Lang, Strings> = { it, en }
export type ErrorKey = keyof Strings['errors']
export type ErrorParams<K extends ErrorKey> = Parameters<Strings['errors'][K]>[0]

const STORAGE_KEY = 'cards-n-chains.lang'

/** Browser language (Italian when any preferred language is Italian), unless the user picked one. */
export function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'it' || saved === 'en') return saved
  } catch { /* storage unavailable: fall back to detection */ }
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language]
  return preferred.find((l) => /^(it|en)\b/i.test(l))?.slice(0, 2).toLowerCase() === 'it' ? 'it' : 'en'
}

export function saveLang(lang: Lang) {
  try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* the choice just won't persist */ }
}

export const LangContext = createContext<Strings>(it)
export const useT = () => useContext(LangContext)
