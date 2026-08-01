/**
 * The message protocol between the main process and the search worker.
 *
 * Typed in one place so a mismatched message shape is a compile error rather
 * than a silently ignored `postMessage`.
 */
import type { GraphNode, RelPath, SearchOptions, SearchResult } from '@shared/types'

export interface CrawlRequest {
  type: 'crawl'
  workspaceId: string
  root: string
  include: string[]
  ignore: string[]
}

export interface UpsertRequest {
  type: 'upsert'
  workspaceId: string
  paths: RelPath[]
}

export interface RemoveRequest {
  type: 'remove'
  workspaceId: string
  paths: RelPath[]
}

export interface QueryRequest {
  type: 'query'
  requestId: number
  workspaceId: string
  query: string
  options: SearchOptions
  maxResults: number
  fuzzy: number
}

export interface DropRequest {
  type: 'drop'
  workspaceId: string
}

export interface NeighborsRequest {
  type: 'neighbors'
  requestId: number
  workspaceId: string
  path: RelPath
  depth: number
}

export interface GraphFindRequest {
  type: 'graphFind'
  requestId: number
  workspaceId: string
  term: string
}

export type WorkerRequest =
  | CrawlRequest
  | UpsertRequest
  | RemoveRequest
  | QueryRequest
  | DropRequest
  | NeighborsRequest
  | GraphFindRequest

export interface ProgressMessage {
  type: 'progress'
  workspaceId: string
  indexed: number
  total: number
  done: boolean
}

export interface ResultMessage {
  type: 'result'
  requestId: number
  result: SearchResult
}

export interface DocsMessage {
  type: 'docs'
  workspaceId: string
  docs: Array<{ path: RelPath; title: string; mtimeMs: number }>
}

export interface ErrorMessage {
  type: 'error'
  requestId?: number
  message: string
}

export interface GraphMessage {
  type: 'graph'
  requestId: number
  nodes: GraphNode[]
}

export type WorkerMessage =
  | ProgressMessage
  | ResultMessage
  | DocsMessage
  | GraphMessage
  | ErrorMessage
