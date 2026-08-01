/**
 * Filesystem watching, so editing a Markdown file in another editor updates the
 * open document and the search index without a manual refresh.
 *
 * Linux caps `fs.inotify.max_user_watches` (often 8,192 on Mint). Exhausting it
 * raises ENOSPC. Two mitigations, both necessary:
 *   - prune noisy directories in `ignored`, so watches are never allocated for
 *     them in the first place (filtering after the fact does not help);
 *   - catch ENOSPC/EMFILE and fall back to polling with a visible notice.
 *
 * A watcher failure must never prevent a workspace from opening.
 */
import { basename } from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'
import { normalizeRel } from '@shared/paths'
import type { FileChange, FileChangeType, IndexStatus, WorkspaceId } from '@shared/types'
import { invalidateImageCache } from './assets'
import * as registry from './registry'

const BATCH_MS = 200

const PRUNE_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.kt',
  '.obsidian',
  '.trash',
  '__pycache__',
  '.venv',
])

interface Watch {
  watcher: FSWatcher
  timer: NodeJS.Timeout | null
  batch: FileChange[]
  polling: boolean
}

const watches = new Map<WorkspaceId, Watch>()

export interface WatcherCallbacks {
  onChanges(batch: FileChange[]): void
  onStatus(status: Partial<IndexStatus> & { workspaceId: WorkspaceId }): void
}

export function startWatching(id: WorkspaceId, callbacks: WatcherCallbacks): void {
  stopWatching(id)
  const root = registry.requireRoot(id)

  const create = (usePolling: boolean): FSWatcher =>
    chokidar.watch(root, {
      ignoreInitial: true,
      // Prune by directory NAME at every depth — this is what actually prevents
      // watch allocation, unlike a post-hoc path filter.
      ignored: (path) => PRUNE_DIRS.has(basename(path)),
      usePolling,
      interval: usePolling ? 4000 : undefined,
      // Wait for a file to stop growing before reporting it, so a save-in-
      // progress is not indexed half-written.
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
      followSymlinks: false,
    })

  const attach = (watcher: FSWatcher, polling: boolean): void => {
    const entry: Watch = { watcher, timer: null, batch: [], polling }
    watches.set(id, entry)

    const push = (type: FileChangeType) => (absPath: string) => {
      const rel = normalizeRel(absPath.startsWith(root) ? absPath.slice(root.length) : absPath)
      if (!rel) return
      if (type === 'change' || type === 'unlink') invalidateImageCache(root, rel)

      entry.batch.push({ workspaceId: id, type, path: rel })
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = setTimeout(() => {
        const batch = entry.batch
        entry.batch = []
        entry.timer = null
        if (batch.length > 0) callbacks.onChanges(batch)
      }, BATCH_MS)
    }

    watcher
      .on('add', push('add'))
      .on('change', push('change'))
      .on('unlink', push('unlink'))
      .on('addDir', push('addDir'))
      .on('unlinkDir', push('unlinkDir'))
      .on('error', (err) => {
        const code = (err as NodeJS.ErrnoException).code
        if ((code === 'ENOSPC' || code === 'EMFILE') && !polling) {
          console.warn('[watcher] watch limit reached, falling back to polling')
          void watcher.close()
          watches.delete(id)
          attach(create(true), true)
          callbacks.onStatus({
            workspaceId: id,
            notice: 'Watch limit reached — polling for changes every 4s.',
          })
        } else {
          console.error('[watcher] error', err)
        }
      })
  }

  try {
    attach(create(false), false)
  } catch (err) {
    console.error('[watcher] failed to start; continuing without live updates', err)
    callbacks.onStatus({
      workspaceId: id,
      notice: 'File watching unavailable — changes on disk will not appear until reload.',
    })
  }
}

export function stopWatching(id: WorkspaceId): void {
  const entry = watches.get(id)
  if (!entry) return
  if (entry.timer) clearTimeout(entry.timer)
  void entry.watcher.close()
  watches.delete(id)
}

export function stopAllWatching(): void {
  for (const id of [...watches.keys()]) stopWatching(id)
}
