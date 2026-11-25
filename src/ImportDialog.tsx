import { useEffect, useRef, useState } from 'react'
import { useT } from './i18n'
import { NewIcon, OpenIcon } from './icons'

/**
 * Lets the user add card dumps from their own computer to the library. The files are read in
 * the browser and kept there; the user must first confirm they take responsibility for them.
 */
export function ImportDialog({ close, onFiles }: { close: () => void; onFiles: (files: File[]) => void }) {
  const t = useT()
  const dialog = useRef<HTMLDialogElement>(null)
  const filesInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    dialog.current?.showModal()
    // Folder selection is a non-standard attribute that React does not type.
    folderInput.current?.setAttribute('webkitdirectory', '')
  }, [])

  function pick(input: HTMLInputElement) {
    const files = [...(input.files ?? [])]
    input.value = ''
    if (!files.length) return
    close()
    onFiles(files)
  }

  const site = <a href="https://korgaseries.info/user_cards.php" target="_blank" rel="noopener noreferrer">korgaseries.info</a>
  return (
    <dialog ref={dialog} className="dialog import-dialog" onClose={close} onCancel={close}>
      <h3>{t.importTitle}</h3>
      <p>{t.importIntro(site)}</p>
      <p className="import-privacy">{t.importPrivacy}</p>
      <label className="import-consent">
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
        <span>{t.importConsent}</span>
      </label>
      <div className="dialog-actions">
        <button type="button" onClick={close}>{t.cancel}</button>
        <button type="button" className="icon-button" disabled={!accepted} onClick={() => folderInput.current?.click()}><OpenIcon />{t.chooseFolder}</button>
        <button type="button" className="icon-button primary" disabled={!accepted} onClick={() => filesInput.current?.click()}><NewIcon />{t.chooseFiles}</button>
      </div>
      <input ref={filesInput} hidden type="file" multiple accept=".syx,.SYX" onChange={(e) => pick(e.currentTarget)} />
      <input ref={folderInput} hidden type="file" multiple onChange={(e) => pick(e.currentTarget)} />
    </dialog>
  )
}
