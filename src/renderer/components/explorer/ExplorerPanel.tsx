/**
 * The left panel.
 *
 * Section icons sit ON TOP of the panel rather than in a side rail, so the
 * width can be dragged right down without any of them being cut off, and the
 * panel's own toggle leads the row — it acts on the panel, so it belongs with
 * the panel rather than off in the title bar.
 *
 * Sections and their ORDER come from `layout.explorerSections`. Unknown ids are
 * skipped with a warning rather than throwing — that is what lets a workspace
 * list `curriculum` whether or not the plugin happens to be enabled.
 */
import { useMemo, type ComponentType } from 'react'
import { Compass, FilePlus2, PanelLeft, type LucideIcon } from 'lucide-react'
import { ICON_SET, iconByName } from '../../icons/registry'
import { useStore, useShallow } from '../../store'
import { ErrorBoundary } from '../primitives/ErrorBoundary'
import { MiscellaneousSection } from './MiscellaneousSection'
import { CORE_SECTIONS } from './sectionRegistry'
import styles from './ExplorerPanel.module.css'

interface Section {
  id: string
  title: string
  icon: LucideIcon
  render(): React.JSX.Element
}

export function ExplorerPanel(): React.JSX.Element {
  const configured = useStore(
    useShallow((s) => s.settings?.layout.explorerSections ?? ['tree', 'search', 'favorites']),
  )
  const pluginSections = useStore(useShallow((s) => s.sections))
  const active = useStore((s) => s.explorerSection)
  const setSection = useStore((s) => s.setExplorerSection)
  const toggleExplorer = useStore((s) => s.toggleExplorer)
  const runCommand = useStore((s) => s.runCommand)

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = []
    for (const id of configured) {
      const core = CORE_SECTIONS[id]
      if (core) {
        out.push({ id, title: core.title, icon: ICON_SET[core.icon], render: core.render })
        continue
      }
      const contributed = pluginSections[id]
      if (contributed) {
        const Component = contributed.component as ComponentType
        out.push({
          id,
          title: contributed.title,
          // `RegisteredSection.icon` has been part of the plugin API all along
          // and was being ignored — every contributed section got a graduation
          // cap regardless of what it was for.
          icon: iconByName(contributed.icon, 'layers'),
          render: () => <Component />,
        })
        continue
      }
      // Not a crash: a disabled plugin must leave the workspace usable.
      console.warn(`[explorer] unknown section "${id}" — skipped`)
    }
    return out
  }, [configured, pluginSections])

  const current = sections.find((s) => s.id === active) ?? sections[0]

  return (
    <div className={styles.panel}>
      <nav className={styles.tabs} role="tablist" aria-label="Explorer sections">
        <button
          type="button"
          className={`${styles.tab} ${styles.panelToggle}`}
          onClick={toggleExplorer}
          title="Hide side panel · Ctrl B"
          aria-label="Hide side panel"
        >
          <PanelLeft size={16} strokeWidth={1.8} />
        </button>

        {sections.map((section) => {
          const Icon = section.icon
          const on = section.id === current?.id
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={section.title}
              title={section.title}
              className={on ? `${styles.tab} ${styles.on}` : styles.tab}
              onClick={() => setSection(section.id)}
            >
              <Icon size={16} strokeWidth={1.8} />
            </button>
          )
        })}

        {/*
          The Lobby is a destination, not an explorer section — it opens as a
          tab in the reading pane. So it sits with the other ACTION buttons
          rather than in the section row above.
        */}
        <button
          type="button"
          className={`${styles.tab} ${styles.newNote}`}
          onClick={() => runCommand('lobby.open')}
          title="Lobby · Ctrl Shift L"
          aria-label="Open the Lobby"
        >
          <Compass size={16} strokeWidth={1.8} />
        </button>

        <button
          type="button"
          className={styles.tab}
          onClick={() => runCommand('notes.openToday')}
          title="New daily note"
          aria-label="New daily note"
        >
          <FilePlus2 size={16} strokeWidth={1.8} />
        </button>
      </nav>

      <p className={styles.heading}>{current?.title ?? 'Explorer'}</p>

      <div className={styles.content} role="tabpanel">
        {current ? (
          <ErrorBoundary label={current.title}>{current.render()}</ErrorBoundary>
        ) : (
          <p className={styles.empty}>No explorer sections configured.</p>
        )}
      </div>

      {/* Everything that is not Markdown, docked to the bottom. */}
      {current?.id === 'tree' && <MiscellaneousSection />}
    </div>
  )
}
