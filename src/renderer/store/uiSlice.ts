/**
 * Panel visibility, theme, overlays and focus.
 *
 * `focusZone` is what the `when` clauses in the keymap evaluate against, so it
 * has to be a deliberate piece of state rather than something derived from
 * document.activeElement at keypress time.
 */
import type { RelPath } from '@shared/types'
import { platform } from '../platform'
import type { SliceCreator } from './types'

export type ThemeSetting = 'dark' | 'light' | 'system'
export type OverlayKind = 'quickOpen' | 'commands' | 'search' | 'ask' | null
/** App-level chrome, distinct from the fuzzy overlays above. */
export type ModalKind =
  | 'workflow'
  | 'shortcuts'
  | 'settings'
  | 'closeOut'
  | 'newNote'
  | 'confirmTabClose'
  | 'roughEdge'
  | null
export type FocusZone = 'document' | 'explorer' | 'context' | 'overlay'
/**
 * `sandbox` is the workspace editor — a mode you enter deliberately, and the
 * only one allowed to create folders and write configuration.
 */
export type Screen = 'home' | 'workspace' | 'sandbox'

export interface UiSlice {
  screen: Screen
  theme: ThemeSetting
  zoom: number

  explorerVisible: boolean
  explorerWidth: number
  explorerSection: string
  contextVisible: boolean
  contextWidth: number
  outlineVisible: boolean

  overlay: OverlayKind
  modal: ModalKind
  /** Which tab a `confirmTabClose` modal is about. */
  pendingTabClose: { paneId: string; tabId: string } | null
  /** Which unfinished feature a `roughEdge` warning is about. */
  pendingRoughEdge: string | null
  focusZone: FocusZone
  expandedDirs: Set<RelPath>
  explorerScrollTop: number
  selectedPath: RelPath | null

  /**
   * Which face the Sandbox shows when entered. 'create' is a one-shot: the
   * Sandbox consumes it on mount so leaving and returning lands on the editor
   * rather than the create form again.
   */
  sandboxIntent: 'edit' | 'create'
  /**
   * Where the Sandbox's back button goes.
   *
   * It is not always the reading shell: entering from the Dashboard opens the
   * workspace without restoring its session, so dropping into the shell from
   * there would show tabs and scroll positions that were never loaded.
   */
  sandboxReturnTo: Screen
  setPendingTabClose(target: { paneId: string; tabId: string } | null): void
  setPendingRoughEdge(id: string | null): void
  setScreen(screen: Screen, intent?: 'edit' | 'create', returnTo?: Screen): void
  setTheme(theme: ThemeSetting): void
  toggleTheme(): void
  setZoom(zoom: number): void

  toggleExplorer(): void
  toggleContextPanel(): void
  toggleOutline(): void
  setExplorerWidth(width: number): void
  setContextWidth(width: number): void
  setExplorerSection(section: string): void

  openOverlay(kind: Exclude<OverlayKind, null>): void
  openModal(kind: Exclude<ModalKind, null>): void
  closeModal(): void
  closeOverlay(): void
  setFocusZone(zone: FocusZone): void

  toggleDir(path: RelPath): void
  expandDirs(paths: RelPath[]): void
  setExpandedDirs(paths: RelPath[]): void
  setExplorerScrollTop(top: number): void
  setSelectedPath(path: RelPath | null): void
}

function resolveTheme(theme: ThemeSetting): 'dark' | 'light' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Theme switching is a CSS-variable swap on <html>. Zero React re-render. */
export function applyThemeToDocument(theme: ThemeSetting): void {
  document.documentElement.dataset['theme'] = resolveTheme(theme)
}

export const createUiSlice: SliceCreator<UiSlice> = (set, get) => ({
  screen: 'home',
  theme: 'dark',
  zoom: 1,

  explorerVisible: true,
  explorerWidth: 280,
  explorerSection: 'tree',
  contextVisible: true,
  contextWidth: 320,
  outlineVisible: true,

  overlay: null,
  modal: null,
  pendingTabClose: null,
  pendingRoughEdge: null,
  focusZone: 'document',
  expandedDirs: new Set<RelPath>(),
  explorerScrollTop: 0,
  selectedPath: null,

  setPendingTabClose: (target) => set({ pendingTabClose: target }),
  setPendingRoughEdge: (id) => set({ pendingRoughEdge: id }),
  sandboxIntent: 'edit',
  sandboxReturnTo: 'workspace',
  setScreen: (screen, intent, returnTo) =>
    set({ screen, sandboxIntent: intent ?? 'edit', sandboxReturnTo: returnTo ?? 'workspace' }),

  setTheme(theme) {
    set({ theme })
    applyThemeToDocument(theme)
    platform.setNativeTheme(theme)
  },

  toggleTheme() {
    const current = get().theme
    const next: ThemeSetting = resolveTheme(current) === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },

  setZoom(zoom) {
    const clamped = Math.min(2.5, Math.max(0.5, Number(zoom.toFixed(2))))
    set({ zoom: clamped })
    platform.setZoom(clamped)
  },

  toggleExplorer: () => set((s) => ({ explorerVisible: !s.explorerVisible })),
  toggleContextPanel: () => set((s) => ({ contextVisible: !s.contextVisible })),
  toggleOutline: () => set((s) => ({ outlineVisible: !s.outlineVisible })),
  setExplorerWidth: (width) => set({ explorerWidth: Math.min(720, Math.max(180, width)) }),
  setContextWidth: (width) => set({ contextWidth: Math.min(720, Math.max(180, width)) }),
  setExplorerSection: (section) => set({ explorerSection: section, explorerVisible: true }),

  openOverlay: (kind) => set({ overlay: kind, focusZone: 'overlay' }),
  openModal: (kind) => set({ modal: kind }),
  closeModal: () => set({ modal: null }),
  closeOverlay: () => set({ overlay: null, focusZone: 'document' }),
  setFocusZone: (zone) => set({ focusZone: zone }),

  toggleDir(path) {
    set((s) => {
      const next = new Set(s.expandedDirs)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return { expandedDirs: next }
    })
  },

  expandDirs(paths) {
    if (paths.length === 0) return
    set((s) => {
      const next = new Set(s.expandedDirs)
      for (const p of paths) next.add(p)
      return { expandedDirs: next }
    })
  },

  setExpandedDirs: (paths) => set({ expandedDirs: new Set(paths) }),
  setExplorerScrollTop: (top) => set({ explorerScrollTop: top }),
  setSelectedPath: (path) => set({ selectedPath: path }),
})
