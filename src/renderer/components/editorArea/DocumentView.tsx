/**
 * The reading surface, and the owner of its own scroll.
 *
 * The scroll container is an explicit `overflow: auto` div, never the document
 * scroller — each pane owns its position independently.
 *
 * The document is committed only once it is FULLY rendered (markdown parsed,
 * code highlighted, image boxes reserved). Showing a partial tree and filling
 * it in afterwards is what makes scroll restoration impossible; see
 * `useScrollRestore` for the rest of that argument.
 */
import { useRef } from 'react'
import { isImage } from '@shared/paths'
import type { RelPath } from '@shared/types'
import { useDocument } from '../../hooks/useDocument'
import { useRenderedMarkdown } from '../../hooks/useRenderedMarkdown'
import { useScrollRestore } from '../../hooks/useScrollRestore'
import { platform } from '../../platform'
import { useStore } from '../../store'
import styles from './DocumentView.module.css'

interface Props {
  tabId: string
  paneId: string
  path: RelPath
}

export function DocumentView({ tabId, path }: Props): React.JSX.Element {
  const { doc, error } = useDocument(path)
  const { tree, error: renderError } = useRenderedMarkdown(doc)
  const workspaceId = useStore((s) => s.workspace?.id ?? null)

  const ready = Boolean(doc) && (!doc?.isMarkdown || tree !== null)
  const { scrollRef, contentRef, reservedHeight } = useScrollRestore({
    tabId,
    contentHash: doc?.hash ?? null,
    ready,
  })

  const assetRef = useRef<HTMLDivElement>(null)

  // Images and PDFs are files too — the explorer lists them, so opening one has
  // to show something rather than failing to parse it as text.
  if (workspaceId && isImage(path)) {
    return (
      <div className={styles.scroller} ref={assetRef}>
        <div className={styles.asset}>
          <img src={platform.assetUrl(workspaceId, path)} alt={path} />
        </div>
      </div>
    )
  }

  const problem = error ?? renderError
  if (problem) {
    return (
      <div className={styles.scroller}>
        <p className={styles.problem}>{problem}</p>
      </div>
    )
  }

  return (
    <div className={styles.scroller} ref={scrollRef} tabIndex={-1}>
      <div
        ref={contentRef}
        // Reserve the height this document had last time, BEFORE the first
        // paint, so the restore assignment below cannot be silently clamped.
        // Dropped as soon as the real content exceeds it.
        style={reservedHeight ? { minHeight: reservedHeight } : undefined}
      >
        {!doc ? null : doc.isMarkdown ? (
          // No spinner while rendering: the previous frame stays until the new
          // tree is ready, which reads as instant rather than as a flash.
          <article className="kt-prose">{tree}</article>
        ) : (
          <article className={styles.plain}>
            <pre className={styles.raw}>{doc.content}</pre>
          </article>
        )}
      </div>
    </div>
  )
}
