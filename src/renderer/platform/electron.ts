/**
 * The Electron implementation of the Platform adapter.
 *
 * This is the ONLY file in the renderer that knows an IPC channel string
 * exists. Everything above it — store, components, markdown, plugins — talks to
 * the `Platform` interface. A Tauri port writes a sibling of this file.
 */
import type { AppConfig, WorkspaceSettings } from '@shared/config-schema'
import { encodePathSegments } from '@shared/paths'
import type { DeepPartial, Platform, WorkspaceInfo } from '@shared/platform'
import type { SessionState } from '@shared/session-schema'
import type {
  DocRef,
  FileChange,
  FileStat,
  GraphNode,
  HomeSnapshot,
  ImageSize,
  IndexStatus,
  RecentWorkspace,
  RelPath,
  SearchOptions,
  SearchResult,
  TextFile,
  TreeNode,
  Unsubscribe,
  WorkspaceId,
} from '@shared/types'

const kt = window.kt

export const electronPlatform: Platform = {
  // ── workspaces ──────────────────────────────────────────────────────────
  pickWorkspaceFolder: (): Promise<string | null> => kt.invoke('ws:pickFolder'),
  openWorkspace: (rootPath: string): Promise<WorkspaceInfo> => kt.invoke('ws:open', rootPath),
  closeWorkspace: (id: WorkspaceId): Promise<void> => kt.invoke('ws:close', id),
  listRecentWorkspaces: (): Promise<RecentWorkspace[]> => kt.invoke('ws:listRecent'),
  createWorkspace: (
    rootPath: string,
    seed: DeepPartial<WorkspaceSettings>,
    starterFiles: boolean,
  ): Promise<WorkspaceInfo> => kt.invoke('ws:create', rootPath, seed, starterFiles),
  inspectFolder: (rootPath: string): Promise<{ empty: boolean; hasSettings: boolean }> =>
    kt.invoke('ws:inspectFolder', rootPath),

  // ── tree & files ────────────────────────────────────────────────────────
  readTree: (id: WorkspaceId): Promise<TreeNode> => kt.invoke('fs:readTree', id),
  readDir: (id: WorkspaceId, dir: RelPath): Promise<TreeNode[]> => kt.invoke('fs:readDir', id, dir),
  readTextFile: (id: WorkspaceId, path: RelPath): Promise<TextFile> =>
    kt.invoke('fs:readText', id, path),
  writeTextFile: (id: WorkspaceId, path: RelPath, content: string): Promise<void> =>
    kt.invoke('fs:writeText', id, path, content),
  makeDirectory: (id: WorkspaceId, dir: RelPath): Promise<void> => kt.invoke('fs:mkdirp', id, dir),
  stat: (id: WorkspaceId, path: RelPath): Promise<FileStat | null> =>
    kt.invoke('fs:stat', id, path),
  exists: (id: WorkspaceId, path: RelPath): Promise<boolean> => kt.invoke('fs:exists', id, path),

  listNotes: (id: WorkspaceId, root: string) => kt.invoke('fs:listNotes', id, root),

  /**
   * Synchronous by contract — an async image `src` would reintroduce the layout
   * shift that the scroll restorer depends on not happening. Each segment is
   * encoded separately so filenames with spaces survive (several in this
   * project's own assets folder do).
   */
  assetUrl: (id: WorkspaceId, path: RelPath): string =>
    `${kt.assetScheme}://${id}/${encodePathSegments(path)}`,

  imageDimensions: (id: WorkspaceId, paths: RelPath[]): Promise<Record<RelPath, ImageSize>> =>
    kt.invoke('fs:imageDimensions', id, paths),

  // ── search ──────────────────────────────────────────────────────────────
  search: (id: WorkspaceId, query: string, opts?: SearchOptions): Promise<SearchResult> =>
    kt.invoke('search:query', id, query, opts),
  cancelSearch: (queryId: string): void => {
    void kt.invoke('search:cancel', queryId)
  },
  quickOpenList: (id: WorkspaceId): Promise<DocRef[]> => kt.invoke('search:quickOpen', id),
  reindex: (id: WorkspaceId): Promise<void> => kt.invoke('search:reindex', id),

  graphNeighbors: (id: WorkspaceId, path: RelPath, depth: number): Promise<GraphNode[]> =>
    kt.invoke('graph:neighbors', id, path, depth),
  graphFind: (id: WorkspaceId, term: string): Promise<GraphNode[]> =>
    kt.invoke('graph:find', id, term),

  // ── config & session ────────────────────────────────────────────────────
  readWorkspaceSettings: (id: WorkspaceId): Promise<WorkspaceSettings> =>
    kt.invoke('cfg:readWorkspace', id),
  writeWorkspaceSettings: (
    id: WorkspaceId,
    patch: DeepPartial<WorkspaceSettings>,
  ): Promise<WorkspaceSettings> => kt.invoke('cfg:writeWorkspace', id, patch),
  readRawWorkspaceSettings: (
    id: WorkspaceId,
  ): Promise<{ raw: Record<string, unknown>; problems: string[] }> =>
    kt.invoke('cfg:rawWorkspace', id),
  readAppConfig: (): Promise<AppConfig> => kt.invoke('cfg:readApp'),
  writeAppConfig: (patch: DeepPartial<AppConfig>): Promise<AppConfig> =>
    kt.invoke('cfg:writeApp', patch),

  readSession: (id: WorkspaceId): Promise<SessionState | null> => kt.invoke('session:read', id),
  writeSession: (id: WorkspaceId, session: SessionState): Promise<void> =>
    kt.invoke('session:write', id, session),
  flushSession: (): Promise<void> => kt.invoke('session:flush'),

  readHomeSnapshot: (): Promise<HomeSnapshot | null> => kt.invoke('home:read'),
  writeHomeSnapshot: (snapshot: HomeSnapshot): Promise<void> => kt.invoke('home:write', snapshot),

  pluginState: {
    get: (id: WorkspaceId, pluginId: string): Promise<unknown> =>
      kt.invoke('plugin:stateGet', id, pluginId),
    set: (id: WorkspaceId, pluginId: string, value: unknown): Promise<void> =>
      kt.invoke('plugin:stateSet', id, pluginId, value),
  },

  // ── shell & window ──────────────────────────────────────────────────────
  openExternal: (url: string): Promise<void> => kt.invoke('shell:openExternal', url),
  copyText: (text: string): Promise<void> => kt.invoke('shell:copyText', text),
  revealInFileManager: (id: WorkspaceId, path: RelPath): Promise<void> =>
    kt.invoke('fs:reveal', id, path),
  setWindowTitle: (title: string): void => {
    void kt.invoke('win:setTitle', title)
  },
  setNativeTheme: (theme: 'dark' | 'light' | 'system'): void => {
    void kt.invoke('win:setTheme', theme)
  },
  setZoom: (factor: number): void => {
    void kt.invoke('win:setZoom', factor)
  },

  // ── push events ─────────────────────────────────────────────────────────
  onFileChanged: (cb: (batch: FileChange[]) => void): Unsubscribe => kt.on('evt:files', cb),
  onIndexStatus: (cb: (status: IndexStatus) => void): Unsubscribe => kt.on('evt:index', cb),
  onSettingsChanged: (
    cb: (id: WorkspaceId, s: WorkspaceSettings, problems: string[]) => void,
  ): Unsubscribe => kt.on('evt:settings', cb),
  onMenuCommand: (cb: (commandId: string) => void): Unsubscribe => kt.on('evt:command', cb),
  onBeforeQuit: (cb: () => void): Unsubscribe => kt.on('evt:quitting', cb),
}
