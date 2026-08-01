/**
 * One or two panes side by side.
 *
 * Capped at two deliberately: the spec asks for a split view, not a tiling
 * window manager, and a recursive layout tree would be a lot of machinery whose
 * only consumer is itself.
 */
import { useCallback, useRef } from 'react'
import { useStore, useShallow } from '../../store'
import { Pane } from './Pane'
import styles from './PaneGroup.module.css'

const MIN_RATIO = 0.2
const MAX_RATIO = 0.8
const KEY_STEP = 0.05

export function PaneGroup({ showRestore = false }: { showRestore?: boolean }): React.JSX.Element {
  const paneIds = useStore(useShallow((s) => s.panes.map((p) => p.id)))
  const sizes = useStore(useShallow((s) => s.paneSizes))
  const setPaneSizes = useStore((s) => s.setPaneSizes)

  const container = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const setRatio = useCallback(
    (ratio: number) => {
      const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
      setPaneSizes([clamped, 1 - clamped])
    },
    [setPaneSizes],
  )

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [])

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || !container.current) return
      const rect = container.current.getBoundingClientRect()
      setRatio((event.clientX - rect.left) / rect.width)
    },
    [setRatio],
  )

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const current = sizes[0] ?? 0.5
      if (event.key === 'ArrowLeft') setRatio(current - KEY_STEP)
      else if (event.key === 'ArrowRight') setRatio(current + KEY_STEP)
      else return
      event.preventDefault()
    },
    [setRatio, sizes],
  )

  const first = paneIds[0]
  if (!first) return <div className={styles.group} />

  return (
    <div className={styles.group} ref={container}>
      <div className={styles.slot} style={{ flexGrow: sizes[0] ?? 1 }}>
        <Pane paneId={first} showRestore={showRestore} />
      </div>

      {paneIds[1] && (
        <>
          <div
            className={styles.divider}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize split"
            aria-valuenow={Math.round((sizes[0] ?? 0.5) * 100)}
            aria-valuemin={MIN_RATIO * 100}
            aria-valuemax={MAX_RATIO * 100}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
          />
          <div className={styles.slot} style={{ flexGrow: sizes[1] ?? 1 }}>
            <Pane paneId={paneIds[1]} />
          </div>
        </>
      )}
    </div>
  )
}
