/**
 * The core command implementations.
 *
 * Registered into the SAME registry plugins use, which is what makes every
 * command reachable from the palette, the menu and the keyboard without any of
 * those three knowing where it came from.
 */
import { CORE_COMMANDS } from '@shared/commands'
import { stem } from '@shared/paths'
import type { RelPath } from '@shared/types'
import { LOBBY_PATH } from '../components/editorArea/LobbyPrototype'
import { platform } from '../platform'
import { guarded } from '../roughEdges'
import { store } from '../store'
import { deactivatePlugins } from '../plugins/registry'
import { flushSession, stopSessionSync } from '../store/sessionSync'

type Handler = (args?: unknown[]) => void | Promise<void>

/** First argument as a string, for commands invoked from config with `args`. */
function firstString(args?: unknown[]): string | null {
  const value = args?.[0]
  return typeof value === 'string' ? value : null
}

const HANDLERS: Record<string, Handler> = {
  // ── palettes and search ────────────────────────────────────────────────
  'palette.quickOpen': () => store.get().openOverlay('quickOpen'),
  'palette.commands': () => store.get().openOverlay('commands'),
  'search.openGlobal': () => store.get().openOverlay('search'),
  'ask.open': () => store.get().openOverlay('ask'),

  /**
   * Put an assembled context block on the clipboard.
   *
   * The block is passed in as an argument rather than rebuilt here: the layer-4
   * provider already did the retrieval to decide what to show, and re-running it
   * would risk handing over something different from what was listed.
   */
  'ask.copyContext': (args) => {
    const block = firstString(args)
    const state = store.get()
    if (!block) {
      state.pushNotice({ level: 'warn', message: 'Nothing to copy — ask a question first.' })
      return
    }
    void platform.copyText(block).then(
      () =>
        state.pushNotice({
          level: 'info',
          message: 'Context copied. Paste it into your assistant.',
        }),
      () => state.pushNotice({ level: 'error', message: 'Could not write to the clipboard.' }),
    )
  },
  'overlay.dismiss': () => store.get().closeOverlay(),

  // ── view ───────────────────────────────────────────────────────────────
  'view.toggleExplorer': () => store.get().toggleExplorer(),
  'view.toggleContextPanel': () => store.get().toggleContextPanel(),
  'view.toggleOutline': () => store.get().toggleOutline(),
  'view.focusExplorer': () => {
    store.get().setFocusZone('explorer')
    document.querySelector<HTMLElement>('[role="tree"] [data-row="0"]')?.focus()
  },
  'view.focusDocument': () => {
    store.get().setFocusZone('document')
    document.querySelector<HTMLElement>('[data-kt-scroller]')?.focus()
  },
  'view.splitRight': () => store.get().splitRight(),
  'view.closeSplit': () => store.get().closeSplit(),
  'view.focusOtherPane': () => store.get().focusOtherPane(),
  'view.toggleTheme': () => store.get().toggleTheme(),
  'view.zoomIn': () => store.get().setZoom(store.get().zoom + 0.1),
  'view.zoomOut': () => store.get().setZoom(store.get().zoom - 0.1),
  'view.zoomReset': () => store.get().setZoom(1),

  // ── tabs and navigation ────────────────────────────────────────────────
  'tab.close': () => {
    const state = store.get()
    const pane = state.activePane()
    if (pane?.activeTabId) state.requestCloseTab(pane.id, pane.activeTabId)
  },
  'tab.closeOthers': () => {
    const state = store.get()
    const pane = state.activePane()
    if (pane?.activeTabId) state.closeOtherTabs(pane.id, pane.activeTabId)
  },
  'tab.togglePin': () => {
    const state = store.get()
    const pane = state.activePane()
    if (pane?.activeTabId) state.togglePin(pane.id, pane.activeTabId)
  },
  'tab.next': () => store.get().cycleTab(1),
  'tab.previous': () => store.get().cycleTab(-1),
  'nav.back': () => store.get().navigateBack(),
  'nav.forward': () => store.get().navigateForward(),

  // ── documents ──────────────────────────────────────────────────────────
  'file.open': (args) => {
    const path = firstString(args)
    if (path) store.get().openDocument(path as RelPath)
  },
  'file.toggleFavorite': (args) => {
    const state = store.get()
    const path = firstString(args) ?? state.activeTab()?.path
    if (path) void state.toggleFavorite(path)
  },
  'file.addBookmark': () => {
    const state = store.get()
    const tab = state.activeTab()
    if (!tab) return
    // Bookmark where the reader actually is, not the top of the file.
    const anchor = document
      .querySelector<HTMLElement>('.kt-prose h1[id], .kt-prose h2[id], .kt-prose h3[id]')
      ?.id
    state.addBookmark({
      path: tab.path,
      headingSlug: anchor ?? null,
      blockId: null,
      label: stem(tab.path),
      note: '',
    })
    state.pushNotice({ level: 'info', message: `Bookmarked ${stem(tab.path)}` })
  },
  'file.revealInFileManager': (args) => {
    const state = store.get()
    const path = firstString(args) ?? state.activeTab()?.path
    const id = state.workspace?.id
    if (path && id) void platform.revealInFileManager(id, path)
  },
  'file.copyPath': (args) => {
    const state = store.get()
    const path = firstString(args) ?? state.activeTab()?.path
    if (!path) return
    void platform.copyText(path)
    state.pushNotice({ level: 'info', message: 'Path copied' })
  },

  // ── notes & session ────────────────────────────────────────────────────
  /**
   * Shows what today's note should be called and what frontmatter it needs,
   * ready to paste into whichever notes app you write in.
   *
   * It does NOT create the file. The app stays read-only, and — more
   * practically — writing into a vault whose owning app is running is how
   * notes get clobbered.
   */
  'notes.openToday': () => store.get().openModal('newNote'),

  'session.closeOut': () => {
    const state = store.get()
    if (state.settings?.gate.enabled === false) {
      state.pushNotice({ level: 'info', message: 'Session closed.' })
      return
    }
    state.openModal('closeOut')
  },

  // ── workspace ──────────────────────────────────────────────────────────
  'workspace.open': async () => {
    const root = await platform.pickWorkspaceFolder()
    if (root) window.dispatchEvent(new CustomEvent('kt:open-workspace', { detail: root }))
  },
  'workspace.switch': () => {
    void (async () => {
      await flushSession()
      stopSessionSync()
      await deactivatePlugins()
      await store.get().closeWorkspace()
      store.get().setScreen('home')
    })()
  },
  'workspace.configure': () => {
    void (async () => {
      // Flush first: the Sandbox unmounts the reading shell, and an unwritten
      // scroll position would be lost with it.
      await flushSession()
      store.get().setScreen('sandbox')
    })()
  },
  'workspace.create': guarded('new-workspace', () => {
    store.get().setScreen('sandbox', 'create')
  }),
  'lobby.open': guarded('lobby', () => {
    store.get().openDocument(LOBBY_PATH)
  }),
  'workspace.goHome': () => {
    void (async () => {
      await flushSession()
      store.get().setScreen('home')
    })()
  },
  'workspace.reindex': () => {
    const id = store.get().workspace?.id
    if (id) void platform.reindex(id)
  },
  'workspace.reloadSettings': () => {
    void (async () => {
      const state = store.get()
      const id = state.workspace?.id
      if (!id) return
      const [settings, { problems }] = await Promise.all([
        platform.readWorkspaceSettings(id),
        platform.readRawWorkspaceSettings(id),
      ])
      state.applySettings(settings, problems)
      await state.refreshTree()
      state.pushNotice(
        problems.length > 0
          ? { level: 'warn', message: 'settings.json', detail: problems[0] ?? '' }
          : { level: 'info', message: 'Workspace settings reloaded' },
      )
    })()
  },
}

/** Register every core command. Idempotent — safe to call on remount. */
export function registerCoreCommands(): void {
  const { registerCommand } = store.get()
  for (const descriptor of CORE_COMMANDS) {
    const run = HANDLERS[descriptor.id]
    if (!run) {
      // A declared command with no implementation is a bug in this file, not a
      // reason to break the palette.
      console.warn(`[commands] no handler for "${descriptor.id}"`)
      continue
    }
    registerCommand({ ...descriptor, category: descriptor.category, run, owner: 'core' })
  }
}
