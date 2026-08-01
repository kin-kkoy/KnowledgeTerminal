/**
 * Where the active document sits in the tree. Each segment is clickable:
 * folders reveal in the explorer, the last segment is the document itself.
 */
import { segments, stem } from '@shared/paths'
import { useStore } from '../../store'
import styles from './Breadcrumbs.module.css'

export function Breadcrumbs(): React.JSX.Element | null {
  const path = useStore((s) => s.activeTab()?.path ?? null)
  const expandDirs = useStore((s) => s.expandDirs)
  const setSection = useStore((s) => s.setExplorerSection)
  const setSelected = useStore((s) => s.setSelectedPath)

  // The Lobby is a surface, not a file — a `kt://` URI split into crumbs reads
  // as nonsense ("kt: / lobby").
  if (!path || path.startsWith('kt://')) return null

  const parts = segments(path)

  return (
    <nav className={styles.crumbs} aria-label="Breadcrumbs">
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1
        const prefix = parts.slice(0, index + 1).join('/')
        return (
          <span key={prefix} className={styles.item}>
            {index > 0 && <span className={styles.sep}>/</span>}
            <button
              type="button"
              className={isLast ? `${styles.crumb} ${styles.current}` : styles.crumb}
              onClick={() => {
                setSection('tree')
                expandDirs(parts.slice(0, index + 1).map((_, i) => parts.slice(0, i + 1).join('/')))
                setSelected(path)
              }}
            >
              {isLast ? stem(part) : part}
            </button>
          </span>
        )
      })}
    </nav>
  )
}
