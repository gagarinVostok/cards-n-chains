import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { type CardInfo, type ChainInfo, type EffectInfo, type EffectParam, type ProgramInfo, decodeCard, setEffectOff, setEffectParam, setEffectVariation, setProgramChain } from './a2decode'
import type { A2Bank, A2Program } from './a2sysex'
import { type LoadedCard, cardInfo, cardName } from './cards'
import { ChainIcon, CloseIcon, RevertIcon, SaveIcon } from './icons'
import { WaveformPlayer } from './WaveformPlayer'
import type { Preview } from './previews'
import { useT } from './i18n'
import { chainLabel, isExternalChain, slotNumber } from './librarian'

type Tab = 'programs' | 'chains'

/** Side panel shell: overlay, header with close button, Esc to close, page scroll locked. */
function Drawer({ label, eyebrow, title, summary, close, modified, actions, children }: { label: string; eyebrow: string; title: ReactNode; summary: string; close: () => void; modified?: boolean; actions?: ReactNode; children: ReactNode }) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const t = useT()

  useEffect(() => {
    closeButton.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    // The page behind stays put while the panel scrolls.
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [close])

  return (
    <>
      <div className="drawer-overlay" onClick={close} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={label}>
        <header className={`drawer-head ${modified ? 'modified' : ''}`}>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 className="drawer-title">{title}</h2>
            <p className="drawer-summary">{summary}</p>
          </div>
          <div className="drawer-actions">
            <button ref={closeButton} className="icon-only" onClick={close} aria-label={t.closePanel}><CloseIcon /></button>
            {actions}
          </div>
        </header>
        {children}
      </aside>
    </>
  )
}

/** Read-only side panel with every program and chain of a library card. */
export function CardPanel({ card, close }: { card: LoadedCard; close: () => void }) {
  const info = useMemo(() => decodeCard(card.bank), [card])
  const [tab, setTab] = useState<Tab>('programs')
  const t = useT()
  const cardChains = info.chains.filter((c) => isExternalChain(c.chain)).length
  const name = cardName(card.file)
  const note = [cardInfo(card.file)?.code, card.file, t.readOnly].filter(Boolean).join(' · ')
  const summary = [t.programsCount(info.programs.length), cardChains && t.cardChainsCount(cardChains), info.chains.length > cardChains && t.internalChainsCount(info.chains.length - cardChains)].filter(Boolean).join(' · ')
  return (
    <Drawer label={t.cardDetails(name)} eyebrow={note} title={name} summary={summary} close={close}>
      <div className="drawer-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'programs'} onClick={() => setTab('programs')}>{t.tabPrograms} <span>{info.programs.length}</span></button>
        <button role="tab" aria-selected={tab === 'chains'} onClick={() => setTab('chains')}>{t.tabChains} <span>{info.chains.length}</span></button>
      </div>
      <div className="drawer-body">
        {tab === 'programs' ? info.programs.map((p) => <ProgramRow key={p.slot} program={p} />) : info.chains.map((c) => <ChainRow key={c.chain} chain={c} />)}
      </div>
    </Drawer>
  )
}

/**
 * Side panel for one program: its chain and every effect, already expanded.
 * With `onChange` (destination card) the chain, effect on/off, variation and parameters are editable.
 */
export function ProgramPanel({ bank, slot, place, close, preview, modified, onChange, onChainChange, onSave, onRevert }: { bank: A2Bank; slot: number; place: string; close: () => void; preview?: Preview; modified?: boolean; onChange?: (program: A2Program) => void; onChainChange?: (label: string) => void; onSave?: () => void; onRevert?: () => void }) {
  const info = useMemo(() => decodeCard(bank), [bank])
  const program = info.programs[slot]
  const raw = bank.programs[slot]
  const chain = info.chains.find((c) => c.chain === program.chain)
  const edit = onChange && ((change: (p: A2Program) => A2Program) => onChange(change(raw)))
  const t = useT()
  const audio = preview?.lookup({ side: onChange ? 'destination' : 'source', slot }, raw)
  return (
    <Drawer
      label={t.programDetails(program.name)}
      eyebrow={`${place.toUpperCase()}${modified ? ` · ${t.modifiedTag}` : edit ? ` · ${t.editableTag}` : ''}`}
      modified={modified}
      actions={modified && (onSave || onRevert) && (
        <div className="drawer-edit-actions">
          {onRevert && <button className="icon-button" onClick={onRevert} title={t.revertTitle}><RevertIcon />{t.revert}</button>}
          {onSave && <button className="icon-button" onClick={onSave}><SaveIcon />{t.save}</button>}
        </div>
      )}
      title={<><span className="led">{slotNumber(slot)}</span> {program.name || '—'}</>}
      summary={t.programSummary(chainLabel(program.chain), isExternalChain(program.chain), program.volume, program.threshold)}
      close={close}
    >
      <div className="drawer-body">
        {audio && preview && (
          <WaveformPlayer url={audio.url} name={program.name} preview={preview} disabled={audio.disabled} notice={audio.disabled ? t.previewModified : undefined} />
        )}
        <h3 className="drawer-section"><ChainIcon /> {t.effectChain}</h3>
        {edit ? (
          <ChainSelect info={info} value={program.chain} onSelect={(next) => { edit((p) => setProgramChain(p, next, info)); onChainChange?.(chainLabel(next)) }} />
        ) : (
          <p className="chain-flow-line">{chain?.slots.filter(Boolean).map((s) => s!.name).join(' → ') || t.unknownChain}</p>
        )}
        {(chain?.slots ?? []).map((chainSlot, fx) => {
          const effect = program.effects.find((e) => e.fx === fx)
          if (!chainSlot || !effect) return <div key={fx} className="fx fx-unused"><span className="fx-slot">FX{fx + 1}</span><span>{t.unused}</span></div>
          return edit
            ? <EffectEditor key={fx} effect={effect} card={Boolean(chainSlot.module)} edit={edit} />
            : <EffectBlock key={fx} effect={effect} card={Boolean(chainSlot.module)} variants={effect.variants} />
        })}
      </div>
    </Drawer>
  )
}

const chainFlow = (c: ChainInfo) => c.slots.filter(Boolean).map((s) => s!.name).join(' → ')

function ChainSelect({ info, value, onSelect }: { info: CardInfo; value: number; onSelect: (chain: number) => void }) {
  const card = info.available.filter((c) => isExternalChain(c.chain))
  const internal = info.available.filter((c) => !isExternalChain(c.chain))
  const t = useT()
  const option = (c: ChainInfo) => <option key={c.chain} value={c.chain}>{c.label} · {chainFlow(c)}</option>
  return (
    <label className="chain-select">
      <span className="sr-only">Chain</span>
      <select value={value} onChange={(e) => onSelect(Number(e.target.value))}>
        {!info.available.some((c) => c.chain === value) && <option value={value}>{chainLabel(value)} · {t.unknownOption}</option>}
        {card.length > 0 && <optgroup label={t.cardChainsGroup}>{card.map(option)}</optgroup>}
        <optgroup label={t.internalChainsGroup}>{internal.map(option)}</optgroup>
      </select>
    </label>
  )
}

function EffectEditor({ effect, card, edit }: { effect: EffectInfo; card: boolean; edit: (change: (p: A2Program) => A2Program) => void }) {
  const { fx } = effect
  const t = useT()
  return (
    <div className={`fx fx-edit ${effect.off ? 'is-off' : ''}`}>
      <span className="fx-slot">FX{fx + 1}</span>
      <div>
        <div className="fx-head">
          <strong>{effect.name.split(' · ')[0]}</strong>
          {card && <span className="fx-tag">{t.cardModule}</span>}
          <button
            role="switch"
            aria-checked={!effect.off}
            className="switch"
            onClick={() => edit((p) => setEffectOff(p, fx, !effect.off))}
            title={effect.off ? t.effectOffTitle : t.effectOnTitle}
          >
            <span className="switch-knob" />{effect.off ? 'OFF' : 'ON'}
          </button>
        </div>
        {effect.variants.length > 1 && (
          <label className="variant-select">
            <span>{t.variant}</span>
            <select value={effect.variation} onChange={(e) => edit((p) => setEffectVariation(p, fx, Number(e.target.value)))}>
              {effect.variants.map((v, i) => <option key={i} value={i}>{v}</option>)}
            </select>
          </label>
        )}
        {effect.params.map((param) => (
          param.def
            ? <ParamSlider key={param.index} param={param} onInput={(value) => edit((p) => setEffectParam(p, fx, param.index, value))} />
            : <p key={param.index} className="param-readonly"><span>{param.label}</span>{param.value} <em>{t.undocumented}</em></p>
        ))}
      </div>
    </div>
  )
}

/** One slider per parameter, limited to the documented internal values (step 1 = every possible value). */
function ParamSlider({ param, onInput }: { param: EffectParam; onInput: (value: number) => void }) {
  const def = param.def!
  const outOfRange = param.raw < def.min || param.raw > def.max
  const id = useId()
  const t = useT()
  return (
    <div className="param">
      <label htmlFor={id} className="param-label">{param.label}</label>
      <span className="param-bound">{def.format(def.min)}</span>
      <input id={id} type="range" min={def.min} max={def.max} step={1} value={Math.min(def.max, Math.max(def.min, param.raw))} onChange={(e) => onInput(Number(e.target.value))} />
      <span className="param-bound">{def.format(def.max)}</span>
      <output htmlFor={id} className={`param-value ${outOfRange ? 'out-of-range' : ''}`} title={outOfRange ? t.outOfRange : undefined}>{param.value}</output>
    </div>
  )
}

function EffectBlock({ effect, card, variants }: { effect: EffectInfo; card?: boolean; variants?: string[] }) {
  const t = useT()
  return (
    <div className={`fx ${effect.off ? 'is-off' : ''}`}>
      <span className="fx-slot">FX{effect.fx + 1}</span>
      <div>
        <strong>{effect.name}</strong>
        {card && <span className="fx-tag">{t.cardModule}</span>}
        {effect.off && <span className="fx-tag fx-off">OFF</span>}
        {variants && variants.length > 1 && <p className="fx-variants">{t.variants(variants.join(' · '))}</p>}
        {effect.params.length > 0 && (
          <ul className="fx-params">
            {effect.params.map((param, i) => <li key={i}><span>{param.label}</span>{param.value}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}

function ProgramRow({ program }: { program: ProgramInfo }) {
  const t = useT()
  return (
    <details className="info-row">
      <summary>
        <span className="led">{slotNumber(program.slot)}</span>
        <strong className="info-name">{program.name || '—'}</strong>
        <span className="chain-pill"><ChainIcon />{chainLabel(program.chain)}</span>
      </summary>
      <div className="info-detail">
        <p className="info-meta">{t.volumeThreshold(program.volume, program.threshold)}</p>
        {program.effects.map((effect) => <EffectBlock key={effect.fx} effect={effect} />)}
      </div>
    </details>
  )
}

function ChainRow({ chain }: { chain: ChainInfo }) {
  const card = isExternalChain(chain.chain)
  const t = useT()
  return (
    <details className="info-row">
      <summary>
        <span className="chain-pill"><ChainIcon />{chain.label}</span>
        <strong className="info-name chain-flow">{chain.slots.filter(Boolean).map((s) => s!.name).join(' → ') || '—'}</strong>
        <span className="info-count">{chain.programs.length ? t.programsShort(chain.programs.length) : t.chainUnused}</span>
      </summary>
      <div className="info-detail">
        <p className="info-meta">{card ? t.cardChainNote : t.internalChainNote}</p>
        {chain.slots.map((slot, fx) => slot && (
          <div key={fx} className="fx">
            <span className="fx-slot">FX{fx + 1}</span>
            <div>
              <strong>{slot.name}</strong>
              {slot.module && <span className="fx-tag">modulo card</span>}
              <p className="fx-variants">{(slot.module?.names ?? slot.group?.variants ?? []).join(' · ')}</p>
            </div>
          </div>
        ))}
        {chain.programs.length > 0 && <p className="info-meta">{t.usedBy(chain.programs.map(slotNumber).join(' '))}</p>}
      </div>
    </details>
  )
}
