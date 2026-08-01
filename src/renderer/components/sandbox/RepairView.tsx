/**
 * What the Sandbox shows when settings.json does not parse.
 *
 * The editor is gone, not disabled-looking-but-clickable. Here is why that is
 * the only honest option: `parseConfig` returns the WHOLE fallback on any
 * failure, so when there are problems the app is running on defaults and does
 * not know what your file says. Offering to "save" from that state would write
 * our misreading over your work.
 *
 * So: show the file, show exactly what zod objected to and where, and give you
 * the two things that actually help — open it, and reload once you have fixed
 * it. Writing is blocked at the store level too (`patchSettings`), so nothing
 * else in the app can sneak a write past this either.
 */
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, FolderOpen, RefreshCw } from 'lucide-react'
import { platform } from '../../platform'
import { useStore } from '../../store'
import styles from './RepairView.module.css'

export function RepairView(): React.JSX.Element {
  const workspace = useStore((s) => s.workspace)
  const problems = useStore((s) => s.settingsProblems)
  const runCommand = useStore((s) => s.runCommand)
  const [raw, setRaw] = useState<string>('')

  const load = useCallback(async () => {
    if (!workspace) return
    const { raw: value } = await platform.readRawWorkspaceSettings(workspace.id)
    setRaw(JSON.stringify(value, null, 2))
  }, [workspace])

  useEffect(() => void load(), [load])

  return (
    <div className={styles.repair}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <AlertTriangle size={20} strokeWidth={1.8} className={styles.warn} />
          <div>
            <h2 className={styles.title}>This workspace’s settings could not be read</h2>
            <p className={styles.lede}>
              The app is running on defaults. Your file has not been touched and will not be — the
              Sandbox refuses to write while it cannot understand what is already there.
            </p>
          </div>
        </header>

        <section className={styles.problems}>
          <h3 className={styles.sectionTitle}>
            {problems.length} problem{problems.length === 1 ? '' : 's'}
          </h3>
          <ul className={styles.list}>
            {problems.map((problem, index) => {
              const [path, ...rest] = problem.split(': ')
              return (
                <li key={index} className={styles.problem}>
                  <code className={styles.path}>{path}</code>
                  <span className={styles.message}>{rest.join(': ')}</span>
                </li>
              )
            })}
          </ul>
        </section>

        <div className={styles.actions}>
          {workspace && (
            <button
              type="button"
              className={styles.primary}
              onClick={() => void platform.revealInFileManager(workspace.id, '.kt/settings.json')}
            >
              <FolderOpen size={14} strokeWidth={2} />
              Show settings.json
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              runCommand('workspace.reloadSettings')
              void load()
            }}
          >
            <RefreshCw size={14} strokeWidth={2} />
            I fixed it — reload
          </button>
        </div>

        {raw && (
          <section>
            <h3 className={styles.sectionTitle}>The file as it stands</h3>
            <pre className={styles.json}>{raw}</pre>
          </section>
        )}
      </div>
    </div>
  )
}
