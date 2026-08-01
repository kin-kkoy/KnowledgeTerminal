/**
 * Intrinsic image dimensions.
 *
 * This module exists for one reason: so every `<img>` can carry width/height
 * from the very first render and reserve its box. Without it, images pop in
 * after layout and shove the document down — which would break scroll
 * restoration in a way no amount of cleverness in the restorer could fix.
 *
 * Cached by path+mtime, so a document re-opened later costs nothing.
 */
import { readFile, stat } from 'node:fs/promises'
import { imageSize } from 'image-size'
import type { ImageSize, RelPath } from '@shared/types'
import { resolveInsideRoot } from './safety'

interface CacheEntry {
  mtimeMs: number
  size: ImageSize
}

const cache = new Map<string, CacheEntry>()

async function measure(root: string, path: RelPath): Promise<ImageSize | null> {
  try {
    const abs = await resolveInsideRoot(root, path)
    const info = await stat(abs)
    const key = `${root}::${path}`

    const hit = cache.get(key)
    if (hit && hit.mtimeMs === info.mtimeMs) return hit.size

    // image-size reads only the header for raster formats; the full read here
    // is cheap relative to the IPC round trip and keeps SVG working too.
    const buffer = await readFile(abs)
    const dims = imageSize(buffer)
    if (!dims.width || !dims.height) return null

    const size: ImageSize = { w: dims.width, h: dims.height }
    cache.set(key, { mtimeMs: info.mtimeMs, size })
    return size
  } catch {
    // A missing or unparseable image is not an error worth surfacing; the
    // renderer simply gets no dimensions and falls back to a placeholder box.
    return null
  }
}

/** Batched: one IPC round trip per document, not per image. */
export async function imageDimensions(
  root: string,
  paths: RelPath[],
): Promise<Record<RelPath, ImageSize>> {
  const unique = [...new Set(paths)]
  const results = await Promise.all(unique.map(async (p) => [p, await measure(root, p)] as const))

  const out: Record<RelPath, ImageSize> = {}
  for (const [path, size] of results) {
    if (size) out[path] = size
  }
  return out
}

export function invalidateImageCache(root: string, path: RelPath): void {
  cache.delete(`${root}::${path}`)
}
