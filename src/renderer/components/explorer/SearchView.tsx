/**
 * Full-text results, grouped by file with highlighted context lines.
 */
import { useEffect, useRef } from 'react'
import { dirnameRel } from '@shared/paths'
import type { SearchMatch } from '@shared/types'
import { useStore, useShallow } from '../../store'
import { Icon } from '../primitives/Icon'
import styles from './SearchView.module.css'

/** Split a line into plain and highlighted runs from the match ranges. */
function highlight(match: SearchMatch): React.JSX.Element {
  const parts: React.JSX.Element[] = []
  let cursor = 0
  match.ranges.forEach(([start, end], i) => {
    if (start > cursor) parts.push(<span key={`p${i}`}>{match.text.slice(cursor, start)}</span>)
    parts.push(
      <mark key={`m${i}`} className={styles.mark}>
        {match.text.slice(start, end)}
      </mark>,
    )
    cursor = end
  })
  if (cursor < match.text.length) parts.push(<span key="tail">{match.text.slice(cursor)}</span>)
  return <>{parts}</>
}

export function SearchView(): React.JSX.Element {
  const query = useStore((s) => s.query)
  const hits = useStore(useShallow((s) => s.hits))
  const searching = useStore((s) => s.searching)
  const total = useStore((s) => s.total)
  const truncated = useStore((s) => s.truncated)
  const setQuery = useStore((s) => s.setQuery)
  const openDocument = useStore((s) => s.openDocument)
  const input = useRef<HTMLInputElement>(null)

  // Opening the Search section should put the caret in the box; anything else
  // makes the keyboard user press Tab for no reason.
  useEffect(() => {
    input.current?.focus()
  }, [])

  return (
    <div className={styles.view}>
      <div className={styles.searchbox}>
        <Icon name="search" size={13} />
        <input
          ref={input}
          type="search"
          className={styles.input}
          value={query}
          placeholder="Search the workspace"
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          aria-label="Search the workspace"
        />
      </div>

      {query && (
        <p className={styles.summary}>
          {searching
            ? 'Searching…'
            : `${total} result${total === 1 ? '' : 's'}${truncated ? ' (truncated)' : ''}`}
        </p>
      )}

      <ul className={styles.results}>
        {hits.map((hit) => (
          <li key={hit.path} className={styles.hit}>
            <button
              type="button"
              className={styles.hitHeader}
              onClick={() => openDocument(hit.path)}
              title={hit.path}
            >
              <span className={styles.hitTitle}>{hit.title}</span>
              <span className={styles.hitDir}>{dirnameRel(hit.path)}</span>
            </button>
            {hit.matches.map((match) => (
              <button
                key={`${hit.path}:${match.line}`}
                type="button"
                className={styles.match}
                onClick={() => openDocument(hit.path)}
              >
                <span className={styles.lineNo}>{match.line}</span>
                <span className={styles.lineText}>{highlight(match)}</span>
              </button>
            ))}
          </li>
        ))}
      </ul>

      {query && !searching && hits.length === 0 && (
        <p className={styles.empty}>No matches for “{query}”.</p>
      )}
    </div>
  )
}
