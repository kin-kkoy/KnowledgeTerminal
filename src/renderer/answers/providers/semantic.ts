/**
 * Layer 3 — the last stop before reasoning.
 *
 * Everything above declined, so the question is loosely worded and the honest
 * response is "here is what this is probably about", not a confident sentence.
 * The wording of the answer says so: this layer RETRIEVES, it does not conclude.
 *
 * The actual matching lives behind `SemanticProvider`, so swapping the lexical
 * implementation for an embedding one touches this file's imports and nothing
 * else.
 */
import type { Answer, AnswerProvider, Evidence, QueryContext } from '@shared/answers'
import { lexicalSemanticProvider } from '../semantic/lexical'
import type { SemanticProvider } from '../semantic/provider'

let provider: SemanticProvider = lexicalSemanticProvider

/** Swap the implementation. The seam a local vector index would arrive through. */
export function setSemanticProvider(next: SemanticProvider): void {
  provider = next
}

export const semanticProvider: AnswerProvider = {
  id: 'core.semantic',
  layer: 3,

  /** The search hits, which are this layer's whole contribution either way. */
  async context(ctx: QueryContext): Promise<Evidence[]> {
    if (!provider.ready()) return []
    return (await provider.rank(ctx.query, ctx)).evidence
  },

  async answer(ctx: QueryContext): Promise<Answer | null> {
    if (!provider.ready()) return null

    const { evidence, missed, terms, bestMatched } = await provider.rank(ctx.query, ctx)
    if (evidence.length === 0) return null

    const best = evidence[0]!
    const quoted = (list: string[]): string => list.map((t) => `“${t}”`).join(' and ')

    /**
     * Say what was NOT found.
     *
     * Reporting only the half of a query that worked is how a search tool
     * quietly misleads: the reader assumes their phrase was found somewhere.
     * Two distinct failures are worth naming separately —
     *
     *   - a term in no document at all: the note may never have been written,
     *     or they are remembering a different word;
     *   - every term present, but never together: the two ideas exist in this
     *     workspace and were never connected, which is often the more
     *     interesting fact and is invisible in a plain ranked list.
     */
    let gap = ''
    if (missed.length > 0) {
      gap = `\n\nNothing here mentions ${quoted(missed)}.`
    } else if (terms.length > 1 && bestMatched < terms.length) {
      gap = `\n\nNo single document has all of ${quoted(terms)} — these match part of it.`
    }

    const found =
      evidence.length === 1
        ? `The closest match is ${best.title}.`
        : `${evidence.length} documents look related. The closest is ${best.title}.`

    return {
      layer: 3,
      text: found + gap,
      evidence,
      actions: [{ label: `Open ${best.title}`, command: 'file.open', args: [best.path] }],
    }
  },
}
