import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/** A bottom sheet — the phone-native way to show a form without losing your place. */
export function Sheet({ title, onClose, children }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // Stop the page behind from scrolling while the sheet is open.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    const focusable = bodyRef.current?.querySelector<HTMLElement>('input, button, select, textarea')
    focusable?.focus()
  }, [])

  return (
    <div className="sheet-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__head">
          <h2 className="sheet__title">{title}</h2>
          <button className="sheet__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="sheet__body" ref={bodyRef}>
          {children}
        </div>
      </div>
    </div>
  )
}
