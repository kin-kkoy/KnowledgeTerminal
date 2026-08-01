/**
 * IPC registration for the filesystem domain.
 *
 * Every handler resolves its workspace root from the registry and lets
 * `resolveInsideRoot` (inside each fs helper) reject anything outside it.
 */
import { broadcast, handle } from '../ipc'
import { loadAppConfig } from '../store/appConfig'
import { imageDimensions } from './assets'
import { listNotes, makeDir, pathExists, readTextFile, statPath, writeTextFile } from './files'
import { isEmptyWorkspace, scaffoldWorkspace } from './scaffold'
import * as registry from './registry'
import { readDirShallow, walkTree, type WalkOptions } from './tree'
import { beginIndexing, endIndexing } from '../search/handlers'
import {
  closeWorkspace,
  getProblems,
  getRawSettings,
  getSettings,
  openWorkspace,
  reloadSettings,
  setSettingsListener,
  settingsPath,
  updateSettings,
} from './workspace'
import { fileExists } from '../store/atomic'
import { ASSET_SCHEME } from '../protocol'
import type { RecentWorkspace } from '@shared/types'

function walkOptionsFor(id: string): WalkOptions {
  const { files } = getSettings(id)
  return { include: files.include, ignore: files.ignore }
}

export function registerFsHandlers(): void {
  // A hand-edit to settings.json reaches the running window through here. The
  // listener is injected rather than imported by `workspace.ts`, which would
  // otherwise depend on `../ipc` and close an import cycle.
  setSettingsListener((id, settings, problems) => broadcast('evt:settings', id, settings, problems))

  // ── workspaces ──────────────────────────────────────────────────────────
  handle('ws:open', async (_e, rootPath) => {
    const info = await openWorkspace(rootPath)
    // Deferred inside the service, so the crawl never delays first paint.
    beginIndexing(info.id)
    return info
  })

  handle('ws:close', async (_e, id) => {
    endIndexing(id)
    closeWorkspace(id)
  })

  handle('ws:inspectFolder', async (_e, rootPath) => ({
    empty: await isEmptyWorkspace(rootPath),
    hasSettings: await fileExists(settingsPath(rootPath)),
  }))

  handle('ws:create', async (_e, rootPath, seed, starterFiles) => {
    await scaffoldWorkspace({ root: rootPath, seed, starterFiles })
    const info = await openWorkspace(rootPath)
    beginIndexing(info.id)
    return info
  })

  handle('ws:listRecent', async () => {
    const config = await loadAppConfig()
    return config.workspaces.map<RecentWorkspace>((w) => ({
      id: w.id,
      root: w.root,
      name: w.name,
      lastOpenedAt: w.lastOpenedAt,
    }))
  })

  // ── tree & files ────────────────────────────────────────────────────────
  handle('fs:readTree', async (_e, id) =>
    await walkTree(registry.requireRoot(id), walkOptionsFor(id)),
  )

  handle('fs:readDir', async (_e, id, dir) =>
    await readDirShallow(registry.requireRoot(id), dir, walkOptionsFor(id)),
  )

  handle('fs:readText', async (_e, id, path) =>
    await readTextFile(registry.requireRoot(id), path),
  )

  handle('fs:writeText', async (_e, id, path, content) => {
    await writeTextFile(registry.requireRoot(id), path, content)
  })

  handle('fs:mkdirp', async (_e, id, dir) => {
    await makeDir(registry.requireRoot(id), dir)
  })

  handle('fs:stat', async (_e, id, path) => await statPath(registry.requireRoot(id), path))
  handle('fs:listNotes', async (_e, id, root) => await listNotes(registry.requireRoot(id), root))

  handle('fs:exists', async (_e, id, path) => await pathExists(registry.requireRoot(id), path))

  handle('fs:imageDimensions', async (_e, id, paths) =>
    await imageDimensions(registry.requireRoot(id), paths),
  )

  // ── workspace settings ──────────────────────────────────────────────────
  // Re-reads from disk rather than returning the cache: this is what the
  // explicit "Reload settings" command is for, and a stale answer would make
  // the command a no-op.
  handle('cfg:readWorkspace', async (_e, id) => await reloadSettings(id))
  handle('cfg:writeWorkspace', async (_e, id, patch) => await updateSettings(id, patch))

  /**
   * The file as it literally is, plus whatever zod objected to. The Sandbox
   * shows this instead of an editor when a workspace fails to parse — the point
   * is to help the user repair their file, not to overwrite it with defaults.
   */
  handle('cfg:rawWorkspace', async (_e, id) => ({
    raw: getRawSettings(id),
    problems: getProblems(id),
  }))
}

export { ASSET_SCHEME }
