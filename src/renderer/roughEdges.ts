/**
 * Features that are not finished, and the warning shown before you use one.
 *
 * The list mirrors ROUGH-EDGES.md at the project root — that file is the long
 * version, this is the sentence you get in the moment. Keep the ids identical
 * so the warning can point at the right section.
 *
 * Dismissal is per-FEATURE and per-SESSION: silencing the Lobby warning does
 * not silence the one on creating a workspace, and closing the app brings them
 * all back. It lives in a module-level Set rather than in config, because
 * "don't tell me again for now" is not a preference worth persisting — next
 * launch you may well have forgotten.
 */

import { store } from './store'

export interface RoughEdge {
  id: string
  title: string
  /** One sentence: what is actually thin about it. */
  summary: string
}

export const ROUGH_EDGES: Record<string, RoughEdge> = {
  lobby: {
    id: 'lobby',
    title: 'The Lobby is still a prototype',
    summary:
      'The title and the two document cards are live and cannot go stale. "You are on step two" is hardcoded, and the day loop\'s document list is written into the source rather than your settings.',
  },
  'new-workspace': {
    id: 'new-workspace',
    title: 'Creating a workspace is lightly tested',
    summary:
      'The happy path works end to end. The native folder dialog could not be driven by the test harness, so it was verified with the dialog stubbed — and adopting a folder that is already a workspace disables most of the form, which is correct but reads as broken.',
  },
  'lobby-map-editing': {
    id: 'lobby-map-editing',
    title: 'The Lobby map has no editor',
    summary:
      '`lobby.map` in .kt/settings.json has to be edited by hand. The Sandbox has no section for it, which is the exact thing the Sandbox exists to prevent.',
  },
  keybindings: {
    id: 'keybindings',
    title: 'Keybinding editing is shallow',
    summary:
      'Capture and overrides work. Conflicts are only detected when the key AND the when-clause match exactly, and multi-key chords like "ctrl+k ctrl+t" cannot be captured — type those by hand.',
  },
  'plugin-options': {
    id: 'plugin-options',
    title: 'Plugin options are read-only',
    summary:
      "The enable toggle is real; a plugin's own options are shown as JSON you cannot edit here. Change them in .kt/settings.json.",
  },
}

/** Silenced for the rest of this run. Cleared by quitting the app. */
const silenced = new Set<string>()

export function isSilenced(id: string): boolean {
  return silenced.has(id)
}

export function silence(id: string): void {
  silenced.add(id)
}

/**
 * What to run once the warning is accepted.
 *
 * Held here rather than in the store: it is a continuation, not state, and
 * putting functions in zustand makes every consumer of that slice unserialisable
 * for no benefit.
 */
let pending: (() => void) | null = null

export function setPendingAction(fn: (() => void) | null): void {
  pending = fn
}

export function runPendingAction(): void {
  const fn = pending
  pending = null
  fn?.()
}

/**
 * Run `action`, but warn first if this feature is on the rough list and has not
 * been silenced this session.
 *
 * Imported by the call sites rather than wrapping the command registry, so it
 * is obvious at the point of use which things are gated.
 */
export function guarded(id: string, action: () => void): () => void {
  return () => {
    if (isSilenced(id) || !ROUGH_EDGES[id]) {
      action()
      return
    }
    setPendingAction(action)
    store.get().setPendingRoughEdge(id)
    store.get().openModal('roughEdge')
  }
}
