/**
 * The keyboard.
 *
 * Bindings come from `DEFAULT_KEYBINDINGS` with the workspace's `keybindings`
 * applied ADDITIVELY on top — same key replaces, `"command": null` unbinds.
 * That is VSCode's model, and it is the one users already have in their heads.
 *
 * `when` clauses are a closed five-value enum evaluated by the small function
 * below. Deliberately not an expression language: the moment it becomes one,
 * every config error turns into a silent no-op that nobody can debug.
 */
import { useEffect, useMemo } from 'react'
import { DEFAULT_KEYBINDINGS, type KeybindingEntry, type WhenClause } from '@shared/commands'
import { store, useStore } from '../store'

/** How long a chord prefix stays armed before it is forgotten. */
const CHORD_TIMEOUT_MS = 1500

/** Normalise a KeyboardEvent to the same shape config uses. */
function keyOf(event: KeyboardEvent): string {
  const parts: string[] = []
  if (event.ctrlKey) parts.push('ctrl')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  if (event.metaKey) parts.push('meta')

  let key = event.key.toLowerCase()
  if (key === ' ') key = 'space'
  // Browsers report the arrows as `ArrowLeft`; config — and every other editor
  // — writes `left`. Without this alias `alt+left` silently never fires.
  const alias: Record<string, string> = {
    arrowleft: 'left',
    arrowright: 'right',
    arrowup: 'up',
    arrowdown: 'down',
    esc: 'escape',
  }
  key = alias[key] ?? key

  // Modifier presses on their own are not bindings.
  if (['control', 'alt', 'shift', 'meta'].includes(key)) return ''
  parts.push(key)
  return parts.join('+')
}

function evaluateWhen(clause: WhenClause | undefined): boolean {
  if (!clause || clause === 'always') return true
  const state = store.get()
  switch (clause) {
    case 'workspace':
      return state.workspace !== null
    case 'documentFocus':
      return state.focusZone === 'document' && state.activeTab() !== null
    case 'explorerFocus':
      return state.focusZone === 'explorer'
    case 'overlayOpen':
      return state.overlay !== null
    default:
      return false
  }
}

/**
 * Typing in a text field must not trigger commands — except for the ones that
 * exist to get you OUT of the field.
 */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

const ALLOWED_IN_TEXT = new Set(['escape', 'overlay.dismiss'])

export function useKeybindings(): void {
  const configured = useStore((s) => s.settings?.keybindings)
  const pluginBindings = useStore((s) => s.pluginKeybindings)

  /** Resolved keymap: defaults, then plugins, then the workspace's overrides. */
  const keymap = useMemo(() => {
    const map = new Map<string, KeybindingEntry>()
    const put = (entry: KeybindingEntry): void => {
      const key = entry.key.trim().toLowerCase()
      if (entry.command === null) map.delete(key)
      else map.set(key, { ...entry, key })
    }

    for (const entry of DEFAULT_KEYBINDINGS) put(entry)
    for (const entry of pluginBindings) put(entry)
    for (const entry of configured ?? []) put(entry)
    return map
  }, [configured, pluginBindings])

  useEffect(() => {
    // Chords such as `ctrl+k ctrl+t`: the first press arms a prefix.
    let prefix: string | null = null
    let prefixTimer: number | null = null

    const clearPrefix = (): void => {
      prefix = null
      if (prefixTimer !== null) window.clearTimeout(prefixTimer)
      prefixTimer = null
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const pressed = keyOf(event)
      if (!pressed) return

      const combo = prefix ? `${prefix} ${pressed}` : pressed
      const binding = keymap.get(combo)

      // An armed prefix that leads nowhere is dropped rather than swallowed.
      if (!binding && prefix) {
        clearPrefix()
        return
      }

      if (!binding) {
        // Is this the start of a chord?
        const isPrefix = [...keymap.keys()].some((k) => k.startsWith(`${pressed} `))
        if (isPrefix && !isTextEntry(event.target)) {
          event.preventDefault()
          prefix = pressed
          prefixTimer = window.setTimeout(clearPrefix, CHORD_TIMEOUT_MS)
        }
        return
      }

      clearPrefix()

      if (isTextEntry(event.target) && !ALLOWED_IN_TEXT.has(pressed) && !ALLOWED_IN_TEXT.has(binding.command ?? '')) {
        return
      }
      if (!evaluateWhen(binding.when)) return
      if (!binding.command) return

      const command = store.get().commands[binding.command]
      // An unknown command id means stale config or a disabled plugin. Let the
      // keystroke fall through to the browser rather than eating it.
      if (!command) return
      if (!evaluateWhen(command.when)) return

      event.preventDefault()
      store.get().runCommand(binding.command)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearPrefix()
    }
  }, [keymap])
}

/**
 * Human-readable form for the palette and the empty-pane hints.
 *
 * Chords are space-separated (`ctrl+k ctrl+t`), so the space has to be split on
 * FIRST — splitting only on `+` yields the nonsense "Ctrl / K ctrl / T".
 */
export function describeKey(key: string): string[] {
  return key
    .split(' ')
    .flatMap((chunk, index) => (index === 0 ? chunk.split('+') : ['then', ...chunk.split('+')]))
    .map((part) =>
      part === 'then'
        ? 'then'
        : part === 'ctrl'
        ? 'Ctrl'
        : part === 'shift'
          ? 'Shift'
          : part === 'alt'
            ? 'Alt'
            : part === 'meta'
              ? 'Meta'
              : part.length === 1
                ? part.toUpperCase()
                : part.charAt(0).toUpperCase() + part.slice(1),
    )
}

/** The key currently bound to a command, if any. */
export function keyForCommand(
  commandId: string,
  configured: KeybindingEntry[] | undefined,
): string | null {
  const map = new Map<string, string>()
  for (const entry of [...DEFAULT_KEYBINDINGS, ...(configured ?? [])]) {
    if (entry.command) map.set(entry.command, entry.key)
    else map.delete(entry.command ?? '')
  }
  return map.get(commandId) ?? null
}
