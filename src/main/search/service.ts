/**
 * Main-side facade over the search worker.
 *
 * Owns the worker's lifetime, routes queries to their callers, and holds the
 * Quick Open path list — which the renderer fetches ONCE per workspace and then
 * patches from watcher events, so typing in Quick Open costs no IPC at all.
 */
import { join } from 'node:path'
import { Worker } from 'node:worker_threads'
import type {
  DocRef,
  GraphNode,
  IndexStatus,
  RelPath,
  SearchOptions,
  SearchResult,
  WorkspaceId,
} from '@shared/types'
import { loadAppConfig } from '../store/appConfig'
import type { WorkerMessage, WorkerRequest } from './protocol'

/** Deferred until after the window is shown; indexing must never delay paint. */
const START_DELAY_MS = 300

let worker: Worker | null = null
let requestSeq = 0

const pending = new Map<number, (result: SearchResult) => void>()
const pendingGraph = new Map<number, (nodes: GraphNode[]) => void>()
const docsByWorkspace = new Map<WorkspaceId, DocRef[]>()
const statusByWorkspace = new Map<WorkspaceId, IndexStatus>()

let onStatus: ((status: IndexStatus) => void) | null = null

export function setStatusListener(listener: (status: IndexStatus) => void): void {
  onStatus = listener
}

function ensureWorker(): Worker {
  if (worker) return worker

  worker = new Worker(join(__dirname, 'search-worker.js'))

  worker.on('message', (message: WorkerMessage) => {
    switch (message.type) {
      case 'result': {
        pending.get(message.requestId)?.(message.result)
        pending.delete(message.requestId)
        break
      }
      case 'progress': {
        const status: IndexStatus = {
          workspaceId: message.workspaceId,
          phase: message.done ? 'ready' : 'crawling',
          indexed: message.indexed,
          total: message.total,
        }
        statusByWorkspace.set(message.workspaceId, status)
        onStatus?.(status)
        break
      }
      case 'docs': {
        docsByWorkspace.set(message.workspaceId, message.docs)
        break
      }
      case 'graph': {
        pendingGraph.get(message.requestId)?.(message.nodes)
        pendingGraph.delete(message.requestId)
        break
      }
      case 'error': {
        console.error('[search]', message.message)
        if (message.requestId !== undefined) {
          pending.delete(message.requestId)
          pendingGraph.delete(message.requestId)
        }
        break
      }
    }
  })

  worker.on('error', (err) => {
    console.error('[search] worker crashed', err)
    // A dead index must not take the app with it: search degrades, reading
    // continues, and the next workspace open starts a fresh worker.
    for (const [id] of statusByWorkspace) {
      onStatus?.({
        workspaceId: id,
        phase: 'degraded',
        indexed: 0,
        total: 0,
        notice: 'Search index unavailable for this session.',
      })
    }
    pending.clear()
    pendingGraph.clear()
    worker = null
  })

  worker.unref() // never keep the process alive on the index's account
  return worker
}

function post(request: WorkerRequest): void {
  ensureWorker().postMessage(request)
}

export function startIndexing(
  id: WorkspaceId,
  root: string,
  include: string[],
  ignore: string[],
): void {
  statusByWorkspace.set(id, { workspaceId: id, phase: 'crawling', indexed: 0, total: 0 })
  setTimeout(() => post({ type: 'crawl', workspaceId: id, root, include, ignore }), START_DELAY_MS)
}

export function reindex(id: WorkspaceId, root: string, include: string[], ignore: string[]): void {
  post({ type: 'crawl', workspaceId: id, root, include, ignore })
}

export function upsert(id: WorkspaceId, paths: RelPath[]): void {
  if (paths.length > 0) post({ type: 'upsert', workspaceId: id, paths })
}

export function remove(id: WorkspaceId, paths: RelPath[]): void {
  if (paths.length > 0) post({ type: 'remove', workspaceId: id, paths })
}

export function dropWorkspace(id: WorkspaceId): void {
  docsByWorkspace.delete(id)
  statusByWorkspace.delete(id)
  if (worker) post({ type: 'drop', workspaceId: id })
}

export async function search(
  id: WorkspaceId,
  queryText: string,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const config = await loadAppConfig()
  const requestId = ++requestSeq

  return await new Promise<SearchResult>((resolve) => {
    pending.set(requestId, resolve)
    post({
      type: 'query',
      requestId,
      workspaceId: id,
      query: queryText,
      options,
      maxResults: options.limit ?? config.search.maxResults,
      fuzzy: options.fuzzy ?? config.search.fuzzy,
    })

    // A query that never comes back must not leave the renderer hanging.
    setTimeout(() => {
      if (pending.delete(requestId)) {
        resolve({ queryId: options.queryId ?? '', hits: [], total: 0, truncated: false })
      }
    }, 5000)
  })
}

/**
 * Graph queries reuse the search worker because it already holds the parsed
 * link data — asking a second process would mean reading every file twice.
 */
function askGraph(request: (requestId: number) => void): Promise<GraphNode[]> {
  const requestId = ++requestSeq
  return new Promise<GraphNode[]>((resolve) => {
    pendingGraph.set(requestId, resolve)
    request(requestId)
    setTimeout(() => {
      if (pendingGraph.delete(requestId)) resolve([])
    }, 5000)
  })
}

export function neighbors(id: WorkspaceId, path: RelPath, depth: number): Promise<GraphNode[]> {
  return askGraph((requestId) =>
    post({ type: 'neighbors', requestId, workspaceId: id, path, depth }),
  )
}

export function graphFind(id: WorkspaceId, term: string): Promise<GraphNode[]> {
  return askGraph((requestId) => post({ type: 'graphFind', requestId, workspaceId: id, term }))
}

export function quickOpenList(id: WorkspaceId): DocRef[] {
  return docsByWorkspace.get(id) ?? []
}

export function indexStatus(id: WorkspaceId): IndexStatus | null {
  return statusByWorkspace.get(id) ?? null
}

/** Cancellation is advisory: MiniSearch queries are sub-10ms, so the only real
 *  cost of a superseded query is the snippet reads, which the renderer already
 *  discards by queryId. */
export function cancel(_queryId: string): void {
  /* no-op by design; see above */
}

export function shutdown(): void {
  void worker?.terminate()
  worker = null
}
