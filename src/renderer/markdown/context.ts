/**
 * Per-document data handed to the markdown plugins.
 *
 * The processor itself is built ONCE and reused. Anything document-specific —
 * which file we are rendering, where its images live, what other documents
 * exist for wiki-links to resolve against — travels on the VFile instead, so a
 * new processor (and a new shiki highlighter) is never constructed per render.
 */
import type { MarkdownSettings } from './settings'
import type { DocRef, ImageSize, RelPath } from '@shared/types'

export interface RenderContext {
  workspaceId: string
  /** The document being rendered; relative links resolve against its folder. */
  docPath: RelPath
  /** Every file in the workspace, for wiki-link resolution. */
  docs: DocRef[]
  /** Extra roots to try for assets, Obsidian-style. From `files.assetRoots`. */
  assetRoots: string[]
  /** Pre-measured intrinsic sizes so every <img> can reserve its box. */
  imageSizes: Record<RelPath, ImageSize>
  markdown: MarkdownSettings
}

declare module 'vfile' {
  interface DataMap {
    kt: RenderContext
  }
}

export function contextOf(data: { kt?: RenderContext }): RenderContext {
  const context = data.kt
  if (!context) throw new Error('Markdown plugin ran without a RenderContext on the VFile')
  return context
}
