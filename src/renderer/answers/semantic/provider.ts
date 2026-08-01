/**
 * The seam for layer 3.
 *
 * Layer 3's job is RETRIEVAL — find the documents a loosely-worded question is
 * reaching for. How it does that is an implementation detail, and deliberately
 * a replaceable one.
 *
 * The shipped implementation (`lexical.ts`) uses the MiniSearch index that
 * already exists: zero new dependencies, zero resident memory, fully offline. A
 * genuine embedding model would slot in here unchanged — it would be a second
 * file implementing this interface plus one line in `providers/semantic.ts`.
 * That was deliberately NOT built first: on an 8GB machine a lazy-loaded ONNX
 * model costs 150-300MB whenever it is touched and ~90MB of package weight, and
 * it would be this project's only native dependency. The honest thing is to run
 * on the cheap implementation until a real query fails in a way only embeddings
 * can fix.
 *
 * `ready()` exists so a provider that needs to load something can say so
 * without blocking the router.
 */
import type { Evidence, QueryContext } from '@shared/answers'

export interface SemanticResult {
  evidence: Evidence[]
  /**
   * Query terms that appear in NO document.
   *
   * Reported rather than swallowed. "Nothing here mentions 'fatigue'" is a real
   * answer — it tells the reader their memory is wrong or the note was never
   * written, which silently ranking on the other half of the query does not.
   */
  missed: string[]
  /** The query terms actually searched on, after stopwords are dropped. */
  terms: string[]
  /**
   * How many terms the BEST document matched.
   *
   * When this is below `terms.length` no single document contains the whole
   * phrase — the results match a word each, which is a materially different
   * finding from "here is your document" and has to be said out loud.
   */
  bestMatched: number
}

export interface SemanticProvider {
  id: string
  ready(): boolean
  rank(query: string, ctx: QueryContext): Promise<SemanticResult>
}
