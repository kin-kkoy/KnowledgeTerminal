/**
 * The active workspace: its settings, file tree, favorites and index status.
 */
import type { WorkspaceSettings } from '@shared/config-schema'
import type { DeepPartial, WorkspaceInfo } from '@shared/platform'
import { basename, isMarkdown, stem } from '@shared/paths'
import type {
  DocRef,
  FileChange,
  IndexStatus,
  Notice,
  RelPath,
  TreeNode,
  WorkspaceId,
} from '@shared/types'
import { platform } from '../platform'
import type { SliceCreator } from './types'

export interface WorkspaceSlice {
  workspace: WorkspaceInfo | null
  settings: WorkspaceSettings | null
  /**
   * Zod issues from the last parse of settings.json. Non-empty means the running
   * app is on DEFAULTS and disagrees with the file — so every write is blocked
   * until it is repaired. The Sandbox turns this into its Repair view.
   */
  settingsProblems: string[]
  tree: TreeNode | null
  /** Flat path list for Quick Open and wiki-link resolution. */
  docs: DocRef[]
  indexStatus: IndexStatus | null
  notices: Notice[]
  loading: boolean

  openWorkspace(root: string): Promise<WorkspaceInfo | null>
  /**
   * Adopt a workspace main has already opened — the Sandbox's create flow,
   * where `ws:create` scaffolds and opens in one round trip.
   */
  applyWorkspaceInfo(info: WorkspaceInfo): void
  closeWorkspace(): Promise<void>
  refreshTree(): Promise<void>
  /** No-ops and warns while `settingsProblems` is non-empty. */
  patchSettings(patch: DeepPartial<WorkspaceSettings>): Promise<void>
  applySettings(settings: WorkspaceSettings, problems?: string[]): void
  toggleFavorite(path: RelPath): Promise<void>
  isFavorite(path: RelPath): boolean

  applyFileChanges(batch: FileChange[]): void
  setIndexStatus(status: IndexStatus): void
  pushNotice(notice: Omit<Notice, 'id'>): void
  dismissNotice(id: string): void

  /** Convenience: the id of the open workspace, or throw. Handlers need it. */
  requireId(): WorkspaceId
}

let noticeSeq = 0

/** One notice, not one per drag frame — see `patchSettings`. */
const SETTINGS_BLOCKED = 'Settings not saved'

/** Flatten the tree into the DocRef list Quick Open and wiki-links search. */
function collectDocs(node: TreeNode, out: DocRef[] = []): DocRef[] {
  for (const child of node.children ?? []) {
    if (child.kind === 'file') {
      out.push({
        path: child.path,
        title: isMarkdown(child.path) ? stem(child.path) : basename(child.path),
        mtimeMs: child.mtimeMs ?? 0,
      })
    } else {
      collectDocs(child, out)
    }
  }
  return out
}

export const createWorkspaceSlice: SliceCreator<WorkspaceSlice> = (set, get) => ({
  workspace: null,
  settings: null,
  settingsProblems: [],
  tree: null,
  docs: [],
  indexStatus: null,
  notices: [],
  loading: false,

  requireId() {
    const id = get().workspace?.id
    if (!id) throw new Error('No workspace is open')
    return id
  },

  async openWorkspace(root) {
    set({ loading: true })
    try {
      const info = await platform.openWorkspace(root)
      set({
        workspace: info,
        settings: info.settings,
        settingsProblems: info.problems,
        loading: false,
      })

      // Config problems are surfaced, never thrown. A malformed settings.json
      // must still leave a readable workspace.
      for (const problem of info.problems) {
        get().pushNotice({ level: 'warn', message: 'settings.json', detail: problem })
      }

      await get().refreshTree()
      return info
    } catch (err) {
      set({ loading: false })
      get().pushNotice({ level: 'error', message: `Could not open ${root}`, detail: String(err) })
      return null
    }
  },

  applyWorkspaceInfo(info) {
    set({ workspace: info, settings: info.settings, settingsProblems: info.problems })
  },

  async closeWorkspace() {
    const id = get().workspace?.id
    if (id) await platform.closeWorkspace(id)
    set({
      workspace: null,
      settings: null,
      settingsProblems: [],
      tree: null,
      docs: [],
      indexStatus: null,
    })
  },

  async refreshTree() {
    const id = get().workspace?.id
    if (!id) return
    try {
      const tree = await platform.readTree(id)
      set({ tree, docs: collectDocs(tree) })
    } catch (err) {
      get().pushNotice({ level: 'error', message: 'Could not read workspace', detail: String(err) })
    }
  },

  async patchSettings(patch) {
    const id = get().workspace?.id
    if (!id) return

    // The file failed to parse, so what is in memory is DEFAULTS, not what the
    // user wrote. Writing now would encode our misreading of their file. Refuse
    // — once, not once per drag frame.
    if (get().settingsProblems.length > 0) {
      const already = get().notices.some((n) => n.message === SETTINGS_BLOCKED)
      if (!already) {
        get().pushNotice({
          level: 'warn',
          message: SETTINGS_BLOCKED,
          detail: 'settings.json has errors. Fix them, then reload settings.',
        })
      }
      return
    }

    try {
      const settings = await platform.writeWorkspaceSettings(id, patch)
      get().applySettings(settings)
    } catch (err) {
      // Main refuses the same write for the same reason, and will win a race
      // where the renderer has not yet heard that the file went bad.
      get().pushNotice({ level: 'warn', message: SETTINGS_BLOCKED, detail: String(err) })
    }
  },

  applySettings(settings, problems) {
    set((state) => ({
      settings,
      settingsProblems: problems ?? state.settingsProblems,
      workspace: state.workspace ? { ...state.workspace, settings } : state.workspace,
    }))
  },

  async toggleFavorite(path) {
    const settings = get().settings
    if (!settings) return
    const exists = settings.favorites.some((f) => f.path === path)
    const favorites = exists
      ? settings.favorites.filter((f) => f.path !== path)
      : [...settings.favorites, { path, label: stem(path) }]
    await get().patchSettings({ favorites })
  },

  isFavorite(path) {
    return get().settings?.favorites.some((f) => f.path === path) ?? false
  },

  applyFileChanges(batch) {
    // Structural changes need a re-walk; content-only changes do not. Re-walking
    // on every keystroke-save of an open file would be wasteful.
    const structural = batch.some((c) => c.type !== 'change')
    if (structural) void get().refreshTree()
  },

  setIndexStatus(status) {
    set({ indexStatus: status })
    if (status.notice) {
      get().pushNotice({ level: 'warn', message: status.notice })
    }
  },

  pushNotice(notice) {
    const id = `n${++noticeSeq}`
    set((state) => ({ notices: [...state.notices, { ...notice, id }] }))
  },

  dismissNotice(id) {
    set((state) => ({ notices: state.notices.filter((n) => n.id !== id) }))
  },
})
