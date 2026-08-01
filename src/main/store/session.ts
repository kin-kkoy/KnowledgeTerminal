/**
 * Per-workspace session state, in `userData/sessions/<workspaceId>.json`.
 *
 * Sessions live in userData rather than the workspace on purpose: scroll
 * offsets and window geometry are machine state, not notes, and must never
 * appear in the user's folder (or their git diff). Favorites are the mirror
 * case and correctly live in the workspace's settings.json.
 *
 * Writes are debounced — the renderer calls `writeSession` on every scroll
 * settle — and force-flushed on quit.
 */
import { join } from 'node:path'
import { app } from 'electron'
import { parseConfig } from '@shared/config-schema'
import { sessionSchema, type SessionState } from '@shared/session-schema'
import type { HomeSnapshot, WorkspaceId } from '@shared/types'
import { createDebouncedWriter, readJsonSafe, writeJsonAtomic } from './atomic'

const SESSION_DEBOUNCE_MS = 700

function sessionDir(): string {
  return join(app.getPath('userData'), 'sessions')
}

function sessionPath(id: WorkspaceId): string {
  return join(sessionDir(), `${id}.json`)
}

function homeSnapshotPath(): string {
  return join(app.getPath('userData'), 'home-snapshot.json')
}

const writer = createDebouncedWriter(SESSION_DEBOUNCE_MS)

/** The freshest state per workspace, so `flush` always writes the latest. */
const latest = new Map<WorkspaceId, SessionState>()

export async function readSession(id: WorkspaceId): Promise<SessionState | null> {
  const cached = latest.get(id)
  if (cached) return cached

  const raw = await readJsonSafe(sessionPath(id))
  if (!raw) return null

  // A corrupt session must not lose the workspace. parseConfig falls back to a
  // valid empty session rather than throwing.
  const { value, problems } = parseConfig(sessionSchema, raw, null as unknown as SessionState)
  if (problems.length > 0 || !value) {
    console.warn(`[session] ${id} failed validation, starting fresh:`, problems.join('; '))
    return null
  }
  latest.set(id, value)
  return value
}

export function writeSession(id: WorkspaceId, session: SessionState): void {
  const stamped: SessionState = { ...session, savedAt: Date.now() }
  latest.set(id, stamped)
  writer.queue(sessionPath(id), stamped)
}

/** Await before exit. Called from `before-quit` after the renderer has flushed. */
export async function flushSessions(): Promise<void> {
  await writer.flush()
}

/**
 * Stamp the moment this session ended, so the next launch can say "2 days ago".
 * Called once on quit — `lastSessionAt` must describe the PREVIOUS session, so
 * it is written as the current `savedAt` for the next read to find.
 */
export function markSessionEnded(id: WorkspaceId): void {
  const current = latest.get(id)
  if (!current) return
  writeSession(id, { ...current, lastSessionAt: Date.now() })
}

// ── home snapshot ─────────────────────────────────────────────────────────

export async function readHomeSnapshot(): Promise<HomeSnapshot | null> {
  return await readJsonSafe<HomeSnapshot>(homeSnapshotPath())
}

export async function writeHomeSnapshot(snapshot: HomeSnapshot): Promise<void> {
  await writeJsonAtomic(homeSnapshotPath(), snapshot)
}

// ── plugin state ──────────────────────────────────────────────────────────

function pluginStatePath(id: WorkspaceId, pluginId: string): string {
  // Namespaced per workspace AND per plugin: a plugin can never read or clobber
  // another's state, which is the point of routing it through main at all.
  const safe = pluginId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return join(app.getPath('userData'), 'plugin-state', id, `${safe}.json`)
}

export async function readPluginState(id: WorkspaceId, pluginId: string): Promise<unknown> {
  return await readJsonSafe(pluginStatePath(id, pluginId))
}

export async function writePluginState(
  id: WorkspaceId,
  pluginId: string,
  value: unknown,
): Promise<void> {
  await writeJsonAtomic(pluginStatePath(id, pluginId), value)
}
