/**
 * The workspace tree.
 *
 * Flattened to a visible-row list and windowed, so expanding a folder with a
 * few thousand files stays instant. The row height is a fixed token, which is
 * what makes windowing trivial here — variable-height rows would need
 * measurement for no visual gain.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { ancestorDirs, isMarkdown, matchesAny } from '@shared/paths'
import type { RelPath, TreeNode } from '@shared/types'
import { resolveIcon, type IconOverrides } from '../../icons/registry'
import { useStore, useShallow } from '../../store'
import { IconMenu, type IconMenuTarget } from './IconMenu'
import styles from './FileTree.module.css'

/** Stable identity, so the shallow selector does not fire on every render. */
const EMPTY_ICONS: IconOverrides = {}

interface Row {
  node: TreeNode
  depth: number
  expanded: boolean
}

const ROW_HEIGHT = 24
const OVERSCAN = 8

function flatten(node: TreeNode, expanded: Set<RelPath>, depth = 0, rows: Row[] = []): Row[] {
  for (const child of node.children ?? []) {
    const isOpen = child.kind === 'dir' && expanded.has(child.path)
    rows.push({ node: child, depth, expanded: isOpen })
    if (isOpen) flatten(child, expanded, depth + 1, rows)
  }
  return rows
}

/** Keep a directory only if something inside it survives the filter. */
function prune(node: TreeNode, filter: string[]): TreeNode | null {
  if (node.kind === 'file') return matchesAny(node.path, filter) ? node : null
  const children = (node.children ?? [])
    .map((child) => prune(child, filter))
    .filter((child): child is TreeNode => child !== null)
  if (children.length === 0) return null
  return { ...node, children }
}

export function FileTree(): React.JSX.Element {
  const tree = useStore((s) => s.tree)
  const expandedDirs = useStore((s) => s.expandedDirs)
  const selectedPath = useStore((s) => s.selectedPath)
  const scrollTop = useStore((s) => s.explorerScrollTop)
  const toggleDir = useStore((s) => s.toggleDir)
  const expandDirs = useStore((s) => s.expandDirs)
  const setScrollTop = useStore((s) => s.setExplorerScrollTop)
  const setFocusZone = useStore((s) => s.setFocusZone)
  const openDocument = useStore((s) => s.openDocument)

  const treeFilter = useStore(
    useShallow((s) => s.settings?.files.treeFilter ?? ['**/*.md', '**/*.markdown']),
  )
  // Just the override map, not all of `settings` — the tree must not re-render
  // every time the reading measure moves.
  const iconOverrides = useStore(useShallow((s) => s.settings?.files.icons ?? EMPTY_ICONS))
  const [iconTarget, setIconTarget] = useState<IconMenuTarget | null>(null)

  const viewport = useRef<HTMLDivElement>(null)
  // Everything filtered out here is still indexed and embeddable — it moves to
  // the Miscellaneous section rather than disappearing.
  const filtered = useMemo(
    () => (tree ? (prune(tree, treeFilter) ?? { ...tree, children: [] }) : null),
    [tree, treeFilter],
  )
  const rows = useMemo(
    () => (filtered ? flatten(filtered, expandedDirs) : []),
    [filtered, expandedDirs],
  )

  // Reveal the active document by expanding the folders that contain it.
  useEffect(() => {
    if (selectedPath) expandDirs(ancestorDirs(selectedPath))
  }, [selectedPath, expandDirs])

  // Restore the tree's own scroll offset when the panel remounts.
  useEffect(() => {
    const el = viewport.current
    if (el && scrollTop > 0 && el.scrollTop === 0) el.scrollTop = scrollTop
    // Intentionally runs once per mount; live updates come from onScroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onScroll = useCallback(() => {
    const el = viewport.current
    if (el) setScrollTop(el.scrollTop)
  }, [setScrollTop])

  const activate = useCallback(
    (row: Row) => {
      if (row.node.kind === 'dir') toggleDir(row.node.path)
      else openDocument(row.node.path)
    },
    [openDocument, toggleDir],
  )

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      const row = rows[index]
      if (!row) return
      const focusRow = (i: number): void => {
        const clamped = Math.max(0, Math.min(rows.length - 1, i))
        const el = viewport.current?.querySelector<HTMLElement>(`[data-row="${clamped}"]`)
        el?.focus()
        el?.scrollIntoView({ block: 'nearest' })
      }

      switch (event.key) {
        case 'ArrowDown':
          focusRow(index + 1)
          break
        case 'ArrowUp':
          focusRow(index - 1)
          break
        case 'ArrowRight':
          if (row.node.kind === 'dir' && !row.expanded) toggleDir(row.node.path)
          else focusRow(index + 1)
          break
        case 'ArrowLeft':
          if (row.node.kind === 'dir' && row.expanded) toggleDir(row.node.path)
          else focusRow(index - 1)
          break
        case 'Enter':
        case ' ':
          activate(row)
          break
        default:
          return
      }
      event.preventDefault()
    },
    [activate, rows, toggleDir],
  )

  if (!tree) return <p className={styles.empty}>No workspace open.</p>
  if (rows.length === 0) return <p className={styles.empty}>No matching files.</p>

  // Window the list: only rows near the viewport are in the DOM.
  const height = viewport.current?.clientHeight ?? 800
  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const last = Math.min(rows.length, Math.ceil((scrollTop + height) / ROW_HEIGHT) + OVERSCAN)
  const visible = rows.slice(first, last)

  return (
    <div
      className={styles.viewport}
      ref={viewport}
      onScroll={onScroll}
      onFocus={() => setFocusZone('explorer')}
      role="tree"
      aria-label="Workspace files"
    >
      <div style={{ height: rows.length * ROW_HEIGHT }} className={styles.spacer}>
        <div style={{ transform: `translateY(${first * ROW_HEIGHT}px)` }}>
          {visible.map((row, i) => {
            const index = first + i
            const selected = row.node.path === selectedPath
            return (
              <div
                key={row.node.path}
                data-row={index}
                role="treeitem"
                aria-level={row.depth + 1}
                aria-expanded={row.node.kind === 'dir' ? row.expanded : undefined}
                aria-selected={selected}
                tabIndex={index === 0 ? 0 : -1}
                className={selected ? `${styles.row} ${styles.selected}` : styles.row}
                style={{ paddingLeft: indentFor(row.depth) }}
                onClick={() => activate(row)}
                onKeyDown={(e) => onKeyDown(e, index)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setIconTarget({
                    path: row.node.path,
                    name: row.node.name,
                    kind: row.node.kind,
                    x: e.clientX,
                    y: e.clientY,
                  })
                }}
                title={row.node.path}
              >
                <span className={styles.chevron}>
                  {row.node.kind === 'dir' &&
                    (row.expanded ? (
                      <ChevronDown size={12} strokeWidth={2.4} />
                    ) : (
                      <ChevronRight size={12} strokeWidth={2.4} />
                    ))}
                </span>
                <span className={styles.icon}>
                  {(() => {
                    const { icon: Glyph, colour } = resolveIcon(
                      row.node.path,
                      row.node.name,
                      row.node.kind,
                      row.expanded,
                      iconOverrides,
                    )
                    return <Glyph size={13} strokeWidth={1.8} style={{ color: colour }} />
                  })()}
                </span>
                <span className={styles.name}>
                  {isMarkdown(row.node.path) ? row.node.name.replace(/\.mdx?$/i, '') : row.node.name}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {iconTarget && <IconMenu target={iconTarget} onClose={() => setIconTarget(null)} />}
    </div>
  )
}

/** 12px per level, plus the base gutter. */
function indentFor(depth: number): number {
  return 6 + depth * 12
}
