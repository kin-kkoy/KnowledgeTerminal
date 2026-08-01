/**
 * The right panel.
 *
 * The widget list, their order and their options all come from
 * `layout.contextWidgets` in the workspace's settings.json. Core widgets and
 * plugin widgets resolve from the same map, so a workspace can reorder or drop
 * either without touching source.
 *
 * Two rules make this safe:
 *   - an unknown widget id is skipped with a console warning, never a crash;
 *   - each widget renders inside its own boundary, so one broken widget shows a
 *     message in its frame instead of blanking the panel.
 */
import { useMemo } from 'react'
import { PanelRight } from 'lucide-react'
import { useStore, useShallow } from '../../store'
import { ErrorBoundary } from '../primitives/ErrorBoundary'
import { WidgetFrame } from './WidgetFrame'
import { CORE_WIDGETS } from './widgetRegistry'
import styles from './ContextPanel.module.css'

export function ContextPanel(): React.JSX.Element {
  const configured = useStore(useShallow((s) => s.settings?.layout.contextWidgets ?? []))
  const pluginWidgets = useStore(useShallow((s) => s.widgets))
  const toggleContextPanel = useStore((s) => s.toggleContextPanel)

  const resolved = useMemo(() => {
    return configured.flatMap((entry) => {
      const core = CORE_WIDGETS[entry.id]
      if (core) return [{ ...entry, title: core.title, component: core.component }]

      const contributed = pluginWidgets[entry.id]
      if (contributed) {
        return [{ ...entry, title: contributed.title, component: contributed.component }]
      }

      console.warn(`[context] unknown widget "${entry.id}" — skipped`)
      return []
    })
  }, [configured, pluginWidgets])

  if (resolved.length === 0) {
    return (
      <div className={styles.panel}>
        <p className={styles.empty}>
          No context widgets configured. Add them in the Sandbox, under Layout.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      {resolved.map((widget, index) => {
        const Component = widget.component
        // The panel's own control rides on the FIRST widget's header row; when
        // the panel is hidden the same button reappears beside Split.
        const action =
          index === 0 ? (
            <button
              type="button"
              className={styles.collapse}
              onClick={toggleContextPanel}
              title="Hide context panel · Ctrl J"
              aria-label="Hide context panel"
            >
              <PanelRight size={14} strokeWidth={1.9} />
            </button>
          ) : undefined
        return (
          <ErrorBoundary
            key={widget.id}
            label={widget.title}
            fallback={(error) => (
              <div className={styles.failed}>
                <p className={styles.failedTitle}>{widget.id} failed to render</p>
                <p className={styles.failedDetail}>{error.message}</p>
              </div>
            )}
          >
            <WidgetFrame title={widget.title} defaultCollapsed={widget.collapsed} action={action}>
              <Component options={widget.options} />
            </WidgetFrame>
          </ErrorBoundary>
        )
      })}
    </div>
  )
}
