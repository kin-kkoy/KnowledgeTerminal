/**
 * The Sandbox's control vocabulary.
 *
 * Ten sections editing fifty fields will invent ten different text inputs
 * unless the inputs are decided once, here. Every one of these is uncontrolled
 * about *when* it commits: local state while you type, `onCommit` on blur or
 * Enter. That is the same bargain the reading-comfort sliders make — feel
 * immediate, do not produce a disk write per keystroke.
 */
import { useEffect, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { ICON_COLOURS, type IconColour } from '@shared/config-schema'
import { ICON_SET, isIconName, type IconName } from '../../icons/registry'
import styles from './controls.module.css'

// ── text ──────────────────────────────────────────────────────────────────

interface TextProps {
  value: string
  placeholder?: string
  mono?: boolean
  multiline?: boolean
  disabled?: boolean
  /** id of a <datalist> to suggest from — used for path fields. */
  list?: string
  onCommit(next: string): void
}

export function TextInput({
  value,
  placeholder,
  mono,
  multiline,
  disabled,
  list,
  onCommit,
}: TextProps): React.JSX.Element {
  const [draft, setDraft] = useState(value)

  // Re-sync when the value changes underneath us — a settings.json hand-edit,
  // or a reset button in another row.
  useEffect(() => setDraft(value), [value])

  const commit = (): void => {
    if (draft !== value) onCommit(draft)
  }
  const className = mono ? `${styles.input} ${styles.mono}` : styles.input

  if (multiline) {
    return (
      <textarea
        className={`${className} ${styles.area}`}
        value={draft}
        placeholder={placeholder}
        disabled={disabled}
        rows={3}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
    )
  }

  return (
    <input
      type="text"
      className={className}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      list={list}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}

// ── number ────────────────────────────────────────────────────────────────

export function NumberInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number
  min?: number
  max?: number
  step?: number
  onCommit(next: number): void
}): React.JSX.Element {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  const commit = (): void => {
    const parsed = Number(draft)
    // A field left in an unparseable state snaps back rather than writing NaN
    // into the config and failing the schema on the next load.
    if (!Number.isFinite(parsed)) return setDraft(String(value))
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed))
    setDraft(String(clamped))
    if (clamped !== value) onCommit(clamped)
  }

  return (
    <input
      type="number"
      className={`${styles.input} ${styles.mono} ${styles.number}`}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}

// ── toggle & segmented ────────────────────────────────────────────────────

export function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange(next: boolean): void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={checked ? `${styles.toggle} ${styles.on}` : styles.toggle}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.knob} />
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange(next: T): void
}): React.JSX.Element {
  return (
    <div className={styles.seg}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? `${styles.segb} ${styles.segOn}` : styles.segb}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ── string lists (globs, prompts, branches) ───────────────────────────────

/**
 * An ordered list of strings, edited one row at a time.
 *
 * NOT a comma-separated text box: these hold globs, and a glob containing a
 * comma is legal. One row per entry also makes it obvious that order matters
 * for `files.include`.
 */
export function StringList({
  values,
  placeholder,
  onChange,
}: {
  values: string[]
  placeholder?: string
  onChange(next: string[]): void
}): React.JSX.Element {
  const [adding, setAdding] = useState('')

  const replace = (index: number, next: string): void => {
    const copy = [...values]
    if (next.trim() === '') copy.splice(index, 1)
    else copy[index] = next
    onChange(copy)
  }

  const add = (): void => {
    const trimmed = adding.trim()
    if (trimmed === '') return
    onChange([...values, trimmed])
    setAdding('')
  }

  return (
    <div className={styles.list}>
      {values.map((entry, index) => (
        <div key={`${entry}-${index}`} className={styles.listRow}>
          <TextInput value={entry} mono onCommit={(next) => replace(index, next)} />
          <button
            type="button"
            className={styles.iconBtn}
            title="Remove"
            aria-label={`Remove ${entry}`}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>
      ))}

      <div className={`${styles.listRow} ${styles.addRow}`}>
        <input
          type="text"
          className={`${styles.input} ${styles.mono} ${styles.addInput}`}
          value={adding}
          // Prefixed, because a bare example in the empty row reads as an entry
          // that is already in the list.
          placeholder={placeholder ? `Add…  e.g. ${placeholder}` : 'Add…'}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button
          type="button"
          className={styles.iconBtn}
          title="Add"
          aria-label="Add entry"
          onClick={add}
        >
          <Plus size={13} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  )
}

// ── icon picker ───────────────────────────────────────────────────────────

/**
 * The whole icon set, plus the palette.
 *
 * A grid rather than a dropdown: you are choosing by silhouette, and a list of
 * forty names tells you nothing about what any of them look like.
 */
export function IconPicker({
  icon,
  colour,
  onChange,
}: {
  icon: string | null
  colour: IconColour | undefined
  onChange(next: { icon: IconName; colour?: IconColour } | null): void
}): React.JSX.Element {
  const tint = colour ? `var(--${colour})` : 'var(--text-muted)'

  return (
    <div className={styles.picker}>
      <div className={styles.iconGrid}>
        {(Object.keys(ICON_SET) as IconName[]).map((name) => {
          const Glyph = ICON_SET[name]
          const selected = name === icon
          return (
            <button
              key={name}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={selected}
              className={selected ? `${styles.iconCell} ${styles.cellOn}` : styles.iconCell}
              onClick={() => onChange({ icon: name, ...(colour ? { colour } : {}) })}
            >
              <Glyph size={16} strokeWidth={1.8} style={{ color: selected ? tint : undefined }} />
            </button>
          )
        })}
      </div>

      <div className={styles.swatches}>
        {ICON_COLOURS.map((name) => (
          <button
            key={name}
            type="button"
            title={name}
            aria-label={name}
            aria-pressed={name === colour}
            className={name === colour ? `${styles.swatch} ${styles.swatchOn}` : styles.swatch}
            style={{ background: `var(--${name})` }}
            onClick={() => {
              // Choosing a colour before an icon is meaningless — there is
              // nothing to tint yet.
              if (icon && isIconName(icon)) onChange({ icon, colour: name })
            }}
          >
            {name === colour && <Check size={11} strokeWidth={3} />}
          </button>
        ))}
      </div>
    </div>
  )
}
