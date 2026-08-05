/**
 * State → disk, and disk → state.
 *
 * ONE explicit, greppable path in each direction. zustand's `persist`
 * middleware is deliberately not used: it is localStorage-shaped, and it cannot
 * reach the scroll registry, which lives outside React on purpose.
 */
import type { SessionState } from '@shared/session-schema'
import { emptySession } from '@shared/session-schema'
import type { WorkspaceInfo } from '@shared/platform'
import type { HomeSnapshot } from '@shared/types'
import { platform } from '../platform'
import { store, useStore } from './index'
import { allAnchors, getAnchor, hydrateAnchors } from './scrollRegistry'

const WRITE_DEBOUNCE_MS = 700

let timer: number | null = null
let unsubscribe: (() => void) | null = null
let activeWorkspaceId: string | null = null

/** Assemble the current session from the store plus the scroll registry. */
export function snapshotSession(): SessionState | null {
  const state = store.get()
  const workspace = state.workspace
  if (!workspace) return null

  const previous = emptySession(workspace.id, workspace.root)

  return {
    ...previous,
    savedAt: Date.now(),
    lastSessionAt: previous.lastSessionAt,
    window: previous.window,
    ui: {
      theme: state.theme,
      explorer: {
        visible: state.explorerVisible,
        width: state.explorerWidth,
        activeSection: state.explorerSection,
      },
      contextPanel: { visible: state.contextVisible, width: state.contextWidth },
      outlineVisible: state.outlineVisible,
      zoom: state.zoom,
    },
    explorerState: {
      expandedDirs: [...state.expandedDirs],
      scrollTop: state.explorerScrollTop,
      selected: state.selectedPath,
    },
    layout: {
      orientation: 'vertical',
      sizes: state.paneSizes,
      activePaneId: state.activePaneId,
      // Merge the live scroll anchors in as the panes are serialised. This is
      // the only place the non-reactive registry meets persisted state.
      panes: state.panes.map((pane) => ({
        ...pane,
        tabs: pane.tabs.map((tab) => ({ ...tab, scroll: getAnchor(tab.id) })),
      })),
    },
    sessionDates: state.sessionDates,
    recents: state.recents,
    bookmarks: state.bookmarks,
    plugins: {},
  }
}

/**
 * Schedule a debounced write.
 *
 * Exported because the scroll recorder calls it directly: scroll positions live
 * outside the store by design, so nothing in the store subscription below ever
 * fires for them. Without this, a position would only reach disk when something
 * ELSE changed — and a crash mid-read would lose it entirely.
 */
export function scheduleSessionWrite(): void {
  scheduleWrite()
}

function scheduleWrite(): void {
  if (!activeWorkspaceId) return
  if (timer !== null) window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    timer = null
    const session = snapshotSession()
    if (session) void platform.writeSession(session.workspaceId, session)
  }, WRITE_DEBOUNCE_MS)
}

/** Write immediately. Called on tab switch, window blur, and quit. */
export async function flushSession(): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
  const session = snapshotSession()
  if (!session) return
  await platform.writeSession(session.workspaceId, session)
  await platform.flushSession()
}

/**
 * Restore a saved session into the store. Called once per workspace open,
 * BEFORE any document mounts, so the scroll registry is already populated when
 * the first DocumentView asks for its anchor.
 */
export async function restoreSession(workspace: WorkspaceInfo): Promise<boolean> {
  const session = await platform.readSession(workspace.id)
  if (!session) return false

  // Anchors first: a DocumentView mounting later reads them synchronously.
  hydrateAnchors(
    session.layout.panes.flatMap((pane) => pane.tabs.map((tab) => [tab.id, tab.scroll] as const)),
  )

  const state = store.get()
  state.setExpandedDirs(session.explorerState.expandedDirs)
  state.setExplorerScrollTop(session.explorerState.scrollTop)
  state.setSelectedPath(session.explorerState.selected)
  state.setExplorerSection(session.ui.explorer.activeSection)
  state.setExplorerWidth(session.ui.explorer.width)
  state.setContextWidth(session.ui.contextPanel.width)
  state.hydrateRecents(session.recents)
  state.setSessionDates(session.sessionDates)
  state.hydrateBookmarks(session.bookmarks)

  useStore.setState({
    explorerVisible: session.ui.explorer.visible,
    contextVisible: session.ui.contextPanel.visible,
    outlineVisible: session.ui.outlineVisible,
  })

  if (session.layout.panes.length > 0) {
    state.hydratePanes(session.layout.panes, session.layout.activePaneId, session.layout.sizes)
  }

  return session.layout.panes.some((p) => p.tabs.length > 0)
}

/**
 * Subscribe to everything worth persisting.
 *
 * Scroll positions are NOT in this selector — they change on every frame of
 * every scroll and live in the registry precisely so they never trigger a React
 * update. They ride along whenever something else schedules a write, and are
 * force-flushed on tab switch and quit.
 */
export function startSessionSync(workspaceId: string): void {
  stopSessionSync()
  activeWorkspaceId = workspaceId

  unsubscribe = store.subscribe(
    (s) => ({
      panes: s.panes,
      activePaneId: s.activePaneId,
      paneSizes: s.paneSizes,
      recents: s.recents,
      bookmarks: s.bookmarks,
      sessionDates: s.sessionDates,
      expandedDirs: s.expandedDirs,
      selectedPath: s.selectedPath,
      explorerVisible: s.explorerVisible,
      explorerWidth: s.explorerWidth,
      explorerSection: s.explorerSection,
      contextVisible: s.contextVisible,
      contextWidth: s.contextWidth,
      outlineVisible: s.outlineVisible,
      theme: s.theme,
      zoom: s.zoom,
    }),
    scheduleWrite,
    {
      equalityFn: (a, b) =>
        a.panes === b.panes &&
        a.activePaneId === b.activePaneId &&
        a.paneSizes === b.paneSizes &&
        a.recents === b.recents &&
        a.bookmarks === b.bookmarks &&
        a.sessionDates === b.sessionDates &&
        a.expandedDirs === b.expandedDirs &&
        a.selectedPath === b.selectedPath &&
        a.explorerVisible === b.explorerVisible &&
        a.explorerWidth === b.explorerWidth &&
        a.explorerSection === b.explorerSection &&
        a.contextVisible === b.contextVisible &&
        a.contextWidth === b.contextWidth &&
        a.outlineVisible === b.outlineVisible &&
        a.theme === b.theme &&
        a.zoom === b.zoom,
    },
  )
}

let unsubscribeActive: (() => void) | null = null

/**
 * Switching tabs force-flushes rather than waiting out the debounce.
 *
 * The outgoing DocumentView records its final anchor as it unmounts; writing it
 * straight away means a crash or a kill between here and the next debounce
 * cannot lose the position the reader just left.
 *
 * Subscribed here rather than called from `tabsSlice` on purpose: the slice
 * importing this module would close an import cycle through the store.
 */
export function watchActiveDocument(): void {
  unsubscribeActive?.()
  unsubscribeActive = store.subscribe(
    (s) => `${s.activePaneId}:${s.activePane()?.activeTabId ?? ''}`,
    () => {
      void flushSession()
    },
  )
}

export function stopSessionSync(): void {
  unsubscribe?.()
  unsubscribe = null
  unsubscribeActive?.()
  unsubscribeActive = null
  activeWorkspaceId = null
  if (timer !== null) {
    window.clearTimeout(timer)
    timer = null
  }
}

/**
 * Count consecutive days ending today (or yesterday), from the recorded dates.
 *
 * Yesterday still counts so the streak does not appear broken first thing in
 * the morning before you have started — it breaks only once a full day is
 * genuinely missed.
 */
export function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const set = new Set(dates)
  const day = 86_400_000
  const iso = (t: number): string => new Date(t).toISOString().slice(0, 10)

  const now = Date.now()
  let cursor = set.has(iso(now)) ? now : now - day
  if (!set.has(iso(cursor))) return 0

  let streak = 0
  while (set.has(iso(cursor))) {
    streak++
    cursor -= day
  }
  return streak
}

/** Today, as the app records it. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Record that a session happened today. Idempotent, and trimmed so the list
 * cannot grow without bound.
 */
export async function markSessionToday(): Promise<void> {
  const state = store.get()
  if (!state.workspace) return
  const stamp = today()
  if (state.sessionDates.includes(stamp)) return
  state.setSessionDates([...state.sessionDates, stamp].slice(-400))
  await flushSession()
}

/**
 * Write the dashboard's first-frame data.
 *
 * The core supplies only what it can know from config and session state. The
 * headline, streak counter, gate name and today's tasks come from plugins via
 * `dashboardSources` — which is what keeps this file free of any notion of
 * modules, days or curricula.
 */
export async function writeHomeSnapshot(): Promise<void> {
  const state = store.get()
  const workspace = state.workspace
  const settings = state.settings
  if (!workspace || !settings) return

  const contributed = state.dashboardSources.reduce<Partial<HomeSnapshot>>((acc, source) => {
    try {
      return { ...acc, ...source.get() }
    } catch {
      // A misbehaving plugin costs its own section of the dashboard, nothing more.
      return acc
    }
  }, {})

  const snapshot: HomeSnapshot = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    root: workspace.root,
    eyebrow: null,
    headline: settings.workspace.mission ?? workspace.name,
    mission: settings.workspace.mission,
    goal: settings.workspace.goal,
    quote: settings.workspace.quote,
    lastSessionAt: Date.now(),
    streak: computeStreak(state.sessionDates),
    nextGate: null,
    progressLabel: null,
    progressValue: null,
    recents: state.recents.slice(0, 6).map((r) => ({ title: r.title, path: r.path })),
    ...contributed,
    // Contributions may omit these, and the shape must stay complete.
    board: contributed.board ?? null,
    tasks: contributed.tasks ?? [],
    tokens: contributed.tokens ?? {},
    links: contributed.links ?? [],
  }
  await platform.writeHomeSnapshot(snapshot)
}

/**
 * The merged token bag, read LIVE from the plugins rather than from the
 * snapshot on disk — the daily-note dialog needs today's day number, not the
 * one that happened to be current when the snapshot was last written.
 */
export function noteTokens(): Record<string, string> {
  const state = store.get()
  return state.dashboardSources.reduce<Record<string, string>>((acc, source) => {
    try {
      return { ...acc, ...(source.get().tokens ?? {}) }
    } catch {
      return acc
    }
  }, {})
}

/** Number of anchors currently held. Useful when debugging a restore. */
export function anchorCount(): number {
  return allAnchors().size
}
