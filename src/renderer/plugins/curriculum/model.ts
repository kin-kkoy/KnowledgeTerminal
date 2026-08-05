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


// ── milestones ────────────────────────────────────────────────────────

export interface MilestoneItem {
  text: string
  done: boolean
  /** Position among all task items in the roadmap, for write-back. */
  index: number
}

export interface Milestone {
  number: number
  title: string
  /** Which part of the curriculum it pairs with, verbatim from the source. */
  curriculum: string
  goal: string
  /** Tickable work — the bullets under **Tasks** and **Features**. */
  tasks: MilestoneItem[]
  /** Everything else the milestone lists. Real content, but not chores. */
  scope: Array<{ label: string; items: string[] }>
  /** The **Deliverable** box. Ticking it is what finishes the milestone. */
  deliverable: MilestoneItem | null
}

const MILESTONE_HEADING = /^#{2,3}\s+Milestone\s+(\d+)\s*[—–-]\s*(.*)$/i
const LABEL = /^\*\*([A-Za-z][A-Za-z ]*)\*\*\s*(?:[—–-]\s*(.*))?$/
const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s*(.*)$/
const PLAIN_BULLET = /^\s*[-*+]\s+(?!\[[ xX]\])(.+)$/

/**
 * Labels whose bullets are WORK. Everything else under a milestone is scope.
 *
 * A roadmap says "Introduce: dragon class hierarchy" and "Tasks: create
 * README". Only the second is a chore you tick off; the first describes what
 * the milestone covers. Counting both would make the progress bar a lie.
 */
const WORK_LABELS = new Set(['tasks', 'features'])

const titleCase = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase())

/**
 * Split a roadmap document into milestones.
 *
 * Sibling of `parseDayBlocks` above, and derived the same way: the document is
 * the source of truth, so which milestone is live is computed rather than
 * stored, and ticking a box in the file moves it with nothing to keep in sync.
 *
 * Task indices are counted across the WHOLE document, fenced blocks excluded,
 * so they line up exactly with `toggleTaskAt` in `markdown/tasks.ts` — that is
 * what lets the Lobby tick a box in a document nobody has opened.
 */
export function parseMilestones(markdown: string): Milestone[] {
  const out: Milestone[] = []
  let current: Milestone | null = null
  let label = ''
  let fence: string | null = null
  let taskIndex = -1

  for (const line of markdown.split('\n')) {
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (fence === null) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    if (fence !== null) continue

    // Counted before anything else: every checkbox in the file advances the
    // index, including ones outside any milestone, or the numbering would
    // drift out of step with the writer.
    const checkbox = CHECKBOX.exec(line)
    if (checkbox) taskIndex++

    const heading = MILESTONE_HEADING.exec(line)
    if (heading) {
      current = {
        number: Number(heading[1]),
        title: (heading[2] ?? '').trim(),
        curriculum: '',
        goal: '',
        tasks: [],
        scope: [],
        deliverable: null,
      }
      out.push(current)
      label = ''
      continue
    }
    if (!current) continue

    const labelMatch = LABEL.exec(line)
    if (labelMatch) {
      label = labelMatch[1]!.trim().toLowerCase()
      const value = (labelMatch[2] ?? '').trim()
      if (label === 'curriculum') current.curriculum = value
      if (label === 'goal') current.goal = value
      continue
    }

    if (checkbox) {
      const item: MilestoneItem = {
        text: checkbox[2]!.trim(),
        done: checkbox[1]!.toLowerCase() === 'x',
        index: taskIndex,
      }
      if (label === 'deliverable') current.deliverable = item
      else current.tasks.push(item)
      continue
    }

    /**
     * The deliverable ENDS a milestone, even when prose keeps going.
     *
     * The last milestone in a roadmap is usually followed by closing sections
     * — things deliberately deferred, what success looks like — and without
     * this they would all be swept up as that milestone's scope, which is
     * simply untrue.
     */
    if (current.deliverable) continue

    const bullet = PLAIN_BULLET.exec(line)
    if (bullet && !WORK_LABELS.has(label)) {
      // A list under no heading at all still says something; dropping it
      // silently would lose content the document plainly states.
      const groupLabel = label ? titleCase(label) : 'Includes'
      let group = current.scope[current.scope.length - 1]
      if (!group || group.label !== groupLabel) {
        group = { label: groupLabel, items: [] }
        current.scope.push(group)
      }
      group.items.push(bullet[1]!.trim())
    }
  }

  return out
}

/**
 * The milestone being worked on: the first whose deliverable is unticked.
 *
 * Gated on the DELIVERABLE rather than on the task count, for two reasons. It
 * is the workspace's own rule — "a task is ✅ only when its done-when criterion
 * is met, not when time was spent on it" — and it is the only rule that works
 * for a milestone listing no tasks at all, which would otherwise have no way to
 * ever end and would strand the board on it forever.
 */
export function currentMilestone(list: Milestone[]): Milestone | null {
  if (list.length === 0) return null
  return list.find((m) => !m.deliverable?.done) ?? list[list.length - 1]!
}
