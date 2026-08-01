/**
 * A dialog you can move out of the way.
 *
 * Used by anything that asks you to go and do something in ANOTHER app. A
 * centred modal is the wrong shape for that job: it blocks the screen you need
 * and closes the moment you click past it. This one dims to mark the moment,
 * then lifts the dim as soon as you drag it — at which point it stops being a
 * wall and becomes a reference you work beside.
 *
 * It does not close on an outside click, and it has no backdrop dismissal.
 * Closing is always a deliberate act.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { GripHorizontal, Move, X } from 'lucide-react'
import styles from './DraggablePanel.module.css'

interface Props {
  /** Short label in the grip bar. */
  title: string
  children: ReactNode
  width?: number
  /** Omit to leave the panel with no close affordance of its own. */
  onClose?: () => void
}

export function DraggablePanel({ title, children, width = 430, onClose }: Props): React.JSX.Element {
  const [moved, setMoved] = useState(false)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ dx: number; dy: number } | null>(null)

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = panel.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    // Switch from centred to absolute placement BEFORE the first move, or the
    // translate(-50%,-50%) fights every pointer delta.
    setPos({ x: rect.left, y: rect.top })
    setMoved(true)
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const el = panel.current
    if (!drag.current || !el) return
    const maxX = window.innerWidth - el.offsetWidth
    const maxY = window.innerHeight - el.offsetHeight
    setPos({
      x: Math.max(0, Math.min(maxX, event.clientX - drag.current.dx)),
      y: Math.max(0, Math.min(maxY, event.clientY - drag.current.dy)),
    })
  }, [])

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  return (
    <>
      <div className={moved ? `${styles.dim} ${styles.lifted}` : styles.dim} aria-hidden />
      <div
        ref={panel}
        className={styles.panel}
        style={{
          width,
          ...(moved && pos ? { left: pos.x, top: pos.y, transform: 'none' } : {}),
        }}
        role="dialog"
        aria-modal={!moved}
        aria-label={title}
      >
        <div
          className={styles.grip}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <GripHorizontal size={14} strokeWidth={2} className={styles.dots} />
          <span className={styles.title}>{title}</span>
          {!moved && (
            <span className={styles.hint}>
              <Move size={12} strokeWidth={1.9} />
              drag me aside
            </span>
          )}
          {onClose && (
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close"
              // The grip owns pointer events; the button must not start a drag.
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>

        <div className={styles.body}>{children}</div>
      </div>
    </>
  )
}
