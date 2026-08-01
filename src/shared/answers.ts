/**
 * The vocabulary of the layered answer system.
 *
 * One question box, five layers, tried cheapest-first. A layer that can answer
 * confidently stops the walk; a layer that cannot returns `null` and the router
 * moves on. The point is that a question like "where was I" costs a map lookup,
 * not a network round trip.
 *
 *   0  workspace state   session store            "where was I"
 *   1  rule-based        plugin-supplied data     "have I learned delegates"
 *   2  graph             derived link graph       "what references X"
 *   3  semantic          expanded lexical search  "the worker fatigue thing"
 *   4  handoff           layers 0-3 as retrieval  "explain why…"
 *
 * Layer 4 is where reasoning is required — and this app deliberately does not
 * do reasoning. It has no model, no API key and no network code. Instead it
 * assembles everything layers 0-3 found into a block you paste into whatever
 * assistant you already use.
 *
 * That is not a compromise, it is the better trade. Finding the right documents
 * is the part a local workspace can do and a chat window cannot; generating
 * prose is the part any assistant already does, better, on a subscription you
 * are already paying for. Layer 4 hands off at exactly that seam.
 *
 * Same rule as the rest of `src/shared`: no `node:*`, no DOM.
 */
import type { RelPath, WorkspaceId } from './types'

export type AnswerLayer = 0 | 1 | 2 | 3 | 4

/**
 * What the badge on an answer says. The user should never have to wonder how a
 * question got answered — that is the explainability half of the design, and it
 * is why every answer carries its layer rather than arriving anonymous.
 */
export const LAYER_LABELS: Record<AnswerLayer, string> = {
  0: 'Workspace state',
  1: 'Workspace data',
  2: 'Connections',
  3: 'Search',
  4: 'Assistant handoff',
}

/**
 * One piece of assembled context, ready to be pasted elsewhere.
 *
 * `path` is empty for facts with no file behind them — the curriculum position,
 * where the reader is — which are still worth sending along.
 */
export interface ContextItem {
  path: RelPath | ''
  title: string
  excerpt: string
}

// ── intent ────────────────────────────────────────────────────────────────

/**
 * Deterministic classification. No model decides which layer runs — a wrong
 * guess would be untraceable, and "why did that cost me an API call" is exactly
 * the question this architecture exists to never provoke.
 */
export type IntentKind = 'state' | 'lookup' | 'relation' | 'recall' | 'reasoning'

export interface Intent {
  kind: IntentKind
  /**
   * The user explicitly asked for reasoning ("explain", "compare", "teach").
   * Forces escalation to layer 4 even when a lower layer would have answered —
   * being handed a fact when you asked for an explanation is a worse failure
   * than spending a request.
   */
  wantsReasoning: boolean
  /** The subject of the question with the interrogative scaffolding removed. */
  topic: string
  /** The matched trigger, kept for the "why did this route here" affordance. */
  trigger: string | null
}

// ── answers ───────────────────────────────────────────────────────────────

export interface Evidence {
  path: RelPath
  title: string
  headingSlug?: string
  excerpt?: string
  /** Why this document is here: "links to Contracts", "matched 'fatigue'". */
  reason?: string
}

/** Offered as a button under the answer. `command` goes through the registry. */
export interface AnswerAction {
  label: string
  command: string
  args?: unknown[]
}

export interface Answer {
  layer: AnswerLayer
  /** Deterministic prose for layers 0-3; streamed model output for layer 4. */
  text: string
  /** Badge text. Defaults to `LAYER_LABELS[layer]`; layers may be more specific. */
  source?: string
  evidence: Evidence[]
  actions?: AnswerAction[]
}

export interface QueryContext {
  workspaceId: WorkspaceId
  /** The raw text the user typed, untouched. */
  query: string
  intent: Intent
  /** The document being read. Drives graph proximity and "this" references. */
  activePath: RelPath | null
  /**
   * The heading the reader is actually scrolled to, as a github-slugger slug.
   *
   * This is what resolves "this part" and "here" in a question. It comes from
   * the scroll registry, which already tracks it for restore — the information
   * exists, it just was not being used for anything but returning you to your
   * place.
   */
  activeHeading: string | null
}

/**
 * `null` means "not my question" and costs nothing — providers are expected to
 * decline most of what they see. It is not an error channel.
 */
export interface AnswerProvider {
  id: string
  layer: AnswerLayer
  answer(ctx: QueryContext): Promise<Answer | null>

  /**
   * What this provider knows that is relevant, REGARDLESS of whether it would
   * claim the question.
   *
   * Answering and retrieving are opposite jobs, and conflating them was a real
   * bug: `answer()` declines anything outside its intent, which is correct for
   * routing and exactly wrong for gathering context. Asking "why does this use
   * an interface here?" is a reasoning question, so every deterministic layer
   * declines to answer it — but the curriculum layer still knows which module
   * you are in, and that is precisely what the question needs.
   *
   * Only called when escalating to layer 4. Return facts, not answers.
   */
  context?(ctx: QueryContext): Promise<Evidence[]>
}
