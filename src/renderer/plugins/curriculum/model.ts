/**
 * Parsing `curriculum.json` into something the views can walk.
 *
 * All knowledge of what a curriculum IS lives here, in a plugin — the core
 * application has no concept of modules, checkpoints or branches. That
 * separation is the point: it is what lets the same binary open a workspace
 * about Rust, or mathematics, or nothing in particular.
 */
import { joinRel } from '@shared/paths'
import type { RelPath } from '@shared/types'

export interface Branch {
  key: string
  label: string
  color: string
  order: number
}

export type NodeKind = 'chapter' | 'topic' | 'checkpoint' | 'crossroad' | 'project' | string

export interface CurriculumNode {
  id: string
  kind: NodeKind
  branch: string
  tier: number
  label: string
  summary?: string
  est?: string
  cert?: string
  /** Workspace-relative once resolved against `docBase`. Often absent. */
  doc?: RelPath
  /**
   * The teaching document for this chapter, as opposed to `doc`, which is the
   * day plan. The two answer different questions — read this, do that — and a
   * workspace that only has one of them simply omits the other.
   */
  chapter?: RelPath
  /**
   * The worked solution for this chapter: the same material shown as finished
   * source rather than as teaching prose. Read-only, authored in the workspace,
   * and a third answer to the same read/do pair above — show me the code.
   */
  worked?: RelPath
  checkpoint?: string
  prereqs: string[]
  topics: CurriculumNode[]
}

export interface Curriculum {
  title: string
  version: string
  branches: Branch[]
  nodes: CurriculumNode[]
  /** Flat lookup by id, including topics nested under chapters. */
  byId: Map<string, CurriculumNode>
}

interface RawNode {
  id?: string
  kind?: string
  branch?: string
  tier?: number
  label?: string
  summary?: string
  est?: string
  cert?: string
  doc?: string
  chapter?: string
  worked?: string
  checkpoint?: string
  prereqs?: string[]
  topics?: RawNode[]
  /** Section separators carry no id; they are skipped. */
  _section?: string
}

function toNode(raw: RawNode, docBase: string, parentBranch: string): CurriculumNode | null {
  if (!raw.id || !raw.label) return null
  return {
    id: raw.id,
    kind: raw.kind ?? 'topic',
    branch: raw.branch ?? parentBranch,
    tier: raw.tier ?? 0,
    ...(raw.summary ? { summary: raw.summary } : {}),
    ...(raw.est ? { est: raw.est } : {}),
    ...(raw.cert ? { cert: raw.cert } : {}),
    ...(raw.doc ? { doc: joinRel(docBase, raw.doc) } : {}),
    ...(raw.chapter ? { chapter: joinRel(docBase, raw.chapter) } : {}),
    ...(raw.worked ? { worked: joinRel(docBase, raw.worked) } : {}),
    ...(raw.checkpoint ? { checkpoint: raw.checkpoint } : {}),
    label: raw.label,
    prereqs: raw.prereqs ?? [],
    topics: (raw.topics ?? [])
      .map((t) => toNode(t, docBase, raw.branch ?? parentBranch))
      .filter((n): n is CurriculumNode => n !== null),
  }
}

export function parseCurriculum(json: unknown, docBase: string): Curriculum {
  const root = json as {
    meta?: { title?: string; version?: string }
    branches?: Record<string, { label?: string; color?: string; order?: number }>
    nodes?: RawNode[]
  }

  const branches: Branch[] = Object.entries(root.branches ?? {})
    .map(([key, value], index) => ({
      key,
      label: value.label ?? key,
      color: value.color ?? '#6E9BC5',
      order: value.order ?? index,
    }))
    .sort((a, b) => a.order - b.order)

  const nodes = (root.nodes ?? [])
    .map((raw) => toNode(raw, docBase, 'core'))
    .filter((n): n is CurriculumNode => n !== null)

  const byId = new Map<string, CurriculumNode>()
  const index = (list: CurriculumNode[]): void => {
    for (const node of list) {
      byId.set(node.id, node)
      index(node.topics)
    }
  }
  index(nodes)

  return {
    title: root.meta?.title ?? 'Curriculum',
    version: root.meta?.version ?? '1',
    branches,
    nodes,
    byId,
  }
}

/** Chapters of a branch, in tier order. */
export function chaptersOf(curriculum: Curriculum, branch: string): CurriculumNode[] {
  return curriculum.nodes
    .filter((n) => n.branch === branch && n.kind === 'chapter')
    .sort((a, b) => a.tier - b.tier)
}

export interface Progress {
  /** Node ids the learner has completed. */
  done: string[]
  /** Where they are now. Drives the Current Module widget. */
  activeNodeId: string | null
}

export const EMPTY_PROGRESS: Progress = { done: [], activeNodeId: null }

/**
 * The next chapter to work on: the first incomplete one along the branch.
 * Explicit `activeNodeId` wins, so the learner can override the guess.
 */
export function currentChapter(
  curriculum: Curriculum,
  progress: Progress,
  branch = 'core',
): CurriculumNode | null {
  if (progress.activeNodeId) {
    const explicit = curriculum.byId.get(progress.activeNodeId)
    if (explicit) return explicit
  }
  const done = new Set(progress.done)
  return chaptersOf(curriculum, branch).find((c) => !done.has(c.id)) ?? null
}

export function completionOf(
  curriculum: Curriculum,
  progress: Progress,
  branch: string,
): { done: number; total: number } {
  const chapters = chaptersOf(curriculum, branch)
  const done = new Set(progress.done)
  return { done: chapters.filter((c) => done.has(c.id)).length, total: chapters.length }
}


// ── day blocks ────────────────────────────────────────────────────────

export interface DayBlock {
  /** 1-indexed, as written in the heading. */
  number: number
  title: string
  total: number
  done: number
}

const DAY_HEADING = /^#{2,4}\s+Day\s+(\d+)\s*[—–-]?\s*(.*)$/i
const TASK = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]/
const FENCE = /^\s{0,3}(```+|~~~+)/

/**
 * Split a module document into its day blocks and count each one's tasks.
 *
 * The file is the source of truth — checkbox ticks are written back into it —
 * so "which day am I on" is DERIVED rather than stored. Nothing to keep in
 * sync, and it advances by itself as boxes get ticked.
 */
export function parseDayBlocks(markdown: string): DayBlock[] {
  const blocks: DayBlock[] = []
  let current: DayBlock | null = null
  let fence: string | null = null

  for (const line of markdown.split('\n')) {
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (fence === null) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    if (fence !== null) continue

    const heading = DAY_HEADING.exec(line)
    if (heading) {
      current = {
        number: Number(heading[1]),
        title: (heading[2] ?? '').trim(),
        total: 0,
        done: 0,
      }
      blocks.push(current)
      continue
    }

    if (!current) continue
    const task = TASK.exec(line)
    if (!task) continue
    current.total++
    if (task[1]!.toLowerCase() === 'x') current.done++
  }

  return blocks
}

/** The first day with unfinished work, or the last one if all are done. */
export function currentDay(blocks: DayBlock[]): DayBlock | null {
  if (blocks.length === 0) return null
  return blocks.find((b) => b.total === 0 || b.done < b.total) ?? blocks[blocks.length - 1]!
}
