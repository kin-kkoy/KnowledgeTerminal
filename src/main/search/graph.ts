/**
 * The document graph, derived from the Markdown.
 *
 * Built from facts the files already state — wikilinks, relative links, tags,
 * and directory siblinghood — so there is nothing to maintain and nothing that
 * can drift out of date. A hand-authored `relationships.json` was the obvious
 * alternative and was rejected for exactly that reason: it goes stale the first
 * time you write a document and forget to update it.
 *
 * What derivation genuinely cannot express — "this dragon is connected to
 * mining" when no document says so — arrives as typed edges from a plugin,
 * merged in the renderer. Core never learns that vocabulary.
 *
 * Adjacency is rebuilt wholesale rather than patched. At workspace scale
 * (hundreds to a few thousand files) that is single-digit milliseconds, and it
 * removes an entire class of incremental-update bugs.
 */
import { dirnameRel, joinRel, stem } from '@shared/paths'
import type { GraphEdgeKind, GraphNode, RelPath } from '@shared/types'

export interface FileFacts {
  title: string
  links: string[]
  tags: string[]
}

export interface Graph {
  /** path → outbound neighbours. */
  out: Map<RelPath, Set<RelPath>>
  /** path → documents that link TO it. */
  in: Map<RelPath, Set<RelPath>>
  /** tag → documents carrying it. */
  byTag: Map<string, Set<RelPath>>
  titles: Map<RelPath, string>
  tags: Map<RelPath, Set<string>>
}

const MAX_SIBLINGS = 8

function add(map: Map<RelPath, Set<RelPath>>, key: RelPath, value: RelPath): void {
  const existing = map.get(key)
  if (existing) existing.add(value)
  else map.set(key, new Set([value]))
}

/**
 * Turn a link target into a real path.
 *
 * Wikilinks name a document, not a path, so they resolve by stem — the same
 * rule the renderer's `InternalLink` uses, which is why a link that works when
 * clicked also works in the graph.
 */
function resolveLink(from: RelPath, target: string, byStem: Map<string, RelPath[]>, known: Set<RelPath>): RelPath | null {
  const clean = target.split('#')[0]?.trim()
  if (!clean) return null

  // A relative or workspace-rooted path, with or without the extension.
  if (clean.includes('/') || /\.[a-z0-9]+$/i.test(clean)) {
    const base = clean.startsWith('/') ? clean.slice(1) : joinRel(dirnameRel(from), clean)
    const normalised = normalise(base)
    if (known.has(normalised)) return normalised
    for (const ext of ['.md', '.markdown']) {
      if (known.has((normalised + ext) as RelPath)) return (normalised + ext) as RelPath
    }
  }

  // Otherwise it names a document. Prefer one in the same directory.
  const candidates = byStem.get(clean.toLowerCase())
  if (!candidates || candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]!
  const dir = dirnameRel(from)
  return candidates.find((c) => dirnameRel(c) === dir) ?? candidates[0]!
}

/** Collapse `.` and `..` segments; `joinRel` does not. */
function normalise(path: string): RelPath {
  const out: string[] = []
  for (const segment of path.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') out.pop()
    else out.push(segment)
  }
  return out.join('/') as RelPath
}

export function buildGraph(facts: Map<RelPath, FileFacts>): Graph {
  const known = new Set(facts.keys())
  const byStem = new Map<string, RelPath[]>()
  for (const path of known) {
    const key = stem(path).toLowerCase()
    const list = byStem.get(key)
    if (list) list.push(path)
    else byStem.set(key, [path])
  }

  const graph: Graph = {
    out: new Map(),
    in: new Map(),
    byTag: new Map(),
    titles: new Map(),
    tags: new Map(),
  }

  for (const [path, file] of facts) {
    graph.titles.set(path, file.title)
    graph.tags.set(path, new Set(file.tags))

    for (const target of file.links) {
      const resolved = resolveLink(path, target, byStem, known)
      if (!resolved || resolved === path) continue
      add(graph.out, path, resolved)
      add(graph.in, resolved, path)
    }

    for (const tag of file.tags) {
      const set = graph.byTag.get(tag)
      if (set) set.add(path)
      else graph.byTag.set(tag, new Set([path]))
    }
  }

  return graph
}

interface Found {
  kind: GraphEdgeKind
  reason: string
  distance: number
}

/**
 * Neighbours of a document, nearest first.
 *
 * Ordering is by hop distance and then by edge strength: an explicit link is
 * worth more than a shared tag, which is worth more than merely living in the
 * same folder. Siblings are capped because in a flat directory they would
 * otherwise drown out every real relationship.
 */
export function neighborsOf(graph: Graph, path: RelPath, depth: number): GraphNode[] {
  const found = new Map<RelPath, Found>()
  const record = (target: RelPath, entry: Found): void => {
    if (target === path) return
    const existing = found.get(target)
    if (!existing || existing.distance > entry.distance) found.set(target, entry)
  }

  let frontier: RelPath[] = [path]
  for (let hop = 1; hop <= Math.max(1, depth); hop++) {
    const next: RelPath[] = []
    for (const current of frontier) {
      for (const target of graph.out.get(current) ?? []) {
        if (!found.has(target)) next.push(target)
        record(target, {
          kind: 'link',
          reason: hop === 1 ? 'links to it' : `reached via ${graph.titles.get(current) ?? current}`,
          distance: hop,
        })
      }
      for (const source of graph.in.get(current) ?? []) {
        if (!found.has(source)) next.push(source)
        record(source, {
          kind: 'backlink',
          reason: hop === 1 ? 'references it' : `reached via ${graph.titles.get(current) ?? current}`,
          distance: hop,
        })
      }
    }
    frontier = next
    if (frontier.length === 0) break
  }

  for (const tag of graph.tags.get(path) ?? []) {
    for (const target of graph.byTag.get(tag) ?? []) {
      record(target, { kind: 'tag', reason: `shares #${tag}`, distance: 1 })
    }
  }

  const dir = dirnameRel(path)
  let siblings = 0
  for (const candidate of graph.titles.keys()) {
    if (siblings >= MAX_SIBLINGS) break
    if (candidate === path || dirnameRel(candidate) !== dir) continue
    if (found.has(candidate)) continue
    record(candidate, { kind: 'sibling', reason: `in ${dir || 'the workspace root'}`, distance: 2 })
    siblings++
  }

  const weight: Record<GraphEdgeKind, number> = {
    link: 0,
    backlink: 1,
    typed: 1,
    tag: 2,
    sibling: 3,
  }

  return [...found.entries()]
    .map(([target, entry]) => ({
      path: target,
      title: graph.titles.get(target) ?? stem(target),
      kind: entry.kind,
      reason: entry.reason,
      distance: entry.distance,
    }))
    .sort(
      (a, b) =>
        a.distance - b.distance ||
        weight[a.kind] - weight[b.kind] ||
        a.title.localeCompare(b.title),
    )
}

/**
 * Documents whose title, path or tags name a term.
 *
 * This is how "everything related to Contracts" finds a starting point when
 * the user names a concept rather than a file.
 */
export function findByTerm(graph: Graph, term: string): GraphNode[] {
  const needle = term.toLowerCase().trim()
  if (!needle) return []

  const hits: GraphNode[] = []
  for (const [path, title] of graph.titles) {
    const haystackTitle = title.toLowerCase()
    const haystackPath = path.toLowerCase()
    let reason: string | null = null

    if (haystackTitle === needle) reason = 'exact title match'
    else if (haystackTitle.includes(needle)) reason = 'title mentions it'
    else if (stem(path).toLowerCase().includes(needle)) reason = 'filename mentions it'
    else if ((graph.tags.get(path) ?? new Set()).has(needle)) reason = `tagged #${needle}`
    else if (haystackPath.includes(needle)) reason = 'path mentions it'

    if (reason) {
      hits.push({
        path,
        title,
        kind: 'link',
        reason,
        distance: reason === 'exact title match' ? 0 : 1,
      })
    }
  }

  return hits.sort((a, b) => a.distance - b.distance || a.title.length - b.title.length)
}
