/**
 * Panes, tabs, pinning and per-pane navigation history.
 *
 * There are at most two panes (the spec asks for split view, not a tiling
 * window manager). Keeping that cap explicit avoids a recursive layout tree
 * whose only user would be the layout code itself.
 */
import { stem } from '@shared/paths'
import type { Bookmark, PaneState, TabState } from '@shared/session-schema'
import type { RelPath } from '@shared/types'
import { dropAnchor } from './scrollRegistry'
import type { SliceCreator } from './types'

export interface TabsSlice {
  panes: PaneState[]
  activePaneId: string
  /** Fractions of the editor area, one per pane. */
  paneSizes: number[]
  recents: Array<{ path: RelPath; title: string; openedAt: number }>
  /** Saved positions within documents. Session state, not workspace config —
   *  unlike favorites, which are intentional and live in settings.json. */
  bookmarks: Bookmark[]
  /** ISO dates on which a session happened; drives the dashboard streak. */
  sessionDates: string[]

  addBookmark(bookmark: Omit<Bookmark, 'id' | 'createdAt'>): void
  removeBookmark(id: string): void
  hydrateBookmarks(bookmarks: Bookmark[]): void
  setSessionDates(dates: string[]): void
  hydrateRecents(recents: Array<{ path: RelPath; title: string; openedAt: number }>): void

  openDocument(path: RelPath, opts?: { pane?: 'active' | 'right'; focus?: boolean }): void
  closeTab(paneId: string, tabId: string): void
  /**
   * Close, unless the tab is pinned — pinning says "keep this", so closing it
   * by reflex (middle-click, Ctrl+W) should have to be meant. Unpinned tabs go
   * straight through; only the deliberate case costs a confirmation.
   */
  requestCloseTab(paneId: string, tabId: string): void
  closeOtherTabs(paneId: string, tabId: string): void
  activateTab(paneId: string, tabId: string): void
  togglePin(paneId: string, tabId: string): void
  moveTab(paneId: string, from: number, to: number): void
  cycleTab(delta: number): void

  splitRight(): void
  closeSplit(paneId?: string): void
  focusOtherPane(): void
  setActivePane(paneId: string): void
  setPaneSizes(sizes: number[]): void

  navigateBack(): void
  navigateForward(): void
  canNavigate(direction: -1 | 1): boolean

  activeTab(): TabState | null
  activePane(): PaneState | null
  hydratePanes(panes: PaneState[], activePaneId: string | null, sizes: number[]): void
}

let seq = 0
const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${++seq}`

function emptyPane(): PaneState {
  return { id: nextId('pane'), activeTabId: null, tabs: [], history: { entries: [], index: -1 } }
}

/** Pinned tabs sort ahead of unpinned ones, preserving order within each group. */
function orderTabs(tabs: TabState[]): TabState[] {
  return [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)]
}

function pushHistory(pane: PaneState, path: RelPath): PaneState['history'] {
  const { entries, index } = pane.history
  if (entries[index] === path) return pane.history
  // Navigating after going back truncates the forward stack, like a browser.
  const kept = entries.slice(0, index + 1)
  kept.push(path)
  return { entries: kept.slice(-100), index: Math.min(kept.length, 100) - 1 }
}

export const createTabsSlice: SliceCreator<TabsSlice> = (set, get) => {
  const initial = emptyPane()

  return {
    panes: [initial],
    activePaneId: initial.id,
    paneSizes: [1],
    recents: [],
    bookmarks: [],
    sessionDates: [],

    addBookmark(bookmark) {
      set((s) => ({
        bookmarks: [
          ...s.bookmarks,
          { ...bookmark, id: nextId('bm'), createdAt: Date.now() },
        ],
      }))
    },

    removeBookmark(id) {
      set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) }))
    },

    hydrateBookmarks: (bookmarks) => set({ bookmarks }),
    setSessionDates: (dates) => set({ sessionDates: dates }),
    hydrateRecents: (recents) => set({ recents }),

    activePane() {
      return get().panes.find((p) => p.id === get().activePaneId) ?? get().panes[0] ?? null
    },

    activeTab() {
      const pane = get().activePane()
      if (!pane) return null
      return pane.tabs.find((t) => t.id === pane.activeTabId) ?? null
    },

    openDocument(path, opts = {}) {
      const state = get()
      const wantsRight = opts.pane === 'right'

      let targetId = state.activePaneId
      if (wantsRight) {
        if (state.panes.length < 2) get().splitRight()
        const panes = get().panes
        targetId = panes[1]?.id ?? targetId
      }

      set((s) => ({
        panes: s.panes.map((pane) => {
          if (pane.id !== targetId) return pane
          const existing = pane.tabs.find((t) => t.path === path)
          if (existing) {
            return { ...pane, activeTabId: existing.id, history: pushHistory(pane, path) }
          }
          const tab: TabState = {
            id: nextId('tab'),
            path,
            pinned: false,
            // The anchor is looked up from the scroll registry at mount, not
            // stored here — see scrollRegistry.ts for why.
            scroll: { top: 0, ratio: 0, blockId: null, blockOffset: 0, headingSlug: null, contentHash: null, lastHeight: 0 },
          }
          return {
            ...pane,
            tabs: orderTabs([...pane.tabs, tab]),
            activeTabId: tab.id,
            history: pushHistory(pane, path),
          }
        }),
        activePaneId: targetId,
        selectedPath: path,
        // The Lobby is a surface, not a document — it does not belong in the
        // recents list, which is meant to answer "what was I reading".
        recents: path.startsWith('kt://') ? s.recents : [
          { path, title: stem(path), openedAt: Date.now() },
          ...s.recents.filter((r) => r.path !== path),
        ].slice(0, 25),
      }))

      if (opts.focus !== false) set({ focusZone: 'document' })
    },

    requestCloseTab(paneId, tabId) {
      const pane = get().panes.find((p) => p.id === paneId)
      const tab = pane?.tabs.find((t) => t.id === tabId)
      if (!tab) return
      if (!tab.pinned) {
        get().closeTab(paneId, tabId)
        return
      }
      get().setPendingTabClose({ paneId, tabId })
      get().openModal('confirmTabClose')
    },

    closeTab(paneId, tabId) {
      dropAnchor(tabId)
      set((s) => {
        const panes = s.panes.map((pane) => {
          if (pane.id !== paneId) return pane
          const index = pane.tabs.findIndex((t) => t.id === tabId)
          const tabs = pane.tabs.filter((t) => t.id !== tabId)
          let activeTabId = pane.activeTabId
          if (pane.activeTabId === tabId) {
            // Land on the neighbour to the left, which is where the eye already is.
            activeTabId = tabs[Math.max(0, index - 1)]?.id ?? null
          }
          return { ...pane, tabs, activeTabId }
        })
        // An empty second pane collapses; the first pane always survives.
        const kept = panes.filter((p, i) => i === 0 || p.tabs.length > 0)
        return {
          panes: kept,
          activePaneId: kept.some((p) => p.id === s.activePaneId)
            ? s.activePaneId
            : (kept[0]?.id ?? s.activePaneId),
          paneSizes: kept.length === 1 ? [1] : s.paneSizes,
        }
      })
    },

    closeOtherTabs(paneId, tabId) {
      set((s) => ({
        panes: s.panes.map((pane) => {
          if (pane.id !== paneId) return pane
          const kept = pane.tabs.filter((t) => t.id === tabId || t.pinned)
          for (const t of pane.tabs) if (!kept.includes(t)) dropAnchor(t.id)
          return { ...pane, tabs: kept, activeTabId: tabId }
        }),
      }))
    },

    activateTab(paneId, tabId) {
      set((s) => ({
        panes: s.panes.map((pane) => {
          if (pane.id !== paneId) return pane
          const tab = pane.tabs.find((t) => t.id === tabId)
          return tab
            ? { ...pane, activeTabId: tabId, history: pushHistory(pane, tab.path) }
            : pane
        }),
        activePaneId: paneId,
        selectedPath: s.panes.find((p) => p.id === paneId)?.tabs.find((t) => t.id === tabId)?.path ?? s.selectedPath,
      }))
    },

    togglePin(paneId, tabId) {
      set((s) => ({
        panes: s.panes.map((pane) =>
          pane.id === paneId
            ? {
                ...pane,
                tabs: orderTabs(
                  pane.tabs.map((t) => (t.id === tabId ? { ...t, pinned: !t.pinned } : t)),
                ),
              }
            : pane,
        ),
      }))
    },

    moveTab(paneId, from, to) {
      set((s) => ({
        panes: s.panes.map((pane) => {
          if (pane.id !== paneId) return pane
          const tabs = [...pane.tabs]
          const [moved] = tabs.splice(from, 1)
          if (!moved) return pane
          tabs.splice(to, 0, moved)
          return { ...pane, tabs: orderTabs(tabs) }
        }),
      }))
    },

    cycleTab(delta) {
      const pane = get().activePane()
      if (!pane || pane.tabs.length === 0) return
      const index = pane.tabs.findIndex((t) => t.id === pane.activeTabId)
      const next = (index + delta + pane.tabs.length) % pane.tabs.length
      const tab = pane.tabs[next]
      if (tab) get().activateTab(pane.id, tab.id)
    },

    splitRight() {
      if (get().panes.length >= 2) return
      const source = get().activePane()
      const pane = emptyPane()
      // Carry the current document across, so a split shows something at once.
      const current = source?.tabs.find((t) => t.id === source.activeTabId)
      if (current) {
        const tab: TabState = { ...current, id: nextId('tab'), pinned: false }
        pane.tabs = [tab]
        pane.activeTabId = tab.id
        pane.history = { entries: [current.path], index: 0 }
      }
      set((s) => ({ panes: [...s.panes, pane], activePaneId: pane.id, paneSizes: [0.5, 0.5] }))
    },

    closeSplit(paneId) {
      set((s) => {
        if (s.panes.length < 2) return s
        const target = paneId ?? s.activePaneId
        const kept = s.panes.filter((p) => p.id !== target)
        if (kept.length === 0) return s
        for (const pane of s.panes) {
          if (pane.id === target) for (const t of pane.tabs) dropAnchor(t.id)
        }
        return { panes: kept, activePaneId: kept[0]!.id, paneSizes: [1] }
      })
    },

    focusOtherPane() {
      const { panes, activePaneId } = get()
      if (panes.length < 2) return
      const other = panes.find((p) => p.id !== activePaneId)
      if (other) set({ activePaneId: other.id, focusZone: 'document' })
    },

    setActivePane: (paneId) => set({ activePaneId: paneId }),
    setPaneSizes: (sizes) => set({ paneSizes: sizes }),

    canNavigate(direction) {
      const pane = get().activePane()
      if (!pane) return false
      const next = pane.history.index + direction
      return next >= 0 && next < pane.history.entries.length
    },

    navigateBack() {
      navigate(get, set, -1)
    },

    navigateForward() {
      navigate(get, set, 1)
    },

    hydratePanes(panes, activePaneId, sizes) {
      if (panes.length === 0) return
      set({
        panes,
        activePaneId: activePaneId ?? panes[0]!.id,
        paneSizes: sizes.length === panes.length ? sizes : panes.map(() => 1 / panes.length),
      })
    },
  }
}

/**
 * History navigation opens the target in the SAME tab rather than creating one.
 * Back/forward that spawned tabs would turn a quick lookup into tab sprawl.
 */
function navigate(
  get: () => TabsSlice & { activePaneId: string },
  set: (fn: (s: TabsSlice) => Partial<TabsSlice>) => void,
  direction: -1 | 1,
): void {
  const pane = get().activePane()
  if (!pane) return
  const index = pane.history.index + direction
  const path = pane.history.entries[index]
  if (path === undefined) return

  set((s) => ({
    panes: s.panes.map((p) => {
      if (p.id !== pane.id) return p
      const existing = p.tabs.find((t) => t.path === path)
      if (existing) {
        return { ...p, activeTabId: existing.id, history: { ...p.history, index } }
      }
      const tab: TabState = {
        id: nextId('tab'),
        path,
        pinned: false,
        scroll: { top: 0, ratio: 0, blockId: null, blockOffset: 0, headingSlug: null, contentHash: null, lastHeight: 0 },
      }
      return {
        ...p,
        tabs: orderTabs([...p.tabs, tab]),
        activeTabId: tab.id,
        history: { ...p.history, index },
      }
    }),
  }))
}
