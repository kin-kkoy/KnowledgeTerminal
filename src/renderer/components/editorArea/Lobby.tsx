/**
 * The Lobby — orientation, in the pane where you read.
 *
 * Not the dashboard and not a rail: it is the room, and a document is what you
 * pick up in it. It opens as a tab, and is also what an empty pane shows.
 *
 * THE DESK is permanent — where you are, and the documents that matter now.
 * Beneath it a tab picks between THE BOARD (a contributed stretch of work you
 * can tick off), WHERE THINGS LIVE (the workspace by purpose) and WHAT A
 * SESSION LOOKS LIKE (the loop, and the documents each step uses).
 *
 * The board leads when one is contributed, because "what am I building" beats
 * "where do files live" on the third visit and every visit after it. Nothing
 * contributes one in a fresh workspace, and then the map leads as before.
 *
 * There is no live strip: the context panel already owns Today / Module / Gate
 * / Progress, and repeating them here was pure duplication.
 *
 * NOTHING SUBJECT-SPECIFIC LIVES HERE. The desk's title and its document
 * targets arrive through `registerDashboardSource` — the same seam the
 * dashboard uses — so a contributor nominates them and core renders what it was
 * handed. The map comes from `settings.lobby.map`, falling back to the
 * workspace's top-level folders when that is unset.
 *
 * PATHS RESOLVE BY FILENAME, never hardcoded. An earlier version hardcoded
 * `curriculum/plan/module-01-...` and broke the moment those files were
 * grouped into `plan/1-core/`; looking the name up in the document index means
 * the buttons survive the folders moving again.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Check,
  CornerDownRight,
  FileText,
  Library,
  Map as MapIcon,
  Target,
} from 'lucide-react'
import { resolveIcon, type IconOverrides } from '../../icons/registry'
import { useShallow, useStore } from '../../store'
import { platform } from '../../platform'
import { markSelfWrite } from '../../hooks/useDocument'
import { toggleTaskAt } from '../../markdown/tasks'
import type { BoardItem, HomeSnapshot, LobbyBoard, RelPath } from '@shared/types'

import styles from './Lobby.module.css'

/** Stable identities, so the shallow selectors do not fire every render. */
const EMPTY_MAP: Array<{
  group: string
  entries: Array<{ path: string; label?: string; note?: string; emphasis: boolean }>
}> = []
const EMPTY_ICONS: IconOverrides = {}

/**
 * The Lobby's tab identity.
 *
 * Tabs are keyed by path, so the Lobby needs one that can never collide with a
 * real document. A `kt://` URI cannot be a workspace-relative path, so nothing
 * on disk can ever claim it.
 */
export const LOBBY_PATH = 'kt://lobby'

export function Lobby(): React.JSX.Element {
  const [tab, setTab] = useState<'board' | 'map' | 'loop'>('board')

  const docs = useStore(useShallow((s) => s.docs))
  const tree = useStore((s) => s.tree)
  const openDocument = useStore((s) => s.openDocument)
  const expandDirs = useStore((s) => s.expandDirs)
  const setExplorerSection = useStore((s) => s.setExplorerSection)
  const configuredMap = useStore(useShallow((s) => s.settings?.lobby.map ?? EMPTY_MAP))
  const iconOverrides = useStore(useShallow((s) => s.settings?.files.icons ?? EMPTY_ICONS))
  const mission = useStore((s) => s.settings?.workspace.mission ?? null)
  const name = useStore((s) => s.settings?.workspace.name ?? 'Workspace')

  /**
   * TIER 1 + 2 — live, from the SAME seam the dashboard reads.
   *
   * `dashboardSources` is how a plugin hands core a headline, an eyebrow and a
   * set of role-tagged links without core learning what a module is. Reading it
   * here rather than inventing a second seam is the whole point: the curriculum
   * plugin already computes all of this and was simply never asked.
   *
   * These are PULL-based, so `contributionVersion` is what makes them reactive:
   * a contributor calls `ctx.app.refreshContributions()` when its own state
   * moves, and this recomputes. Necessary now the Lobby is a tab that stays
   * open — ticking a task must move it without a remount.
   */
  const sources = useStore(useShallow((s) => s.dashboardSources))
  // Contributions are pulled, so their identity never changes when the values
  // do. This counter is the signal that they moved — see `bumpContributions`.
  const version = useStore((s) => s.contributionVersion)
  const live = useMemo(() => {
    return sources.reduce<Partial<HomeSnapshot>>((acc, src) => {
      try {
        return { ...acc, ...src.get() }
      } catch {
        return acc // a broken contributor costs its own line, nothing more
      }
    }, {})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the point
  }, [sources, version])

  const linkFor = (role: string): HomeSnapshot['links'][number] | undefined =>
    live.links?.find((l) => l.role === role)

  const board = live.board ?? null

  /**
   * Fall back rather than show an empty first tab.
   *
   * The board leads, but only if one exists. A workspace whose contributor has
   * nothing to offer — or which loses it mid-session — must not open onto a
   * blank panel, and must not silently strand the user on a tab that vanished.
   */
  useEffect(() => {
    if (!board && tab === 'board') setTab('map')
  }, [board, tab])

  /** stem -> real path, so nothing here depends on where a file currently sits. */
  const byStem = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of docs) {
      const stem = (d.path.split('/').pop() ?? '').replace(/\.[^.]+$/, '')
      if (!m.has(stem)) m.set(stem, d.path)
    }
    return m
  }, [docs])

  /** Every directory in the tree, so folder targets can be checked before use. */
  const dirs = useMemo(() => {
    const out = new Set<string>()
    const walk = (n: { children?: Array<{ kind: string; path: string; children?: unknown }> }): void => {
      for (const c of (n.children ?? []) as Array<{ kind: string; path: string }>) {
        if (c.kind === 'dir') {
          out.add(c.path)
          walk(c as never)
        }
      }
    }
    if (tree) walk(tree as never)
    return out
  }, [tree])

  const openPath = (path: string) => (): void => openDocument(path)

  const openStem = (stem: string) => (): void => {
    const path = byStem.get(stem)
    if (path) openDocument(path)
  }

  const revealDir = (dir: string) => (): void => {
    setExplorerSection('tree') // also un-hides the panel
    expandDirs(dir.split('/').map((_, i, p) => p.slice(0, i + 1).join('/')))
  }

  const hasStem = (s: string): boolean => byStem.has(s)

  /** Is this path a folder, a document, or absent? */
  const exists = (p: string): 'dir' | 'file' | null =>
    dirs.has(p) ? 'dir' : docs.some((d) => d.path === p) ? 'file' : null

  const openEntry = (path: string, isDir: boolean) => (): void =>
    isDir ? revealDir(path)() : openDocument(path)

  /**
   * The map's contents come from `settings.lobby.map`. With none configured we
   * derive a plain list of top-level folders — duller than a written map, but a
   * workspace that has never been configured still gets something true.
   */
  const mapGroups = useMemo(() => {
    if (configuredMap.length > 0) return configuredMap
    const top = [...dirs].filter((d) => !d.includes('/')).sort()
    if (top.length === 0) return []
    return [{ group: 'Folders', entries: top.map((path) => ({ path, emphasis: false })) }]
  }, [configuredMap, dirs])

  return (
    <div className={styles.host}>
      <div className={styles.scroll}>
        {/* ── THE DESK — always here ─────────────────────────────────────── */}
        <section className={styles.desk}>
          <p className={styles.eyebrow}>{live.eyebrow ?? name}</p>
          <h1 className={styles.deskTitle}>
            {live.headline ?? mission ?? 'Pick up where you left off.'}
          </h1>

          <button type="button" className={styles.primary} onClick={openStem('PROGRESS')}>
            Open PROGRESS
            <ArrowRight size={15} strokeWidth={2.2} />
          </button>
          <p className={styles.deskNote}>
            It holds the TODAY pointer. Nothing else requires a decision.
          </p>

          <div className={styles.deskRow}>
            <DeskCard
              icon={<Library size={16} strokeWidth={1.8} />}
              colour="var(--sapphire)"
              title="Read a topic"
              note="The teaching material."
              link={linkFor('read')}
              onOpen={openPath}
            />
            <DeskCard
              icon={<Target size={16} strokeWidth={1.8} />}
              colour="var(--green)"
              title="Today’s tasks"
              note="Day blocks with done-when criteria."
              link={linkFor('do')}
              onOpen={openPath}
            />
            <StaticCard
              icon={<MapIcon size={16} strokeWidth={1.8} />}
              colour="var(--peach)"
              title="What’s next"
              note="The milestone ladder."
              target="Implementation roadmap"
              enabled={hasStem('implementation-roadmap')}
              onClick={openStem('implementation-roadmap')}
            />
          </div>
        </section>

        {/* ── the switchable half ────────────────────────────────────────── */}
        <nav className={styles.tabs} role="tablist" aria-label="Lobby view">
          {board && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'board'}
              className={tab === 'board' ? `${styles.tab} ${styles.tabOn}` : styles.tab}
              onClick={() => setTab('board')}
            >
              {board.tab}
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'map'}
            className={tab === 'map' ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            onClick={() => setTab('map')}
          >
            Where things live
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'loop'}
            className={tab === 'loop' ? `${styles.tab} ${styles.tabOn}` : styles.tab}
            onClick={() => setTab('loop')}
          >
            What a session looks like
          </button>
        </nav>

        <div className={styles.panel}>
          {tab === 'board' && board && <BoardView board={board} onOpen={openPath} />}
          {tab === 'map' && (
            <MapView
              groups={mapGroups}
              onOpen={openEntry}
              exists={exists}
              icons={iconOverrides}
            />
          )}
          {tab === 'loop' && (
            <DayLoop
              openStem={openStem}
              hasStem={hasStem}
              openPath={openPath}
              linkFor={linkFor}
            />
          )}
        </div>
      </div>

    </div>
  )
}

/** A desk card whose target comes from a contributed link. */
function DeskCard({
  icon,
  colour,
  title,
  note,
  link,
  onOpen,
}: {
  icon: React.ReactNode
  colour: string
  title: string
  note: string
  link?: { role: string; path: string; label: string; hint?: string }
  onOpen(path: string): () => void
}): React.JSX.Element {
  if (!link) {
    return (
      <div className={`${styles.deskCard} ${styles.deskCardEmpty}`}>
        <span className={styles.deskCardIcon} style={{ color: colour }}>{icon}</span>
        <span className={styles.deskCardTitle}>{title}</span>
        <span className={styles.deskCardNote}>Nothing nominated this yet.</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={styles.deskCard}
      onClick={onOpen(link.path)}
      title={link.path}
    >
      <span className={styles.deskCardIcon} style={{ color: colour }}>{icon}</span>
      <span className={styles.deskCardTitle}>{title}</span>
      <span className={styles.deskCardNote}>{note}</span>
      {/* What it will actually open, stated plainly rather than on hover. */}
      <span className={styles.deskCardTarget} style={{ color: colour }}>{link.label}</span>
    </button>
  )
}

/** A card with a fixed target — nothing contributes it, so no live link. */
function StaticCard({
  icon, colour, title, note, target, enabled, onClick,
}: {
  icon: React.ReactNode
  colour: string
  title: string
  note: string
  target: string
  enabled: boolean
  onClick(): void
}): React.JSX.Element {
  return (
    <button type="button" className={styles.deskCard} disabled={!enabled} onClick={onClick}>
      <span className={styles.deskCardIcon} style={{ color: colour }}>{icon}</span>
      <span className={styles.deskCardTitle}>{title}</span>
      <span className={styles.deskCardNote}>{enabled ? note : 'Not found'}</span>
      <span className={styles.deskCardTarget} style={{ color: colour }}>
        {enabled ? target : '—'}
      </span>
    </button>
  )
}

// ── the board ──────────────────────────────────────────────────────────────

/**
 * A contributed stretch of work, with real checkboxes.
 *
 * Three tiers, and the distinction between them is the whole design:
 *
 *  - ITEMS are chores. They tick, and they fill the bar.
 *  - GROUPS are scope — what the stretch covers. You cannot finish "dragon
 *    class hierarchy" the way you finish "create README", so they are shown
 *    and never counted.
 *  - the GATE is the one box that says it is actually done, and the only one
 *    that moves the board on.
 *
 * Core attaches no meaning to any of it. It was handed a title, some lines and
 * a file to write them back to.
 */
function BoardView({
  board,
  onOpen,
}: {
  board: LobbyBoard
  onOpen(path: string): () => void
}): React.JSX.Element {
  const done = board.items.filter((i) => i.done).length
  const total = board.items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className={styles.board}>
      <p className={styles.panelHint}>
        <CornerDownRight size={12} strokeWidth={2} />
        Ticking a box here writes it straight into the document.
      </p>

      <header className={styles.boardHead}>
        {board.eyebrow && <p className={styles.boardEyebrow}>{board.eyebrow}</p>}
        <h2 className={styles.boardTitle}>{board.title}</h2>
        {board.note && <p className={styles.boardNote}>{board.note}</p>}
        <button type="button" className={styles.boardSource} onClick={onOpen(board.path)}>
          <FileText size={12} strokeWidth={1.9} />
          {board.meta ? `${board.meta} · read the source` : 'Read the source'}
        </button>
      </header>

      {total > 0 && (
        <section className={styles.boardWork}>
          <div className={styles.boardBarRow}>
            <span className={styles.boardCount}>
              {done} of {total} done
            </span>
            <span className={styles.boardBar}>
              <span className={styles.boardBarFill} style={{ width: `${pct}%` }} />
            </span>
          </div>
          <ul className={styles.boardItems}>
            {board.items.map((item) => (
              <li key={item.index}>
                <BoardCheck item={item} path={board.path} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {board.groups.length > 0 && (
        <section className={styles.boardScope}>
          {board.groups.map((group) => (
            <div key={group.label} className={styles.boardGroup}>
              <p className={styles.boardGroupLabel}>{group.label}</p>
              <ul className={styles.boardChips}>
                {group.items.map((it) => (
                  <li key={it} className={styles.boardChip}>
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className={styles.boardScopeNote}>
            What this covers — not a checklist. These are finished by building them,
            not by ticking them.
          </p>
        </section>
      )}

      {board.gate && (
        <section className={styles.boardGate}>
          <BoardCheck item={board.gate} path={board.path} prefix="Done when" />
        </section>
      )}
    </div>
  )
}

/**
 * One tickable line, written back to a document that is not open.
 *
 * Same two rules as the reader's own checkbox: flip optimistically, because a
 * round trip still reads as lag, and mark the write as ours so the watcher does
 * not treat it as an external edit. `index` counts task items in document
 * order, which is exactly what `toggleTaskAt` expects.
 */
function BoardCheck({
  item,
  path,
  prefix,
}: {
  item: BoardItem
  path: RelPath
  prefix?: string
}): React.JSX.Element {
  const [checked, setChecked] = useState(item.done)
  const [busy, setBusy] = useState(false)
  const workspaceId = useStore((s) => s.workspace?.id ?? null)
  const pushNotice = useStore((s) => s.pushNotice)

  // The file is the truth. If it changes underneath us — an edit in the
  // reader, an external editor, a git checkout — the board follows it.
  useEffect(() => setChecked(item.done), [item.done])

  const toggle = useCallback(async () => {
    if (busy || !workspaceId) return
    const next = !checked
    setChecked(next)
    setBusy(true)
    try {
      const file = await platform.readTextFile(workspaceId, path)
      const updated = toggleTaskAt(file.content, item.index, next)
      if (updated === null) {
        setChecked(!next)
        pushNotice({ level: 'warn', message: 'Could not find that task in the file' })
        return
      }
      markSelfWrite(path)
      await platform.writeTextFile(workspaceId, path, updated)
    } catch (err) {
      setChecked(!next)
      pushNotice({ level: 'error', message: 'Could not update the task', detail: String(err) })
    } finally {
      setBusy(false)
    }
  }, [busy, checked, item.index, path, pushNotice, workspaceId])

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={checked ? `${styles.boardLine} ${styles.boardLineDone}` : styles.boardLine}
      onClick={() => void toggle()}
    >
      <span className={styles.boardBox}>{checked && <Check size={11} strokeWidth={3} />}</span>
      <span className={styles.boardText}>
        {prefix && <b className={styles.boardPrefix}>{prefix}</b>}
        {item.text}
      </span>
    </button>
  )
}

// ── where things live ──────────────────────────────────────────────────────

/**
 * The map, rendered from `settings.lobby.map`.
 *
 * Nothing here is hardcoded: core does not know that this workspace has a
 * `chapters/` folder, only that config nominated some paths and said a sentence
 * about each. Icons come from `resolveIcon`, so a tile matches its tree row —
 * including any `files.icons` override.
 */
function MapView({
  groups,
  onOpen,
  exists,
  icons,
}: {
  groups: Array<{ group: string; entries: Array<{ path: string; label?: string; note?: string; emphasis: boolean }> }>
  onOpen: (path: string, isDir: boolean) => () => void
  exists: (path: string) => 'dir' | 'file' | null
  icons: IconOverrides
}): React.JSX.Element {
  if (groups.length === 0) {
    return (
      <div className={styles.map}>
        <p className={styles.empty}>
          Nothing configured, and no top-level folders to fall back on.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.map}>
      <p className={styles.panelHint}>
        <CornerDownRight size={12} strokeWidth={2} />
        Folders open in the explorer; documents open here.
      </p>
      {groups.map((region) => (
        <section key={region.group} className={styles.region}>
          <h2 className={styles.regionTitle}>{region.group}</h2>
          <div className={styles.regionGrid}>
            {region.entries.map((it) => {
              const kind = exists(it.path)
              const name = it.path.split('/').pop() ?? it.path
              const { icon: Glyph, colour } = resolveIcon(
                it.path,
                name,
                kind ?? 'dir',
                false,
                icons,
              )
              const label = it.label ?? (kind === 'dir' ? `${name}/` : name)
              return (
                <button
                  key={it.path}
                  type="button"
                  disabled={!kind}
                  className={it.emphasis ? `${styles.tile} ${styles.tileBig}` : styles.tile}
                  onClick={onOpen(it.path, kind === 'dir')}
                  title={it.path}
                >
                  <Glyph size={15} strokeWidth={1.8} style={{ color: colour }} />
                  <span className={styles.tileName}>{label}</span>
                  <span className={styles.tileNote}>
                    {kind ? (it.note ?? it.path) : 'Not found'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── what a session looks like ──────────────────────────────────────────────

/**
 * The loop, with the documents each step actually uses.
 *
 * `role` entries resolve to whatever a contributor nominated (today's chapter,
 * today's plan); plain stems are fixed documents. Listing them is the point —
 * the step tells you WHERE the work happens, not just that it happens.
 */
/**
 * The loop is a SHAPE, not a position.
 *
 * An earlier version marked step one done and step two current. It was invented
 * — nothing here knows which step you are on, and working it out would mean
 * tracking which documents you opened this session against the day block's
 * tasks. A confident wrong answer is worse than none, so the steps are simply
 * numbered and you pick the one you want.
 */
const STEPS: Array<{
  n: number
  title: string
  note: string
  uses: Array<{ role?: string; stem?: string; why: string }>
}> = [
  {
    n: 1, title: 'Check the pointer',
    note: 'What today is, and what gates it.',
    uses: [
      { stem: 'PROGRESS', why: 'The honest state, as you last left it' },
      { stem: 'daily-protocol', why: 'How to open a session' },
    ],
  },
  {
    n: 2, title: 'Read the topic',
    note: '20 minutes, no more. Then close it.',
    uses: [
      { role: 'read', why: 'Today’s chapter — the teaching material' },
      { stem: 'curriculum-outline', why: 'Where this topic sits in the map' },
    ],
  },
  {
    n: 3, title: 'Build the thing',
    note: 'The day block’s build task, and its done-when.',
    uses: [
      { role: 'do', why: 'The day block and its done-when criteria' },
      { stem: 'stuck-protocol', why: 'If you are stuck more than 20 minutes' },
    ],
  },
  {
    n: 4, title: 'Tick it off',
    note: 'Ticking the last box of a day advances the day.',
    uses: [
      { role: 'do', why: 'The checkboxes that move the day along' },
      { stem: 'checkpoint-protocol', why: 'When a gate is next' },
    ],
  },
  {
    n: 5, title: 'Write the log',
    note: 'The close-out gate will ask. Two lines is enough.',
    uses: [
      { stem: 'PROGRESS', why: 'Update "Where things actually stand"' },
      { stem: 'project-journal', why: 'The running development log' },
      { stem: 'weekly-protocol', why: 'On the last day of a week' },
    ],
  },
]

/**
 * The loop as two columns: the steps on the left, the selected step's documents
 * in a panel on the right.
 *
 * An accordion pushed everything below it down each time you opened one, so the
 * list never sat still. Splitting it means the left column is stable and only
 * the right side changes, which is also what makes a plain cross-fade legible.
 */
function DayLoop({
  openStem,
  hasStem,
  openPath,
  linkFor,
}: {
  openStem: (s: string) => () => void
  hasStem: (s: string) => boolean
  openPath: (p: string) => () => void
  linkFor: (role: string) => { path: string; label: string } | undefined
}): React.JSX.Element {
  const [selected, setSelected] = useState(2)
  const step = STEPS.find((s) => s.n === selected) ?? STEPS[0]!

  return (
    <div className={styles.loop}>
      <p className={styles.panelHint}>
        <CornerDownRight size={12} strokeWidth={2} />
        The shape of a session. Pick a step to see the documents it uses.
      </p>

      <div className={styles.loopCols}>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li
              key={s.n}
              className={styles.step}
            >
              <span className={styles.stepN}>{s.n}</span>
              <button
                type="button"
                aria-pressed={selected === s.n}
                className={
                  selected === s.n ? `${styles.stepBody} ${styles.stepPicked}` : styles.stepBody
                }
                onClick={() => setSelected(s.n)}
              >
                <span className={styles.stepTitle}>{s.title}</span>
                <span className={styles.stepNote}>{s.note}</span>
              </button>
            </li>
          ))}
        </ol>

        <aside className={styles.detail}>
          {/* Keyed on the step so React remounts it and the fade replays. */}
          <div key={step.n} className={styles.detailInner}>
            <p className={styles.detailTitle}>{step.title}</p>
            <p className={styles.detailNote}>{step.note}</p>
            <ul className={styles.uses}>
              {step.uses.map((u, i) => {
                const link = u.role ? linkFor(u.role) : undefined
                const path = link?.path ?? (u.stem && hasStem(u.stem) ? u.stem : null)
                const label = link?.label ?? u.stem ?? ''
                return (
                  <li key={i}>
                    <button
                      type="button"
                      className={styles.use}
                      disabled={!path}
                      onClick={
                        link ? openPath(link.path) : u.stem ? openStem(u.stem) : undefined
                      }
                    >
                      <FileText size={12} strokeWidth={1.9} className={styles.useIcon} />
                      <span className={styles.useLabel}>
                        {path ? label : `${label} (not found)`}
                      </span>
                      <span className={styles.useWhy}>{u.why}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
