/**
 * What a pane shows with nothing open.
 *
 * Keyboard hints rather than a graphic: this is the moment the user is most
 * likely to be deciding what to do next, so the shortcuts belong here.
 */
import { useStore } from '../../store'
import styles from './EmptyPane.module.css'

const HINTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['Ctrl', 'P'], label: 'Open a document' },
  { keys: ['Ctrl', 'Shift', 'P'], label: 'Run a command' },
  { keys: ['Ctrl', '/'], label: 'Search the workspace' },
  { keys: ['Ctrl', 'B'], label: 'Toggle the explorer' },
  { keys: ['Ctrl', 'J'], label: 'Toggle the context panel' },
]

export function EmptyPane(): React.JSX.Element {
  const entryDocument = useStore((s) => s.settings?.workspace.entryDocument ?? null)
  const openDocument = useStore((s) => s.openDocument)

  return (
    <div className={styles.empty}>
      <dl className={styles.hints}>
        {HINTS.map((hint) => (
          <div key={hint.label} className={styles.hint}>
            <dt className={styles.keys}>
              {hint.keys.map((key) => (
                <kbd key={key} className={styles.kbd}>
                  {key}
                </kbd>
              ))}
            </dt>
            <dd className={styles.label}>{hint.label}</dd>
          </div>
        ))}
      </dl>

      {entryDocument && (
        <button type="button" className={styles.entry} onClick={() => openDocument(entryDocument)}>
          Open {entryDocument}
        </button>
      )}
    </div>
  )
}
