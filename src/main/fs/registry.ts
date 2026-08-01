/**
 * The open-workspace registry: WorkspaceId → absolute root.
 *
 * Split out from `workspace.ts` so the `kt://` protocol handler can resolve
 * ids without importing the whole workspace-opening machinery (which would
 * create a cycle, since opening a workspace registers assets).
 */
import { hashString } from '@shared/paths'
import type { WorkspaceId } from '@shared/types'

export interface OpenWorkspace {
  id: WorkspaceId
  root: string
  name: string
}

const open = new Map<WorkspaceId, OpenWorkspace>()

/** Stable across runs: the same folder always gets the same id. */
export function workspaceIdFor(root: string): WorkspaceId {
  return hashString(root)
}

export function register(ws: OpenWorkspace): void {
  open.set(ws.id, ws)
}

export function unregister(id: WorkspaceId): void {
  open.delete(id)
}

export function get(id: WorkspaceId): OpenWorkspace | undefined {
  return open.get(id)
}

/** Throws rather than returning undefined — every IPC handler needs the root. */
export function requireRoot(id: WorkspaceId): string {
  const ws = open.get(id)
  if (!ws) throw new Error(`Unknown workspace: ${id}`)
  return ws.root
}

export function all(): OpenWorkspace[] {
  return [...open.values()]
}
