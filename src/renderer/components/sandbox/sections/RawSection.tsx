/**
 * settings.json exactly as it is on disk.
 *
 * Deliberately the RAW object rather than the parsed one. The schema strips
 * keys it does not model, so showing the parsed value would present a tidied
 * version of the user's file and imply we had thrown the rest away — which is
 * precisely what we go out of our way not to do.
 *
 * Read-only. Editing text here would be a second, worse editor.
 */
import { useCallback, useEffect, useState } from 'react'
import { Copy, FolderOpen, RefreshCw } from 'lucide-react'
import { platform } from '../../../platform'
import { useStore } from '../../../store'
import { FieldGroup } from '../../primitives/Field'
import styles from './RawSection.module.css'

export function RawSection(): React.JSX.Element {
  const workspace = useStore((s) => s.workspace)
  const settings = useStore((s) => s.settings)
  const runCommand = useStore((s) => s.runCommand)
  const pushNotice = useStore((s) => s.pushNotice)
  const [raw, setRaw] = useState<Record<string, unknown> | null>(null)

  const load = useCallback(async () => {
    if (!workspace) return
    const { raw: value } = await platform.readRawWorkspaceSettings(workspace.id)
    setRaw(value)
  }, [workspace])

  // Re-read whenever settings change, so this stays a mirror rather than a
  // snapshot taken when the tab happened to open.
  useEffect(() => void load(), [load, settings])

  const text = raw ? JSON.stringify(raw, null, 2) : ''
  const empty = raw !== null && Object.keys(raw).length === 0

  return (
    <FieldGroup title="settings.json">
      <p className={styles.note}>
        The file verbatim. Keys this app does not recognise are shown here and are preserved on
        every write — they are never round-tripped through the schema. Comments cannot survive,
        because the format is strict JSON.
      </p>

      <div className={styles.actions}>
        <button type="button" className={styles.action} onClick={() => void load()}>
          <RefreshCw size={13} strokeWidth={2} />
          Re-read
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            // platform.copyText, never navigator.clipboard — the renderer's
            // permission lockdown denies clipboard-write and the web API fails
            // silently.
            void platform.copyText(text)
            pushNotice({ level: 'info', message: 'settings.json copied' })
          }}
        >
          <Copy size={13} strokeWidth={2} />
          Copy
        </button>
        {workspace && (
          <button
            type="button"
            className={styles.action}
            onClick={() => void platform.revealInFileManager(workspace.id, '.kt/settings.json')}
          >
            <FolderOpen size={13} strokeWidth={2} />
            Show in folder
          </button>
        )}
        <button
          type="button"
          className={styles.action}
          onClick={() => runCommand('workspace.reloadSettings')}
        >
          Reload into the app
        </button>
      </div>

      {empty ? (
        <p className={styles.empty}>
          No settings file yet. One is written the first time you change anything here — and it
          holds only what you changed, not a dump of every default.
        </p>
      ) : (
        <pre className={styles.json}>{text}</pre>
      )}
    </FieldGroup>
  )
}
