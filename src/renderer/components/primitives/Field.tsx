/**
 * One labelled setting: name, hint, control, optional value readout, optional
 * reset.
 *
 * Lifted out of SettingsModal so the Sandbox is visibly the same idea at a
 * larger size rather than a second design. The reset button is always in the
 * DOM but invisible and untabbable until the value differs from its default —
 * a control that appears and disappears reflows the row under the cursor.
 */
import { RotateCcw } from 'lucide-react'
import styles from './Field.module.css'

interface FieldProps {
  name: string
  hint?: string
  /** A short readout of the current value, right-aligned in monospace. */
  value?: string
  changed?: boolean
  onReset?(): void
  /** Put the control on its own line — for lists and anything wide. */
  stacked?: boolean
  children: React.ReactNode
}

export function Field({
  name,
  hint,
  value,
  changed,
  onReset,
  stacked,
  children,
}: FieldProps): React.JSX.Element {
  return (
    <div className={stacked ? `${styles.row} ${styles.stacked}` : styles.row}>
      <div className={styles.head}>
        <div className={styles.text}>
          <div className={styles.name}>{name}</div>
          {hint && <div className={styles.hint}>{hint}</div>}
        </div>
        {!stacked && children}
        {value !== undefined && <span className={styles.value}>{value}</span>}
        {onReset && (
          <button
            type="button"
            className={changed ? `${styles.reset} ${styles.show}` : styles.reset}
            onClick={onReset}
            title="Reset to default"
            aria-label={`Reset ${name}`}
            tabIndex={changed ? 0 : -1}
          >
            <RotateCcw size={13} strokeWidth={2} />
          </button>
        )}
      </div>
      {stacked && <div className={styles.body}>{children}</div>}
    </div>
  )
}

/** A small uppercase heading between groups of fields. */
export function FieldGroup({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>{title}</h3>
      {children}
    </section>
  )
}
