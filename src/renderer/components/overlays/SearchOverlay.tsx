/**
 * Ctrl+/ — full-text search across the workspace, as an overlay.
 *
 * Shares the store's search slice with the Explorer's Search section, so the
 * query and results are the same object seen two ways rather than two
 * independent searches racing each other.
 */
import { useEffect, useMemo } from 'react'
import { dirnameRel } from '@shared/paths'
import type { SearchMatch } from '@shared/types'
import { useStore, useShallow } from '../../store'
import { Overlay, type OverlayItem } from './Overlay'
import styles from './Overlay.module.css'

function highlight(match: SearchMatch): React.JSX.Element {
  const parts: React.JSX.Element[] = []
  let cursor = 0
  match.ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(<span key={`p${i}`}>{match.text.slice(cursor, start)}</span>)
    parts.push(
      <span key={`m${i}`} className={styles.match}>
        {match.text.slice(start, end)}
      </span>,
    )
    cursor = end
  })
  if (cursor < match.text.length) parts.push(<span key="tail">{match.text.slice(cursor)}</span>)
  return <>{parts}</>
}

export function SearchOverlay(): React.JSX.Element {
  const query = useStore((s) => s.query)
  const hits = useStore(useShallow((s) => s.hits))
  const searching = useStore((s) => s.searching)
  const total = useStore((s) => s.total)
  const setQuery = useStore((s) => s.setQuery)
  const openDocument = useStore((s) => s.openDocument)
  const setSection = useStore((s) => s.setExplorerSection)

  // Re-run on open so results match the current index rather than whatever was
  // last searched, possibly several file changes ago.
  useEffect(() => {
    if (query.trim()) void useStore.getState().runSearch(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items = useMemo<OverlayItem[]>(
    () =>
      hits.map((hit) => ({
        key: hit.path,
        content: (
          <>
            <span className={styles.primary}>
              {hit.title}
              {hit.matches[0] && (
                <span className={styles.snippet}> — {highlight(hit.matches[0])}</span>
              )}
            </span>
            <span className={styles.secondary}>{dirnameRel(hit.path) || '/'}</span>
          </>
        ),
        onSelect: ({ alt }) => openDocument(hit.path, { pane: alt ? 'right' : 'active' }),
      })),
    [hits, openDocument],
  )

  return (
    <Overlay
      label="Search Workspace"
      placeholder="Search every document…"
      query={query}
      onQueryChange={setQuery}
      items={items}
      empty={
        !query.trim()
          ? 'Type to search across every document in the workspace.'
          : searching
            ? 'Searching…'
            : `No match for “${query}”.`
      }
      footer={
        <>
          {total > 0 && `${total} result${total === 1 ? '' : 's'} · `}
          <button
            type="button"
            className={styles.linkish}
            onClick={() => setSection('search')}
          >
            Show all in the explorer
          </button>
        </>
      }
    />
  )
}
