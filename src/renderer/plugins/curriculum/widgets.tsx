/**
 * The curriculum plugin's context-panel widgets.
 *
 * These render inside the same `WidgetFrame` the core widgets use, so a reader
 * cannot tell which came from a plugin — which is the correct outcome.
 */
import { useStore } from '../../store'
import { chaptersOf, completionOf, currentChapter } from './model'
import { useCurriculum } from './store'
import styles from './widgets.module.css'

interface WidgetProps {
  options: Record<string, unknown>
}

export function CurrentModule({ options }: WidgetProps): React.JSX.Element {
  const { curriculum, progress, error } = useCurriculum()
  const openDocument = useStore((s) => s.openDocument)
  const showEstimate = options['showEstimate'] !== false

  if (error) return <p className={styles.unset}>{error}</p>
  if (!curriculum) return <p className={styles.unset}>Loading…</p>

  const chapter = currentChapter(curriculum, progress)
  if (!chapter) {
    return <p className={styles.unset}>Every chapter on the core spine is complete.</p>
  }

  const next = chapter.topics.find((t) => !progress.done.includes(t.id))

  return (
    <div className={styles.module}>
      <button
        type="button"
        className={styles.title}
        onClick={() => chapter.doc && openDocument(chapter.doc)}
        disabled={!chapter.doc}
        title={chapter.doc ?? chapter.label}
      >
        {chapter.label}
      </button>

      {showEstimate && chapter.est && <p className={styles.meta}>{chapter.est}</p>}

      {next && (
        <p className={styles.next}>
          <span className={styles.nextLabel}>Next</span> {next.label}
        </p>
      )}

      {chapter.checkpoint && (
        <p className={styles.meta}>
          Gate: <code>{chapter.checkpoint}</code>
        </p>
      )}
    </div>
  )
}

export function CurriculumProgress({ options }: WidgetProps): React.JSX.Element {
  const { curriculum, progress } = useCurriculum()
  if (!curriculum) return <p className={styles.unset}>Loading…</p>

  const wanted = Array.isArray(options['branches'])
    ? (options['branches'] as string[])
    : curriculum.branches.map((b) => b.key)

  const branches = curriculum.branches.filter(
    (b) => wanted.includes(b.key) && chaptersOf(curriculum, b.key).length > 0,
  )

  return (
    <div className={styles.bars}>
      {branches.map((branch) => {
        const { done, total } = completionOf(curriculum, progress, branch.key)
        const pct = total === 0 ? 0 : Math.round((done / total) * 100)
        return (
          <div key={branch.key} className={styles.bar}>
            <div className={styles.barHead}>
              <span className={styles.barLabel}>{branch.label}</span>
              <span className={styles.barCount}>
                {done}/{total}
              </span>
            </div>
            {/* A flat track and a flat fill. No gradient, no animation. */}
            <div className={styles.track}>
              <div
                className={styles.fill}
                style={{ width: `${pct}%`, background: branch.color }}
                role="progressbar"
                aria-valuenow={done}
                aria-valuemin={0}
                aria-valuemax={total}
                aria-label={branch.label}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
