/**
 * The shared modal primitive: a filter input over a keyboard-navigable list.
 *
 * Quick Open, the command palette and global search are the same interaction
 * with different data, so they are the same component with different props.
 *
 * No backdrop blur, no scale-in animation, no dimming of the page behind it —
 * a 4px translate and an opacity fade, and it is gone as fast as it arrived.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../../store'
import styles from './Overlay.module.css'

export interface OverlayItem {
  key: string
  /** Rendered as the row. Must not contain interactive elements. */
  content: ReactNode
  onSelect(modifiers: { alt: boolean }): void
}

interface Props {
  placeholder: string
  query: string
  onQueryChange(value: string): void
  items: OverlayItem[]
  /** Shown in place of the list when there is nothing to show. */
  empty?: ReactNode
  footer?: ReactNode
  label: string
}

export function Overlay({
  placeholder,
  query,
  onQueryChange,
  items,
  empty,
  footer,
  label,
}: Props): React.JSX.Element {
  const closeOverlay = useStore((s) => s.closeOverlay)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  // A new result set always starts at the top; keeping a stale index is how
  // "press Enter" opens the wrong file.
  useEffect(() => setActive(0), [items])

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (event: React.KeyboardEvent): void => {
    switch (event.key) {
      case 'ArrowDown':
        setActive((i) => (items.length === 0 ? 0 : (i + 1) % items.length))
        break
      case 'ArrowUp':
        setActive((i) => (items.length === 0 ? 0 : (i - 1 + items.length) % items.length))
        break
      case 'Home':
        setActive(0)
        break
      case 'End':
        setActive(Math.max(0, items.length - 1))
        break
      case 'Enter': {
        const item = items[active]
        if (item) {
          item.onSelect({ alt: event.altKey })
          closeOverlay()
        }
        break
      }
      case 'Escape':
        closeOverlay()
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <div className={styles.backdrop} onMouseDown={closeOverlay} role="presentation">
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={input}
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label={placeholder}
        />

        {items.length > 0 ? (
          <ul className={styles.list} ref={list} role="listbox">
            {items.map((item, index) => (
              <li
                key={item.key}
                data-index={index}
                role="option"
                aria-selected={index === active}
                className={index === active ? `${styles.row} ${styles.rowActive}` : styles.row}
                onMouseMove={() => setActive(index)}
                onClick={(e) => {
                  item.onSelect({ alt: e.altKey })
                  closeOverlay()
                }}
              >
                {item.content}
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>{empty}</div>
        )}

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}
