/**
 * Load a document and keep the result cached per path+hash.
 *
 * The cache is what makes switching back to an already-open tab instant, which
 * in turn makes scroll restoration for that tab trivial: nothing has to be
 * re-parsed, so nothing re-flows.
 */
import { useEffect, useState } from 'react'
import { isMarkdown } from '@shared/paths'
import type { RelPath, TextFile } from '@shared/types'
import { platform } from '../platform'
import { useStore } from '../store'

export interface LoadedDocument {
  path: RelPath
  content: string
  hash: string
  mtimeMs: number
  size: number
  isMarkdown: boolean
}

export interface DocumentState {
  doc: LoadedDocument | null
  loading: boolean
  error: string | null
}

/**
 * Strip Electron's IPC wrapper off a rejected invoke.
 *
 * Raw, these read `Error: Error invoking remote method 'fs:readText': Error:
 * ENOENT …` — three layers of plumbing in front of the one clause that matters
 * to the person reading it.
 */
function readableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const withoutIpc = raw.replace(/^Error invoking remote method '[^']+':\s*/, '')
  return withoutIpc.replace(/^(Error:\s*)+/, '')
}

/** Small LRU. Twelve documents is generous for reading and bounded for memory. */
const CACHE_LIMIT = 12
const cache = new Map<string, LoadedDocument>()

function cacheKey(workspaceId: string, path: RelPath): string {
  return `${workspaceId}::${path}`
}

function remember(key: string, doc: LoadedDocument): void {
  cache.delete(key)
  cache.set(key, doc)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/** Called by the file watcher: a changed file must not serve a stale cache. */
export function invalidateDocument(workspaceId: string, path: RelPath): void {
  cache.delete(cacheKey(workspaceId, path))
}

/**
 * Paths this app has just written, and the moment it did.
 *
 * Ticking a checkbox writes the file, the watcher notices, and without this the
 * document would be invalidated and re-rendered under the reader — a visible
 * flash and a scroll jolt for a change they made themselves. Suppressing our
 * own echo for a beat keeps that from happening, while a genuine external edit
 * a second later still comes through normally.
 */
const selfWrites = new Map<RelPath, number>()
const SELF_WRITE_WINDOW_MS = 1500

export function markSelfWrite(path: RelPath): void {
  selfWrites.set(path, Date.now())
}

export function isSelfWrite(path: RelPath): boolean {
  const at = selfWrites.get(path)
  if (at === undefined) return false
  if (Date.now() - at > SELF_WRITE_WINDOW_MS) {
    selfWrites.delete(path)
    return false
  }
  return true
}

function toDocument(file: TextFile): LoadedDocument {
  return {
    path: file.path,
    content: file.content,
    hash: file.hash,
    mtimeMs: file.mtimeMs,
    size: file.size,
    isMarkdown: isMarkdown(file.path),
  }
}

export function useDocument(path: RelPath): DocumentState {
  const workspaceId = useStore((s) => s.workspace?.id ?? null)
  const maxBytes = useStore((s) => s.settings?.files.maxRenderBytes ?? 2_000_000)

  const [state, setState] = useState<DocumentState>(() => {
    const hit = workspaceId ? cache.get(cacheKey(workspaceId, path)) : undefined
    return { doc: hit ?? null, loading: !hit, error: null }
  })

  useEffect(() => {
    if (!workspaceId) return
    const key = cacheKey(workspaceId, path)

    const hit = cache.get(key)
    if (hit) {
      setState({ doc: hit, loading: false, error: null })
      return
    }

    let cancelled = false
    setState((prev) => ({ ...prev, loading: true, error: null }))

    platform
      .readTextFile(workspaceId, path)
      .then((file) => {
        if (cancelled) return
        if (file.size > maxBytes) {
          setState({
            doc: null,
            loading: false,
            error: `This file is ${Math.round(file.size / 1024)} KB, above the ${Math.round(
              maxBytes / 1024,
            )} KB render limit set in settings.json.`,
          })
          return
        }
        const doc = toDocument(file)
        remember(key, doc)
        setState({ doc, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ doc: null, loading: false, error: readableError(err) })
      })

    return () => {
      cancelled = true
    }
  }, [workspaceId, path, maxBytes])

  return state
}
