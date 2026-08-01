/**
 * Turn a loaded document into a React tree.
 *
 * Rendering is fully resolved BEFORE the tree is handed back — including syntax
 * highlighting and image dimensions. That is the whole point: whatever
 * DocumentView commits is final, so nothing re-flows after mount and the scroll
 * restorer has stable ground to stand on.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { dirnameRel } from '@shared/paths'
import type { ImageSize, RelPath, TocEntry } from '@shared/types'
import type { LoadedDocument } from './useDocument'
import { platform } from '../platform'
import { useStore } from '../store'
import { renderMarkdown } from '../markdown/pipeline'
import { collectImagePaths } from '../markdown/rehype-asset-src'
import { resolveAsset } from '../markdown/resolve'
import { DEFAULT_MARKDOWN_SETTINGS } from '../markdown/settings'
import { extractToc } from '../markdown/toc'

export interface RenderedDocument {
  tree: ReactElement | null
  toc: TocEntry[]
  rendering: boolean
  error: string | null
}

/** Rendered trees, keyed by path+hash. Bounded so long sessions stay flat. */
const CACHE_LIMIT = 12
const cache = new Map<string, ReactElement>()

function remember(key: string, tree: ReactElement): void {
  cache.delete(key)
  cache.set(key, tree)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

export function useRenderedMarkdown(doc: LoadedDocument | null): RenderedDocument {
  const workspaceId = useStore((s) => s.workspace?.id ?? null)
  const docs = useStore((s) => s.docs)
  const assetRoots = useStore((s) => s.settings?.files.assetRoots)
  const markdownSettings = useStore((s) => s.settings?.markdown)

  const cacheKey = doc ? `${doc.path}::${doc.hash}` : null

  const [tree, setTree] = useState<ReactElement | null>(() =>
    cacheKey ? (cache.get(cacheKey) ?? null) : null,
  )
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toc = useMemo(
    () => (doc?.isMarkdown ? extractToc(doc.content) : []),
    [doc?.content, doc?.isMarkdown],
  )

  useEffect(() => {
    if (!doc || !workspaceId || !cacheKey) return
    if (!doc.isMarkdown) {
      setTree(null)
      return
    }

    const hit = cache.get(cacheKey)
    if (hit) {
      setTree(hit)
      setRendering(false)
      return
    }

    let cancelled = false
    setRendering(true)

    void (async () => {
      try {
        // Resolve every image's intrinsic size in ONE round trip, before
        // rendering, so each <img> can carry width/height from the first frame.
        const roots = assetRoots ?? []
        const refs = collectImagePaths(doc.content)
        const resolved = new Map<string, RelPath>()
        for (const ref of refs) {
          const path = resolveAsset(ref, doc.path, docs, roots)
          if (path) resolved.set(ref, path)
        }

        let imageSizes: Record<RelPath, ImageSize> = {}
        if (resolved.size > 0) {
          imageSizes = await platform.imageDimensions(workspaceId, [...resolved.values()])
        }
        if (cancelled) return

        const { tree: rendered } = await renderMarkdown(doc.content, {
          workspaceId,
          docPath: doc.path,
          docs,
          assetRoots: roots,
          imageSizes,
          markdown: markdownSettings ?? DEFAULT_MARKDOWN_SETTINGS,
        })
        if (cancelled) return

        remember(cacheKey, rendered)
        setTree(rendered)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setRendering(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // `docs` changes whenever the tree is re-walked; including it would re-render
    // every open document on any file change. Wiki-link targets are resolved
    // against the list captured at render time, which is close enough and is
    // refreshed the next time the document is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, workspaceId, cacheKey, assetRoots, markdownSettings])

  return { tree, toc, rendering, error }
}

/** Drop a document's rendered tree — called when its file changes on disk. */
export function invalidateRendered(path: RelPath): void {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${path}::`)) cache.delete(key)
  }
}

export { dirnameRel }
