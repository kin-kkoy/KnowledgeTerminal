/**
 * "You pinned this — close it anyway?"
 *
 * Pinning is a statement that a tab should stay, so the one gesture that
 * contradicts it is worth a beat. Unpinned tabs close instantly; this never
 * appears for them.
 *
 * Enter confirms and Escape cancels, so the prompt costs a keystroke rather
 * than a trip to the mouse.
 */
import { useEffect } from 'react'
import { stem } from '@shared/paths'
import { LOBBY_PATH } from '../editorArea/LobbyPrototype'
import { useStore } from '../../store'
import { Modal } from './Modal'
import styles from './ConfirmTabClose.module.css'

export function ConfirmTabClose({ onClose }: { onClose(): void }): React.JSX.Element | null {
  const pending = useStore((s) => s.pendingTabClose)
  const panes = useStore((s) => s.panes)
  const closeTab = useStore((s) => s.closeTab)
  const togglePin = useStore((s) => s.togglePin)
  const setPending = useStore((s) => s.setPendingTabClose)

  const tab = pending
    ? (panes.find((p) => p.id === pending.paneId)?.tabs.find((t) => t.id === pending.tabId) ?? null)
    : null

  const dismiss = (): void => {
    setPending(null)
    onClose()
  }

  const confirm = (): void => {
    if (pending) closeTab(pending.paneId, pending.tabId)
    dismiss()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        confirm()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!pending || !tab) return null

  const label = tab.path === LOBBY_PATH ? 'Lobby' : stem(tab.path)

  return (
    <Modal title="Close pinned tab?" onClose={dismiss}>
      <p className={styles.lede}>
        <b>{label}</b> is pinned, which keeps it on the tab bar and out of the way of
        &ldquo;close others&rdquo;.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.confirm} onClick={confirm} autoFocus>
          Close it
        </button>
        <button
          type="button"
          className={styles.unpin}
          onClick={() => {
            // The likelier intent behind closing a pinned tab: it should not
            // have been pinned. Offer that without closing anything.
            togglePin(pending.paneId, pending.tabId)
            dismiss()
          }}
        >
          Just unpin it
        </button>
        <button type="button" className={styles.cancel} onClick={dismiss}>
          Keep it
        </button>
      </div>
    </Modal>
  )
}
