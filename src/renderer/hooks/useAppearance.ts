/**
 * Push `appearance` from the workspace config onto the document element.
 *
 * These land as data attributes and CSS custom properties rather than as props
 * threaded through components, so changing the accent or the reading measure
 * costs one style recalculation and zero React re-renders.
 */
import { useEffect } from 'react'
import { useStore } from '../store'

const PROSE_FONTS: Record<string, string> = {
  serif: 'var(--font-prose)',
  sans: 'var(--font-ui)',
  mono: 'var(--font-mono)',
}

export function useAppearance(): void {
  const appearance = useStore((s) => s.settings?.appearance ?? null)
  const setTheme = useStore((s) => s.setTheme)

  useEffect(() => {
    if (!appearance) return
    const root = document.documentElement

    // The accent is a NAME; themes.css maps it per flavour.
    root.dataset['accent'] = appearance.accent
    root.dataset['density'] = appearance.density
    root.dataset['reveal'] = appearance.revealMode

    root.style.setProperty('--fs-prose', `${appearance.fontSize}px`)
    root.style.setProperty('--lh-prose', String(appearance.lineHeight))
    root.style.setProperty('--measure', appearance.measure)
    root.style.setProperty('--font-reading', PROSE_FONTS[appearance.proseFont] ?? 'var(--font-ui)')

    setTheme(appearance.theme)
  }, [appearance, setTheme])
}

/**
 * Live preview without touching config — used by the settings sliders so the
 * page responds while dragging, before anything is written to disk.
 */
export function previewAppearance(patch: {
  measure?: string
  fontSize?: number
  lineHeight?: number
  accent?: string
  revealMode?: string
  density?: string
  proseFont?: string
}): void {
  const root = document.documentElement
  if (patch.measure) root.style.setProperty('--measure', patch.measure)
  if (patch.fontSize) root.style.setProperty('--fs-prose', `${patch.fontSize}px`)
  if (patch.lineHeight) root.style.setProperty('--lh-prose', String(patch.lineHeight))
  if (patch.accent) root.dataset['accent'] = patch.accent
  if (patch.revealMode) root.dataset['reveal'] = patch.revealMode
  if (patch.density) root.dataset['density'] = patch.density
  if (patch.proseFont) {
    root.style.setProperty('--font-reading', PROSE_FONTS[patch.proseFont] ?? 'var(--font-ui)')
  }
  // Theme deliberately absent: it round-trips through the store so the native
  // window chrome and the pre-paint attribute stay in step with the CSS.
}
