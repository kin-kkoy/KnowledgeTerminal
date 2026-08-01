/**
 * The built-in context widgets.
 *
 * They all read from config or session state and never from anything
 * subject-specific — "Current Mission" is whatever `workspace.mission` says,
 * and the application has no opinion about what a mission is.
 */
import { useMemo } from 'react'
import { BookOpen, Clock, ListChecks, Map, Search, SquarePen, type LucideIcon } from 'lucide-react'
import { relativeTime, stem } from '@shared/paths'
import { ICON_SET, isIconName } from '../../../icons/registry'
import { platform } from '../../../platform'
import { useStore, useShallow } from '../../../store'
import { Icon } from '../../primitives/Icon'
import styles from './CoreWidgets.module.css'

type WidgetProps = { options: Record<string, unknown> }

/** Shown when the config asks for a widget the workspace has no data for. */
function Unset({ hint }: { hint: string }): React.JSX.Element {
  return <p className={styles.unset}>{hint}</p>
}

export function CurrentMission(): React.JSX.Element {
  const mission = useStore((s) => s.settings?.workspace.mission ?? null)
  if (!mission) return <Unset hint="Set a mission in the Sandbox, under Identity." />
  return <p className={styles.statement}>{mission}</p>
}

export function CurrentGoal(): React.JSX.Element {
  const goal = useStore((s) => s.settings?.workspace.goal ?? null)
  if (!goal) return <Unset hint="Set a goal in the Sandbox, under Identity." />
  return <p className={styles.statement}>{goal}</p>
}

export function OpenTabs(): React.JSX.Element {
  // Select `panes` directly and derive with useMemo. Building the flattened
  // objects INSIDE the selector would allocate fresh references on every call,
  // so even useShallow would report a change every time and the component would
  // re-render itself forever.
  const panes = useStore((s) => s.panes)
  const activateTab = useStore((s) => s.activateTab)

  const tabs = useMemo(
    () =>
      panes.flatMap((pane) =>
        pane.tabs.map((tab) => ({
          id: tab.id,
          paneId: pane.id,
          path: tab.path,
          pinned: tab.pinned,
          active: tab.id === pane.activeTabId,
        })),
      ),
    [panes],
  )

  if (tabs.length === 0) return <Unset hint="Nothing open." />

  return (
    <ul className={styles.list}>
      {tabs.map((tab) => (
        <li key={tab.id}>
          <button
            type="button"
            className={tab.active ? `${styles.row} ${styles.rowActive}` : styles.row}
            onClick={() => activateTab(tab.paneId, tab.id)}
            title={tab.path}
          >
            {tab.pinned && <Icon name="pin" size={10} />}
            <span className={styles.rowLabel}>{stem(tab.path)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function Recents({ options }: WidgetProps): React.JSX.Element {
  const limit = typeof options['limit'] === 'number' ? options['limit'] : 8
  const recents = useStore(useShallow((s) => s.recents.slice(0, limit)))
  const openDocument = useStore((s) => s.openDocument)

  if (recents.length === 0) return <Unset hint="Nothing opened yet." />

  return (
    <ul className={styles.list}>
      {recents.map((r) => (
        <li key={r.path}>
          <button
            type="button"
            className={styles.row}
            onClick={() => openDocument(r.path)}
            title={r.path}
          >
            <span className={styles.rowLabel}>{r.title}</span>
            <span className={styles.rowMeta}>{relativeTime(r.openedAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/**
 * Opens today's note, creating it if it does not exist yet. The path template
 * comes from config; `{{date}}` is the only substitution, deliberately — a
 * general template language here would be a feature nobody asked for.
 */
export function DailyNotes({ options }: WidgetProps): React.JSX.Element {
  const template = typeof options['path'] === 'string' ? options['path'] : 'notes/daily/{{date}}.md'
  const openDocument = useStore((s) => s.openDocument)
  const workspaceId = useStore((s) => s.workspace?.id ?? null)
  const pushNotice = useStore((s) => s.pushNotice)

  const today = new Date().toISOString().slice(0, 10)
  const path = template.replace('{{date}}', today)

  return (
    <button
      type="button"
      className={styles.action}
      onClick={async () => {
        if (!workspaceId) return
        if (!(await platform.exists(workspaceId, path))) {
          await platform.writeTextFile(
            workspaceId,
            path,
            `---\ntitle: ${today}\nkind: daily\n---\n\n# ${today}\n\n`,
          )
          pushNotice({ level: 'info', message: `Created ${path}` })
        }
        openDocument(path)
      }}
    >
      Open today’s note
      <span className={styles.actionMeta}>{today}</span>
    </button>
  )
}

interface QuickAction {
  label: string
  command: string
  args?: unknown[]
  /** A lucide icon name; falls back to the first letter of the label. */
  icon?: string
}

/**
 * A named icon wins; otherwise `guessIcon` reads the label. Names resolve
 * against the shared set, so anything the Sandbox's picker offers works here.
 */
function actionIcon(action: QuickAction): LucideIcon {
  if (action.icon && isIconName(action.icon)) return ICON_SET[action.icon]
  return guessIcon(action.label)
}

/**
 * Icons in a row rather than a stack of full-width buttons: four labelled
 * buttons took a third of the panel to say very little. Each expands to show
 * its label on hover, so nothing is lost.
 */
export function QuickActions({ options }: WidgetProps): React.JSX.Element {
  const actions = Array.isArray(options['actions']) ? (options['actions'] as QuickAction[]) : []
  const runCommand = useStore((s) => s.runCommand)

  if (actions.length === 0) {
    return <Unset hint="Add actions in the Sandbox, under Layout." />
  }

  return (
    <div className={styles.qaRow}>
      {actions.map((action) => {
        const Glyph = actionIcon(action)
        return (
          <button
            key={`${action.command}:${action.label}`}
            type="button"
            className={styles.qa}
            onClick={() => runCommand(action.command, action.args)}
            title={action.label}
          >
            <Glyph size={15} strokeWidth={1.8} className={styles.qaIcon} />
            <span className={styles.qaLabel}>{action.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Best-effort icon from the label, so config need not name one. */
function guessIcon(label: string): LucideIcon {
  const l = label.toLowerCase()
  if (l.includes('note')) return SquarePen
  if (l.includes('road') || l.includes('map')) return Map
  if (l.includes('search')) return Search
  if (l.includes('protocol') || l.includes('time')) return Clock
  if (l.includes('progress')) return BookOpen
  return ListChecks
}
