/**
 * The shared modal frame.
 *
 * Dims the page and nothing else — no drop shadow, no blur, no scale-in. The
 * dimming is what separates it from the page; a shadow on top of that is one
 * effect too many.
 */
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import styles from './Modal.module.css'

interface Props {
  title: string
  onClose(): void
  children: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, wide }: Props): React.JSX.Element {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div
      className={styles.backdrop}
      // Close only when the press lands on the backdrop ITSELF. Relying on
      // stopPropagation in the panel below is fragile — anything that
      // re-renders mid-gesture, or any child that swallows the event, leaves
      // the press looking like it came from the backdrop and dismisses the
      // dialog out from under the click.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className={wide ? `${styles.modal} ${styles.wide}` : styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className={styles.head}>
          <h3 className={styles.title}>{title}</h3>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={15} strokeWidth={1.9} />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  )
}
