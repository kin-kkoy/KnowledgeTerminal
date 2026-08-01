/**
 * The documents an answer rests on.
 *
 * Every answer in this app cites something, including the deterministic ones —
 * an answer you cannot check is an answer you have to take on faith, which is
 * the opposite of what a workspace-as-source-of-truth is for.
 *
 * Rows are real buttons so they are reachable by Tab without the overlay having
 * to implement its own roving focus.
 */
import { dirnameRel } from '@shared/paths'
import type { Evidence } from '@shared/answers'
import type { RelPath } from '@shared/types'
import styles from './Answer.module.css'

interface Props {
  items: Evidence[]
  onOpen(path: RelPath, opts: { alt: boolean }): void
}

export function EvidenceList({ items, onOpen }: Props): React.JSX.Element | null {
  if (items.length === 0) return null

  return (
    <div className={styles.evidence}>
      <div className={styles.evidenceLabel}>
        {items.length === 1 ? 'From this document' : `From these ${items.length} documents`}
      </div>
      {items.map((item) => {
        // Root-level files have no directory. Showing a bare "/" for them is
        // noise, not information.
        const dir = dirnameRel(item.path)
        return (
          <button
            key={`${item.path}#${item.headingSlug ?? ''}`}
            type="button"
            className={styles.row}
            onClick={(e) => onOpen(item.path, { alt: e.altKey })}
          >
            <span className={styles.rowTitle}>{item.title}</span>
            {item.reason && <span className={styles.rowReason}>{item.reason}</span>}
            {dir && <span className={styles.rowPath}>{dir}</span>}
          </button>
        )
      })}
    </div>
  )
}
