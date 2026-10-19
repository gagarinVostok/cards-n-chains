import { useEffect, useRef, useState } from 'react'
import { useT } from './i18n'

/**
 * In-app replacement for window.confirm/prompt, which some embedded browsers
 * (e.g. the Claude app's preview pane) silently suppress.
 */
export type DialogRequest = {
  title: string
  body?: string
  confirmLabel: string
  /** When set, the dialog asks for a text value (like window.prompt). */
  input?: { value: string; maxLength: number }
  onConfirm: (value: string) => void
}

export function Dialog({ request, close }: { request: DialogRequest; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(request.input?.value ?? '')
  const t = useT()

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    close()
    request.onConfirm(value)
  }

  return (
    <dialog ref={ref} className="dialog" onClose={close} onCancel={close}>
      <form onSubmit={submit}>
        <h3>{request.title}</h3>
        {request.body && <p>{request.body}</p>}
        {request.input && (
          <input autoFocus value={value} maxLength={request.input.maxLength} onChange={(e) => setValue(e.target.value)} onFocus={(e) => e.target.select()} />
        )}
        <div className="dialog-actions">
          <button type="button" onClick={close}>{t.cancel}</button>
          <button type="submit" className="primary" autoFocus={!request.input}>{request.confirmLabel}</button>
        </div>
      </form>
    </dialog>
  )
}
