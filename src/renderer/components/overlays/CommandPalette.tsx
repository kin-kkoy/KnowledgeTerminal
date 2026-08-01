/**
 * Ctrl+Shift+P — every command, core and plugin alike.
 *
 * Commands are read straight from the registry, so a plugin's contribution
 * appears here with no involvement from this file whatsoever.
 */
import { useMemo, useState } from 'react'
import fuzzysort from 'fuzzysort'
import { useStore, useShallow } from '../../store'
import { describeKey, keyForCommand } from '../../hooks/useKeybindings'
import { Overlay, type OverlayItem } from './Overlay'
import styles from './Overlay.module.css'

export function CommandPalette(): React.JSX.Element {
  const commands = useStore(useShallow((s) => Object.values(s.commands)))
  const configured = useStore((s) => s.settings?.keybindings)
  const runCommand = useStore((s) => s.runCommand)
  const workspaceOpen = useStore((s) => s.workspace !== null)
  const [query, setQuery] = useState('')

  const available = useMemo(
    () =>
      commands
        // A workspace-only command in the palette with nothing open would just
        // fail silently when chosen.
        .filter((c) => workspaceOpen || (c.when !== 'workspace' && c.when !== 'documentFocus'))
        .filter((c) => c.when !== 'overlayOpen')
        .map((c) => ({ ...c, label: `${c.category}: ${c.title}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [commands, workspaceOpen],
  )

  const items = useMemo<OverlayItem[]>(() => {
    const toItem = (
      command: (typeof available)[number],
      highlighted?: React.ReactNode,
    ): OverlayItem => {
      const key = keyForCommand(command.id, configured)
      return {
        key: command.id,
        content: (
          <>
            <span className={styles.primary}>{highlighted ?? command.label}</span>
            {key && (
              <span className={styles.badge}>
                {describeKey(key).map((part) => (
                  <span key={part} className={styles.kbd}>
                    {part}
                  </span>
                ))}
              </span>
            )}
          </>
        ),
        onSelect: () => runCommand(command.id),
      }
    }

    if (!query.trim()) return available.map((c) => toItem(c))

    /*
     * A tight threshold, and the TITLE weighted above the category.
     *
     * The default was permissive enough that "theme" matched "Curriculum: Open
     * **the** Check**p**oint for the Current **M**odul**e**" — the letters do
     * appear, just scattered across four words. Requiring a decent score keeps
     * results to things that actually look like what was typed.
     */
    return fuzzysort
      .go(query, available, { keys: ['title', 'label'], limit: 30, threshold: 0.4 })
      .map((result) =>
        toItem(
          result.obj,
          (result[0] ?? result[1])?.highlight((match, i) => (
            <span key={i} className={styles.match}>
              {match}
            </span>
          )),
        ),
      )
  }, [available, configured, query, runCommand])

  return (
    <Overlay
      label="Command Palette"
      placeholder="Run a command…"
      query={query}
      onQueryChange={setQuery}
      items={items}
      empty={`No command matches “${query}”.`}
    />
  )
}
