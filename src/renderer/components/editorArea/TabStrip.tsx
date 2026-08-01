/**
 * Tabs for one pane, plus the view controls that belong with the document:
 * outline and split, and — while the side panel is hidden — its restore button
 * at the very front of the row, exactly where the panel used to be.
 */
import { useCallback, useRef, useState } from 'react'
import { Columns2, ListTree, PanelLeft, PanelRight, Pin, X } from 'lucide-react'
import { stem } from '@shared/paths'
import { LOBBY_PATH } from './Lobby'

/** The Lobby is not a file, so `stem()` would render its URI. */
const labelOf = (path: string): string => (path === LOBBY_PATH ? 'Lobby' : stem(path))
import { useStore } from '../../store'
import styles from './TabStrip.module.css'

interface Props {
  paneId: string
  showRestore?: boolean
}

export function TabStrip({ paneId, showRestore = false }: Props): React.JSX.Element | null {
  const pane = useStore((s) => s.panes.find((p) => p.id === paneId))
  const splitCount = useStore((s) => s.panes.length)
  const outlineVisible = useStore((s) => s.outlineVisible)
  const contextVisible = useStore((s) => s.contextVisible)
  const activateTab = useStore((s) => s.activateTab)
  const closeTab = useStore((s) => s.requestCloseTab)
  const togglePin = useStore((s) => s.togglePin)
  const moveTab = useStore((s) => s.moveTab)
  const splitRight = useStore((s) => s.splitRight)
  const closeSplit = useStore((s) => s.closeSplit)
  const toggleExplorer = useStore((s) => s.toggleExplorer)
  const toggleOutline = useStore((s) => s.toggleOutline)
  const toggleContextPanel = useStore((s) => s.toggleContextPanel)

  const dragFrom = useRef<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  const onDrop = useCallback(
    (to: number) => {
      const from = dragFrom.current
      dragFrom.current = null
      setDropAt(null)
      if (from !== null && from !== to) moveTab(paneId, from, to)
    },
    [moveTab, paneId],
  )

  if (!pane) return null

  return (
    <div className={styles.strip} role="tablist" aria-label="Open documents">
      {/* Present only while the side panel is hidden. Its width and opacity
          animate together, so the row opens a gap as the icon arrives. */}
      <button
        type="button"
        className={showRestore ? `${styles.lead} ${styles.leadOn}` : styles.lead}
        onClick={toggleExplorer}
        title="Show side panel · Ctrl B"
        aria-label="Show side panel"
        tabIndex={showRestore ? 0 : -1}
      >
        <PanelLeft size={15} strokeWidth={1.9} />
      </button>

      <div className={styles.tabs}>
        {pane.tabs.map((tab, index) => {
          const active = tab.id === pane.activeTabId
          const classes = [styles.tab]
          if (active) classes.push(styles.tabActive)
          if (dropAt === index) classes.push(styles.dropzone)
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              draggable
              onDragStart={() => {
                dragFrom.current = index
              }}
              onDragEnd={() => {
                dragFrom.current = null
                setDropAt(null)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                if (dragFrom.current !== null && dragFrom.current !== index) setDropAt(index)
              }}
              onDrop={(e) => {
                e.preventDefault()
                onDrop(index)
              }}
              className={classes.join(' ')}
              onClick={() => activateTab(paneId, tab.id)}
              onAuxClick={(e) => {
                if (e.button === 1) closeTab(paneId, tab.id)
              }}
              onDoubleClick={() => togglePin(paneId, tab.id)}
              title={tab.path}
            >
              {tab.pinned && <Pin size={11} strokeWidth={2} className={styles.pin} />}
              <span className={styles.label}>{labelOf(tab.path)}</span>
              <button
                type="button"
                className={styles.close}
                aria-label={`Close ${labelOf(tab.path)}`}
                onClick={(e) => {
                  e.stopPropagation()
                  closeTab(paneId, tab.id)
                }}
              >
                <X size={11} strokeWidth={2} />
              </button>
            </div>
          )
        })}
      </div>

      <div className={styles.tools}>
        <button
          type="button"
          className={outlineVisible ? `${styles.tool} ${styles.on}` : styles.tool}
          onClick={toggleOutline}
          title="Outline · Ctrl Shift O"
          aria-label="Toggle outline"
          aria-pressed={outlineVisible}
        >
          <ListTree size={15} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className={styles.tool}
          onClick={() => (splitCount > 1 ? closeSplit(paneId) : splitRight())}
          title={splitCount > 1 ? 'Close split' : 'Split right · Ctrl \\'}
          aria-label={splitCount > 1 ? 'Close split' : 'Split right'}
        >
          <Columns2 size={15} strokeWidth={1.9} />
        </button>
        {/* Mirrors the side panel: while the context panel is hidden its control
            lives here, next to Split. When it is open, it lives in the panel. */}
        {!contextVisible && (
          <button
            type="button"
            className={styles.tool}
            onClick={toggleContextPanel}
            title="Show context panel · Ctrl J"
            aria-label="Show context panel"
          >
            <PanelRight size={15} strokeWidth={1.9} />
          </button>
        )}
      </div>
    </div>
  )
}
