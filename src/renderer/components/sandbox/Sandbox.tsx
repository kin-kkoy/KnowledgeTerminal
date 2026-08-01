/**
 * The Sandbox — the workspace editor.
 *
 * A separate SCREEN, not a panel. Three reasons, in order of weight:
 *
 *   1. It is the only place in the app allowed to create folders and write
 *      configuration. That deserves a boundary you cross deliberately, not a
 *      tab you can brush against while reading.
 *   2. It needs the whole window — a reorderable widget list and a forty-icon
 *      picker do not fit in a 320px rail.
 *   3. "Keep it out of the reading path" then costs nothing to maintain.
 *
 * It is CORE rather than a plugin: it configures core concepts and enumerates
 * core's own registries, and carrying it as a plugin would mean granting every
 * plugin the ability to write files — a bad trade for one consumer.
 *
 * It is NOT a Markdown editor and must not become one. The only document writes
 * in this application remain the task checkbox and the scaffold that runs once
 * when a workspace is created.
 */
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, FolderPlus } from 'lucide-react'
import { ICON_SET, type IconName } from '../../icons/registry'
import { platform } from '../../platform'
import { activatePlugins } from '../../plugins/registry'
import { guarded } from '../../roughEdges'
import { useStore } from '../../store'
import { NewWorkspace } from './NewWorkspace'
import { RepairView } from './RepairView'
import { AppearanceSection } from './sections/AppearanceSection'
import { FavoritesSection } from './sections/FavoritesSection'
import { FilesSection } from './sections/FilesSection'
import { IdentitySection } from './sections/IdentitySection'
import { KeybindingsSection } from './sections/KeybindingsSection'
import { LayoutSection } from './sections/LayoutSection'
import { MarkdownSection } from './sections/MarkdownSection'
import { NotesSection } from './sections/NotesSection'
import { PluginsSection } from './sections/PluginsSection'
import { RawSection } from './sections/RawSection'
import styles from './Sandbox.module.css'

interface Tab {
  id: string
  title: string
  icon: IconName
  hint: string
  /** Id in ROUGH_EDGES, when this section is one of the unfinished ones. */
  rough?: string
  render(): React.JSX.Element
}

const TABS: Tab[] = [
  {
    id: 'identity',
    title: 'Identity',
    icon: 'flag',
    hint: 'What this workspace is for',
    render: () => <IdentitySection />,
  },
  {
    id: 'files',
    title: 'Files',
    icon: 'folder',
    hint: 'What is indexed, shown, and how it looks',
    render: () => <FilesSection />,
  },
  {
    id: 'appearance',
    title: 'Appearance',
    icon: 'sparkles',
    hint: 'Theme, type and reading comfort',
    render: () => <AppearanceSection />,
  },
  {
    id: 'layout',
    title: 'Layout',
    icon: 'layers',
    hint: 'Panels, widgets and explorer sections',
    render: () => <LayoutSection />,
  },
  {
    id: 'favorites',
    title: 'Favorites',
    icon: 'star',
    hint: 'Pinned documents',
    render: () => <FavoritesSection />,
  },
  {
    id: 'markdown',
    title: 'Markdown',
    icon: 'fileText',
    hint: 'Which syntax extensions are on',
    render: () => <MarkdownSection />,
  },
  {
    id: 'notes',
    title: 'Notes & Gate',
    icon: 'calendar',
    hint: 'Daily notes and the close-out gate',
    render: () => <NotesSection />,
  },
  {
    id: 'plugins',
    rough: 'plugin-options',
    title: 'Plugins',
    icon: 'package',
    hint: 'What is active, and how it is configured',
    render: () => <PluginsSection />,
  },
  {
    id: 'keybindings',
    rough: 'keybindings',
    title: 'Keybindings',
    icon: 'code',
    hint: 'Overrides on the default keymap',
    render: () => <KeybindingsSection />,
  },
  {
    id: 'raw',
    title: 'Raw',
    icon: 'database',
    hint: 'settings.json exactly as it is on disk',
    render: () => <RawSection />,
  },
]

export function Sandbox(): React.JSX.Element {
  const workspace = useStore((s) => s.workspace)
  const problems = useStore((s) => s.settingsProblems)
  const setScreen = useStore((s) => s.setScreen)
  const intent = useStore((s) => s.sandboxIntent)
  const returnTo = useStore((s) => s.sandboxReturnTo)
  const [tab, setTab] = useState('identity')
  // Entering with no workspace open can only mean one thing, so that case does
  // not need the intent flag to say so.
  const [creating, setCreating] = useState(() => intent === 'create' || !workspace)
  /**
   * Did we ENTER the Sandbox to create, or open the form from inside it?
   *
   * It decides where Back goes. Arriving from the dashboard's "New workspace"
   * and changing your mind should return you to the dashboard — falling through
   * to the settings editor answers a question you never asked.
   */
  const [enteredToCreate] = useState(() => intent === 'create')

  useEffect(() => {
    if (!workspace) setCreating(true)
  }, [workspace])

  const current = useMemo(() => TABS.find((t) => t.id === tab) ?? TABS[0], [tab])

  // Back to wherever you came from — see `sandboxReturnTo`.
  const back = workspace && returnTo === 'workspace' ? 'workspace' : 'home'
  const leave = (): void => setScreen(back)

  if (creating) {
    return (
      <NewWorkspace
        onCancel={() => {
          // Back out of the Sandbox entirely if that is how we came in.
          if (enteredToCreate || !workspace) setScreen(returnTo === 'workspace' && workspace ? 'workspace' : 'home')
          else setCreating(false)
        }}
        onCreated={() => {
          setCreating(false)
          setTab('identity')
          // A workspace that was just created has no session to restore, so the
          // reading shell is the wrong place to land. Stay on the Sandbox, and
          // send the back button to the dashboard.
          setScreen('sandbox', 'edit', 'home')
        }}
      />
    )
  }

  return (
    <div className={styles.sandbox}>
      <header className={styles.bar}>
        <button type="button" className={styles.back} onClick={leave}>
          <ArrowLeft size={14} strokeWidth={2} />
          {back === 'workspace' ? 'Back to workspace' : 'Back to dashboard'}
        </button>

        <div className={styles.identity}>
          <span className={styles.title}>{workspace?.name ?? 'Sandbox'}</span>
          {workspace && <span className={styles.root}>{workspace.root}</span>}
        </div>

        <button
          type="button"
          className={styles.newBtn}
          onClick={guarded('new-workspace', () => setCreating(true))}
        >
          <FolderPlus size={14} strokeWidth={2} />
          New workspace
        </button>
      </header>

      {problems.length > 0 ? (
        <RepairView />
      ) : (
        <div className={styles.body}>
          <nav className={styles.rail} aria-label="Sandbox sections">
            {TABS.map((entry) => {
              const Glyph = ICON_SET[entry.icon]
              const on = entry.id === current?.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={on ? `${styles.tab} ${styles.tabOn}` : styles.tab}
                  aria-current={on ? 'page' : undefined}
                  onClick={
                    entry.rough ? guarded(entry.rough, () => setTab(entry.id)) : () => setTab(entry.id)
                  }
                >
                  <Glyph size={15} strokeWidth={1.8} className={styles.tabIcon} />
                  <span className={styles.tabText}>
                    <span className={styles.tabTitle}>{entry.title}</span>
                    <span className={styles.tabHint}>{entry.hint}</span>
                  </span>
                </button>
              )
            })}
          </nav>

          <main className={styles.pane}>
            <div className={styles.paneInner}>{current?.render()}</div>
          </main>
        </div>
      )}

      <footer className={styles.foot}>
        {problems.length > 0 ? (
          <>
            Nothing here will write to <code>.kt/settings.json</code> until it parses. Repairs have
            to happen in the file itself.
          </>
        ) : (
          <>
            Changes save as you make them, straight into <code>.kt/settings.json</code>. Keys this
            app does not recognise are left exactly where you put them — comments are not, because
            the file is strict JSON.
          </>
        )}
      </footer>
    </div>
  )
}

/**
 * Used by the Dashboard: open a workspace, then land in the Sandbox without
 * ever showing the reading shell.
 *
 * `activatePlugins` is not optional here. Plugin widgets and sections live in
 * the runtime registry, and only activation puts them there — without this the
 * Layout section would list every configured plugin widget as "not available"
 * and offer no way to add one back. It is idempotent (it deactivates first), so
 * calling it again on the way into the workspace is harmless.
 *
 * Session sync deliberately does NOT start: configuring is not a reading
 * session, and there is no scroll position to persist. `leave()` returns to the
 * Home screen for exactly that reason — going straight to the shell would show
 * a workspace whose session was never restored.
 */
export async function enterSandboxFor(root: string): Promise<void> {
  const store = useStore.getState()
  // The Sandbox always edits an OPEN workspace — main resolves settings writes
  // through the open-workspace registry, so there is no way to edit a folder
  // that has not been opened.
  const info = await store.openWorkspace(root)
  if (!info) return
  await activatePlugins(info)
  platform.setWindowTitle(`${info.name} — Sandbox`)
  store.setScreen('sandbox', 'edit', 'home')
}
