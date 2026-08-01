/**
 * Layer 2 — relationships between documents.
 *
 * "Which documents reference the Merchant Council" is a graph traversal, not a
 * text search: the answer is the set of documents that point at it, which is a
 * different question from the set of documents that happen to contain the
 * phrase. Answering it by keyword would miss a document that links by alias and
 * would wrongly include one that mentions the words in passing.
 *
 * Derived edges come from the search worker. Typed edges — relationships the
 * prose does not state — come from plugins and are merged here, so the core
 * never learns any domain vocabulary.
 */
import type { Answer, AnswerProvider, Evidence, QueryContext } from '@shared/answers'
import { stem } from '@shared/paths'
import type { GraphNode, RelPath, TypedEdge } from '@shared/types'
import { platform } from '../../platform'
import { store } from '../../store'

const MAX_EVIDENCE = 12

/**
 * Living in the same folder is filing, not a relationship.
 *
 * Siblings were drowning the real signal — seven of ten "connections" to a
 * document were `in documentation`, which is true of every file in that folder
 * and tells the reader nothing. They are kept only as padding when a document
 * genuinely has few connections, and never in bulk.
 */
const MAX_SIBLINGS = 2
const ENOUGH_REAL_EDGES = 3

function toEvidence(node: GraphNode): Evidence {
  return { path: node.path, title: node.title, reason: node.reason }
}

/** Plugin-asserted edges touching `path`, in both directions. */
function typedNeighbors(path: RelPath): GraphNode[] {
  const edges: TypedEdge[] = store
    .get()
    .graphEdgeSources.flatMap((source) => {
      try {
        return source.get()
      } catch {
        // A plugin that throws here must not break a graph question.
        return []
      }
    })

  const out: GraphNode[] = []
  for (const edge of edges) {
    if (edge.from === path) {
      out.push({
        path: edge.to,
        title: stem(edge.to),
        kind: 'typed',
        reason: edge.label ?? edge.type,
        distance: 1,
      })
    } else if (edge.to === path) {
      out.push({
        path: edge.from,
        title: stem(edge.from),
        kind: 'typed',
        reason: edge.label ?? edge.type,
        distance: 1,
      })
    }
  }
  return out
}

function merge(derived: GraphNode[], typed: GraphNode[]): GraphNode[] {
  const seen = new Map<RelPath, GraphNode>()
  // Typed edges first: an explicit assertion outranks an incidental link.
  for (const node of [...typed, ...derived]) {
    if (!seen.has(node.path)) seen.set(node.path, node)
  }

  const all = [...seen.values()]
  const real = all.filter((n) => n.kind !== 'sibling')
  const siblings = all.filter((n) => n.kind === 'sibling')

  // Once there are enough genuine connections, folder neighbours add nothing.
  if (real.length >= ENOUGH_REAL_EDGES) return real
  return [...real, ...siblings.slice(0, MAX_SIBLINGS)]
}

export const graphProvider: AnswerProvider = {
  id: 'core.graph',
  layer: 2,

  /**
   * What sits next to the document being read. Neighbours are frequently where
   * the answer to "why is it done this way here" actually lives — the design
   * note, the checkpoint, the meeting where it was decided.
   */
  async context(ctx: QueryContext): Promise<Evidence[]> {
    if (!ctx.activePath) return []
    const derived = await platform.graphNeighbors(ctx.workspaceId, ctx.activePath, 1)
    return merge(derived, typedNeighbors(ctx.activePath))
      .slice(0, 4)
      .map((node) => ({ path: node.path, title: node.title, reason: node.reason }))
  },

  async answer(ctx: QueryContext): Promise<Answer | null> {
    if (ctx.intent.kind !== 'relation') return null

    const term = ctx.intent.topic.replace(/^(?:the|a|an)\s+/i, '').trim()
    // "What's related to this?" means the document being read. Anything else
    // names a subject and has to be found.
    const refersToActive = !term || /^(?:this|it|here|current document)$/i.test(term)

    let origin: RelPath | null
    let matches: GraphNode[] = []

    if (refersToActive) {
      origin = ctx.activePath
    } else {
      matches = await platform.graphFind(ctx.workspaceId, term)
      // Do NOT fall back to the open document when a named subject is not
      // found. Answering "which documents reference the Merchant Council" with
      // the neighbours of whatever happens to be on screen is confidently
      // wrong, which is worse than declining — and declining lets the semantic
      // layer, which is built for exactly this, take the question instead.
      if (matches.length === 0) return null
      origin = matches[0]!.path
    }

    if (!origin) return null

    const derived = await platform.graphNeighbors(ctx.workspaceId, origin, 1)
    const nodes = merge(derived, typedNeighbors(origin)).slice(0, MAX_EVIDENCE)

    const originTitle = matches[0]?.title ?? stem(origin)

    if (nodes.length === 0) {
      return {
        layer: 2,
        text: `Nothing links to or from ${originTitle}.`,
        evidence: [{ path: origin, title: originTitle, reason: 'the document itself' }],
      }
    }

    const links = nodes.filter((n) => n.kind === 'link').length
    const backlinks = nodes.filter((n) => n.kind === 'backlink').length
    const parts = [
      backlinks > 0 && `${backlinks} document${backlinks === 1 ? '' : 's'} reference it`,
      links > 0 && `it links out to ${links}`,
    ].filter(Boolean)

    return {
      layer: 2,
      text: `${nodes.length} document${nodes.length === 1 ? '' : 's'} connected to ${originTitle}${
        parts.length > 0 ? ` — ${parts.join(', ')}` : ''
      }.`,
      evidence: [
        { path: origin, title: originTitle, reason: 'the subject' },
        ...nodes.map(toEvidence),
      ],
    }
  },
}
