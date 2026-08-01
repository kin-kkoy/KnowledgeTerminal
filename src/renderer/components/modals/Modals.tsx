/**
 * Every app-level modal, mounted once at the root so they work from the
 * dashboard and the workspace alike.
 */
import { useStore } from '../../store'
import { ErrorBoundary } from '../primitives/ErrorBoundary'
import { CloseOutGate } from './CloseOutGate'
import { ConfirmTabClose } from './ConfirmTabClose'
import { NewNoteModal } from './NewNoteModal'
import { RoughEdgeNotice } from './RoughEdgeNotice'
import { SettingsModal } from './SettingsModal'
import { ShortcutsModal } from './ShortcutsModal'
import { WorkflowModal } from './WorkflowModal'

export function Modals(): React.JSX.Element | null {
  const modal = useStore((s) => s.modal)
  const close = useStore((s) => s.closeModal)
  if (!modal) return null

  return (
    <ErrorBoundary label="Dialog">
      {modal === 'workflow' && <WorkflowModal onClose={close} />}
      {modal === 'shortcuts' && <ShortcutsModal onClose={close} />}
      {modal === 'settings' && <SettingsModal onClose={close} />}
      {modal === 'closeOut' && <CloseOutGate onClose={close} />}
      {modal === 'newNote' && <NewNoteModal onClose={close} />}
      {modal === 'confirmTabClose' && <ConfirmTabClose onClose={close} />}
      {modal === 'roughEdge' && <RoughEdgeNotice onClose={close} />}
    </ErrorBoundary>
  )
}
