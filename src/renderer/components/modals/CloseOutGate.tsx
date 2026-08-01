/**
 * The close-out gate.
 *
 * A gate, not an alert. It dims the page to mark a boundary in the session —
 * but the instant you drag it aside the dim lifts and it becomes something you
 * work next to. A modal that blocks you from doing the very thing it is asking
 * for is the usual failure here; being movable is the fix.
 *
 * It never appears on a timer. It opens only when the session is deliberately
 * ended, because an unprompted modal mid-flow would be the most annoying thing
 * in the application.
 *
 * The confirm button is not taken on trust. The app already indexes the notes
 * folder, so it can simply SEE whether today's note exists and when it last
 * changed, and say so. Confirming with nothing there still works — you just
 * know.
 */
import { useCallback, useEffect, useState } from 'react'
import { stem } from '@shared/paths'
import { platform } from '../../platform'
import { useStore } from '../../store'
import { markSessionToday, noteTokens } from '../../store/sessionSync'
import { fillTemplate } from './NewNoteModal'
import { DraggablePanel } from './DraggablePanel'
import styles from './CloseOutGate.module.css'

interface Props {
  onClose(): void
}

/** Poll cadence while the gate is open. Cheap: one stat of one folder. */
const CHECK_MS = 4000

export function CloseOutGate({ onClose }: Props): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const workspaceId = useStore((s) => s.workspace?.id ?? null)
  const pushNotice = useStore((s) => s.pushNotice)
  const openDocument = useStore((s) => s.openDocument)
  const entryDocument = useStore((s) => s.settings?.workspace.entryDocument ?? null)

  const [found, setFound] = useState<{ at: number } | null>(null)
  const [skipping, setSkipping] = useState(false)
  const [reason, setReason] = useState('')

  const notes = settings?.notes
  const gateCfg = settings?.gate

  // ── watch the folder ────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId || !notes) return
    let cancelled = false

    const check = async (): Promise<void> => {
      try {
        const entries = await platform.listNotes(workspaceId, notes.root)
        if (cancelled) return
        const stamp = new Date().toISOString().slice(0, 10)
        const todays = entries.filter((e) => e.name.startsWith(stamp))
        const newest = todays.sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
        setFound(newest ? { at: newest.mtimeMs } : null)
      } catch {
        // An unreadable notes folder is a config problem, not a reason to
        // block the gate — the button still works.
      }
    }

    void check()
    const id = window.setInterval(() => void check(), CHECK_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [workspaceId, notes])

  const finish = useCallback(
    async (skipped: boolean) => {
      await markSessionToday()
      if (skipped) {
        // Recorded honestly rather than pretending the day closed cleanly —
        // otherwise the streak stops meaning anything.
        pushNotice({
          level: 'info',
          message: reason.trim() ? `Log skipped — ${reason.trim()}` : 'Log skipped today',
        })
      }
      onClose()
    },
    [onClose, pushNotice, reason],
  )

  const filename = notes ? fillTemplate(notes.filename, noteTokens()) : ''

  return (
    <DraggablePanel title="Close out">
      <h3 className={styles.title}>{gateCfg?.title ?? "Write today's log before you stop."}</h3>
      <p className={styles.lede}>{gateCfg?.body}</p>

      {notes && (
        <div className={styles.path}>
          {notes.root}/<br />
          <b>{filename}.md</b>
        </div>
      )}

      {notes && notes.prompts.length > 0 && (
        <ul className={styles.prompts}>
          {notes.prompts.map((prompt) => (
            <li key={prompt}>{prompt}</li>
          ))}
        </ul>
      )}

      {/*
        The workspace's entry document is the thing you maintain by hand — here
        it is PROGRESS.md, but core does not know that and must not. It reminds
        you to update whatever `workspace.entryDocument` names, and offers to
        open it, because "write the log" and "record where you actually are" are
        two different jobs and only one of them is the daily note.
      */}
      {entryDocument && (
        <div className={styles.entry}>
          <span className={styles.entryText}>
            Update <b>{stem(entryDocument)}</b> before you go — the honest state, not the plan.
          </span>
          <button
            type="button"
            className={styles.entryOpen}
            onClick={() => {
              openDocument(entryDocument)
              onClose()
            }}
          >
            Open it
          </button>
        </div>
      )}

      <div className={found ? `${styles.check} ${styles.found}` : styles.check}>
        <span className={styles.dot} />
        {found
          ? `Found today's note — last saved ${relativeShort(found.at)}.`
          : 'Watching that folder — nothing for today yet.'}
      </div>

      {skipping && (
        <input
          type="text"
          className={styles.reason}
          placeholder="Why? (optional)"
          value={reason}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void finish(true)
            if (e.key === 'Escape') setSkipping(false)
          }}
        />
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.done} onClick={() => void finish(false)}>
          Done — close out
        </button>
        {skipping ? (
          <button type="button" className={styles.skip} onClick={() => void finish(true)}>
            Skip anyway
          </button>
        ) : (
          <button type="button" className={styles.skip} onClick={() => setSkipping(true)}>
            Skip today
          </button>
        )}
      </div>
    </DraggablePanel>
  )
}

function relativeShort(at: number): string {
  const secs = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (secs < 60) return `${secs} seconds ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  return `${Math.round(mins / 60)} hours ago`
}
