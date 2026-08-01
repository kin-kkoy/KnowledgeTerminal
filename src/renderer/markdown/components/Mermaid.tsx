/**
 * Mermaid diagrams.
 *
 * Mermaid is the one thing in the reading surface that genuinely cannot be
 * sized ahead of time — it has to measure text in the DOM to lay a graph out.
 * So instead of eliminating the layout shift, we BOUND it:
 *
 *   - the rendered height is remembered per diagram+theme and applied to the
 *     wrapper before mermaid runs, so every view after the first shifts by
 *     nothing at all;
 *   - the first ever view reserves a modest placeholder and the scroll
 *     restorer's settle loop absorbs the difference.
 *
 * It is also ~600KB, so it is imported dynamically — a workspace with no
 * diagrams never pays for it.
 */
import { useEffect, useRef, useState } from 'react'
import { hashString } from '@shared/paths'
import { useStore } from '../../store'
import styles from './Mermaid.module.css'

const HEIGHTS_KEY = 'kt.mermaid.heights'
const PLACEHOLDER_HEIGHT = 240

/** Rendered SVGs for this session. Cheap to rebuild, expensive to hold forever. */
const svgCache = new Map<string, string>()

/**
 * Heights persist across launches. Only the numbers are stored, never the SVG —
 * a few hundred bytes buys layout stability, where caching the markup would
 * mean megabytes for no extra benefit.
 */
function loadHeights(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(HEIGHTS_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

function rememberHeight(key: string, height: number): void {
  try {
    const all = loadHeights()
    all[key] = Math.round(height)
    localStorage.setItem(HEIGHTS_KEY, JSON.stringify(all))
  } catch {
    // A full or disabled localStorage is not a reason to fail a diagram.
  }
}

let initialised = false

async function ensureMermaid(theme: 'dark' | 'light'): Promise<typeof import('mermaid').default> {
  const mermaid = (await import('mermaid')).default
  // Re-initialising on theme change is correct: mermaid bakes colours into the
  // SVG, so a theme switch must re-render rather than swap variables.
  mermaid.initialize({
    startOnLoad: false,
    // 'strict' makes mermaid sanitise its own output and refuse click handlers
    // and inline HTML in labels.
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'var(--font-ui)',
    themeVariables:
      theme === 'dark'
        ? {
            background: '#151719',
            primaryColor: '#1B1E20',
            primaryTextColor: '#D6D3CE',
            primaryBorderColor: '#3A3F43',
            lineColor: '#6E6A66',
            secondaryColor: '#22262A',
            tertiaryColor: '#101214',
            fontSize: '13px',
          }
        : {
            background: '#FBFAF8',
            primaryColor: '#F4F2EE',
            primaryTextColor: '#23211E',
            primaryBorderColor: '#CFC9C0',
            lineColor: '#928C84',
            secondaryColor: '#EAE7E1',
            tertiaryColor: '#EFEDE8',
            fontSize: '13px',
          },
  })
  initialised = true
  return mermaid
}

interface Props {
  code: string
  blockId?: string
}

export function Mermaid({ code, blockId }: Props): React.JSX.Element {
  const theme = useStore((s) => (s.theme === 'light' ? 'light' : 'dark'))
  const key = `${hashString(code)}:${theme}`

  const container = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string | null>(() => svgCache.get(key) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [reserved, setReserved] = useState<number>(() => loadHeights()[key] ?? PLACEHOLDER_HEIGHT)

  useEffect(() => {
    const cached = svgCache.get(key)
    if (cached) {
      setSvg(cached)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const mermaid = await ensureMermaid(theme)
        // A unique id per render: mermaid injects a <style> scoped to it.
        const { svg: rendered } = await mermaid.render(`kt-mermaid-${key.replace(/:/g, '-')}`, code)
        if (cancelled) return
        svgCache.set(key, rendered)
        setSvg(rendered)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [code, key, theme])

  // Once it is on screen, remember how tall it actually was.
  useEffect(() => {
    if (!svg || !container.current) return
    const height = container.current.getBoundingClientRect().height
    if (height > 0) {
      rememberHeight(key, height)
      setReserved(height)
    }
  }, [svg, key])

  // A malformed diagram falls back to its source rather than blanking the page.
  if (error) {
    return (
      <div className={styles.failed} data-kt-block={blockId}>
        <p className={styles.failedTitle}>Diagram could not be rendered</p>
        <pre className={styles.source}>{code}</pre>
      </div>
    )
  }

  return (
    <div
      className={styles.mermaid}
      data-kt-block={blockId}
      style={svg ? undefined : { minHeight: reserved }}
    >
      {svg ? (
        // mermaid sanitised this itself under securityLevel: 'strict', and the
        // input is a local Markdown file the user already trusts enough to read.
        <div ref={container} className={styles.svg} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className={styles.pending} aria-label="Rendering diagram" />
      )}
    </div>
  )
}

export function isMermaidLoaded(): boolean {
  return initialised
}
