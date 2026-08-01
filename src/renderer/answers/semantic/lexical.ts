/**
 * Layer 3, lexically.
 *
 * The search box already answers "which files contain these words". This
 * answers the softer question — "it talked about dragon hunger somewhere" —
 * without an embedding model, by doing three things the plain search box does
 * not:
 *
 *   1. RELAXING. The index combines terms with AND, so a half-remembered
 *      phrase usually returns nothing at all. Here a query that finds nothing
 *      is retried term-by-term and the results merged, so documents matching
 *      more of the question rank higher. That single change is most of what
 *      makes vague questions work.
 *   2. EXPANDING. Each term also matches simple morphological variants, so
 *      "worker fatigue" reaches "workers" and "fatigued".
 *   3. RE-RANKING BY PROXIMITY. Documents linked to whatever you are currently
 *      reading are boosted, because the thing you half-remember is usually near
 *      the thing you are looking at.
 *
 * HONEST LIMITATION: this finds vocabulary you actually wrote. It will not
 * connect "burnout" to a document that only ever says "exhaustion" — that is
 * the specific failure embeddings fix, and the only reason to replace this.
 */
import type { Evidence, QueryContext } from '@shared/answers'
import type { RelPath, SearchHit } from '@shared/types'
import { platform } from '../../platform'
import { store } from '../../store'
import type { SemanticProvider, SemanticResult } from './provider'

const MAX_RESULTS = 6

/**
 * Proximity is a TIE-BREAKER, not evidence.
 *
 * At 1.6 it was deciding results outright: for "worker fatigue" it promoted a
 * checkpoint about worker *threads* over the one document that actually says
 * "fatigue", purely because the checkpoint was linked to the open file. Being
 * nearby is a hint about which of two equally good matches you meant — it is
 * not a reason to prefer a worse match.
 */
const NEIGHBOUR_BOOST = 1.15
const HEADING_BOOST = 1.25

/**
 * How far below the best hit a result may fall and still be shown.
 *
 * Without this the list is always exactly MAX_RESULTS long, so the tail is
 * whatever scored least rather than whatever is relevant — noise presented with
 * the same confidence as the answer.
 */
const RELEVANCE_FLOOR = 0.25

/** Question words and filler carry no retrieval signal. */
const STOPWORDS = new Set([
  'a', 'about', 'all', 'an', 'and', 'any', 'anything', 'are', 'around', 'as', 'at', 'be', 'been',
  'but', 'did', 'do', 'does', 'everything', 'find', 'for', 'from', 'get', 'go', 'had', 'has', 'have',
  'here', 'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'of', 'on', 'or', 'somewhere', 'that',
  'the', 'their', 'them', 'then', 'there', 'these', 'they', 'thing', 'this', 'those', 'to', 'up',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your',
])

/**
 * Words about the ACT of asking rather than the subject.
 *
 * "which documents discuss architecture" is a question about architecture;
 * letting "documents" and "discuss" score turns every meeting note into a hit,
 * because those words appear everywhere in a workspace about writing things
 * down.
 */
const META = new Set([
  'discuss', 'discussed', 'discusses', 'doc', 'docs', 'document', 'documents', 'file', 'files',
  'forgot', 'mention', 'mentioned', 'mentions', 'note', 'notes', 'recall', 'reference',
  'referenced', 'references', 'related', 'remember', 'said', 'somewhere', 'talked', 'talks',
  'wrote',
])

function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}#+_-]+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !META.has(t))
}

/**
 * Cheap morphological variants.
 *
 * Not a real stemmer on purpose: a stemmer conflates words the user chose
 * deliberately, and the index already does prefix matching, which covers most
 * of what a stemmer would buy here.
 */
function variants(term: string): string[] {
  const out = new Set([term])
  if (term.endsWith('ies')) out.add(`${term.slice(0, -3)}y`)
  if (term.endsWith('es')) out.add(term.slice(0, -2))
  if (term.endsWith('s')) out.add(term.slice(0, -1))
  else out.add(`${term}s`)
  if (term.endsWith('ing')) out.add(term.slice(0, -3))
  if (term.endsWith('ed')) out.add(term.slice(0, -2))
  return [...out].filter((t) => t.length > 2)
}

interface Scored {
  hit: SearchHit
  score: number
  matched: Set<string>
  neighbour: boolean
}

function looksLikeHeading(hit: SearchHit): boolean {
  return hit.matches.some((m) => /^#{1,6}\s/.test(m.text))
}

export const lexicalSemanticProvider: SemanticProvider = {
  id: 'lexical',
  ready: () => true,

  async rank(query: string, ctx: QueryContext): Promise<SemanticResult> {
    const words = terms(query)
    if (words.length === 0) return { evidence: [], missed: [], terms: [], bestMatched: 0 }

    const byPath = new Map<RelPath, Scored>()
    const absorb = (hits: SearchHit[], word: string, weight: number): void => {
      for (const hit of hits) {
        const existing = byPath.get(hit.path)
        if (existing) {
          existing.score += hit.score * weight
          existing.matched.add(word)
        } else {
          byPath.set(hit.path, {
            hit,
            score: hit.score * weight,
            matched: new Set([word]),
            neighbour: false,
          })
        }
      }
    }

    // The whole phrase first — when it does hit, it is the strongest signal.
    const whole = await platform.search(ctx.workspaceId, words.join(' '), { limit: MAX_RESULTS })
    absorb(whole.hits, words.join(' '), 2)

    /**
     * Then term by term, weighted by how RARE each term is.
     *
     * A term that matches three documents says far more about what you meant
     * than one matching thirty. Without this, "worker fatigue" is decided by
     * "worker" — common, and in this workspace mostly about worker *threads* —
     * while "fatigue", which appears in exactly one document and is obviously
     * the word being remembered, is drowned out.
     *
     * The rarity signal is free: it is the hit count of the search already being
     * run. Widening `limit` here is deliberate — a count capped at the display
     * limit cannot distinguish "matches 6 documents" from "matches sixty".
     */
    const COUNT_LIMIT = 60
    const corpus = Math.max(store.get().docs.length, 10)

    for (const word of words) {
      let rarity = 1
      for (const variant of variants(word)) {
        const result = await platform.search(ctx.workspaceId, variant, { limit: COUNT_LIMIT })
        if (variant === word) {
          /**
           * Inverse document frequency, the standard measure of how much a term
           * narrows things down. A word in 1 of 70 documents scores ~5; a word
           * in 23 of them scores ~2.
           *
           * A gentler curve was measurably not enough: it left "fatigue" (one
           * document) and "worker" (twenty-three) within a hair of each other,
           * so the result was decided by an unrelated proximity boost.
           */
          rarity = Math.log2(1 + corpus / (1 + result.hits.length))
        }
        absorb(result.hits.slice(0, MAX_RESULTS), word, (variant === word ? 1 : 0.6) * rarity)
      }
    }

    if (byPath.size === 0) return { evidence: [], missed: words, terms: words, bestMatched: 0 }

    // Proximity: what you half-remember is usually near what you are reading.
    if (ctx.activePath) {
      const neighbours = await platform.graphNeighbors(ctx.workspaceId, ctx.activePath, 1)
      for (const neighbour of neighbours) {
        const entry = byPath.get(neighbour.path)
        if (entry) {
          entry.score *= NEIGHBOUR_BOOST
          entry.neighbour = true
        }
      }
    }

    for (const entry of byPath.values()) {
      /**
       * COVERAGE DOMINATES. Matching more of the question matters far more than
       * matching one term hard — "worker fatigue" should not be won by a
       * document about worker *threads* purely because it says "worker" a lot.
       *
       * Squared, so missing half the terms costs three quarters of the score.
       * A gentler linear bonus was not enough to overcome the raw index score
       * of a document that repeats one term.
       */
      const coverage = entry.matched.size / words.length
      entry.score *= coverage * coverage
      if (looksLikeHeading(entry.hit)) entry.score *= HEADING_BOOST
    }

    const ranked = [...byPath.values()].sort((a, b) => b.score - a.score)
    const best = ranked[0]?.score ?? 0

    // Terms nothing contained. The caller reports these rather than hiding them.
    const found = new Set<string>()
    for (const entry of ranked) for (const word of entry.matched) found.add(word)
    const missed = words.filter((word) => !found.has(word))

    const evidence = ranked
      .filter((entry) => entry.score >= best * RELEVANCE_FLOOR)
      .slice(0, MAX_RESULTS)
      .map((entry): Evidence => {
        const matched = [...entry.matched].filter((m) => !m.includes(' '))
        const reasons = [
          matched.length > 0 && `matched ${matched.map((m) => `“${m}”`).join(', ')}`,
          entry.neighbour && 'linked to what you’re reading',
        ].filter(Boolean)

        const excerpt = entry.hit.matches[0]?.text
        return {
          path: entry.hit.path,
          title: entry.hit.title,
          reason: reasons.join(' · '),
          ...(excerpt ? { excerpt } : {}),
        }
      })

    /**
     * How much of the query the best document covered.
     *
     * Counts single words only. `matched` also holds the whole-phrase entry —
     * a key containing a space — and counting that as one term would understate
     * a document that matched the entire phrase, so a phrase hit is treated as
     * full coverage instead.
     */
    const coverageOf = (entry: Scored): number => {
      for (const key of entry.matched) if (key.includes(' ')) return words.length
      return entry.matched.size
    }
    const bestMatched = ranked.length > 0 ? Math.max(...ranked.map(coverageOf)) : 0

    return { evidence, missed, terms: words, bestMatched }
  },
}
