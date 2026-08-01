/**
 * THE FILESYSTEM BOUNDARY.
 *
 * Every filesystem operation in the application goes through this interface.
 * Porting to Tauri means writing `src/renderer/platform/tauri.ts` against this
 * contract and changing one line in `src/renderer/platform/index.ts` — nothing
 * in the UI, store, markdown pipeline or plugins changes.
 *
 * Design rules that hold the boundary:
 *  - Everything is workspace-RELATIVE. No absolute path crosses IPC from the
 *    renderer except `openWorkspace`, and main re-validates every path against
 *    the root anyway (see main/fs/safety.ts).
 *  - No Node types, no DOM types, no Electron types appear here.
 */
import type { AppConfig, WorkspaceSettings } from './config-schema'
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
  Unsubscribe,
  WorkspaceId,
} from './types'

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K]
}

export interface WorkspaceInfo {
  id: WorkspaceId
  root: string
  name: string
  settings: WorkspaceSettings
  hasSession: boolean
  lastOpenedAt: number
  /** Config problems found while loading. Surfaced in the status bar. */
  problems: string[]
}

export interface Platform {
  // ── workspaces ──────────────────────────────────────────────────────────
  pickWorkspaceFolder(): Promise<string | null>
  openWorkspace(rootPath: string): Promise<WorkspaceInfo>
  closeWorkspace(id: WorkspaceId): Promise<void>
  listRecentWorkspaces(): Promise<RecentWorkspace[]>
  /**
   * Scaffold a folder into a workspace and open it.
   *
   * The Sandbox is the only caller, and this is the only place the app creates
   * files the user did not name. It never overwrites: pointing it at a folder
   * that already holds notes adopts them rather than replacing them.
   */
  createWorkspace(
    rootPath: string,
    seed: DeepPartial<WorkspaceSettings>,
    starterFiles: boolean,
  ): Promise<WorkspaceInfo>
  /**
   * What is already in a folder, so the create form can say what will actually
   * happen: `empty` drives the "files are already here" notice, `hasSettings`
   * means it is already a workspace and its own config will win.
   */
  inspectFolder(rootPath: string): Promise<{ empty: boolean; hasSettings: boolean }>

  // ── tree & files ────────────────────────────────────────────────────────
  /** Full ignore-filtered walk. Cheap enough to do once per workspace open. */
  readTree(id: WorkspaceId): Promise<TreeNode>
  readDir(id: WorkspaceId, dir: RelPath): Promise<TreeNode[]>
  readTextFile(id: WorkspaceId, path: RelPath): Promise<TextFile>
  writeTextFile(id: WorkspaceId, path: RelPath, content: string): Promise<void>
  /** Create a folder (and parents) inside the workspace. Sandbox only. */
  makeDirectory(id: WorkspaceId, dir: RelPath): Promise<void>
  stat(id: WorkspaceId, path: RelPath): Promise<FileStat | null>
  exists(id: WorkspaceId, path: RelPath): Promise<boolean>
  /**
   * List a notes folder. `root` may be workspace-relative OR absolute, so the
   * close-out gate can watch a vault belonging to another app.
   *
   * READ-ONLY, and the only call in the API that may look outside the
   * workspace. There is deliberately no write counterpart.
   */
  listNotes(id: WorkspaceId, root: string): Promise<NoteFile[]>

  /**
   * SYNC on purpose: it is a pure string transform (Electron → kt://, Tauri →
   * convertFileSrc). An async image `src` would reintroduce layout shift, which
   * is exactly what the scroll restorer cannot tolerate.
   */
  assetUrl(id: WorkspaceId, path: RelPath): string

  /**
   * Intrinsic image sizes, batched one round trip per document, so every <img>
   * can reserve its box on the first frame. This method exists solely to keep
   * cumulative layout shift at zero — it earns its odd shape.
   */
  imageDimensions(id: WorkspaceId, paths: RelPath[]): Promise<Record<RelPath, ImageSize>>

  // ── search ──────────────────────────────────────────────────────────────
  search(id: WorkspaceId, query: string, opts?: SearchOptions): Promise<SearchResult>
  cancelSearch(queryId: string): void
  /** Small list, fetched once per workspace and patched from watcher events. */
  quickOpenList(id: WorkspaceId): Promise<DocRef[]>
  reindex(id: WorkspaceId): Promise<void>

  /**
   * Documents connected to this one, nearest first. Derived from links, tags
   * and directory layout — no separate relationship file to maintain.
   */
  graphNeighbors(id: WorkspaceId, path: RelPath, depth: number): Promise<GraphNode[]>
  /** Documents whose title, filename, path or tags name a term. */
  graphFind(id: WorkspaceId, term: string): Promise<GraphNode[]>

  // ── config & session ────────────────────────────────────────────────────
  readWorkspaceSettings(id: WorkspaceId): Promise<WorkspaceSettings>
  writeWorkspaceSettings(
    id: WorkspaceId,
    patch: DeepPartial<WorkspaceSettings>,
  ): Promise<WorkspaceSettings>
  /**
   * The settings file exactly as it sits on disk, plus its parse problems.
   *
   * The Sandbox needs the RAW object, not the parsed one: unknown keys are
   * stripped by the schema, and showing the user a tidied version of their file
   * while asking them to fix it would be dishonest.
   */
  readRawWorkspaceSettings(
    id: WorkspaceId,
  ): Promise<{ raw: Record<string, unknown>; problems: string[] }>
  readAppConfig(): Promise<AppConfig>
  writeAppConfig(patch: DeepPartial<AppConfig>): Promise<AppConfig>

  readSession(id: WorkspaceId): Promise<SessionState | null>
  /** Debounced main-side; the renderer may call this freely. */
  writeSession(id: WorkspaceId, session: SessionState): Promise<void>
  /** Force the debounce. Called on tab switch, blur and quit. */
  flushSession(): Promise<void>

  /** The Home screen's first-frame fast path. */
  readHomeSnapshot(): Promise<HomeSnapshot | null>
  writeHomeSnapshot(snapshot: HomeSnapshot): Promise<void>

  /** Namespaced plugin storage — plugins never touch the filesystem directly. */
  pluginState: {
    get(id: WorkspaceId, pluginId: string): Promise<unknown>
    set(id: WorkspaceId, pluginId: string, value: unknown): Promise<void>
  }

  // ── shell & window ──────────────────────────────────────────────────────
  openExternal(url: string): Promise<void>
  /**
   * Copy to the clipboard.
   *
   * Goes through main rather than `navigator.clipboard`: the renderer's
   * permission lockdown denies clipboard-write, so the web API silently fails.
   */
  copyText(text: string): Promise<void>
  revealInFileManager(id: WorkspaceId, path: RelPath): Promise<void>
  setWindowTitle(title: string): void
  setNativeTheme(theme: 'dark' | 'light' | 'system'): void
  setZoom(factor: number): void

  // ── push events (main → renderer) ───────────────────────────────────────
  onFileChanged(cb: (batch: FileChange[]) => void): Unsubscribe
  onIndexStatus(cb: (status: IndexStatus) => void): Unsubscribe
  onSettingsChanged(
    cb: (id: WorkspaceId, settings: WorkspaceSettings, problems: string[]) => void,
  ): Unsubscribe
  onMenuCommand(cb: (commandId: string) => void): Unsubscribe
  /** Last chance to flush the freshest scroll position before the app exits. */
  onBeforeQuit(cb: () => void): Unsubscribe
}
