/**
 * The three-panel workspace: Explorer | Content | Context.
 *
 * A flex row rather than a CSS grid, because the resizers need to sit between
 * panels as real elements with their own hit areas and focus.
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store'
import { ErrorBoundary } from '../primitives/ErrorBoundary'
import { ContextPanel } from '../context/ContextPanel'
import { ExplorerPanel } from '../explorer/ExplorerPanel'
import { PaneGroup } from '../editorArea/PaneGroup'
import { AskOverlay } from '../overlays/AskOverlay'
import { CommandPalette } from '../overlays/CommandPalette'
import { QuickOpen } from '../overlays/QuickOpen'
import { SearchOverlay } from '../overlays/SearchOverlay'
import { Resizer } from './Resizer'
import { StatusBar } from './StatusBar'
import { TitleBar } from './TitleBar'
import styles from './WorkspaceShell.module.css'

function Overlays(): React.JSX.Element | null {
  const overlay = useStore((s) => s.overlay)
  if (!overlay) return null
  return (
    <ErrorBoundary label="Overlay">
      {overlay === 'quickOpen' && <QuickOpen />}
      {overlay === 'commands' && <CommandPalette />}
      {overlay === 'search' && <SearchOverlay />}
      {overlay === 'ask' && <AskOverlay />}
    </ErrorBoundary>
  )
}

/**
 * How long the restore button waits before appearing.
 *
 * Sequenced on purpose: the panel goes, a beat passes, then the button fades in
 * as the tab row opens a gap for it. Appearing in the same frame as a
 * collapsing panel reads as a glitch; a held beat reads as a response.
 *
 * Half a second — long enough to separate the two events, short enough that it
 * never feels like waiting for the app to catch up.
 */
const RESTORE_DELAY_MS = 500

export function WorkspaceShell(): React.JSX.Element {
  const explorerVisible = useStore((s) => s.explorerVisible)
  const explorerWidth = useStore((s) => s.explorerWidth)
  const contextVisible = useStore((s) => s.contextVisible)
  const contextWidth = useStore((s) => s.contextWidth)
  const setExplorerWidth = useStore((s) => s.setExplorerWidth)
  const setContextWidth = useStore((s) => s.setContextWidth)

  const [showRestore, setShowRestore] = useState(!explorerVisible)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    if (explorerVisible) {
      // Going the other way it leaves at once — nothing is waiting on it.
      setShowRestore(false)
    } else {
      timer.current = window.setTimeout(() => setShowRestore(true), RESTORE_DELAY_MS)
    }
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [explorerVisible])

  return (
    <div className={styles.shell}>
      <TitleBar />

      <div className={styles.body}>
        {explorerVisible && (
          <>
            <aside className={styles.explorer} style={{ width: explorerWidth }}>
              <ErrorBoundary label="Explorer">
                <ExplorerPanel />
              </ErrorBoundary>
            </aside>
            <Resizer
              value={explorerWidth}
              min={190}
              max={560}
              side="left"
              label="Resize explorer"
              onChange={setExplorerWidth}
            />
          </>
        )}

        <main className={styles.content}>
          <ErrorBoundary label="Document area">
            <PaneGroup showRestore={showRestore} />
          </ErrorBoundary>
        </main>

        {contextVisible && (
          <>
            <Resizer
              value={contextWidth}
              min={220}
              max={560}
              side="right"
              label="Resize context panel"
              onChange={setContextWidth}
            />
            <aside className={styles.context} style={{ width: contextWidth }}>
              <ErrorBoundary label="Context panel">
                <ContextPanel />
              </ErrorBoundary>
            </aside>
          </>
        )}
      </div>

      <StatusBar />
      <Overlays />
    </div>
  )
}
