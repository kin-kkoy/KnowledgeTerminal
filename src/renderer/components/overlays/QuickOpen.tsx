/**
 * Ctrl+P — fuzzy open by path.
 *
 * A different problem from full-text search, and solved differently: this is
 * subsequence matching over a few thousand short strings, it has to feel
 * instant on every keystroke, and it must not pay an IPC round trip to do it.
 * So the path list is fetched ONCE per workspace, held in the renderer, and
 * matched locally with fuzzysort.
 */
import { useEffect, useMemo, useState } from 'react'
import fuzzysort from 'fuzzysort'
import { dirnameRel } from '@shared/paths'
import type { DocRef } from '@shared/types'
import { platform } from '../../platform'
import { useStore } from '../../store'
import { Overlay, type OverlayItem } from './Overlay'
import styles from './Overlay.module.css'

const LIMIT = 60

export function QuickOpen(): React.JSX.Element {
  const workspaceId = useStore((s) => s.workspace?.id ?? null)
  const fallbackDocs = useStore((s) => s.docs)
  const recents = useStore((s) => s.recents)
  const openDocument = useStore((s) => s.openDocument)

  const [docs, setDocs] = useState<DocRef[]>(fallbackDocs)
  const [query, setQuery] = useState('')

  // The index's list is richer (it knows frontmatter titles); the tree's list
  // is the fallback while the crawl is still running.
  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    void platform.quickOpenList(workspaceId).then((list) => {
      if (!cancelled && list.length > 0) setDocs(list)
    })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const prepared = useMemo(
    () => docs.map((doc) => ({ doc, target: fuzzysort.prepare(doc.path) })),
    [docs],
  )

  const items = useMemo<OverlayItem[]>(() => {
    const toItem = (doc: DocRef, highlighted?: React.ReactNode): OverlayItem => ({
      key: doc.path,
      content: (
        <>
          <span className={styles.primary}>{highlighted ?? doc.title}</span>
          <span className={styles.secondary}>{dirnameRel(doc.path) || '/'}</span>
        </>
      ),
      // Alt+Enter opens beside, matching the Ctrl-click convention elsewhere.
      onSelect: ({ alt }) => openDocument(doc.path, { pane: alt ? 'right' : 'active' }),
    })

    if (!query.trim()) {
      // An empty box shows where you have been, not an arbitrary slice of the
      // workspace — which is almost always what you actually want to reopen.
      const recentPaths = new Set(recents.map((r) => r.path))
      const byPath = new Map(docs.map((d) => [d.path, d]))
      const head = recents.flatMap((r) => byPath.get(r.path) ?? [])
      const rest = docs.filter((d) => !recentPaths.has(d.path)).slice(0, LIMIT - head.length)
      return [...head, ...rest].slice(0, LIMIT).map((doc) => toItem(doc))
    }

    const results = fuzzysort.go(query, prepared, { key: 'target', limit: LIMIT, threshold: -10000 })
    return results.map((result) =>
      toItem(
        result.obj.doc,
        // Highlight the matched characters so it is obvious WHY a row matched.
        result.highlight((match, i) => (
          <span key={i} className={styles.match}>
            {match}
          </span>
        )),
      ),
    )
  }, [docs, openDocument, prepared, query, recents])

  return (
    <Overlay
      label="Quick Open"
      placeholder="Open a document by name or path…"
      query={query}
      onQueryChange={setQuery}
      items={items}
      empty={`No file matches “${query}”.`}
      footer={
        <>
          <span className={styles.kbd}>Enter</span> open ·{' '}
          <span className={styles.kbd}>Alt</span>+<span className={styles.kbd}>Enter</span> open
          beside · <span className={styles.kbd}>Esc</span> dismiss
        </>
      }
    />
  )
}
