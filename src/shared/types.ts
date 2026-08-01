/**
 * Domain types shared by main, preload and renderer.
 *
 * RULE: this directory must never import `node:*` or touch the DOM. It is
 * typechecked under both tsconfig.node.json and tsconfig.web.json, so a
 * violation fails the build on one side or the other.
 */

/** Stable hash of a workspace's absolute root path. */
export type WorkspaceId = string

/**
 * A POSIX-style path relative to the workspace root. Never absolute.
 * No absolute path crosses IPC from the renderer except `openWorkspace`.
 */
export type RelPath = string

export type Unsubscribe = () => void

export interface Disposable {
  dispose(): void
}

// ── tree & files ──────────────────────────────────────────────────────────

export interface TreeNode {
  path: RelPath
  name: string
  kind: 'dir' | 'file'
  /** Lowercased, without the dot. Files only. */
  ext?: string
  size?: number
  mtimeMs?: number
  /** Present on directories once walked. */
  children?: TreeNode[]
}

export interface TextFile {
  path: RelPath
  content: string
  /** Content hash — scroll anchors are only trusted when this still matches. */
  hash: string
  mtimeMs: number
  size: number
}

export interface FileStat {
  path: RelPath
  kind: 'dir' | 'file'
  size: number
  mtimeMs: number
}

/** Quick Open payload. Deliberately tiny: this list is held in the renderer. */
export interface DocRef {
  path: RelPath
  title: string
  mtimeMs: number
}

export interface ImageSize {
  w: number
  h: number
}

// ── search ────────────────────────────────────────────────────────────────

export interface SearchOptions {
  limit?: number
  prefix?: boolean
  fuzzy?: number
  queryId?: string
}

export interface SearchMatch {
  /** 1-indexed line number in the source file. */
  line: number
  text: string
  /** [start, end) character offsets into `text` to highlight. */
  ranges: Array<[number, number]>
}

export interface SearchHit {
  path: RelPath
  title: string
  score: number
  matches: SearchMatch[]
}

export interface SearchResult {
  queryId: string
  hits: SearchHit[]
  total: number
  truncated: boolean
}

// ── graph ─────────────────────────────────────────────────────────────────

/**
 * How two documents came to be connected.
 *
 * All of these except `typed` are DERIVED from the Markdown itself, so the
 * graph cannot go stale: there is no second file to keep in sync. `typed` edges
 * come from a plugin and are the only way a relationship the prose does not
 * state ("this dragon mines that ore") can exist at all — which keeps that
 * vocabulary out of core entirely.
 */
export type GraphEdgeKind = 'link' | 'backlink' | 'tag' | 'sibling' | 'typed'

export interface GraphNode {
  path: RelPath
  title: string
  kind: GraphEdgeKind
  /** Human-readable justification, shown verbatim as an answer's evidence. */
  reason: string
  /** Hops from the origin. 1 is a direct neighbour. */
  distance: number
}

/** A relationship a plugin asserts, which the text does not state on its own. */
export interface TypedEdge {
  from: RelPath
  to: RelPath
  type: string
  label?: string
}

// ── events ────────────────────────────────────────────────────────────────

export type FileChangeType = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

export interface FileChange {
  workspaceId: WorkspaceId
  type: FileChangeType
  path: RelPath
}

export interface IndexStatus {
  workspaceId: WorkspaceId
  phase: 'idle' | 'crawling' | 'ready' | 'degraded'
  indexed: number
  total: number
  /** Set when the watcher fell back to polling, or the index failed. */
  notice?: string
}

// ── workspace ─────────────────────────────────────────────────────────────

export interface RecentWorkspace {
  id: WorkspaceId
  root: string
  name: string
  lastOpenedAt: number
}

/**
 * What the Home screen renders in its FIRST frame, cached to disk so there is
 * never a spinner. See plan §"exact scroll restoration" / home snapshot.
 */
/**
 * Everything the dashboard draws, precomputed.
 *
 * Written whenever the mission, goal, progress or recents change — so the first
 * frame after launch is the real thing rather than a skeleton. Fields a
 * workspace has no answer for are null and simply do not render; nothing here
 * is required, and nothing here is subject-specific.
 */
export interface HomeSnapshot {
  workspaceId: WorkspaceId
  workspaceName: string
  root: string
  /** Small line above the headline, e.g. "Day 1 of 5 · Module 01". */
  eyebrow: string | null
  /** The one sentence. Falls back to the workspace name. */
  headline: string | null
  mission: string | null
  goal: string | null
  quote: { text: string; source?: string } | null
  lastSessionAt: number | null
  /** Consecutive days with a session. 0 or null hides the plate. */
  streak: number | null
  /** e.g. "cp1" — whatever the workspace calls its next gate. */
  nextGate: string | null
  /** A labelled counter, e.g. "C# Core modules" / "0 of 5 done". */
  progressLabel: string | null
  progressValue: string | null
  /**
   * Documents a contributor considers relevant right now, tagged by ROLE.
   *
   * Core matches a small set of generic roles — `read`, `do`, `next` — and
   * renders them in fixed slots. It attaches no meaning beyond that: it does
   * not know that `read` happens to be a curriculum chapter, only that
   * something asked to be offered under "read this". A workspace with no
   * contributor supplies none, and the slots simply stay empty.
   */
  links: Array<{ role: string; path: RelPath; label: string; hint?: string }>
  /** Today's checklist, read from the active document's task list. */
  tasks: Array<{ text: string; done: boolean }>
  /**
   * Free-form substitutions for filename templates, e.g. `{ day: "2" }`.
   *
   * Deliberately untyped: the core substitutes whatever it is given without
   * knowing what a "day" or a "module" means. That is what keeps the daily-note
   * naming useful here and harmless in a workspace with no curriculum.
   */
  tokens: Record<string, string>
  recents: Array<{ title: string; path: RelPath }>
}

/** One file in a notes folder, which may live outside the workspace. */
export interface NoteFile {
  name: string
  mtimeMs: number
  size: number
}

// ── documents ─────────────────────────────────────────────────────────────

export interface TocEntry {
  /** github-slugger slug — matches the heading's DOM id exactly. */
  slug: string
  text: string
  depth: number
}

/** A config or content problem surfaced in the status bar, never as a dialog. */
export interface Notice {
  id: string
  level: 'info' | 'warn' | 'error'
  message: string
  detail?: string
}
