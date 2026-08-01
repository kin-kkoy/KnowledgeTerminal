/**
 * "This part isn't finished yet."
 *
 * Shown once per feature per session before you use something on the rough
 * list. It is a heads-up, not a gate — Continue is the primary action and
 * Enter takes it.
 */
import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  ROUGH_EDGES,
  runPendingAction,
  setPendingAction,
  silence,
} from '../../roughEdges'
import { useStore } from '../../store'
import { Modal } from './Modal'
import styles from './RoughEdgeNotice.module.css'

export function RoughEdgeNotice({ onClose }: { onClose(): void }): React.JSX.Element | null {
  const id = useStore((s) => s.pendingRoughEdge)
  const setPending = useStore((s) => s.setPendingRoughEdge)
  const edge = id ? ROUGH_EDGES[id] : null

  const dismiss = (): void => {
    setPendingAction(null)
    setPending(null)
    onClose()
  }

  const proceed = (alsoSilence: boolean): void => {
    if (alsoSilence && id) silence(id)
    setPending(null)
    onClose()
    runPendingAction()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        proceed(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!edge) return null

  return (
    <Modal title="Not finished yet" onClose={dismiss}>
      <div className={styles.head}>
        <AlertTriangle size={18} strokeWidth={1.9} className={styles.icon} />
        <h3 className={styles.title}>{edge.title}</h3>
      </div>

      <p className={styles.summary}>{edge.summary}</p>

      <p className={styles.pointer}>
        The full list is in <code>ROUGH-EDGES.md</code> at the root of the project — see the{' '}
        <code>{edge.id}</code> section.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.go} onClick={() => proceed(false)} autoFocus>
          Continue
        </button>
        <button type="button" className={styles.quiet} onClick={() => proceed(true)}>
          Continue, don’t remind me this session
        </button>
        <button type="button" className={styles.cancel} onClick={dismiss}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
