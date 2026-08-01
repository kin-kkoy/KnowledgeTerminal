/**
 * The single source of truth for IPC.
 *
 * Two DISJOINT namespaces:
 *   `domain:verb` — request/response, via ipcRenderer.invoke
 *   `evt:domain`  — push, via ipcRenderer.on
 *
 * Keeping them disjoint means an `.on` listener can never accidentally bind to
 * an invoke channel, which is a genuinely confusing class of bug.
 *
 * Only two files know these strings: `main/ipc.ts` registers them and
 * `renderer/platform/electron.ts` calls them. Nothing else, ever.
 */
import type { AppConfig, WorkspaceSettings } from './config-schema'
import type { DeepPartial, WorkspaceInfo } from './platform'
import type { SessionState } from './session-schema'
import type {
  DocRef,
  FileChange,
  FileStat,
  GraphNode,
  HomeSnapshot,
  ImageSize,
  IndexStatus,
  NoteFile,
  RecentWorkspace,
  RelPath,
  SearchOptions,
  SearchResult,
  TextFile,
  TreeNode,
  WorkspaceId,
} from './types'

export interface IpcRequests {
  // workspaces
  'ws:pickFolder': { in: []; out: string | null }
  'ws:open': { in: [rootPath: string]; out: WorkspaceInfo }
  'ws:close': { in: [id: WorkspaceId]; out: void }
  'ws:listRecent': { in: []; out: RecentWorkspace[] }
  /**
   * Scaffold a folder into a workspace and open it. The ONE call in the app
   * that creates files the user did not name. Never overwrites.
   */
  'ws:create': {
    in: [rootPath: string, seed: DeepPartial<WorkspaceSettings>, starterFiles: boolean]
    out: WorkspaceInfo
  }
  /** What is already in this folder, so the create form can tell the truth. */
  'ws:inspectFolder': {
    in: [rootPath: string]
    out: { empty: boolean; hasSettings: boolean }
  }

  // tree & files
  'fs:readTree': { in: [id: WorkspaceId]; out: TreeNode }
  'fs:readDir': { in: [id: WorkspaceId, dir: RelPath]; out: TreeNode[] }
  'fs:readText': { in: [id: WorkspaceId, path: RelPath]; out: TextFile }
  'fs:writeText': { in: [id: WorkspaceId, path: RelPath, content: string]; out: void }
  'fs:mkdirp': { in: [id: WorkspaceId, dir: RelPath]; out: void }
  'fs:stat': { in: [id: WorkspaceId, path: RelPath]; out: FileStat | null }
  'fs:exists': { in: [id: WorkspaceId, path: RelPath]; out: boolean }
  'fs:listNotes': { in: [id: WorkspaceId, root: string]; out: NoteFile[] }
  'fs:imageDimensions': {
    in: [id: WorkspaceId, paths: RelPath[]]
    out: Record<RelPath, ImageSize>
  }
  'fs:reveal': { in: [id: WorkspaceId, path: RelPath]; out: void }

  // search
  'search:query': { in: [id: WorkspaceId, q: string, opts?: SearchOptions]; out: SearchResult }
  'search:cancel': { in: [queryId: string]; out: void }
  'search:quickOpen': { in: [id: WorkspaceId]; out: DocRef[] }
  'search:reindex': { in: [id: WorkspaceId]; out: void }

  // graph — derived from the same crawl the index uses
  'graph:neighbors': { in: [id: WorkspaceId, path: RelPath, depth: number]; out: GraphNode[] }
  'graph:find': { in: [id: WorkspaceId, term: string]; out: GraphNode[] }

  // config & session
  'cfg:readWorkspace': { in: [id: WorkspaceId]; out: WorkspaceSettings }
  'cfg:writeWorkspace': {
    in: [id: WorkspaceId, patch: DeepPartial<WorkspaceSettings>]
    out: WorkspaceSettings
  }
  /** The settings file verbatim + its parse problems, for the Sandbox. */
  'cfg:rawWorkspace': {
    in: [id: WorkspaceId]
    out: { raw: Record<string, unknown>; problems: string[] }
  }
  'cfg:readApp': { in: []; out: AppConfig }
  'cfg:writeApp': { in: [patch: DeepPartial<AppConfig>]; out: AppConfig }

  'session:read': { in: [id: WorkspaceId]; out: SessionState | null }
  'session:write': { in: [id: WorkspaceId, session: SessionState]; out: void }
  'session:flush': { in: []; out: void }
  'home:read': { in: []; out: HomeSnapshot | null }
  'home:write': { in: [snapshot: HomeSnapshot]; out: void }

  'plugin:stateGet': { in: [id: WorkspaceId, pluginId: string]; out: unknown }
  'plugin:stateSet': { in: [id: WorkspaceId, pluginId: string, value: unknown]; out: void }

  // shell & window
  'shell:openExternal': { in: [url: string]; out: void }
  'shell:copyText': { in: [text: string]; out: void }
  'win:setTitle': { in: [title: string]; out: void }
  'win:setTheme': { in: [theme: 'dark' | 'light' | 'system']; out: void }
  'win:setZoom': { in: [factor: number]; out: void }
  'win:saveBounds': {
    in: [bounds: { x: number | null; y: number | null; width: number; height: number; maximized: boolean }]
    out: void
  }
}

export interface IpcEvents {
  'evt:files': [batch: FileChange[]]
  'evt:index': [status: IndexStatus]
  /** Emitted when settings.json changes on disk underneath a running window. */
  'evt:settings': [id: WorkspaceId, settings: WorkspaceSettings, problems: string[]]
  'evt:command': [commandId: string]
  'evt:quitting': []
}

export type IpcRequestChannel = keyof IpcRequests
export type IpcEventChannel = keyof IpcEvents

/** The shape `contextBridge` exposes as `window.kt`. */
export interface KtBridge {
  invoke<K extends IpcRequestChannel>(
    channel: K,
    ...args: IpcRequests[K]['in']
  ): Promise<IpcRequests[K]['out']>
  on<K extends IpcEventChannel>(channel: K, cb: (...args: IpcEvents[K]) => void): () => void
  /** Read synchronously by main from disk and passed via additionalArguments,
   *  so the preload can set data-theme BEFORE first paint. No light flash. */
  readonly initialTheme: 'dark' | 'light'
  readonly assetScheme: string
}
