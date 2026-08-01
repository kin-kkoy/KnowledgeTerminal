/**
 * The shared chrome around every context widget: a title, a collapse toggle,
 * and a hairline separator. Widgets supply content only, so a plugin widget is
 * visually indistinguishable from a core one.
 */
import { useState, type ReactNode } from 'react'
import { Icon } from '../primitives/Icon'
import styles from './WidgetFrame.module.css'

interface Props {
  title: string
  defaultCollapsed?: boolean
  /** Rendered at the far right of the header row — the panel's own controls. */
  action?: ReactNode
  children: ReactNode
}

export function WidgetFrame({
  title,
  defaultCollapsed = false,
  action,
  children,
}: Props): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  return (
    <section className={styles.widget}>
      <div className={styles.headRow}>
        <button
          type="button"
          className={styles.header}
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
        >
          <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={11} />
          <span className={styles.title}>{title}</span>
        </button>
        {action}
      </div>
      {!collapsed && <div className={styles.body}>{children}</div>}
    </section>
  )
}
