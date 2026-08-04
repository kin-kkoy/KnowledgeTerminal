/**
 * The Curriculum explorer section: branch → chapter → topic.
 *
 * Only nodes carrying a `doc` are openable. The rest — crossroads, topics whose
 * content lives inside their chapter — show their summary inline instead of
 * pretending to be links that go nowhere.
 */
import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, Circle } from 'lucide-react'
import { useStore } from '../../store'
import { chaptersOf, type CurriculumNode } from './model'
import { useCurriculum, updateProgress } from './store'
import styles from './CurriculumView.module.css'

function NodeRow({
  node,
  color,
  depth,
  done,
  onToggleDone,
}: {
  node: CurriculumNode
  color: string
  depth: number
  done: Set<string>
  onToggleDone(id: string): void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const openDocument = useStore((s) => s.openDocument)
  const isDone = done.has(node.id)
  const hasChildren = node.topics.length > 0
  const openable = Boolean(node.doc)

  return (
    <li>
      <div
        className={styles.row}
        style={{ paddingLeft: 8 + depth * 12, borderLeftColor: depth === 0 ? color : 'transparent' }}
      >
        <button
          type="button"
          className={styles.check}
          onClick={() => onToggleDone(node.id)}
          aria-label={isDone ? `Mark ${node.label} not done` : `Mark ${node.label} done`}
          title={isDone ? 'Completed' : 'Mark complete'}
        >
          {isDone ? <Check size={12} strokeWidth={2.4} /> : <Circle size={10} strokeWidth={1.6} />}
        </button>

        {/* The whole row opens the module's document. Expanding is the
            chevron's job, so a click never has to be aimed. */}
        <button
          type="button"
          className={openable ? styles.label : styles.labelPlain}
          onClick={() => {
            if (node.doc) openDocument(node.doc)
            else if (hasChildren || node.summary) setOpen((o) => !o)
          }}
          title={node.doc ?? node.summary ?? node.label}
        >
          <span className={isDone ? styles.textDone : styles.text}>{node.label}</span>
          {node.est && <span className={styles.est}>{node.est}</span>}
        </button>

        {(hasChildren || node.summary) && (
          <button
            type="button"
            className={styles.expand}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </div>

      {open && (
        <>
          {node.summary && (
            <p className={styles.summary} style={{ paddingLeft: 30 + depth * 12 }}>
              {node.summary}
            </p>
          )}
          {(node.chapter || node.worked) && (
            <div className={styles.docs} style={{ paddingLeft: 30 + depth * 12 }}>
              {node.chapter && (
                <button
                  type="button"
                  className={styles.docLink}
                  onClick={() => openDocument(node.chapter!)}
                  title={node.chapter}
                >
                  Read chapter
                </button>
              )}
              {node.worked && (
                <button
                  type="button"
                  className={styles.docLink}
                  /* Opened beside the chapter, because the two are meant to be
                     read together — same section numbers, teaching on the left,
                     finished source on the right. */
                  onClick={() => openDocument(node.worked!, { pane: 'right' })}
                  title={node.worked}
                >
                  Worked solution
                </button>
              )}
            </div>
          )}
          {hasChildren && (
            <ul>
              {node.topics.map((topic) => (
                <NodeRow
                  key={topic.id}
                  node={topic}
                  color={color}
                  depth={depth + 1}
                  done={done}
                  onToggleDone={onToggleDone}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}

export function CurriculumView(): React.JSX.Element {
  const { curriculum, progress, error } = useCurriculum()

  if (error) return <p className={styles.empty}>{error}</p>
  if (!curriculum) return <p className={styles.empty}>Loading curriculum…</p>

  const done = new Set(progress.done)

  const toggle = (id: string): void => {
    void updateProgress({
      ...progress,
      done: done.has(id) ? progress.done.filter((d) => d !== id) : [...progress.done, id],
    })
  }

  return (
    <div className={styles.view}>
      {curriculum.branches.map((branch) => {
        const chapters = chaptersOf(curriculum, branch.key)
        if (chapters.length === 0) return null
        const completed = chapters.filter((c) => done.has(c.id)).length

        return (
          <section key={branch.key} className={styles.branch}>
            <h3 className={styles.branchTitle}>
              <span className={styles.swatch} style={{ background: branch.color }} />
              {branch.label}
              <span className={styles.count}>
                {completed}/{chapters.length}
              </span>
            </h3>
            <ul>
              {chapters.map((chapter) => (
                <NodeRow
                  key={chapter.id}
                  node={chapter}
                  color={branch.color}
                  depth={0}
                  done={done}
                  onToggleDone={toggle}
                />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
