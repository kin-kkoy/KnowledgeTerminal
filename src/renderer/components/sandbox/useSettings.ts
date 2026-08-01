/**
 * What every Sandbox section needs: the current settings, a way to patch them,
 * and the schema default for any field so "reset" and "differs from default"
 * are derived rather than hand-copied.
 *
 * The hand-copied-defaults mistake already happened once in SettingsModal —
 * three numbers duplicated from the schema, quietly able to drift. At fifty
 * fields it would be certain.
 */
import { DEFAULT_WORKSPACE_SETTINGS, type WorkspaceSettings } from '@shared/config-schema'
import type { DeepPartial } from '@shared/platform'
import { useStore } from '../../store'

export interface SettingsAccess {
  settings: WorkspaceSettings
  defaults: WorkspaceSettings
  patch(patch: DeepPartial<WorkspaceSettings>): void
}

/**
 * Throws if no workspace is open. Every section renders inside the Sandbox,
 * which does not mount its sections until one is — so this is a bug guard, not
 * a case to handle.
 */
export function useSettings(): SettingsAccess {
  const settings = useStore((s) => s.settings)
  const patchSettings = useStore((s) => s.patchSettings)

  if (!settings) throw new Error('Sandbox section rendered with no workspace open')

  return {
    settings,
    defaults: DEFAULT_WORKSPACE_SETTINGS,
    patch: (value) => void patchSettings(value),
  }
}

/** Deep equality for the small JSON-shaped values config holds. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  return JSON.stringify(a) === JSON.stringify(b)
}
