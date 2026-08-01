/**
 * The shared list shape used by Favorites, Recents and Bookmarks.
 *
 * Three panels that look identical but are implemented three times drift apart
 * within a month; one component with an `entries` prop does not.
 */
import { basename, dirnameRel } from '@shared/paths'
import type { RelPath } from '@shared/types'
import { useStore } from '../../store'
import { Icon, type IconName } from '../primitives/Icon'
import styles from './EntryList.module.css'

export interface Entry {
  key: string
  path: RelPath
  label: string
  /** Right-aligned metadata: a timestamp, a note, a folder. */
  meta?: string
  /** Jump to a heading within the document. */
  headingSlug?: string | null
}

interface Props {
  entries: Entry[]
  icon: IconName
  emptyMessage: string
  onRemove?(entry: Entry): void
}

export function EntryList({ entries, icon, emptyMessage, onRemove }: Props): React.JSX.Element {
  const openDocument = useStore((s) => s.openDocument)
  const selectedPath = useStore((s) => s.selectedPath)

  if (entries.length === 0) return <p className={styles.empty}>{emptyMessage}</p>

  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <li key={entry.key}>
          <div className={entry.path === selectedPath ? `${styles.row} ${styles.active}` : styles.row}>
            <button
              type="button"
              className={styles.open}
              onClick={() => openDocument(entry.path)}
              title={entry.path}
            >
              <span className={styles.icon}>
                <Icon name={icon} size={13} />
              </span>
              <span className={styles.text}>
                <span className={styles.label}>{entry.label || basename(entry.path)}</span>
                <span className={styles.meta}>{entry.meta ?? dirnameRel(entry.path)}</span>
              </span>
            </button>

            {onRemove && (
              <button
                type="button"
                className={styles.remove}
                onClick={() => onRemove(entry)}
                aria-label={`Remove ${entry.label}`}
                title="Remove"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
