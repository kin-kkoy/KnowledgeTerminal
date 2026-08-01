/**
 * The in-document table of contents, with scroll-spy.
 *
 * One IntersectionObserver with a negative bottom margin, rather than a scroll
 * handler doing arithmetic — the observer costs nothing while the user reads,
 * which is most of the time.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useDocument } from '../../hooks/useDocument'
import { extractToc, shouldShowToc } from '../../markdown/toc'
import { useStore } from '../../store'
import styles from './OutlinePanel.module.css'

interface Props {
  tabId: string
}

export function OutlinePanel({ tabId }: Props): React.JSX.Element | null {
  const path = useStore((s) => {
    for (const pane of s.panes) {
      const tab = pane.tabs.find((t) => t.id === tabId)
      if (tab) return tab.path
    }
    return null
  })
  const tocConfig = useStore(
    (s) => s.settings?.markdown.tableOfContents ?? { enabled: true, minHeadings: 3, maxDepth: 3 },
  )

  const { doc } = useDocument(path ?? '')
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const observer = useRef<IntersectionObserver | null>(null)

  const entries = useMemo(
    () => (doc?.isMarkdown ? extractToc(doc.content) : []),
    [doc?.content, doc?.isMarkdown],
  )
  const visible = useMemo(
    () => entries.filter((e) => e.depth > 1 && e.depth <= tocConfig.maxDepth),
    [entries, tocConfig.maxDepth],
  )

  useEffect(() => {
    observer.current?.disconnect()
    if (visible.length === 0) return

    // The -70% bottom margin means a heading counts as "current" once it
    // reaches the top third of the viewport, which matches where the eye is.
    const io = new IntersectionObserver(
      (records) => {
        const onScreen = records.filter((r) => r.isIntersecting)
        if (onScreen.length > 0) setActiveSlug(onScreen[0]!.target.id)
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    )

    for (const entry of visible) {
      const el = document.getElementById(entry.slug)
      if (el) io.observe(el)
    }
    observer.current = io
    return () => io.disconnect()
  }, [visible, doc?.hash])

  if (!doc?.isMarkdown) return null
  if (!shouldShowToc(entries, tocConfig)) return null

  return (
    <nav className={styles.outline} aria-label="Document outline">
      <p className={styles.heading}>On this page</p>
      <ul className={styles.list}>
        {visible.map((entry) => (
          <li key={entry.slug}>
            <a
              href={`#${entry.slug}`}
              className={
                entry.slug === activeSlug ? `${styles.link} ${styles.active}` : styles.link
              }
              style={{ paddingLeft: 8 + (entry.depth - 2) * 12 }}
              onClick={(event) => {
                event.preventDefault()
                document.getElementById(entry.slug)?.scrollIntoView({ block: 'start' })
              }}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
