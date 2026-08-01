/**
 * A single pane: its tab strip, the document, and the outline beside it.
 */
import { useStore } from '../../store'
import { ErrorBoundary } from '../primitives/ErrorBoundary'
import { DocumentView } from './DocumentView'
import { LOBBY_PATH, Lobby } from './Lobby'
import { OutlinePanel } from './OutlinePanel'
import { TabStrip } from './TabStrip'
import styles from './Pane.module.css'

interface Props {
  paneId: string
  /** Only the leftmost pane hosts the side-panel restore button. */
  showRestore?: boolean
}

export function Pane({ paneId, showRestore = false }: Props): React.JSX.Element {
  const pane = useStore((s) => s.panes.find((p) => p.id === paneId))
  const isActive = useStore((s) => s.activePaneId === paneId)
  const splitCount = useStore((s) => s.panes.length)
  const outlineVisible = useStore((s) => s.outlineVisible)
  const setActivePane = useStore((s) => s.setActivePane)
  const setFocusZone = useStore((s) => s.setFocusZone)

  if (!pane) return <div className={styles.pane} />

  const activeTab = pane.tabs.find((t) => t.id === pane.activeTabId) ?? null
  // The outline only earns its space when there is room and something to show.
  const showOutline =
    outlineVisible && activeTab !== null && activeTab.path !== LOBBY_PATH && splitCount === 1

  return (
    <section
      className={isActive && splitCount > 1 ? `${styles.pane} ${styles.active}` : styles.pane}
      onFocus={() => {
        setActivePane(paneId)
        setFocusZone('document')
      }}
      onMouseDown={() => setActivePane(paneId)}
      aria-label={splitCount > 1 ? (isActive ? 'Active pane' : 'Pane') : undefined}
    >
      <TabStrip paneId={paneId} showRestore={showRestore} />

      <div className={styles.body}>
        {activeTab?.path === LOBBY_PATH ? (
          <Lobby />
        ) : activeTab ? (
          <>
            <ErrorBoundary label="Document" key={activeTab.id}>
              <DocumentView tabId={activeTab.id} path={activeTab.path} paneId={paneId} />
            </ErrorBoundary>
            {showOutline && <OutlinePanel tabId={activeTab.id} />}
          </>
        ) : (
          /*
           * Nothing open. The Lobby is what the room looks like empty — the
           * keyboard-hint card it replaced only ever told you how to leave.
           */
          <Lobby />
        )}
      </div>
    </section>
  )
}
