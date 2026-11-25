import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { createInitializedBank, type A2Bank, type A2Program, parseA2AllDump, programName, serializeA2AllDump, setProgramName } from './a2sysex'
import { CardPanel, ProgramPanel } from './CardPanel'
import { Dialog, type DialogRequest } from './Dialog'
import { Toast, type ToastMessage } from './Toast'
import { errorMessage } from './errors'
import { type Lang, LangContext, STRINGS, initialLang, saveLang, useT } from './i18n'
import { ChainIcon, ExportIcon, InfoIcon, NewIcon, OpenIcon, PauseIcon, PlayIcon, TrashIcon } from './icons'
import { type Preview, buildPreviewIndex, soundKey } from './previews'
import { CARD_GROUPS, type CardGroup, type LoadedCard, cardFromBytes, cardGroups, cardInfo, cardName, libraryCards, loadCard, mergeLibrary } from './cards'
import { selectCardFiles } from './cardImport'
import { deleteStoredCard, listStoredCards, storeCards } from './cardStore'
import { ImportDialog } from './ImportDialog'
import { type Banks, type Clip, type DropMode, type Side, type SlotRef, chainLabel, copyClip, dropMode, isEmptyProgram, sameSound, moveProgram, pasteProgram, replaceProgram, revertSound, slotNumber } from './librarian'
import '@fontsource/roboto-mono/latin-500.css'
import './styles.css'

function download(bank: A2Bank, filename = 'NEWCRD.SYX') {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([serializeA2AllDump(bank)]))
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}

const isMac = /Mac|iPhone|iPad/.test(navigator.platform)
const shortcut = (key: string) => `${isMac ? '⌘' : 'Ctrl+'}${key}`

/** True when the keystroke belongs to a text field or a text selection, not to the slot grid. */
function isTextContext(target: EventTarget | null) {
  if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return true
  return Boolean(window.getSelection()?.toString())
}

function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = STRINGS[lang]
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const chooseLang = (next: Lang) => { setLang(next); saveLang(next) }
  const sourceFile = useRef<HTMLInputElement>(null)
  const destinationFile = useRef<HTMLInputElement>(null)
  const [banks, setBanks] = useState<Banks>({ source: null, destination: null })
  /** Destination programs as they arrived in each slot: edits in the panel are compared against them. */
  const [baseline, setBaseline] = useState<Uint8Array[]>([])
  const [selected, setSelected] = useState<SlotRef | null>(null)
  const [clip, setClip] = useState<Clip | null>(null)
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogRequest | null>(null)
  const [infoCard, setInfoCard] = useState<LoadedCard | null>(null)
  const closeInfo = useCallback(() => setInfoCard(null), [])
  const [infoSlot, setInfoSlot] = useState<SlotRef | null>(null)
  const closeSlotInfo = useCallback(() => setInfoSlot(null), [])
  const [toast, setToast] = useState<ToastMessage | null>(null)
  /** Shows feedback in the toast; an empty text dismisses it. */
  const setMessage = (text: string) => setToast(text ? { id: Date.now() + Math.random(), text } : null)
  const [drag, setDrag] = useState<SlotRef | null>(null)
  const [library, setLibrary] = useState<{ cards: LoadedCard[]; failed: string[] }>({ cards: [], failed: [] })
  const [importing, setImporting] = useState(false)
  // Bundled cards (assets/cards, absent from the public build) are loaded once; browser cards on every refresh.
  const bundled = useRef<Promise<{ cards: LoadedCard[]; failed: string[] }> | null>(null)
  async function refreshLibrary() {
    bundled.current ??= Promise.allSettled(libraryCards.map(loadCard)).then((results) => ({
      cards: results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : [])),
      failed: libraryCards.filter((_, i) => results[i].status === 'rejected').map((c) => c.file),
    }))
    const [fromBuild, stored] = await Promise.all([bundled.current, listStoredCards()])
    const fromBrowser = stored.flatMap((c) => { try { return [cardFromBytes(c.file, c.bytes.slice().buffer, 'browser')] } catch { return [] } })
    setLibrary({ cards: mergeLibrary(fromBuild.cards, fromBrowser), failed: fromBuild.failed })
  }
  useEffect(() => { refreshLibrary() }, [])

  /** Adds the user's own dumps to the browser library (after they accepted responsibility in the dialog). */
  async function importFiles(files: File[]) {
    const read = await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })))
    const { cards, skipped } = selectCardFiles(read)
    if (!cards.length) return setMessage(t.importNone)
    try {
      await storeCards(cards)
      await refreshLibrary()
      setMessage(t.importDone(cards.length, skipped.length))
    } catch {
      setMessage(t.importFailed)
    }
  }

  /** Deletes one card the user added from this browser's library (an open copy in the source stays). */
  function deleteBrowserCard(card: LoadedCard) {
    const name = cardName(card.file)
    setDialog({
      title: t.deleteTitle(name),
      body: t.deleteBody,
      confirmLabel: t.deleteConfirm,
      onConfirm: async () => {
        await deleteStoredCard(card.file)
        await refreshLibrary()
        setMessage(t.deleted(name))
      },
    })
  }


  // One audio player for every preview: starting one stops the previous.
  const previews = useMemo(() => buildPreviewIndex(library.cards), [library.cards])
  /** A destination patch edited after it arrived keeps its original preview, shown as disabled. */
  const previewLookup = (ref: SlotRef, program: A2Program) => {
    const url = previews.get(soundKey(program.raw))
    if (url) return { url, disabled: false }
    const original = ref.side === 'destination' ? baseline[ref.slot] : undefined
    const stale = original && previews.get(soundKey(original))
    return stale ? { url: stale, disabled: true } : undefined
  }
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  function player() {
    audio.current ??= Object.assign(new Audio(), { preload: 'auto', onended: () => setPlaying(null) })
    return audio.current
  }
  /** Plays `url`, optionally from `time`; switching file starts it from the beginning. */
  function playPreview(url: string, time?: number) {
    const element = player()
    if (element.dataset.url !== url) {
      element.src = url
      element.dataset.url = url
    }
    if (time !== undefined) element.currentTime = time
    else if (element.ended) element.currentTime = 0
    element.play().then(() => setPlaying(url), () => { setPlaying(null); setMessage(t.previewFailed) })
  }
  function togglePreview(url: string) {
    if (playing !== url) return playPreview(url)
    player().pause()
    setPlaying(null)
  }
  const preview: Preview = { lookup: previewLookup, playing, toggle: togglePreview, seek: playPreview, element: () => audio.current }
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)

  /** Replaces a whole card: selection and a clip copied from it no longer refer to the same data. */
  function load(side: Side, bank: A2Bank) {
    setBanks((current) => ({ ...current, [side]: bank }))
    if (side === 'destination') setBaseline(bank.programs.map((p) => p.raw))
    setSelected(null)
    if (clip?.from.side === side) setClip(null)
  }

  /** Runs an edit and reports its error (e.g. a chain conflict) instead of applying it. */
  function edit(change: () => Banks, success: string) {
    try {
      const next = change()
      // A slot that receives another preset (paste, move, drop) starts again as unmodified; a rename keeps its state.
      const before = banks.destination
      if (next.destination && before && next.destination !== before) {
        const after = next.destination
        setBaseline((current) => after.programs.map((p, i) => (sameSound(before.programs[i].raw, p.raw) ? current[i] ?? p.raw : p.raw)))
      }
      setBanks(next)
      setMessage(success)
      return true
    } catch (e) {
      setMessage(errorMessage(e, t, t.operationFailed))
      return false
    }
  }

  async function open(side: Side, file?: File) {
    if (!file) return
    try {
      load(side, parseA2AllDump(await file.arrayBuffer()))
      if (side === 'source') setSourceName(file.name)
      setMessage(t.loaded(side, file.name))
    } catch (e) {
      setMessage(errorMessage(e, t, t.cannotRead))
    }
  }

  function openLibraryCard(card: LoadedCard) {
    const loadCard = () => {
      // Parse a fresh copy: the library keeps its own bank untouched.
      load('source', parseA2AllDump(card.bank.bytes.slice().buffer))
      setSourceName(card.file)
      setMessage('')
    }
    // Confirm only when an open source would be replaced.
    if (!banks.source) return loadCard()
    setDialog({
      title: t.loadTitle(cardName(card.file)),
      body: t.loadBody(sourceName ? cardName(sourceName) : undefined),
      confirmLabel: t.loadConfirm,
      onConfirm: loadCard,
    })
  }

  function copy(cut = false) {
    if (!selected) return
    const bank = banks[selected.side]
    if (!bank) return
    // Same rule as drag and drop: presets leave the source only as copies.
    if (cut && selected.side === 'source') return setMessage(t.sourceReadOnlyCut(shortcut('C')))
    setClip(copyClip(banks, selected, cut))
    const name = programName(bank.programs[selected.slot])
    setMessage(cut ? t.cutFrom(name, selected) : t.copiedFrom(name, selected))
  }

  /** The source card is read-only: presets leave it only as copies. */
  function isEditable(ref: SlotRef) {
    if (ref.side === 'source') setMessage(t.sourceReadOnly(shortcut('C')))
    return ref.side === 'destination' && Boolean(banks.destination)
  }

  function paste() {
    if (!selected || !clip || !isEditable(selected)) return
    if (clip.cut) return move()
    edit(() => pasteProgram(banks, clip, selected), t.copiedTo(programName(clip.program), selected))
  }

  function move() {
    if (!selected || !clip) return
    if (clip.from.side === selected.side && clip.from.slot === selected.slot) {
      setClip(null)
      return setMessage('')
    }
    // The origin slot is now INIT: a second move from the same clip would overwrite it again.
    if (edit(() => moveProgram(banks, clip, selected), t.moved(programName(clip.program), clip.from, selected))) setClip(null)
  }

  function rename(ref: SlotRef) {
    const bank = banks.destination
    if (!isEditable(ref) || !bank) return
    setDialog({
      title: t.renameTitle(ref),
      body: t.renameBody,
      confirmLabel: t.renameConfirm,
      input: { value: programName(bank.programs[ref.slot]), maxLength: 7 },
      onConfirm: (name) => {
        const renamed = setProgramName(bank.programs[ref.slot], name)
        edit(() => ({ ...banks, destination: replaceProgram(bank, ref.slot, renamed) }), t.renamed(programName(bank.programs[ref.slot]), programName(renamed), ref))
      },
    })
  }

  /** Empties a slot: the preset keeps its bytes but is renamed INIT (see isEmptyProgram). */
  function clear(ref: SlotRef) {
    const bank = banks.destination
    if (!isEditable(ref) || !bank || isEmptyProgram(bank.programs[ref.slot])) return
    const name = programName(bank.programs[ref.slot])
    edit(() => ({ ...banks, destination: replaceProgram(bank, ref.slot, setProgramName(bank.programs[ref.slot], 'INIT')) }), t.cleared(name, ref))
  }

  function dragStart(from: SlotRef, e: DragEvent) {
    const bank = banks[from.side]
    if (!bank) return
    e.dataTransfer.effectAllowed = 'copyMove'
    e.dataTransfer.setData('text/plain', programName(bank.programs[from.slot]))
    setDrag(from)
  }

  /** Re-evaluated on every dragover, so pressing or releasing Option mid-drag switches the mode. */
  function dragOver(to: SlotRef, e: DragEvent) {
    const mode = drag && dropMode(drag, to, e.altKey)
    if (!mode) return setDropTarget(null)
    e.preventDefault()
    e.dataTransfer.dropEffect = mode
    if (dropTarget?.side !== to.side || dropTarget.slot !== to.slot || dropTarget.mode !== mode) setDropTarget({ ...to, mode })
  }

  function dragEnd() {
    setDrag(null)
    setDropTarget(null)
  }

  function drop(to: SlotRef, e: DragEvent) {
    e.preventDefault()
    const from = drag
    const mode = from && dropMode(from, to, e.altKey)
    dragEnd()
    if (!from || !mode) return
    const clip = copyClip(banks, from)
    const name = programName(clip.program)
    const done = mode === 'copy'
      ? edit(() => pasteProgram(banks, clip, to), t.copiedTo(name, to))
      : edit(() => moveProgram(banks, clip, to), t.moved(name, from, to))
    if (done) setSelected(to)
  }

  // Cmd (macOS) / Ctrl (others) + C, X, V act on the selected slot; ⌫/Canc empties it; Esc cancels a pending cut.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {})
  onKey.current = (e) => {
    if (dialog || importing || infoCard || infoSlot || isTextContext(e.target)) return
    if (e.key === 'Escape' && clip?.cut) {
      setClip(null)
      return setMessage(t.cutCancelled)
    }
    if (!selected) return
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      return clear(selected)
    }
    if (!(isMac ? e.metaKey : e.ctrlKey) || e.altKey || e.shiftKey) return
    const action = { c: () => copy(), x: () => copy(true), v: () => paste() }[e.key.toLowerCase()]
    if (!action) return
    e.preventDefault()
    action()
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onKey.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  /** Registers the panel edits into the patch: the current values become its new reference (green again). */
  function saveSlot(slot: number) {
    const program = banks.destination?.programs[slot]
    if (!program) return
    setBaseline((current) => current.map((raw, i) => (i === slot ? program.raw : raw)))
    setMessage(t.saved(programName(program), { side: 'destination', slot }))
  }

  /** Discards the panel edits: the patch goes back to how it arrived in the slot (its name is kept). */
  function revertSlot(slot: number) {
    const bank = banks.destination
    const original = baseline[slot]
    if (!bank || !original) return
    const reverted = revertSound(bank.programs[slot], original)
    setBanks((b) => (b.destination ? { ...b, destination: replaceProgram(b.destination, slot, reverted) } : b))
    setMessage(t.reverted(programName(reverted), { side: 'destination', slot }))
  }

  const modified = banks.destination?.programs.map((p, i) => Boolean(baseline[i]) && !isEmptyProgram(p) && !sameSound(baseline[i], p.raw)) ?? []

  const dnd: Dnd = { drag, dropTarget, start: dragStart, over: dragOver, leave: () => setDropTarget(null), drop, end: dragEnd }

  function createDestination() {
    const source = banks.source
    if (!source) return
    const create = () => {
      load('destination', createInitializedBank(source))
      setMessage(t.newCardReady)
    }
    // Confirm only when the destination holds patches that would be lost.
    const patches = banks.destination?.programs.filter((p) => !isEmptyProgram(p)).length ?? 0
    if (!patches) return create()
    setDialog({
      title: t.newCardTitle,
      body: t.newCardBody(patches),
      confirmLabel: t.newCardConfirm,
      onConfirm: create,
    })
  }

  function exportDestination() {
    if (!banks.destination) return
    download(banks.destination)
    setMessage(t.exported)
  }

  return (
    <LangContext.Provider value={t}>
    <main>
      <header>
        <div><p className="eyebrow">KORG A2 LIBRARIAN</p><h1>Cards n’ Chains <span className="beta-badge" title={t.betaTitle}>BETA</span></h1></div>
        <div className="lang-switch" role="group" aria-label={t.languageLabel}>
          {(['it', 'en'] as const).map((l) => (
            <button key={l} aria-pressed={lang === l} onClick={() => chooseLang(l)} lang={l} title={l === 'it' ? 'Italiano' : 'English'}>{l.toUpperCase()}</button>
          ))}
        </div>
      </header>
      <CardLibrary cards={library.cards} failed={library.failed} active={sourceName} open={openLibraryCard} info={setInfoCard} onAdd={() => setImporting(true)} onDelete={deleteBrowserCard} />
      <section className="toolbar">
        <span className="toolbar-hint">{t.hint({ copy: shortcut('C'), cut: shortcut('X'), paste: shortcut('V'), alt: isMac ? '⌥' : 'Alt', del: isMac ? '⌫' : lang === 'it' ? 'Canc' : 'Del' })}</span>
      </section>
      <section className="banks">
        <Bank side="source" title={t.source} name={sourceName} bank={banks.source} selected={selected} select={setSelected} rename={rename} info={setInfoSlot} preview={preview} dnd={dnd} cut={clip?.cut ? clip.from : null} open={() => sourceFile.current?.click()} />
        <Bank side="destination" title={t.destination} bank={banks.destination} selected={selected} select={setSelected} rename={rename} info={setInfoSlot} preview={preview} dnd={dnd} cut={clip?.cut ? clip.from : null} open={() => destinationFile.current?.click()} create={banks.source ? createDestination : undefined} exportCard={exportDestination} modified={modified} />
      </section>
      <footer className="app-footer">
        <span>{t.madeBy}</span>
        <span>{t.thanks(<a href="https://korgaseries.info" target="_blank" rel="noopener noreferrer">korgaseries.info</a>)}</span>
        <span className="footer-disclaimer">
          {t.disclaimer}
          <br />
          {t.previewCredits(
            <a href="https://commons.wikimedia.org/wiki/File:Guitar_with_fuzz.ogg" target="_blank" rel="noopener noreferrer">“Guitar with fuzz”</a>,
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>,
          )}
        </span>
      </footer>
      <Toast toast={toast} close={() => setToast(null)} />
      {infoCard && <CardPanel card={infoCard} close={closeInfo} />}
      {infoSlot && banks[infoSlot.side] && (
        <ProgramPanel
          bank={banks[infoSlot.side]!}
          slot={infoSlot.slot}
          place={infoSlot.side === 'source' ? t.placeSource(sourceName ? cardName(sourceName) : undefined) : t.placeDestination}
          close={closeSlotInfo}
          preview={preview}
          modified={infoSlot.side === 'destination' && modified[infoSlot.slot]}
          onSave={() => saveSlot(infoSlot.slot)}
          onRevert={() => revertSlot(infoSlot.slot)}
          onChange={infoSlot.side === 'destination' ? (program) => setBanks((b) => (b.destination ? { ...b, destination: replaceProgram(b.destination, infoSlot.slot, program) } : b)) : undefined}
          onChainChange={(label) => setMessage(t.chainChanged(label))}
        />
      )}
      {importing && <ImportDialog close={() => setImporting(false)} onFiles={importFiles} />}
      {dialog && <Dialog request={dialog} close={() => setDialog(null)} />}
      <input hidden ref={sourceFile} type="file" accept=".syx" onChange={(e) => { open('source', e.target.files?.[0]); e.target.value = '' }} />
      <input hidden ref={destinationFile} type="file" accept=".syx" onChange={(e) => { open('destination', e.target.files?.[0]); e.target.value = '' }} />
    </main>
    </LangContext.Provider>
  )
}

function CardLibrary({ cards, failed, active, open, info, onAdd, onDelete }: { cards: LoadedCard[]; failed: string[]; active: string | null; open: (card: LoadedCard) => void; info: (card: LoadedCard) => void; onAdd: () => void; onDelete: (card: LoadedCard) => void }) {
  const [filter, setFilter] = useState<CardGroup | 'all'>('all')
  const t = useT()
  const actions = (
    <div className="library-actions">
      <button className="icon-button" onClick={onAdd}><NewIcon />{t.addCards}</button>
    </div>
  )
  if (cards.length === 0) {
    return (
      <section className="library">
        <div className="library-head"><p className="eyebrow">{t.libraryTitle}</p>{actions}</div>
        <p className="library-empty">{t.libraryEmpty(<a href="https://korgaseries.info/user_cards.php" target="_blank" rel="noopener noreferrer">korgaseries.info</a>)}</p>
      </section>
    )
  }
  return (
    <section className="library">
      <div className="library-head">
        <p className="eyebrow">{t.libraryTitle}</p>
        <div className="library-filters" role="group" aria-label={t.filterLabel}>
          {[{ id: 'all' as const, label: t.filterAll }, ...CARD_GROUPS].map((group) => (
            <button key={group.id} aria-pressed={filter === group.id} onClick={() => setFilter(group.id)}>
              {group.label} <span>{group.id === 'all' ? cards.length : cards.filter((c) => cardGroups(c.file).includes(group.id)).length}</span>
            </button>
          ))}
        </div>
        {failed.length > 0 && <span className="library-error">{t.unreadable(failed.join(', '))}</span>}
        {actions}
      </div>
      <div className="library-cards">
        {cards.filter((card) => filter === 'all' || cardGroups(card.file).includes(filter)).map((card) => (
          <div key={card.file} className={`library-item ${card.source === 'browser' ? 'from-browser' : ''}`}>
            <button
              className={`library-card ${active === card.file ? 'active' : ''}`}
              style={cardInfo(card.file)?.color ? ({ '--card-color': cardInfo(card.file)!.color } as React.CSSProperties) : undefined}
              onClick={() => open(card)}
              title={t.loadInto(cardName(card.file), [cardInfo(card.file)?.code, card.file].filter(Boolean).join(' · '))}
            >
              <strong>{cardName(card.file)}</strong>
              <span>{card.bank.programs.slice(0, 3).map(programName).join(' · ')}</span>
              <em>{card.externalChains ? t.externalChains(card.externalChains) : t.internalOnly}</em>
            </button>
            <button className="info-button" onClick={() => info(card)} aria-label={t.detailsOf(cardName(card.file))} title={t.programsAndChains}><InfoIcon /></button>
            {card.source === 'browser' && (
              <button className="info-button card-delete" onClick={() => onDelete(card)} aria-label={t.deleteCard(cardName(card.file))} title={t.deleteCard(cardName(card.file))}><TrashIcon /></button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

type DropTarget = SlotRef & { mode: DropMode }
type Dnd = {
  drag: SlotRef | null
  dropTarget: DropTarget | null
  start: (from: SlotRef, e: DragEvent) => void
  over: (to: SlotRef, e: DragEvent) => void
  leave: () => void
  drop: (to: SlotRef, e: DragEvent) => void
  end: () => void
}

type BankProps = { side: Side; title: string; name?: string | null; bank: A2Bank | null; selected: SlotRef | null; select: (value: SlotRef) => void; rename: (ref: SlotRef) => void; info: (ref: SlotRef) => void; preview: Preview; dnd: Dnd; cut: SlotRef | null; open: () => void; create?: () => void; exportCard?: () => void; modified?: boolean[] }

function Bank({ side, title, name, bank, selected, select, rename, info, preview, dnd, cut, open, create, exportCard, modified }: BankProps) {
  const t = useT()
  return (
    <section className="bank">
      <div className="bank-head">
        <div><h2>{title}{bank && name && <span className="bank-name" title={name}>{cardName(name)}</span>}</h2></div>
        <div>
          <button className="icon-button" onClick={open}><OpenIcon />{t.openDump}</button>
          {create && <button className="icon-button new-card" onClick={create}><NewIcon />{t.newCard}</button>}
          {exportCard && <button className="icon-button" disabled={!bank} onClick={exportCard} title={t.exportTitle}><ExportIcon />{t.export}</button>}
        </div>
      </div>
      {bank ? (
        <div className={`grid ${dnd.drag ? 'dragging' : ''}`}>
          {bank.programs.map((p) => {
            const empty = isEmptyProgram(p)
            const ref = { side, slot: p.slot }
            const audio = empty ? undefined : preview.lookup(ref, p)
            const audioUrl = audio?.url
            const isPlaying = Boolean(audio) && !audio?.disabled && preview.playing === audioUrl
            const isOrigin = dnd.drag?.side === side && dnd.drag.slot === p.slot
            const target = dnd.dropTarget?.side === side && dnd.dropTarget.slot === p.slot ? dnd.dropTarget.mode : undefined
            const classes = ['slot', empty && 'empty-slot', selected?.side === side && selected.slot === p.slot && 'selected', cut?.side === side && cut.slot === p.slot && 'cut-pending', modified?.[p.slot] && 'modified', isOrigin && `drag-origin drag-origin-${dnd.dropTarget?.mode ?? 'idle'}`]
            return (
              <div key={p.slot} className="slot-item">
              <button
                className={classes.filter(Boolean).join(' ')}
                data-drop={target}
                draggable={!empty}
                onClick={() => select(ref)}
                onDoubleClick={() => rename(ref)}
                aria-description={modified?.[p.slot] ? t.modifiedPatch : undefined}
                onDragStart={(e) => dnd.start(ref, e)}
                onDragOver={(e) => dnd.over(ref, e)}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) dnd.leave() }}
                onDrop={(e) => dnd.drop(ref, e)}
                onDragEnd={dnd.end}
                title={empty ? t.emptySlot : undefined}
              >
                <span className="slot-number led">{slotNumber(p.slot)}</span>
                {!empty && <strong className="slot-name">{programName(p) || '—'}</strong>}
                {audioUrl && <span className="slot-play-space" aria-hidden="true" />}
                {!empty && <span className="chain-pill" title={`Chain ${chainLabel(p.raw[0])}`}><ChainIcon />{chainLabel(p.raw[0])}</span>}
              </button>
              {audioUrl && (
                // Same layout as the slot with invisible number and name, so the play button lands right after the name
                // (a button cannot sit inside the slot button).
                <div className="slot slot-overlay">
                  <span className="slot-number led ghost" aria-hidden="true">{slotNumber(p.slot)}</span>
                  <strong className="slot-name ghost" aria-hidden="true">{programName(p) || '—'}</strong>
                  <button className={`info-button slot-play ${isPlaying ? 'playing' : ''}`} disabled={audio?.disabled} onClick={() => preview.toggle(audioUrl)} aria-label={`${isPlaying ? t.pausePreview : t.playPreview}: ${programName(p)}`} title={audio?.disabled ? t.previewModified : isPlaying ? t.pausePreview : t.playPreview}>
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </button>
                </div>
              )}
              {!empty && <button className="info-button slot-info" onClick={() => info(ref)} aria-label={t.detailsOf(programName(p))} title={t.effectChain}><InfoIcon /></button>}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="empty">
          <h3>{side === 'source' ? t.emptySourceTitle : t.emptyDestinationTitle}</h3>
          <p>{side === 'source' ? t.emptySourceText : t.emptyDestinationText}</p>
        </div>
      )}
    </section>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
