/**
 * Opening a workspace: validate the root, load `.kt/settings.json`, register it.
 *
 * Settings live INSIDE the workspace so they are portable and committable —
 * copy the folder to another machine and the layout, favorites and widgets come
 * with it. That is what makes "duplicate a workspace, swap the Markdown" work.
 *
 * WRITES MERGE INTO THE RAW FILE, NOT THE PARSED OBJECT. Every object in the
 * schema is a plain `z.object`, which strips unknown keys — so writing the parse
 * output back would silently delete anything a human hand-wrote that the schema
 * does not model. Keeping the raw JSON and merging patches into *that* is what
 * makes "hand-edit the file, use the app, keep your keys" true. See `rawById`.
 */
import { watch, type FSWatcher } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import {
  DEFAULT_WORKSPACE_SETTINGS,
  parseConfig,
  workspaceSettingsSchema,
  type WorkspaceSettings,
} from '@shared/config-schema'
import type { DeepPartial, WorkspaceInfo } from '@shared/platform'
import type { WorkspaceId } from '@shared/types'
import { fileExists, readJsonSafe, writeJsonAtomic } from '../store/atomic'
import { deepMerge } from '../store/merge'
import { rememberWorkspace } from '../store/appConfig'
import { readSession } from '../store/session'
import * as registry from './registry'

export const KT_DIR = '.kt'
const SETTINGS_FILE = 'settings.json'

export function settingsPath(root: string): string {
  return join(root, KT_DIR, SETTINGS_FILE)
}

/** Problems found loading each workspace's settings, for the status bar. */
const problemsById = new Map<WorkspaceId, string[]>()
const settingsById = new Map<WorkspaceId, WorkspaceSettings>()
/**
 * The file as it literally is on disk, before zod touched it. This is the merge
 * base for every write — see the module header.
 */
const rawById = new Map<WorkspaceId, Record<string, unknown>>()

/**
 * Notified when settings change on disk underneath us. Injected rather than
 * imported so this module does not depend on `../ipc` (which imports the
 * handlers, which import this file).
 */
type SettingsListener = (id: WorkspaceId, settings: WorkspaceSettings, problems: string[]) => void
let onSettingsChanged: SettingsListener | null = null

export function setSettingsListener(fn: SettingsListener | null): void {
  onSettingsChanged = fn
}

export interface LoadedSettings {
  settings: WorkspaceSettings
  problems: string[]
  /** `{}` when there is no file — an unconfigured folder writes a fresh object. */
  raw: Record<string, unknown>
}

export async function loadSettings(root: string): Promise<LoadedSettings> {
  const raw = await readJsonSafe(settingsPath(root))
  if (raw === null) {
    // No settings file is perfectly valid — an unconfigured folder of Markdown
    // should just open. Defaults are not written to disk unasked.
    return { settings: DEFAULT_WORKSPACE_SETTINGS, problems: [], raw: {} }
  }
  const { value, problems } = parseConfig(workspaceSettingsSchema, raw, DEFAULT_WORKSPACE_SETTINGS)
  const object = typeof raw === 'object' && raw !== null && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {}
  return { settings: value, problems, raw: object }
}

export async function openWorkspace(rootPath: string): Promise<WorkspaceInfo> {
  const root = resolve(rootPath)
  const info = await stat(root)
  if (!info.isDirectory()) throw new Error(`Not a directory: ${root}`)

  const id = registry.workspaceIdFor(root)
  const { settings, problems, raw } = await loadSettings(root)

  // The folder name is the honest fallback; settings.workspace.name wins when set.
  const name =
    settings.workspace.name && settings.workspace.name !== 'Workspace'
      ? settings.workspace.name
      : basename(root)

  registry.register({ id, root, name })
  settingsById.set(id, settings)
  problemsById.set(id, problems)
  rawById.set(id, raw)
  watchSettings(id, root)
  await rememberWorkspace({ id, root, name })

  const session = await readSession(id)

  return {
    id,
    root,
    name,
    settings,
    hasSession: session !== null,
    lastOpenedAt: Date.now(),
    problems,
  }
}

export function closeWorkspace(id: WorkspaceId): void {
  unwatchSettings(id)
  registry.unregister(id)
  settingsById.delete(id)
  problemsById.delete(id)
  rawById.delete(id)
}

export function getSettings(id: WorkspaceId): WorkspaceSettings {
  return settingsById.get(id) ?? DEFAULT_WORKSPACE_SETTINGS
}

export function getProblems(id: WorkspaceId): string[] {
  return problemsById.get(id) ?? []
}

/** The file exactly as it sits on disk. The Sandbox's "Raw" view reads this. */
export function getRawSettings(id: WorkspaceId): Record<string, unknown> {
  return rawById.get(id) ?? {}
}

/**
 * Write a settings patch back to the workspace.
 *
 * The merge base is the RAW file, so unknown keys and the author's key order
 * both survive. Only the paths present in `patch` change.
 *
 * A file that failed to parse is never written — the caller (the Sandbox)
 * refuses to save while `getProblems(id)` is non-empty, because merging into a
 * file the app could not understand would encode our misreading of it.
 */
export class SettingsUnreadableError extends Error {
  constructor(public readonly problems: string[]) {
    super(`settings.json has ${problems.length} problem(s); refusing to write`)
    this.name = 'SettingsUnreadableError'
  }
}

export async function updateSettings(
  id: WorkspaceId,
  patch: DeepPartial<WorkspaceSettings>,
): Promise<WorkspaceSettings> {
  const root = registry.requireRoot(id)
  const current = getSettings(id)

  // Enforced HERE and not only in the renderer, so there is no path — a stray
  // command, a plugin, a future caller — that can write into a file the app
  // could not read. The raw merge above would keep the invalid value intact,
  // but the app's in-memory state is defaults, so anything it wrote would be
  // asserting things the user never said.
  const problems = getProblems(id)
  if (problems.length > 0) throw new SettingsUnreadableError(problems)

  const mergedRaw = deepMerge(getRawSettings(id), patch) as Record<string, unknown>
  const { value } = parseConfig(workspaceSettingsSchema, mergedRaw, current)

  rawById.set(id, mergedRaw)
  settingsById.set(id, value)
  markSelfWrite(id)
  await writeJsonAtomic(settingsPath(root), mergedRaw)
  return value
}

/**
 * Create `.kt/settings.json` for a folder that has none.
 *
 * SPARSE — only what the caller actually chose, never a dump of every default.
 * Both forms behave identically at load, because every absent branch is filled
 * by `.default()` in the schema. The difference is what happens later: a file
 * holding today's defaults is frozen at them, and nothing in it distinguishes
 * "I chose 78ch" from "78ch is what the app happened to ship with". A sparse
 * file says only what you decided, and inherits the rest.
 *
 * This also makes creation consistent with every other write — `updateSettings`
 * merges into the raw file, so a workspace configured from scratch through the
 * Sandbox already produces a file containing just the keys it touched.
 */
export async function initSettings(root: string, seed?: DeepPartial<WorkspaceSettings>): Promise<void> {
  if (await fileExists(settingsPath(root))) return
  await writeJsonAtomic(settingsPath(root), { version: 1, ...pruneObject(seed ?? {}) })
}

/**
 * Drop `undefined` and empty objects, recursively.
 *
 * `JSON.stringify` already drops undefined properties, but it leaves the empty
 * containers behind — a seed with no fields filled in would still write
 * `"workspace": {}`, which is noise pretending to be a decision.
 */
function pruneObject(value: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === undefined) continue
    const cleaned = prune(raw)
    if (isEmptyObject(cleaned)) continue
    out[key] = cleaned
  }
  return out
}

function prune(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
  return pruneObject(value)
}

function isEmptyObject(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 0
  )
}

// ── watching settings.json ────────────────────────────────────────────────
//
// The file watcher prunes `.kt` at every depth (and `files.ignore` excludes it
// too), so hand-edits to settings.json would otherwise never reach the app.
// This is a single dedicated watch on one file rather than a hole in the prune
// list, so nothing else inside `.kt` becomes visible to the indexer.

const watchers = new Map<WorkspaceId, FSWatcher>()
const selfWriteAt = new Map<WorkspaceId, number>()

/**
 * `writeJsonAtomic` is temp-file + rename, which fires the watcher. Ignoring
 * events shortly after our own write stops a save from bouncing back as an
 * external change and clobbering in-flight UI state.
 */
const SELF_WRITE_QUIET_MS = 300

function markSelfWrite(id: WorkspaceId): void {
  selfWriteAt.set(id, Date.now())
}

function watchSettings(id: WorkspaceId, root: string): void {
  unwatchSettings(id)
  let timer: NodeJS.Timeout | null = null

  try {
    // Watch the `.kt` DIRECTORY, not the file: the atomic rename replaces the
    // inode, which detaches a file watch after the first save.
    const watcher = watch(join(root, KT_DIR), (_event, filename) => {
      if (filename && filename !== SETTINGS_FILE) return
      if (Date.now() - (selfWriteAt.get(id) ?? 0) < SELF_WRITE_QUIET_MS) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void reloadSettings(id).then((settings) => {
          onSettingsChanged?.(id, settings, getProblems(id))
        })
      }, 80)
    })
    watcher.on('error', () => unwatchSettings(id))
    watchers.set(id, watcher)
  } catch {
    // No `.kt` directory yet, or a platform that cannot watch it. Hand-edits
    // then need the explicit `workspace.reloadSettings` command, as before.
  }
}

function unwatchSettings(id: WorkspaceId): void {
  watchers.get(id)?.close()
  watchers.delete(id)
  selfWriteAt.delete(id)
}

/**
 * Re-read settings.json from disk and refresh every cache.
 *
 * Both the watcher and the explicit `workspace.reloadSettings` command land
 * here. The caller decides whether to notify: the command already gets the
 * value back over IPC, so only the watcher path broadcasts.
 */
export async function reloadSettings(id: WorkspaceId): Promise<WorkspaceSettings> {
  const ws = registry.get(id)
  if (!ws) return getSettings(id)

  const { settings, problems, raw } = await loadSettings(ws.root)
  rawById.set(id, raw)
  settingsById.set(id, settings)
  problemsById.set(id, problems)
  return settings
}
