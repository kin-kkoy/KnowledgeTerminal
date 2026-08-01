/**
 * Creating a workspace.
 *
 * One screen, four fields, one checkbox. The temptation here is a template
 * gallery; the useful thing is a folder that is immediately readable and
 * nothing you have to delete. So: settings.json from the form, a README that is
 * also the entry document, a PROGRESS.md with one unchecked task, and an empty
 * notes/daily/ so the daily-note action works on day one.
 *
 * Pointing this at a folder that already holds Markdown is a legitimate move —
 * adopting a pile of notes you already have. That path never overwrites, and
 * the starter files quietly step aside for anything already present.
 */
import { useState } from 'react'
import { ArrowLeft, Check, FolderOpen } from 'lucide-react'
import { platform } from '../../platform'
import { activatePlugins } from '../../plugins/registry'
import { useStore } from '../../store'
import { TextInput } from './controls'
import styles from './NewWorkspace.module.css'

export function NewWorkspace({
  onCancel,
  onCreated,
}: {
  onCancel(): void
  onCreated(): void
}): React.JSX.Element {
  const applyInfo = useStore((s) => s.applyWorkspaceInfo)
  const pushNotice = useStore((s) => s.pushNotice)
  const refreshTree = useStore((s) => s.refreshTree)

  const [root, setRoot] = useState<string | null>(null)
  const [empty, setEmpty] = useState(true)
  /**
   * The folder is already a workspace. `initSettings` will not overwrite its
   * settings.json — correct, but it means the identity fields below would be
   * quietly discarded, so we say so and turn them off rather than take input we
   * intend to ignore.
   */
  const [adopting, setAdopting] = useState(false)
  const [name, setName] = useState('')
  const [mission, setMission] = useState('')
  const [goal, setGoal] = useState('')
  const [starterFiles, setStarterFiles] = useState(true)
  const [busy, setBusy] = useState(false)

  const pick = async (): Promise<void> => {
    const picked = await platform.pickWorkspaceFolder()
    if (!picked) return
    const { empty: isEmpty, hasSettings } = await platform.inspectFolder(picked)
    setRoot(picked)
    setEmpty(isEmpty)
    setAdopting(hasSettings)
    if (name.trim() === '') setName(picked.split('/').filter(Boolean).pop() ?? '')
  }

  const create = async (): Promise<void> => {
    if (!root) return
    setBusy(true)
    try {
      // `undefined`, not `null`, for the fields left blank: the settings file
      // is written sparsely, and an explicit null is a decision to record where
      // there was none. Absent means "whatever the app's default is".
      const info = await platform.createWorkspace(
        root,
        {
          workspace: {
            name: name.trim() || undefined,
            mission: mission.trim() || undefined,
            goal: goal.trim() || undefined,
            ...(starterFiles ? { entryDocument: 'README.md' } : {}),
          },
        },
        starterFiles && !adopting,
      )
      applyInfo(info)
      // Adopting an existing folder can mean adopting its plugin config too —
      // without this the Layout section would list those widgets as "not
      // available". A genuinely new folder configures no plugins, so this is a
      // no-op there rather than a special case.
      await activatePlugins(info)
      platform.setWindowTitle(`${info.name} — Sandbox`)
      await refreshTree()
      onCreated()
    } catch (err) {
      pushNotice({ level: 'error', message: 'Could not create workspace', detail: String(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.inner}>
        <button type="button" className={styles.back} onClick={onCancel}>
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>

        <h1 className={styles.title}>New workspace</h1>
        <p className={styles.lede}>
          A workspace is a folder of Markdown plus one settings file. Nothing here is a format you
          are locked into — move the folder, rename things, open it in any editor.
        </p>

        <section className={styles.block}>
          <h2 className={styles.label}>Folder</h2>
          <button type="button" className={styles.picker} onClick={() => void pick()}>
            <FolderOpen size={15} strokeWidth={1.8} />
            {root ?? 'Choose or create a folder…'}
          </button>
          {root && adopting ? (
            <p className={styles.warn}>
              This folder is already a workspace — it has its own{' '}
              <code>.kt/settings.json</code>. That file wins and is left exactly as it is, so the
              fields below will not be applied. Open it and edit them in the Sandbox instead.
            </p>
          ) : (
            root &&
            !empty && (
              <p className={styles.warn}>
                This folder already has files in it. They will be left alone — nothing here
                overwrites anything, and the starter files step aside for what is already there.
              </p>
            )
          )}
        </section>

        <section className={styles.block}>
          <h2 className={styles.label}>Name</h2>
          <TextInput
            value={name}
            placeholder="Workspace"
            disabled={adopting}
            onCommit={setName}
          />
          <p className={styles.hint}>Shown in the window title and on the dashboard.</p>
        </section>

        <section className={styles.block}>
          <h2 className={styles.label}>Mission</h2>
          <TextInput
            value={mission}
            multiline
            disabled={adopting}
            placeholder="What are you doing here? One or two sentences."
            onCommit={setMission}
          />
        </section>

        <section className={styles.block}>
          <h2 className={styles.label}>Goal</h2>
          <TextInput
            value={goal}
            multiline
            disabled={adopting}
            placeholder="The single long-range target. Deliberately one, not a list."
            onCommit={setGoal}
          />
        </section>

        <section className={styles.block}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={starterFiles && !adopting}
              disabled={adopting}
              onChange={(e) => setStarterFiles(e.target.checked)}
            />
            <span>
              <strong>Add starter files</strong>
              <span className={styles.checkHint}>
                README.md (set as the entry document), PROGRESS.md, and an empty notes/daily/.
                Without these a new workspace opens onto an empty tree.
              </span>
            </span>
          </label>
        </section>

        <button
          type="button"
          className={styles.create}
          disabled={!root || busy}
          onClick={() => void create()}
        >
          <Check size={15} strokeWidth={2.2} />
          {busy ? 'Opening…' : adopting ? 'Open this workspace' : 'Create workspace'}
        </button>
      </div>
    </div>
  )
}
