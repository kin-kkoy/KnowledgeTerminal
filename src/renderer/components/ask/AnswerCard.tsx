/**
 * One answer, however it was produced.
 *
 * The same component renders a map lookup from layer 0 and streamed model prose
 * from layer 4, because from the reader's side they are the same thing: a
 * statement, what it rests on, and what to do next. The badge is the only place
 * the difference shows — and it always shows.
 */
import { LAYER_LABELS, type Answer } from '@shared/answers'
import type { RelPath } from '@shared/types'
import { store } from '../../store'
import { AnswerText } from './AnswerText'
import { EvidenceList } from './EvidenceList'
import styles from './Answer.module.css'

interface Props {
  answer: Answer
  onOpen(path: RelPath, opts: { alt: boolean }): void
}

export function AnswerCard({ answer, onOpen }: Props): React.JSX.Element {
  return (
    <div className={styles.card}>
      {/* The answer carries the visual weight; sources sit below it, quieter. */}
      <div className={styles.headline}>
        <div className={styles.header}>
          <span className={styles.badge}>{answer.source ?? LAYER_LABELS[answer.layer]}</span>
        </div>

        <AnswerText text={answer.text} />

        {answer.actions && answer.actions.length > 0 && (
          <div className={styles.actions}>
            {answer.actions.map((action) => (
              <button
                key={`${action.command}:${action.label}`}
                type="button"
                className={styles.action}
                onClick={() => store.get().runCommand(action.command, action.args)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <EvidenceList items={answer.evidence} onOpen={onOpen} />
    </div>
  )
}
