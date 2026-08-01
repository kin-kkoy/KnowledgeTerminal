/**
 * Keybinding overrides.
 *
 * The workspace list is applied ADDITIVELY over the default keymap, VSCode's
 * model: a matching `key` replaces the default, and `{key, command: null}`
 * unbinds it. So this section shows the defaults for context and edits only the
 * overrides — presenting a merged list would invite you to "change" a default
 * and quietly write forty entries you never asked for.
 *
 * Keys are captured, not typed. Nobody remembers whether it is `ctrl+shift+k`
 * or `Ctrl-Shift-K`, and the answer matters.
 */
import { useState } from 'react'
import { Keyboard, Plus, X } from 'lucide-react'
import { CORE_COMMANDS, DEFAULT_KEYBINDINGS, WHEN_CLAUSES, type WhenClause } from '@shared/commands'
import { useShallow, useStore } from '../../../store'
import { FieldGroup } from '../../primitives/Field'
import { useSettings } from '../useSettings'
import styles from './KeybindingsSection.module.css'

/** `KeyboardEvent` → the `ctrl+shift+k` form the keymap uses. */
function chordOf(event: React.KeyboardEvent): string | null {
  const key = event.key.toLowerCase()
  if (['control', 'shift', 'alt', 'meta'].includes(key)) return null

  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  if (event.metaKey) parts.push('meta')
  parts.push(key === ' ' ? 'space' : key)
  return parts.join('+')
}

export function KeybindingsSection(): React.JSX.Element {
  const { settings, patch } = useSettings()
  const overrides = settings.keybindings
  const pluginCommands = useStore(useShallow((s) => s.commands))
  const [capturing, setCapturing] = useState<number | null>(null)

  const allCommands = [
    ...CORE_COMMANDS.map((c) => ({ id: c.id, title: c.title, category: c.category })),
    ...Object.values(pluginCommands)
      .filter((c) => c.owner !== 'core')
      .map((c) => ({ id: c.id, title: c.title, category: c.category })),
  ]

  const titleFor = (id: string): string => allCommands.find((c) => c.id === id)?.title ?? id

  const update = (index: number, next: Partial<(typeof overrides)[number]>): void => {
    const copy = [...overrides]
    const current = copy[index]
    if (!current) return
    copy[index] = { ...current, ...next }
    patch({ keybindings: copy })
  }

  /**
   * Two overrides on the same key with overlapping `when` is a conflict the
   * keymap resolves by last-wins — silently. Better to say so.
   */
  const conflicts = new Set(
    overrides
      .map((b, i) =>
        overrides.some(
          (other, j) => j !== i && other.key === b.key && (other.when ?? 'always') === (b.when ?? 'always'),
        )
          ? b.key
          : null,
      )
      .filter((k): k is string => k !== null),
  )

  return (
    <>
      <FieldGroup title="Your overrides">
        <p className={styles.note}>
          Applied on top of the defaults below. Set a command to <code>Unbind</code> to remove a
          default without replacing it.
        </p>

        {overrides.length === 0 ? (
          <p className={styles.empty}>No overrides — the defaults are in force.</p>
        ) : (
          <ul className={styles.list}>
            {overrides.map((binding, index) => (
              <li key={index} className={styles.item}>
                <button
                  type="button"
                  className={
                    capturing === index
                      ? `${styles.chord} ${styles.capturing}`
                      : conflicts.has(binding.key)
                        ? `${styles.chord} ${styles.conflict}`
                        : styles.chord
                  }
                  title={
                    conflicts.has(binding.key)
                      ? 'Another override uses this same key and condition'
                      : 'Click, then press the keys'
                  }
                  onClick={() => setCapturing(index)}
                  onBlur={() => setCapturing(null)}
                  onKeyDown={(e) => {
                    if (capturing !== index) return
                    e.preventDefault()
                    if (e.key === 'Escape') return setCapturing(null)
                    const chord = chordOf(e)
                    if (!chord) return
                    update(index, { key: chord })
                    setCapturing(null)
                  }}
                >
                  <Keyboard size={12} strokeWidth={2} />
                  {capturing === index ? 'Press keys…' : binding.key}
                </button>

                <select
                  className={styles.select}
                  value={binding.command ?? ''}
                  onChange={(e) =>
                    update(index, { command: e.target.value === '' ? null : e.target.value })
                  }
                >
                  <option value="">Unbind</option>
                  {allCommands.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.category} · {c.title}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.selectNarrow}
                  value={binding.when ?? 'always'}
                  onChange={(e) => update(index, { when: e.target.value as WhenClause })}
                >
                  {WHEN_CLAUSES.map((clause) => (
                    <option key={clause} value={clause}>
                      {clause}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className={styles.mini}
                  title="Remove override"
                  aria-label={`Remove override for ${binding.key}`}
                  onClick={() => patch({ keybindings: overrides.filter((_, i) => i !== index) })}
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className={styles.add}
          onClick={() => {
            patch({
              keybindings: [
                ...overrides,
                { key: 'ctrl+alt+n', command: allCommands[0]?.id ?? null, when: 'always' },
              ],
            })
            setCapturing(overrides.length)
          }}
        >
          <Plus size={12} strokeWidth={2.4} />
          Add an override
        </button>
      </FieldGroup>

      <FieldGroup title="Defaults">
        <p className={styles.note}>
          For reference. These are in source, not in your file — nothing here writes anything.
        </p>
        <ul className={styles.defaults}>
          {DEFAULT_KEYBINDINGS.map((binding) => {
            const replaced = overrides.some((o) => o.key === binding.key)
            return (
              <li
                key={`${binding.key}:${binding.command}`}
                className={replaced ? `${styles.default} ${styles.replaced}` : styles.default}
              >
                <code className={styles.defaultKey}>{binding.key}</code>
                <span className={styles.defaultTitle}>{titleFor(binding.command ?? '')}</span>
                {replaced && <span className={styles.badge}>overridden</span>}
              </li>
            )
          })}
        </ul>
      </FieldGroup>
    </>
  )
}
