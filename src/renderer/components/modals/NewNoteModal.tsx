/**
 * "New daily note" — a handoff, not a creation.
 *
 * Knowledge Terminal does not write this file. It works out what the note
 * should be CALLED and what frontmatter it should carry, and hands you both to
 * paste into whichever notes app you actually write in.
 *
 * That keeps the app read-only, and — more practically — keeps it from writing
 * into a vault whose owning app is running, which is how notes get clobbered.
 */
import { platform } from '../../platform'
import { useCallback, useState } from 'react'
import { Check, ChevronRight, Copy } from 'lucide-react'
import { useStore } from '../../store'
import { noteTokens } from '../../store/sessionSync'
import { DraggablePanel } from './DraggablePanel'
import styles from './NewNoteModal.module.css'

/** Substitute `{{token}}` from the merged plugin token bag, plus the date. */
export function fillTemplate(template: string, tokens: Record<string, string>): string {
  const all: Record<string, string> = {
    date: new Date().toISOString().slice(0, 10),
    ...tokens,
  }
  return template
    .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => all[key] ?? '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function CopyButton({ value, label }: { value: string; label: string }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(() => {
    void platform.copyText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }, [value])

  return (
    <button
      type="button"
      className={copied ? `${styles.copy} ${styles.copied}` : styles.copy}
      onClick={copy}
      aria-label={label}
      title={label}
    >
      {copied ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={1.9} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

export function NewNoteModal({ onClose }: { onClose(): void }): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const [open, setOpen] = useState(false)

  const notes = settings?.notes
  const tokens = noteTokens()
  const name = notes ? fillTemplate(notes.filename, tokens) : ''
  const today = new Date().toISOString().slice(0, 10)

  const frontmatter = [
    '---',
    `title: ${name}`,
    `date: ${today}`,
    'kind: daily',
    '---',
    '',
  ].join('\n')

  return (
    // Draggable, because the whole point is to keep the frontmatter visible
    // WHILE you paste it into another app.
    <DraggablePanel title="Today's note" width={470} onClose={onClose}>
      <p className={styles.lede}>
        Create this in your notes app. Knowledge Terminal does not write it — it just works out what
        it should be called.
      </p>

      <p className={styles.label}>File name</p>
      <div className={styles.field}>
        <code className={styles.name}>{name}</code>
        <CopyButton value={name} label="Copy the file name" />
      </div>

      <section className={open ? `${styles.acc} ${styles.accOpen}` : styles.acc}>
        <button
          type="button"
          className={styles.accHead}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronRight size={12} strokeWidth={2.4} className={styles.chev} />
          Frontmatter
          <span className={styles.accHint}>paste at the top of the note</span>
        </button>

        {open && (
          <div className={styles.accBody}>
            <pre className={styles.block}>{frontmatter}</pre>
            <CopyButton value={frontmatter} label="Copy the frontmatter" />
          </div>
        )}
      </section>

      {notes && (
        <p className={styles.where}>
          Knowledge Terminal reads <code>{notes.root}</code> to check the note appeared — it never
          writes there.
        </p>
      )}
    </DraggablePanel>
  )
}
