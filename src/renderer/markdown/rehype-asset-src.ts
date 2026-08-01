/**
 * Rewrite relative asset URLs to `kt://` and stamp intrinsic dimensions.
 *
 * The width/height attributes are the important half. Without them an image
 * occupies zero height until it decodes, then suddenly pushes the document
 * down — which is precisely the layout shift the scroll restorer cannot
 * compensate for. With them (plus `height: auto` in prose.css) the box is
 * correct on the very first frame.
 *
 * Also handles relative <a href> so `[text](../documentation/x.md)` opens in a
 * tab rather than trying to navigate the window.
 */
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { encodePathSegments } from '@shared/paths'
import { contextOf } from './context'
import { isExternal, resolveAsset, resolveWikiLink, splitTarget } from './resolve'

export const rehypeAssetSrc: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const { workspaceId, docPath, docs, assetRoots, imageSizes } = contextOf(file.data)

    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'img') {
        const src = node.properties?.['src']
        if (typeof src !== 'string' || isExternal(src) || src.startsWith('data:')) return

        const resolved = resolveAsset(src, docPath, docs, assetRoots)
        if (!resolved) {
          node.properties = { ...node.properties, 'data-kt-missing': 'true' }
          return
        }

        // Per-SEGMENT encoding: several assets in this project contain spaces,
        // and one contains an underscore-space. Encoding the whole path at once
        // would eat the separators.
        const size = imageSizes[resolved]
        node.properties = {
          ...node.properties,
          src: `kt://${workspaceId}/${encodePathSegments(resolved)}`,
          'data-kt-asset': resolved,
          ...(size ? { width: size.w, height: size.h } : {}),
          loading: 'lazy',
          decoding: 'async',
        }
        return
      }

      if (node.tagName === 'a') {
        const href = node.properties?.['href']
        if (typeof href !== 'string') return
        if (isExternal(href)) {
          node.properties = { ...node.properties, 'data-kt-link': 'external' }
          return
        }
        // In-page anchors stay as they are; the outline uses them too.
        if (href.startsWith('#') || href.startsWith('kt-doc:')) return

        const { target, heading } = splitTarget(href)
        const resolved = resolveWikiLink(target, docPath, docs)
        node.properties = {
          ...node.properties,
          'data-kt-link': 'internal',
          'data-kt-target': resolved ?? target,
          ...(heading ? { 'data-kt-heading': heading } : {}),
          ...(resolved ? {} : { 'data-kt-unresolved': 'true' }),
        }
      }
    })
  }
}

/**
 * Collect every relative image path in a document, so their dimensions can be
 * fetched in ONE round trip before rendering starts.
 */
export function collectImagePaths(markdown: string): string[] {
  const found = new Set<string>()
  const patterns = [/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, /<img[^>]+src=["']([^"']+)["']/gi]
  for (const pattern of patterns) {
    for (const match of markdown.matchAll(pattern)) {
      const src = match[1]
      if (src && !isExternal(src) && !src.startsWith('data:')) found.add(src)
    }
  }
  return [...found]
}
