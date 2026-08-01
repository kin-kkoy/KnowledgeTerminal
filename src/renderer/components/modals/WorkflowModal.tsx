/**
 * "How a session works" — the universal loop, not this workspace's curriculum.
 *
 * Kept generic on purpose: the steps describe how to use the APPLICATION, so
 * they read the same whether the workspace is about C#, Rust or nothing in
 * particular.
 */
import { Modal } from './Modal'
import styles from './WorkflowModal.module.css'

const STEPS: Array<{ title: string; detail: string }> = [
  {
    title: 'Open · 2 min',
    detail:
      "Launch. The dashboard already shows today's work — you never go looking for it. Press Enter to begin, or Shift+Enter to land back on the exact line you left.",
  },
  {
    title: 'Warm up · 10 min',
    detail:
      'Retrieval, not rereading. Redo something cold, or explain a topic aloud. Rereading feels like learning and is not.',
  },
  {
    title: 'Work · 60–90 min',
    detail:
      'Follow the day block in order, ticking each box as you finish it. The checkboxes are real — they are written back into the file, so your progress lives with your notes.',
  },
  {
    title: 'Stuck?',
    detail:
      'Blocked more than thirty minutes: write the question down, mark it, and move on. Being stuck is information, not failure.',
  },
  {
    title: 'Close out · 5 min',
    detail:
      "End the session deliberately. A gate appears asking for today's log — write it in whatever notes app you use, then confirm. Drag the gate aside if you need the screen.",
  },
  {
    title: 'Bad day?',
    detail:
      'Do the minimum: warm-up plus one sub-task, thirty minutes. The streak survives and the plan does not get renegotiated downward.',
  },
]

export function WorkflowModal({ onClose }: { onClose(): void }): React.JSX.Element {
  return (
    <Modal title="How a session works" onClose={onClose}>
      <p className={styles.lede}>
        The same six steps every day. The point is that none of them requires a decision.
      </p>
      <ol className={styles.steps}>
        {STEPS.map((step, i) => (
          <li key={step.title} className={styles.step}>
            <span className={styles.n}>{i + 1}</span>
            <div>
              <p className={styles.t}>{step.title}</p>
              <p className={styles.d}>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  )
}
