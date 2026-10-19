import { useEffect } from 'react'
import { useT } from './i18n'

const TOAST_MS = 5000

/** `id` changes on every notification, so repeating the same text restarts the timer. */
export type ToastMessage = { id: number; text: string }

export function Toast({ toast, close }: { toast: ToastMessage | null; close: () => void }) {
  const t = useT()
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(close, TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast?.id])

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && (
        <div key={toast.id} className="toast">
          <span>{toast.text}</span>
          <button className="toast-close" onClick={close} aria-label={t.closeNotification}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}
