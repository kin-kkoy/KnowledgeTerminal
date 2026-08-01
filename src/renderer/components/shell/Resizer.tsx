/**
 * A drag handle that is also operable from the keyboard.
 *
 * "Keyboard-first" has to include the chrome, not just navigation — a panel you
 * can only resize with a mouse is a panel you cannot resize.
 */
import { useCallback, useRef } from 'react'
import styles from './Resizer.module.css'

interface Props {
  /** Current size in px, used as the ARIA value and the drag origin. */
  value: number
  min: number
  max: number
  /** 'left' means the panel being sized is to the left of this handle. */
  side: 'left' | 'right'
  label: string
  onChange(next: number): void
}

const KEY_STEP = 16

export function Resizer({ value, min, max, side, label, onChange }: Props): React.JSX.Element {
  const dragging = useRef(false)
  const origin = useRef({ x: 0, value: 0 })

  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true
      origin.current = { x: event.clientX, value }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [value],
  )

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      const delta = event.clientX - origin.current.x
      onChange(clamp(origin.current.value + (side === 'left' ? delta : -delta)))
    },
    [clamp, onChange, side],
  )

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const grow = side === 'left' ? 'ArrowRight' : 'ArrowLeft'
      const shrink = side === 'left' ? 'ArrowLeft' : 'ArrowRight'
      if (event.key === grow) onChange(clamp(value + KEY_STEP))
      else if (event.key === shrink) onChange(clamp(value - KEY_STEP))
      else if (event.key === 'Home') onChange(min)
      else if (event.key === 'End') onChange(max)
      else return
      event.preventDefault()
    },
    [clamp, max, min, onChange, side, value],
  )

  return (
    <div
      className={styles.resizer}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={onKeyDown}
    />
  )
}
