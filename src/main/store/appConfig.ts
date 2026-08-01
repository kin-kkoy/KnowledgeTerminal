/**
 * App-level config: `userData/config.json`. Recent workspaces, theme, zoom.
 *
 * The theme is also read SYNCHRONOUSLY at startup (see `readThemeSync`) because
 * the BrowserWindow's backgroundColor and the preload's `data-theme` must both
 * be decided before the first frame, or the user sees a white flash.
 */
import { readFileSync } from 'node:fs'
import { app } from 'electron'
import { join } from 'node:path'
import {
  DEFAULT_APP_CONFIG,
  appConfigSchema,
  parseConfig,
  type AppConfig,
} from '@shared/config-schema'
import type { DeepPartial } from '@shared/platform'
import { readJsonSafe, writeJsonAtomic } from './atomic'
import { deepMerge } from './merge'

export function appConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

let cache: AppConfig | null = null
export const appConfigProblems: string[] = []

export async function loadAppConfig(): Promise<AppConfig> {
  if (cache) return cache
  const raw = await readJsonSafe(appConfigPath())
  const { value, problems } = parseConfig(appConfigSchema, raw ?? {}, DEFAULT_APP_CONFIG)
  appConfigProblems.splice(0, appConfigProblems.length, ...problems)
  cache = value
  return cache
}

export async function saveAppConfig(patch: DeepPartial<AppConfig>): Promise<AppConfig> {
  const current = await loadAppConfig()
  const merged = deepMerge(current, patch)
  const { value } = parseConfig(appConfigSchema, merged, current)
  cache = value
  await writeJsonAtomic(appConfigPath(), value)
  return value
}

export async function rememberWorkspace(entry: {
  id: string
  root: string
  name: string
}): Promise<void> {
  const cfg = await loadAppConfig()
  const others = cfg.workspaces.filter((w) => w.id !== entry.id)
  const existing = cfg.workspaces.find((w) => w.id === entry.id)
  await saveAppConfig({
    lastWorkspaceId: entry.id,
    workspaces: [
      { ...entry, lastOpenedAt: Date.now(), pinned: existing?.pinned ?? false },
      ...others,
    ].slice(0, 20) as AppConfig['workspaces'],
  })
}

/**
 * Read just the theme, synchronously, before the window exists.
 *
 * Doing this async would mean either delaying window creation or painting the
 * default theme first — a light flash on a dark-theme launch is exactly the
 * kind of thing that makes an app feel cheap on every single start.
 */
export function readThemeSync(): 'dark' | 'light' {
  try {
    const raw = JSON.parse(readFileSync(appConfigPath(), 'utf8')) as { theme?: string }
    if (raw.theme === 'light') return 'light'
    if (raw.theme === 'dark') return 'dark'
  } catch {
    // No config yet, or unreadable — dark is the default.
  }
  return 'dark'
}
