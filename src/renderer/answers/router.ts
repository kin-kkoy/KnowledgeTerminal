/**
 * The router: walk the layers cheapest-first, stop at the first real answer.
 *
 * The whole architecture is this function. Everything else is a provider that
 * either recognises a question or declines it. Two rules keep it honest:
 *
 *   1. Ascending layer order, always. A layer never runs if a cheaper one
 *      already answered — that is what makes "where was I" free.
 *   2. A provider that throws is SKIPPED, not fatal. A broken plugin must not
 *      be able to take the question box down with it, same containment posture
 *      as `pluginSlice.runCommand`.
 *
 * `wantsReasoning` is the one documented override: it lets the walk run past
 * layers that could have answered, because being handed a fact when you asked
 * for an explanation is the worse failure.
 */
import type { Answer, AnswerLayer, AnswerProvider, QueryContext } from '@shared/answers'
import { store } from '../store'
import { getAnchor } from '../store/scrollRegistry'
import { classify } from './intent'
import { graphProvider } from './providers/graph'
import { orientationProvider } from './providers/orientation'
import { semanticProvider } from './providers/semantic'
import { workspaceStateProvider } from './providers/state'
import { handoffProvider } from './providers/handoff'

export interface RoutedAnswer {
  answer: Answer | null
  /** Which layers were consulted, for the "how was this answered" affordance. */
  tried: AnswerLayer[]
  context: QueryContext | null
}

/**
 * Core providers, in no particular order — the router sorts by layer. Later
 * phases add the graph, semantic and teaching-assistant providers here; plugin
 * providers are merged in below and are the only way subject-specific knowledge
 * enters the walk.
 */
const CORE_PROVIDERS: AnswerProvider[] = [
  workspaceStateProvider,
  orientationProvider,
  graphProvider,
  semanticProvider,
  handoffProvider,
]

function collectProviders(): AnswerProvider[] {
  const plugins = Object.values(store.get().answerProviders)
  /**
   * Within a layer, SPECIFIC beats GENERIC — so plugins are consulted first.
   *
   * A plugin registering at a layer core already occupies is asserting it knows
   * something more particular about this workspace. "Where should I start?" has
   * a generic core answer (open the entry document) and a much better one from a
   * curriculum plugin (module 2, day 3, four tasks left). The sort is stable, so
   * listing plugins first is the whole mechanism.
   */
  return [...plugins, ...CORE_PROVIDERS].sort((a, b) => a.layer - b.layer)
}

export async function route(query: string): Promise<RoutedAnswer> {
  const state = store.get()
  const workspaceId = state.workspace?.id
  if (!workspaceId || !query.trim()) return { answer: null, tried: [], context: null }

  // The scroll registry already knows which heading the reader is parked on,
  // for restore. Reusing it is what lets "this part" mean something.
  const tab = state.activeTab()

  const ctx: QueryContext = {
    workspaceId,
    query: query.trim(),
    intent: classify(query),
    activePath: tab?.path ?? null,
    activeHeading: tab ? getAnchor(tab.id).headingSlug : null,
  }

  const tried: AnswerLayer[] = []

  for (const provider of collectProviders()) {
    // An explicit ask for reasoning skips straight past the deterministic
    // layers. They still run — as retrieval for layer 4 — but they do not get
    // to answer on their own.
    if (ctx.intent.wantsReasoning && provider.layer < 4) continue

    tried.push(provider.layer)
    try {
      const answer = await provider.answer(ctx)
      if (answer) return { answer, tried, context: ctx }
    } catch (err) {
      store.get().pushNotice({
        level: 'warn',
        message: `Answer provider "${provider.id}" failed`,
        detail: String(err),
      })
    }
  }

  return { answer: null, tried, context: ctx }
}
