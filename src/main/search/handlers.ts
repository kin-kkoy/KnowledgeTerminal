/**
 * IPC registration for the search domain, plus the wiring that keeps the index
 * and the renderer in step with the filesystem.
 */
import { broadcast, handle } from '../ipc'
import { startWatching, stopWatching } from '../fs/watcher'
import * as registry from '../fs/registry'
import { getSettings } from '../fs/workspace'
import * as service from './service'
import type { FileChange, WorkspaceId } from '@shared/types'

export function registerSearchHandlers(): void {
  service.setStatusListener((status) => broadcast('evt:index', status))

  handle('search:query', async (_e, id, q, opts) => await service.search(id, q, opts))

  handle('search:cancel', async (_e, queryId) => {
    service.cancel(queryId)
  })

  handle('search:quickOpen', async (_e, id) => service.quickOpenList(id))

  handle('graph:neighbors', async (_e, id, path, depth) => await service.neighbors(id, path, depth))

  handle('graph:find', async (_e, id, term) => await service.graphFind(id, term))

  handle('search:reindex', async (_e, id) => {
    const { files } = getSettings(id)
    service.reindex(id, registry.requireRoot(id), files.include, files.ignore)
  })
}

/**
 * Called once a workspace is open: start the index and the watcher together.
 *
 * The watcher feeds BOTH the index and the renderer from the same debounced
 * batch, so a file saved in another editor updates the tree, the open document
 * and the search results in one pass rather than three.
 */
export function beginIndexing(id: WorkspaceId): void {
  const root = registry.requireRoot(id)
  const { files } = getSettings(id)

  service.startIndexing(id, root, files.include, files.ignore)

  startWatching(id, {
    onChanges(batch: FileChange[]) {
      const changed = batch.filter((c) => c.type === 'add' || c.type === 'change').map((c) => c.path)
      const removed = batch.filter((c) => c.type === 'unlink').map((c) => c.path)
      service.upsert(id, changed)
      service.remove(id, removed)
      broadcast('evt:files', batch)
    },
    onStatus(partial) {
      // The watcher only ever reports trouble (a watch-limit fallback, or no
      // watching at all), so a degraded phase is the right default here — but
      // the caller's own fields win.
      broadcast('evt:index', {
        phase: 'degraded',
        indexed: 0,
        total: 0,
        ...partial,
        workspaceId: id,
      })
    },
  })
}

export function endIndexing(id: WorkspaceId): void {
  stopWatching(id)
  service.dropWorkspace(id)
}
