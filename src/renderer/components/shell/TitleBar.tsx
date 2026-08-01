/**
 * The top strip: workspace name, breadcrumbs, and the app-level dialogs.
 *
 * The panel toggles used to live here. They now sit with the panels they
 * control — the side panel's in its own icon row, the context panel's in its
 * Today header — so a control is always next to the thing it affects.
 */
import { HelpCircle, Keyboard, Settings } from 'lucide-react'
import { useStore } from '../../store'
import { Breadcrumbs } from '../editorArea/Breadcrumbs'
import styles from './TitleBar.module.css'

export function TitleBar(): React.JSX.Element {
  const name = useStore((s) => s.workspace?.name ?? 'Knowledge Terminal')
  const openModal = useStore((s) => s.openModal)
  const goHome = useStore((s) => s.setScreen)

  return (
    <header className={styles.titlebar}>
      <button
        type="button"
        className={styles.workspace}
        onClick={() => goHome('home')}
        title="Back to the dashboard"
      >
        <span className={styles.mark} />
        {name}
      </button>

      <div className={styles.breadcrumbs}>
        <Breadcrumbs />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => openModal('workflow')}
          title="How a session works"
          aria-label="How a session works"
        >
          <HelpCircle size={15} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => openModal('shortcuts')}
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
        >
          <Keyboard size={15} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          className={styles.toggle}
          onClick={() => openModal('settings')}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={15} strokeWidth={1.9} />
        </button>
      </div>
    </header>
  )
}
