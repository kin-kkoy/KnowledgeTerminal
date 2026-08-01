/**
 * Everything that is not Markdown.
 *
 * Docked to the BOTTOM of the panel like a VSCode secondary section: collapsed
 * it is a single header bar; expanding grows it upward and the file tree gives
 * up the room.
 *
 * Grouped by KIND rather than by directory, deliberately — when you want an
 * illustration you want "the images", not the folder someone happened to file
 * it in. These files stay fully indexed and embeddable; this is only about
 * keeping them out of the way of the documents.
 */
import { useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { basename, isMarkdown, matchesAny } from '@shared/paths'
import type { RelPath } from '@shared/types'
import { ICON_SET, type IconName } from '../../icons/registry'
import { useStore, useShallow } from '../../store'
import styles from './MiscellaneousSection.module.css'

interface Group {
  key: string
  label: string
  icon: IconName
  colour: string
  exts: string[]
  files: RelPath[]
}

/**
 * Grouping is by KIND, and the icon names come from the shared set so this
 * section and the tree cannot drift apart.
 */
const GROUPS: Array<Omit<Group, 'files'>> = [
  {
    key: 'images',
    label: 'Images',
    icon: 'image',
    colour: 'var(--pink)',
    exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'],
  },
  { key: 'pdfs', label: 'PDFs', icon: 'fileType', colour: 'var(--red)', exts: ['pdf'] },
  {
    key: 'data',
    label: 'Data',
    icon: 'database',
    colour: 'var(--yellow)',
    exts: ['json', 'yaml', 'yml', 'toml', 'csv', 'xml'],
  },
]

export function MiscellaneousSection(): React.JSX.Element | null {
  const docs = useStore(useShallow((s) => s.docs))
  const treeFilter = useStore(
    useShallow((s) => s.settings?.files.treeFilter ?? ['**/*.md', '**/*.markdown']),
  )
  const openDocument = useStore((s) => s.openDocument)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const { groups, total } = useMemo(() => {
    // Anything indexed but not shown in the tree lands here.
    const hidden = docs.filter((d) => !matchesAny(d.path, treeFilter))
    const built = GROUPS.map<Group>((g) => ({
      ...g,
      files: hidden
        .filter((d) => g.exts.includes(d.path.split('.').pop()?.toLowerCase() ?? ''))
        .map((d) => d.path),
    })).filter((g) => g.files.length > 0)

    const claimed = new Set(built.flatMap((g) => g.files))
    const rest = hidden.filter((d) => !claimed.has(d.path) && !isMarkdown(d.path))
    if (rest.length > 0) {
      built.push({
        key: 'other',
        label: 'Other',
        icon: 'file',
        colour: 'var(--text-faint)',
        exts: [],
        files: rest.map((d) => d.path),
      })
    }
    return { groups: built, total: hidden.length }
  }, [docs, treeFilter])

  // Nothing hidden means nothing to show — no empty section taking up a row.
  if (total === 0) return null

  return (
    <section className={open ? `${styles.misc} ${styles.open}` : styles.misc}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <ChevronRight size={10} strokeWidth={2.6} className={styles.chev} />
        Miscellaneous
        <span className={styles.count}>{total}</span>
      </button>

      <div className={styles.body}>
        {groups.map((group) => {
          const Icon = ICON_SET[group.icon]
          const isOpen = expanded === group.key
          return (
            <div key={group.key}>
              <button
                type="button"
                className={styles.group}
                onClick={() => setExpanded(isOpen ? null : group.key)}
                aria-expanded={isOpen}
              >
                <ChevronRight
                  size={10}
                  strokeWidth={2.6}
                  className={isOpen ? styles.chevOpen : styles.chev}
                />
                <Icon size={13} strokeWidth={1.8} style={{ color: group.colour }} />
                <span className={styles.groupName}>{group.label}</span>
                <span className={styles.groupCount}>{group.files.length}</span>
              </button>

              {isOpen &&
                group.files.map((path) => (
                  <button
                    key={path}
                    type="button"
                    className={styles.file}
                    onClick={() => openDocument(path)}
                    title={path}
                  >
                    {basename(path)}
                  </button>
                ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}
