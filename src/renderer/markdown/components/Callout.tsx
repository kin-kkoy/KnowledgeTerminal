/**
 * A callout: a flat block with a 2px coloured left rule and an icon.
 *
 * No fill gradient, no glow, no rounded card — the colour lives entirely in the
 * rule and the icon, so a page with five callouts still reads as one document
 * rather than five boxes.
 */
import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Ban,
  Bug,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Flame,
  HelpCircle,
  Info,
  Lightbulb,
  ListTodo,
  type LucideIcon,
  Pencil,
  Quote,
  StickyNote,
} from 'lucide-react'
import styles from './Callout.module.css'

const ICONS: Record<string, LucideIcon> = {
  note: StickyNote,
  tip: Lightbulb,
  info: Info,
  important: CircleAlert,
  warning: AlertTriangle,
  caution: Flame,
  danger: Flame,
  success: CheckCircle2,
  question: HelpCircle,
  example: Pencil,
  quote: Quote,
  abstract: StickyNote,
  todo: ListTodo,
  failure: Ban,
  bug: Bug,
}

const DEFAULT_TITLES: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  info: 'Info',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
  danger: 'Danger',
  success: 'Success',
  question: 'Question',
  example: 'Example',
  quote: 'Quote',
  abstract: 'Abstract',
  todo: 'To do',
  failure: 'Failure',
  bug: 'Bug',
}

interface Props {
  type: string
  title?: string
  /** '-' starts collapsed, '+' starts expanded, absent means not foldable. */
  fold?: string
  blockId?: string
  children?: ReactNode
}

export function Callout({ type, title, fold, blockId, children }: Props): React.JSX.Element {
  const foldable = fold === '-' || fold === '+'
  const [open, setOpen] = useState(fold !== '-')
  const IconComponent = ICONS[type] ?? Info
  const heading = title || DEFAULT_TITLES[type] || type

  return (
    <div className={styles.callout} data-kt-callout={type} data-kt-block={blockId}>
      {foldable ? (
        <button
          type="button"
          className={styles.header}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronRight
            size={13}
            strokeWidth={2}
            className={open ? styles.chevronOpen : styles.chevron}
            aria-hidden
          />
          <IconComponent size={14} strokeWidth={1.9} aria-hidden />
          <span className={styles.title}>{heading}</span>
        </button>
      ) : (
        <p className={styles.header}>
          <IconComponent size={14} strokeWidth={1.9} aria-hidden />
          <span className={styles.title}>{heading}</span>
        </p>
      )}

      {open && <div className={styles.body}>{children}</div>}
    </div>
  )
}
