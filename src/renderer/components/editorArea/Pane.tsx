/**
 * A single pane: its tab strip, the document, and the outline beside it.
 */
import { useStore } from '../../store'
import { ErrorBoundary } from '../primitives/ErrorBoundary'
import { DocumentView } from './DocumentView'
import { EmptyPane } from './EmptyPane'
import { LOBBY_PATH, LobbyPrototype } from './LobbyPrototype'
import { OutlinePanel } from './OutlinePanel'
import { TabStrip } from './TabStrip'
import styles from './Pane.module.css'

/**
 * PROTOTYPE SWITCH — throwaway. ON by default while the Lobby design is being
 * decided, so `npm run dev` shows it with no URL fiddling. It only appears when
 * a pane has NO tab open, which is the whole premise: the Lobby is the room, a
 * document is what you pick up in it.
 *
 * Set to `false` (or delete this and its import) to get the old EmptyPane back.
 */
const LOBBY_PROTOTYPE = true

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
          <LobbyPrototype />
        ) : activeTab ? (
          <>
            <ErrorBoundary label="Document" key={activeTab.id}>
              <DocumentView tabId={activeTab.id} path={activeTab.path} paneId={paneId} />
            </ErrorBoundary>
            {showOutline && <OutlinePanel tabId={activeTab.id} />}
          </>
        ) : LOBBY_PROTOTYPE ? (
          <LobbyPrototype /> /* PROTOTYPE — remove with LobbyPrototype.tsx */
        ) : (
          <EmptyPane />
        )}
      </div>
    </section>
  )
}
