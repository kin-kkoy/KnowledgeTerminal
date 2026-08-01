/**
 * Every binding, grouped, read from the LIVE keymap.
 *
 * Generated from the same registry the keyboard handler uses, so a rebinding in
 * settings.json shows up here automatically and this can never drift out of
 * date the way a hand-written list would.
 */
import { useMemo } from 'react'
import { DEFAULT_KEYBINDINGS } from '@shared/commands'
import { describeKey } from '../../hooks/useKeybindings'
import { useStore, useShallow } from '../../store'
import { Modal } from './Modal'
import styles from './ShortcutsModal.module.css'

/** Category → the order we want to read them in. */
const ORDER = ['Go', 'View', 'File', 'Tab', 'Workspace', 'Curriculum']

export function ShortcutsModal({ onClose }: { onClose(): void }): React.JSX.Element {
  const configured = useStore((s) => s.settings?.keybindings)
  const commands = useStore(useShallow((s) => s.commands))

  const groups = useMemo(() => {
    // Resolved keymap: defaults, then the workspace's overrides on top.
    const bound = new Map<string, string>()
    for (const entry of [...DEFAULT_KEYBINDINGS, ...(configured ?? [])]) {
      if (entry.command) bound.set(entry.command, entry.key)
      else for (const [id, k] of bound) if (k === entry.key) bound.delete(id)
    }

    const byCategory = new Map<string, Array<{ title: string; key: string }>>()
    for (const [commandId, key] of bound) {
      const command = commands[commandId]
      if (!command) continue
      const list = byCategory.get(command.category) ?? []
      list.push({ title: command.title, key })
      byCategory.set(command.category, list)
    }

    return [...byCategory.entries()].sort(([a], [b]) => {
      const ia = ORDER.indexOf(a)
      const ib = ORDER.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
    })
  }, [commands, configured])

  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} wide>
      <div className={styles.grid}>
        {groups.map(([category, items]) => (
          <section key={category} className={styles.group}>
            <p className={styles.groupTitle}>{category}</p>
            {items.map((item) => (
              <div key={item.title} className={styles.row}>
                <span className={styles.label}>{item.title}</span>
                <span className={styles.keys}>
                  {describeKey(item.key).map((part, i) =>
                    part === 'then' ? (
                      <span key={i} className={styles.then}>
                        then
                      </span>
                    ) : (
                      <kbd key={i} className={styles.kbd}>
                        {part}
                      </kbd>
                    ),
                  )}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
      <p className={styles.footnote}>
        Rebind anything under <code>keybindings</code> in <code>.kt/settings.json</code>. Same key
        replaces; <code>"command": null</code> unbinds.
      </p>
    </Modal>
  )
}
