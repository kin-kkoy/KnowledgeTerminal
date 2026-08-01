/**
 * A real, clickable task checkbox.
 *
 * remark-gfm renders `- [ ]` as a disabled `<input type="checkbox">`; this
 * replaces it with one that writes the change back to the file.
 *
 * Two details make it feel instant and stay correct:
 *  - the box flips OPTIMISTICALLY, before the write lands, because a 20ms
 *    round trip is still long enough to feel like lag on a click;
 *  - the write is suppressed from the watcher (see `markSelfWrite`), so our
 *    own change does not bounce back as an external edit and re-render the
 *    document under the reader.
 */
import { useCallback, useState } from 'react'
import { Check } from 'lucide-react'
import { platform } from '../../platform'
import { useStore } from '../../store'
import { markSelfWrite } from '../../hooks/useDocument'
import { toggleTaskAt } from '../tasks'
import styles from './TaskCheckbox.module.css'

interface Props {
  checked?: boolean
  /** Document order, injected by the rehype plugin. */
  'data-kt-task'?: string
  [key: string]: unknown
}

export function TaskCheckbox(props: Props): React.JSX.Element {
  const index = Number(props['data-kt-task'] ?? -1)
  const [checked, setChecked] = useState(Boolean(props.checked))
  const [busy, setBusy] = useState(false)

  const workspaceId = useStore((s) => s.workspace?.id ?? null)
  const path = useStore((s) => s.activeTab()?.path ?? null)
  const pushNotice = useStore((s) => s.pushNotice)

  const toggle = useCallback(async () => {
    if (busy || index < 0 || !workspaceId || !path) return
    const next = !checked

    setChecked(next) // optimistic
    setBusy(true)
    try {
      const file = await platform.readTextFile(workspaceId, path)
      const updated = toggleTaskAt(file.content, index, next)
      if (updated === null) {
        // The source did not look the way we expected — leave the file alone.
        setChecked(!next)
        pushNotice({ level: 'warn', message: 'Could not find that task in the file' })
        return
      }
      markSelfWrite(path)
      await platform.writeTextFile(workspaceId, path, updated)
    } catch (err) {
      setChecked(!next)
      pushNotice({ level: 'error', message: 'Could not update the task', detail: String(err) })
    } finally {
      setBusy(false)
    }
  }, [busy, checked, index, path, pushNotice, workspaceId])

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={checked ? `${styles.box} ${styles.done}` : styles.box}
      onClick={(e) => {
        e.preventDefault()
        void toggle()
      }}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  )
}
