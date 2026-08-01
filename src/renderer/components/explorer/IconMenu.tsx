/**
 * Right-click a tree row → choose its icon.
 *
 * The Sandbox's Files section can do this too, but this is the gesture that
 * will actually get used: you notice a folder is hard to find *while reading*,
 * and fixing it should not cost a mode switch. The Sandbox's table is where you
 * review and clear them later.
 *
 * This is the only write the explorer performs, and it writes to config, not to
 * a document — the read-only rule over Markdown is untouched.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { ICON_COLOURS, type IconColour } from '@shared/config-schema'
import { ICON_SET, resolveIcon, type IconName } from '../../icons/registry'
import { useStore } from '../../store'
import styles from './IconMenu.module.css'

export interface IconMenuTarget {
  path: string
  name: string
  kind: 'dir' | 'file'
  x: number
  y: number
}

export function IconMenu({
  target,
  onClose,
}: {
  target: IconMenuTarget
  onClose(): void
}): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const patchSettings = useStore((s) => s.patchSettings)
  const overrides = settings?.files.icons ?? {}
  const current = overrides[target.path]

  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: target.x, top: target.y })

  // Keep it on screen. A menu opened near the bottom of a tall tree would
  // otherwise render most of its icon grid below the fold.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()
    setPos({
      left: Math.min(target.x, window.innerWidth - box.width - 8),
      top: Math.min(target.y, window.innerHeight - box.height - 8),
    })
  }, [target.x, target.y])

  useEffect(() => {
    const onDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    // `capture` so a click lands here before the tree row's own handler opens a
    // document behind the menu.
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const write = (next: { icon: IconName; colour?: IconColour } | null): void => {
    const copy = { ...overrides }
    if (next === null) delete copy[target.path]
    else copy[target.path] = next
    void patchSettings({ files: { icons: copy } })
  }

  const preview = resolveIcon(target.path, target.name, target.kind, false, overrides)
  const Preview = preview.icon

  return (
    <div ref={ref} className={styles.menu} style={pos} role="dialog" aria-label="Choose an icon">
      <header className={styles.head}>
        <Preview size={14} strokeWidth={1.8} style={{ color: preview.colour }} />
        <span className={styles.name}>{target.name}</span>
        {current && (
          <button
            type="button"
            className={styles.reset}
            title="Back to the guessed icon"
            aria-label="Reset to the guessed icon"
            onClick={() => {
              write(null)
              onClose()
            }}
          >
            <RotateCcw size={12} strokeWidth={2.2} />
          </button>
        )}
      </header>

      <div className={styles.grid}>
        {(Object.keys(ICON_SET) as IconName[]).map((name) => {
          const Glyph = ICON_SET[name]
          const on = current?.icon === name
          return (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={on}
              className={on ? `${styles.cell} ${styles.cellOn}` : styles.cell}
              onClick={() =>
                write({ icon: name, ...(current?.colour ? { colour: current.colour } : {}) })
              }
            >
              <Glyph size={15} strokeWidth={1.8} />
            </button>
          )
        })}
      </div>

      <div className={styles.swatches}>
        {ICON_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            title={colour}
            aria-label={colour}
            aria-pressed={current?.colour === colour}
            className={
              current?.colour === colour ? `${styles.swatch} ${styles.swatchOn}` : styles.swatch
            }
            style={{ background: `var(--${colour})` }}
            // Colour alone is a complete edit: it keeps whichever icon is
            // showing — the override's, or the one the heuristic guessed — so
            // "make this folder peach" does not force you to re-pick the icon.
            onClick={() => write({ icon: preview.name, colour })}
          />
        ))}
      </div>
    </div>
  )
}
