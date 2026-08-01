/**
 * Layer 4 — hand off to whatever assistant you already use.
 *
 * This app does not reason. It has no model, no API key, no network code, and
 * that is deliberate: the half a local workspace is uniquely good at is knowing
 * WHICH documents matter, and the half a chat window is already good at is
 * explaining things. Calling an API from here would have meant paying per token
 * for a worse version of a subscription you already have — so layer 4 does the
 * retrieval and hands you the result instead.
 *
 * It runs exactly the same gathering a model path would have: the section on
 * screen, the curriculum position, recent logs, graph neighbours, search hits.
 * The output is a Markdown block on your clipboard.
 */
import type { Answer, AnswerProvider, ContextItem, Evidence, QueryContext } from '@shared/answers'
import { stem } from '@shared/paths'
import type { RelPath } from '@shared/types'
import { platform } from '../../platform'
import { store } from '../../store'
import { sectionForSlug } from '../section'
import { graphProvider } from './graph'
import { semanticProvider } from './semantic'
import { workspaceStateProvider } from './state'

/**
 * Documents are what cost you paste length; facts are a line or two each and
 * are counted separately, so a handful of cheap facts can never crowd out the
 * documents the question is actually about.
 */
const MAX_CONTEXT_DOCS = 8
const MAX_CONTEXT_FACTS = 8

/**
 * Total size of the assembled block, in characters (~10k tokens).
 *
 * A count-based cap alone is not enough: eight documents can still be 58KB if
 * some of them are long, which is more than several chat UIs will accept in one
 * paste. Because evidence arrives in priority order — what is on screen, then
 * curriculum position, then neighbours, then search hits — filling until the
 * budget runs out drops the least relevant material rather than the most.
 */
const MAX_TOTAL_CHARS = 40_000

/**
 * A long document is mostly irrelevant to a question about one section of it,
 * and including both the section and its parent doubles the paste for no gain.
 * Below this size the whole thing is cheap enough that the surrounding context
 * is worth having.
 */
const WHOLE_DOCUMENT_LIMIT = 8000

/**
 * What the reader is looking at, right now.
 *
 * Deliberately first and deliberately unconditional. The open document must not
 * depend on winning a keyword search against its own contents — otherwise "why
 * is this done this way here?" arrives with no *here* at all. The section comes
 * from the scroll anchor, so "this part" resolves to the part on screen.
 */
async function whatIsOnScreen(ctx: QueryContext): Promise<Evidence[]> {
  if (!ctx.activePath) return []

  const title = stem(ctx.activePath)
  try {
    const file = await platform.readTextFile(ctx.workspaceId, ctx.activePath)

    if (ctx.activeHeading && file.content.length > WHOLE_DOCUMENT_LIMIT) {
      const section = sectionForSlug(file.content, ctx.activeHeading)
      if (section) {
        return [
          {
            path: ctx.activePath,
            title: `${title} — ${section.heading}`,
            excerpt: section.text,
            reason: 'the section on screen',
          },
        ]
      }
    }

    return [{ path: ctx.activePath, title, excerpt: file.content, reason: 'the open document' }]
  } catch {
    return []
  }
}

/**
 * Gather from every layer — this is retrieval, not routing, so nothing "wins"
 * and nothing declines on grounds of intent.
 *
 * Providers contribute through `context()` rather than `answer()`. The two are
 * opposite jobs: `answer()` exists to decline anything outside its intent,
 * which is right for routing and precisely wrong here.
 */
async function retrieve(ctx: QueryContext): Promise<Evidence[]> {
  // Sorted by layer, so the cheapest and most specific knowledge is gathered
  // first: a plugin's "you are on Module 02, Day 3" (layer 1) matters more than
  // the tenth keyword match (layer 3), and must not be squeezed out by it.
  const providers: AnswerProvider[] = [
    workspaceStateProvider,
    graphProvider,
    semanticProvider,
    ...Object.values(store.get().answerProviders),
  ].sort((a, b) => a.layer - b.layer)

  const evidence: Evidence[] = await whatIsOnScreen(ctx)

  for (const provider of providers) {
    if (!provider.context) continue
    try {
      evidence.push(...(await provider.context(ctx)))
    } catch {
      // A provider that fails costs us context, not the handoff.
    }
  }

  const seen = new Set<string>()
  return evidence.filter((item) => {
    const key = `${item.path}#${item.title}`
    if (seen.has(key) || (!item.path && !item.excerpt)) return false
    seen.add(key)
    return true
  })
}

/**
 * Read the real documents so the block carries text, not just titles.
 *
 * An excerpt already on the evidence is AUTHORITATIVE and is never replaced by
 * a re-read: that is how the extracted section survives. Re-reading here would
 * silently swap the section the reader is looking at for the whole file.
 */
async function loadExcerpts(ctx: QueryContext, evidence: Evidence[]): Promise<ContextItem[]> {
  const items: ContextItem[] = []
  const seen = new Set<string>()
  let documents = 0
  let facts = 0
  let chars = 0

  /**
   * Facts are a line or two and always fit; documents spend the budget.
   *
   * A document that would overshoot is SKIPPED rather than truncated — half a
   * module document is worse than none, because the reader cannot tell which
   * half the assistant saw. The first document is always taken, whatever its
   * size: that is the one on screen, and a block without it is pointless.
   */
  const take = (item: ContextItem): boolean => {
    const isDocument = item.path !== ''
    if (isDocument && documents > 0 && chars + item.excerpt.length > MAX_TOTAL_CHARS) return false
    items.push(item)
    chars += item.excerpt.length
    if (isDocument) documents++
    return true
  }

  for (const item of evidence) {
    const key = `${item.path}#${item.title}`
    if (seen.has(key)) continue
    seen.add(key)

    if (item.path) {
      if (documents >= MAX_CONTEXT_DOCS || chars >= MAX_TOTAL_CHARS) continue
    } else {
      if (facts >= MAX_CONTEXT_FACTS) continue
      facts++
    }

    if (item.excerpt) {
      take({ path: item.path, title: item.title, excerpt: item.excerpt })
      continue
    }
    if (!item.path) continue

    try {
      const file = await platform.readTextFile(ctx.workspaceId, item.path)
      take({ path: item.path, title: item.title, excerpt: file.content })
    } catch {
      /* a file that vanished between retrieval and read is simply skipped */
    }
  }

  return items
}

/**
 * The block that lands on the clipboard.
 *
 * Written to be pasted into a chat window and understood without preamble: the
 * question first, then what the workspace knows, then the documents fenced by
 * path. The grounding instruction is the same one that would have gone into a
 * system prompt — the notes are authoritative, and anything beyond them has to
 * announce itself.
 */
export function formatHandoff(question: string, context: ContextItem[]): string {
  const facts = context.filter((item) => !item.path)
  const documents = context.filter((item) => item.path)

  const parts: string[] = [
    'I keep my study notes in a local Markdown workspace. Below is my question, followed by the',
    'relevant context pulled from my own notes.',
    '',
    'Treat these notes as authoritative — prefer them over your own knowledge, and cite them by',
    'title as you use them. If you need to go beyond what they say, tell me explicitly that you',
    'are doing so before you do.',
    '',
    '## Question',
    '',
    question,
    '',
  ]

  if (facts.length > 0) {
    parts.push('## Where I am', '')
    for (const fact of facts) parts.push(`**${fact.title}.** ${fact.excerpt}`, '')
  }

  for (const doc of documents) {
    parts.push(`## ${doc.title}`, '', `\`${doc.path}\``, '', doc.excerpt.trim(), '')
  }

  return parts.join('\n')
}

/** Rough, and labelled as rough wherever it is shown. ~4 characters per token. */
function estimateTokens(chars: number): string {
  const tokens = Math.round(chars / 4)
  return tokens > 1000 ? `~${(tokens / 1000).toFixed(1)}k` : `~${tokens}`
}

export const handoffProvider: AnswerProvider = {
  id: 'core.handoff',
  layer: 4,

  async answer(ctx: QueryContext): Promise<Answer | null> {
    const context = await loadExcerpts(ctx, await retrieve(ctx))
    if (context.length === 0) return null

    const block = formatHandoff(ctx.query, context)
    const documents = context.filter((item) => item.path)
    const facts = context.length - documents.length

    const counted = [
      documents.length > 0 && `${documents.length} document${documents.length === 1 ? '' : 's'}`,
      facts > 0 && `${facts} note${facts === 1 ? '' : 's'} about where you are`,
    ]
      .filter(Boolean)
      .join(' and ')

    return {
      layer: 4,
      source: 'Assistant handoff',
      text: `That needs reasoning, which happens outside this app.\n\nI've gathered ${counted} — ${estimateTokens(block.length)} tokens. Copy it, then paste it into your assistant.`,
      actions: [{ label: 'Copy context', command: 'ask.copyContext', args: [block] }],
      evidence: documents.map((item) => ({
        path: item.path as RelPath,
        title: item.title,
        reason: 'included in the copy',
      })),
    }
  },
}
