/**
 * Query classification, by pattern matching and nothing else.
 *
 * This file decides which layer a question starts at, so it is deliberately the
 * dumbest possible thing that works: ordered lists of triggers, first match
 * wins, fully inspectable. A classifier you cannot read is a routing bug you
 * cannot diagnose.
 *
 * Order matters. `wantsReasoning` is checked FIRST because "explain what module
 * I'm in" is a request for an explanation, not a lookup — the reasoning verb
 * outranks the topic every time.
 */
import type { Intent, IntentKind } from '@shared/answers'

/**
 * Explicit asks for synthesis. Matching one of these escalates to layer 4 even
 * if a deterministic layer could have produced a fact, because the user asked
 * for something a fact does not satisfy.
 */
const REASONING: RegExp[] = [
  /\bexplain\b/,
  /\bwhy\b/,
  /\bcompare\b/,
  /\bcontrast\b/,
  /\bsummari[sz]e\b/,
  /\bsummary\b/,
  /\bteach\b/,
  /\breview\b/,
  /\bcritique\b/,
  /\bchallenge\b/,
  /\bcatch me up\b/,
  /\bcaught up\b/,
  /\bwalk me through\b/,
  /\bhelp me understand\b/,
  /\bwhat (?:patterns|gaps|themes)\b/,
  /\bstruggl/,
  /\bconnect .* (?:to|with|and)\b/,
]

/** Answerable from the session store alone. */
const STATE: RegExp[] = [
  /\bwhere was i\b/,
  /\bwhere did i (?:leave|stop|get to)\b/,
  /\bwhat was i (?:reading|doing|on)\b/,
  /\bresume\b/,
  /\bpick up where\b/,
  /\blast (?:opened |read )?(?:document|doc|file|note)\b/,
  /\bwhat(?:'s| is| are)? (?:currently )?open\b/,
  /\bopen tabs?\b/,
  /\brecent (?:documents|docs|files|notes)\b/,
  /\bwhat have i been reading\b/,
  /\bmy (?:streak|mission|goal)\b/,
  /\bhow long have i been\b/,
]

/**
 * Answerable from structured workspace data a plugin owns.
 *
 * These stay GENERIC on purpose. Words that name a particular kind of
 * structure — module, lesson, chapter, milestone — are a specific subject's
 * vocabulary and belong to the plugin that owns that data, not to the core
 * classifier. A plugin whose own trigger words appear in an otherwise
 * unclassified query claims it at layer 1 regardless of what this returns.
 */
const LOOKUP: RegExp[] = [
  /\bhave i (?:learned|done|covered|finished|completed)\b/,
  /\bdid i (?:learn|do|cover|finish|complete)\b/,
  /\bprerequisites?\b/,
  /\bprereqs?\b/,
  /\b(?:show|list) (?:completed|finished|done)\b/,
  /\bwhat(?:'s| is| should i work on)? next\b/,
  /\bnext (?:task|step)\b/,
  /\btoday'?s (?:task|work)\b/,
  /\bprogress\b/,

  /*
   * ORIENTATION — "don't let me get lost".
   *
   * These are the questions a reader asks about their own position rather than
   * about any document, and they are the ones most easily mistaken for a text
   * search: "where should I start" shares no useful word with its answer, so
   * left unclassified it matches documents containing "start" and confidently
   * points at the finish line. They belong to whatever owns the structure of
   * the workspace — a plugin usually, core's entry document otherwise.
   */
  /\bwhere (?:do|should|shall|can|would) i (?:start|begin)\b/,
  /\bwhere (?:do|should) i go\b/,
  /\bwhere (?:do i|to) (?:start|begin)\b/,
  /\bhow (?:do|should) i (?:start|begin)\b/,
  /\bwhat (?:do|should) i (?:do|study|read|learn|work on)\b/,
  /\bwhen (?:do|will|can) i (?:get to |be able to )?(?:learn|study|cover|reach|do|start|get)\b/,
  /\bhow (?:far|much|many|long)\b.*\b(?:am i|have i|is left|are left|to go|until|remaining)\b/,
  /\bhow (?:far|much) (?:am i|have i)\b/,
  /\bwhat(?:'s| is)? (?:left|remaining)\b/,
  /\bwhat (?:comes |is )?after\b/,
  /\bam i (?:on track|behind|ahead|nearly|almost)\b/,
  /\bhow much (?:more|further)\b/,
]

/** Answerable by walking links between documents. */
const RELATION: RegExp[] = [
  /\brelated to\b/,
  /\breferences?\b/,
  /\brefer(?:s|ring)? to\b/,
  /\bconnected (?:to|with)\b/,
  /\blinks? to\b/,
  /\blinked (?:to|from)\b/,
  /\bmentions?\b/,
  /\bwhat (?:uses|depends on)\b/,
  /\beverything (?:about|around|related)\b/,
  /\bwhich documents?\b/,
]

/** Scaffolding stripped when extracting the topic. Longest phrases first. */
const SCAFFOLD: RegExp[] = [
  /^(?:can you |could you |please )+/,
  // "me" is optional: people write both "show me everything about X" and
  // "show everything related to X", and leaving the second unstripped hands the
  // graph a phrase it can never match.
  /^(?:show|list|find|tell)(?:\s+me)?\s+(?:everything|anything|all)?\s*(?:about|related\s+to|connected\s+to|linked\s+to|on)?\s*/,
  /^(?:what|which) documents? (?:reference|mention|relate to|are related to|link to)\s+/,
  /^(?:what|which)(?:'s| is| are)?\s+(?:the\s+)?/,
  /^(?:have|did) i (?:learned?|done|covered|finished|completed)\s+/,
  /^(?:where|when|who|how)\s+(?:is|are|was|were|do|does|did)?\s*/,
  /^(?:explain|summari[sz]e|teach|review|critique|challenge|compare)\s+(?:me\s+)?(?:the\s+)?/,
  /^(?:everything|anything)\s+(?:about|related to|on)\s+/,
  /^(?:tell me about|about)\s+/,
  // Applied after the interrogative is gone, so "what's related to this"
  // reduces to "this" and the graph knows it means the open document.
  /^(?:related\s+to|connected\s+to|linked\s+to|referenced\s+by)\s+/,
  /\s*\?+\s*$/,
]

function matchFirst(patterns: RegExp[], text: string): string | null {
  for (const pattern of patterns) {
    const found = pattern.exec(text)
    if (found) return found[0]
  }
  return null
}

/**
 * Strip interrogative scaffolding so "which documents reference the Merchant
 * Council?" yields "merchant council" — the thing a graph or an index can
 * actually be asked about.
 */
export function extractTopic(query: string): string {
  let text = query.trim().toLowerCase()
  for (const pattern of SCAFFOLD) text = text.replace(pattern, '')
  return text.replace(/\s+/g, ' ').trim()
}

export function classify(query: string): Intent {
  const text = query.trim().toLowerCase()

  const reasoning = matchFirst(REASONING, text)
  if (reasoning) {
    return { kind: 'reasoning', wantsReasoning: true, topic: extractTopic(query), trigger: reasoning }
  }

  const ordered: Array<[IntentKind, RegExp[]]> = [
    ['state', STATE],
    ['lookup', LOOKUP],
    ['relation', RELATION],
  ]

  for (const [kind, patterns] of ordered) {
    const hit = matchFirst(patterns, text)
    if (hit) return { kind, wantsReasoning: false, topic: extractTopic(query), trigger: hit }
  }

  // Nothing recognised it. That is not a failure — it is the common case for
  // "the worker fatigue thing", which layer 3 exists to handle.
  return { kind: 'recall', wantsReasoning: false, topic: extractTopic(query), trigger: null }
}
