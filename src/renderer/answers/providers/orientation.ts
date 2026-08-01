/**
 * Layer 1, core — "where do I start?" for a workspace with no plugin.
 *
 * A plugin that knows the structure of the workspace answers this far better,
 * and the router consults plugins first within a layer for exactly that reason.
 * This is the floor: every workspace can name an entry document, and pointing
 * at it beats falling through to text search, which matches documents
 * containing the word "start" and confidently offers the last one.
 *
 * Subject-agnostic by construction — it knows about `entryDocument`, `mission`
 * and `goal`, which are core settings, and about nothing else.
 */
import type { Answer, AnswerProvider, QueryContext } from '@shared/answers'
import { stem } from '@shared/paths'
import type { RelPath } from '@shared/types'
import { store } from '../../store'

const START = /\b(?:where|how) (?:do|should|shall|can|would) i (?:start|begin)\b|\bwhere (?:do i|to) (?:start|begin)\b|\bwhere (?:do|should) i go\b|\bwhat (?:do|should) i (?:do|read|study)\b/

export const orientationProvider: AnswerProvider = {
  id: 'core.orientation',
  layer: 1,

  async answer(ctx: QueryContext): Promise<Answer | null> {
    if (ctx.intent.kind !== 'lookup' || !START.test(ctx.query.toLowerCase())) return null

    const settings = store.get().settings
    const entry = settings?.workspace.entryDocument
    if (!entry) return null

    const lines = [
      `Start with ${stem(entry)} — it's set as this workspace's entry document.`,
      settings?.workspace.mission ? `Today: ${settings.workspace.mission}` : null,
    ].filter(Boolean)

    return {
      layer: 1,
      source: 'Workspace',
      text: lines.join('\n\n'),
      evidence: [{ path: entry as RelPath, title: stem(entry), reason: 'the entry document' }],
      actions: [{ label: `Open ${stem(entry)}`, command: 'file.open', args: [entry] }],
    }
  },
}
