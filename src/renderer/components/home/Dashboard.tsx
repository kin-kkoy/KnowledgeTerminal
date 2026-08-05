/**
 * The dashboard. First thing the app shows, and it answers one question:
 * what should I be doing right now?
 *
 * Deliberately sparse. One sentence, one button, and everything else folded
 * into a panel that peeks on hover and stays when pinned — because a dashboard
 * that shows you eleven things has not decided anything on your behalf.
 *
 * It renders from `home-snapshot.json`, a small file written whenever the
 * mission, goal or recents change, so the real content is in the FIRST frame.
 * No splash, no spinner, no skeleton.
 */
import { useCallback, useEffect, useState } from 'react'
import { Flame, FolderPlus, HelpCircle, Keyboard, Pin, SlidersHorizontal } from 'lucide-react'
import { relativeTime } from '@shared/paths'
import type { HomeSnapshot, RecentWorkspace } from '@shared/types'
import { platform } from '../../platform'
import { useStore } from '../../store'
import { guarded } from '../../roughEdges'
import { enterSandboxFor } from '../sandbox/Sandbox'
import styles from './Dashboard.module.css'

interface Props {
  onResume(root: string, opts?: { lastDocument?: boolean }): Promise<void>
  onOpenModal(which: 'workflow' | 'shortcuts' | 'settings'): void
}

/**
 * Fill in anything a snapshot from an older build is missing.
 *
 * This file is on disk and outlives any one version of the app, so reading it
 * defensively is not paranoia — a snapshot written before `tasks` existed would
 * otherwise take the whole dashboard down on launch.
 */
function normalise(snap: HomeSnapshot | null): HomeSnapshot | null {
  if (!snap) return null
  return {
    ...snap,
    eyebrow: snap.eyebrow ?? null,
    headline: snap.headline ?? null,
    streak: snap.streak ?? null,
    nextGate: snap.nextGate ?? null,
    progressLabel: snap.progressLabel ?? null,
    progressValue: snap.progressValue ?? null,
    board: snap.board ?? null,
    tasks: Array.isArray(snap.tasks) ? snap.tasks : [],
    links: Array.isArray(snap.links) ? snap.links : [],
    recents: Array.isArray(snap.recents) ? snap.recents : [],
  }
}

export function Dashboard({ onResume, onOpenModal }: Props): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<HomeSnapshot | null>(null)
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([])
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)
  const setScreen = useStore((s) => s.setScreen)

  useEffect(() => {
    let cancelled = false
    void Promise.all([platform.readHomeSnapshot(), platform.listRecentWorkspaces()]).then(
      ([snap, recents]) => {
        if (cancelled) return
        setSnapshot(normalise(snap))
        setRecentWorkspaces(recents)
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const target = snapshot?.root ?? recentWorkspaces[0]?.root ?? null

  /** Configure a workspace without reading it: open it, then land in Sandbox. */
  const openSandbox = useCallback(async (root: string | null) => {
    if (!root) return setScreen('sandbox', 'create')
    await enterSandboxFor(root)
  }, [setScreen])

  const begin = useCallback(
    async (lastDocument = false) => {
      if (busy) return
      if (!target) {
        const root = await platform.pickWorkspaceFolder()
        if (root) await onResume(root)
        return
      }
      setBusy(true)
      try {
        await onResume(target, { lastDocument })
      } finally {
        setBusy(false)
      }
    },
    [busy, onResume, target],
  )

  // Enter begins; Shift+Enter resumes exactly where you left off.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey) return
      event.preventDefault()
      void begin(event.shiftKey)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [begin])

  const mission = snapshot?.mission ?? null
  const name = snapshot?.workspaceName ?? recentWorkspaces[0]?.name ?? 'No workspace yet'

  return (
    <main className={styles.screen}>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <span className={styles.mark} />
          <span className={styles.ws}>{name}</span>
          <span className={styles.tools}>
            <button
              type="button"
              className={styles.tool}
              onClick={() => onOpenModal('workflow')}
              title="How a session works"
              aria-label="How a session works"
            >
              <HelpCircle size={15} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={styles.tool}
              onClick={() => onOpenModal('shortcuts')}
              title="Keyboard shortcuts"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard size={15} strokeWidth={1.9} />
            </button>
            {/*
              The Sandbox rather than the settings dialog. The dialog needs an
              OPEN workspace to say anything — from here it could only ever
              report "No workspace open." The Sandbox works either way: it edits
              the workspace you are about to resume, or offers to create one.
            */}
            <button
              type="button"
              className={styles.tool}
              onClick={() => void openSandbox(target)}
              title="Configure workspace"
              aria-label="Configure workspace"
            >
              <SlidersHorizontal size={15} strokeWidth={1.9} />
            </button>
            <button
              type="button"
              className={styles.tool}
              onClick={guarded('new-workspace', () => setScreen('sandbox', 'create', 'home'))}
              title="New workspace"
              aria-label="New workspace"
            >
              <FolderPlus size={15} strokeWidth={1.9} />
            </button>
          </span>
        </header>

        {snapshot?.eyebrow && <p className={styles.eyebrow}>{snapshot.eyebrow}</p>}
        <h1 className={styles.title}>{snapshot?.headline ?? name}</h1>
        {mission && <p className={styles.desc}>{mission}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void begin(false)}>
            {target ? 'Begin' : 'Open a workspace folder'}
            {target && <kbd className={styles.kbd}>Enter</kbd>}
          </button>
          {target && (
            <button type="button" className={styles.ghost} onClick={() => void begin(true)}>
              Resume last document
              <kbd className={styles.kbd}>Shift</kbd>
              <kbd className={styles.kbd}>Enter</kbd>
            </button>
          )}
        </div>

        <div className={styles.stats}>
          {typeof snapshot?.streak === 'number' && snapshot.streak > 0 && (
            <div className={styles.streak}>
              <Flame size={19} strokeWidth={1.8} className={styles.flame} />
              <div>
                <div className={styles.streakN}>{snapshot.streak}</div>
                <div className={styles.streakK}>Day streak</div>
              </div>
            </div>
          )}
          <Stat label="Last session" value={snapshot?.lastSessionAt ? relativeTime(snapshot.lastSessionAt) : 'never'} />
          {snapshot?.nextGate && <Stat label="Next gate" value={snapshot.nextGate} />}
          {snapshot?.progressLabel && (
            <Stat label={snapshot.progressLabel} value={snapshot.progressValue ?? ''} />
          )}
        </div>

        {/* Peeks on hover; the pin makes it stay. */}
        <div className={pinned ? `${styles.reveal} ${styles.pinned}` : styles.reveal}>
          <div className={styles.revealHead}>
            <button
              type="button"
              className={styles.pin}
              onClick={() => setPinned((p) => !p)}
              title={pinned ? 'Unpin' : 'Keep this open'}
              aria-pressed={pinned}
            >
              <Pin size={14} strokeWidth={1.9} />
            </button>
            Everything else
            <span className={styles.pinHint}>
              {pinned ? 'pinned open' : 'hover to peek · pin to keep'}
            </span>
          </div>

          <div className={styles.panel}>
            {snapshot && snapshot.tasks.length > 0 && (
              <section className={styles.card}>
                <p className={styles.cardTitle}>Today's tasks</p>
                <ul className={styles.tasks}>
                  {snapshot.tasks.slice(0, 5).map((task) => (
                    <li key={task.text} className={task.done ? styles.taskDone : styles.task}>
                      <span className={styles.box}>{task.done ? '✓' : ''}</span>
                      {task.text}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {snapshot && snapshot.recents.length > 0 && (
              <section className={styles.card}>
                <p className={styles.cardTitle}>Recent</p>
                <ul className={styles.recents}>
                  {snapshot.recents.slice(0, 5).map((doc) => (
                    <li key={doc.path}>
                      <button
                        type="button"
                        className={styles.recent}
                        onClick={async () => {
                          if (!target) return
                          await onResume(target)
                          useStore.getState().openDocument(doc.path)
                        }}
                      >
                        {doc.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {recentWorkspaces.length > 1 && (
              <section className={styles.card}>
                <p className={styles.cardTitle}>Other workspaces</p>
                <ul className={styles.recents}>
                  {recentWorkspaces
                    .filter((w) => w.root !== target)
                    .slice(0, 4)
                    .map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          className={styles.recent}
                          onClick={() => void onResume(w.root)}
                          title={w.root}
                        >
                          {w.name}
                        </button>
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {snapshot?.quote && (
          <blockquote className={styles.quote}>
            {snapshot.quote.text}
            {snapshot.quote.source && <cite className={styles.cite}>{snapshot.quote.source}</cite>}
          </blockquote>
        )}
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className={styles.stat}>
      <div className={styles.statK}>{label}</div>
      <div className={styles.statV}>{value}</div>
    </div>
  )
}
