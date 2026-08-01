/**
 * Layer 0 — the user's own reading state.
 *
 * Every answer here comes out of the store that is already in memory: no IPC, no
 * index, no file read. "Where was I" should feel like the app remembering, not
 * like the app looking something up.
 *
 * There is deliberately no `workspace-state.json`. The data this layer reads —
 * open tabs, recents, per-tab scroll anchors, session dates — already lives in
 * `SessionState` under `userData`, which is where it belongs: scroll offsets are
 * machine state and have no business turning up in the user's git diff.
 */
import type { Answer, AnswerProvider, Evidence, QueryContext } from '@shared/answers'
import { joinRel, stem } from '@shared/paths'
import type { RelPath } from '@shared/types'
import { platform } from '../../platform'
import { store } from '../../store'
import { getAnchor } from '../../store/scrollRegistry'
import { computeStreak } from '../../store/sessionSync'

const OPEN_TABS = /\bopen tabs?\b|\bwhat(?:'s| is| are)? (?:currently )?open\b/
const RECENTS = /\brecent\b|\bwhat have i been reading\b/
const STREAK = /\bstreak\b|\bhow long have i been\b/
const MISSION = /\bmy (?:mission|goal)\b/

function titleOf(path: RelPath): string {
  return stem(path)
}

function evidenceFor(path: RelPath, reason: string): Evidence {
  return { path, title: titleOf(path), reason }
}

/** "about a third of the way in" beats "0.34" for something read aloud. */
function describePosition(ratio: number): string {
  if (ratio <= 0.02) return 'at the top'
  if (ratio >= 0.98) return 'at the end'
  return `about ${Math.round(ratio * 100)}% of the way through`
}

function answerOpenTabs(): Answer | null {
  const panes = store.get().panes
  const tabs = panes.flatMap((pane) => pane.tabs)
  if (tabs.length === 0) return null

  const active = store.get().activeTab()
  const names = tabs.map((tab) => titleOf(tab.path))

  return {
    layer: 0,
    text:
      tabs.length === 1
        ? `One document is open: ${names[0]}.`
        : `${tabs.length} documents are open: ${names.join(', ')}.`,
    evidence: tabs.map((tab) =>
      evidenceFor(tab.path, tab.id === active?.id ? 'currently active' : 'open in a tab'),
    ),
  }
}

function answerRecents(): Answer | null {
  const recents = store.get().recents.slice(0, 8)
  if (recents.length === 0) return null

  return {
    layer: 0,
    text: `Your last ${recents.length === 1 ? 'document was' : `${recents.length} documents were`} ${recents
      .map((r) => r.title || titleOf(r.path))
      .join(', ')}.`,
    evidence: recents.map((r) => ({
      path: r.path,
      title: r.title || titleOf(r.path),
      reason: 'opened recently',
    })),
  }
}

function answerStreak(): Answer | null {
  const dates = store.get().sessionDates
  if (dates.length === 0) return null

  const streak = computeStreak(dates)
  const total = dates.length
  return {
    layer: 0,
    text:
      streak > 0
        ? `You're on a ${streak}-day streak, across ${total} session${total === 1 ? '' : 's'} in total.`
        : `No active streak right now. You've had ${total} session${total === 1 ? '' : 's'} in total.`,
    evidence: [],
  }
}

function answerMission(): Answer | null {
  const settings = store.get().settings
  const mission = settings?.workspace.mission
  const goal = settings?.workspace.goal
  if (!mission && !goal) return null

  // Blank lines, not single newlines: answer text is rendered as Markdown, and
  // a lone newline collapses into the preceding paragraph.
  const lines = [mission && `Mission: ${mission}`, goal && `Goal: ${goal}`].filter(Boolean)
  return { layer: 0, text: lines.join('\n\n'), evidence: [] }
}

/** The headline question. Falls back through active tab → most recent document. */
function answerWhereWasI(): Answer | null {
  const state = store.get()
  const active = state.activeTab()

  if (active) {
    const anchor = getAnchor(active.id)
    const where = describePosition(anchor.ratio)
    return {
      layer: 0,
      text: `You're in ${titleOf(active.path)}, ${where}.`,
      evidence: [evidenceFor(active.path, 'the document you have open')],
      actions: [{ label: 'Go there', command: 'file.open', args: [active.path] }],
    }
  }

  const last = state.recents[0]
  if (!last) return null

  return {
    layer: 0,
    text: `Nothing is open. The last document you read was ${last.title || titleOf(last.path)}.`,
    evidence: [evidenceFor(last.path, 'most recently opened')],
    actions: [{ label: 'Resume', command: 'file.open', args: [last.path] }],
  }
}

/**
 * Recent daily notes.
 *
 * These are the highest-value context the workspace holds and the only record
 * of what actually went wrong: the curriculum says what you were meant to
 * learn, the logs say where you got stuck. Read-only, most recent first, and
 * they appear by name in the consent dialog like anything else.
 */
async function recentLogs(ctx: QueryContext, limit: number): Promise<Evidence[]> {
  const root = store.get().settings?.notes.root
  if (!root) return []

  try {
    const notes = await platform.listNotes(ctx.workspaceId, root)
    return notes
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
      .slice(0, limit)
      .map((note) => ({
        path: joinRel(root, note.name) as RelPath,
        title: stem(note.name),
        reason: 'a recent log',
      }))
  } catch {
    // No notes folder is the normal case for most workspaces.
    return []
  }
}

export const workspaceStateProvider: AnswerProvider = {
  id: 'core.state',
  layer: 0,

  /**
   * Standing facts about where the reader is, for layer 4. None of this is
   * conditional on the question being a "state" question — that guard belongs
   * to answering, not to retrieval.
   */
  async context(ctx: QueryContext): Promise<Evidence[]> {
    const state = store.get()
    const out: Evidence[] = []

    const active = state.activeTab()
    if (active) {
      const anchor = getAnchor(active.id)
      out.push({
        path: '' as RelPath,
        title: 'Where the reader is',
        excerpt: `Currently reading ${titleOf(active.path)} (${active.path}), ${describePosition(anchor.ratio)}.`,
        reason: 'session',
      })
    }

    const settings = state.settings
    if (settings?.workspace.mission || settings?.workspace.goal) {
      out.push({
        path: '' as RelPath,
        title: 'Mission and goal',
        excerpt: [
          settings.workspace.mission && `Mission: ${settings.workspace.mission}`,
          settings.workspace.goal && `Goal: ${settings.workspace.goal}`,
        ]
          .filter(Boolean)
          .join('\n'),
        reason: 'workspace settings',
      })
    }

    const recents = state.recents.slice(0, 6)
    if (recents.length > 0) {
      out.push({
        path: '' as RelPath,
        title: 'Recently opened',
        excerpt: recents.map((r) => r.title || titleOf(r.path)).join(', '),
        reason: 'session',
      })
    }

    // More logs for a catch-up, since reconstructing the gap IS the question.
    out.push(...(await recentLogs(ctx, ctx.intent.kind === 'reasoning' ? 5 : 2)))
    return out
  },

  async answer(ctx: QueryContext): Promise<Answer | null> {
    if (ctx.intent.kind !== 'state') return null
    const text = ctx.query.toLowerCase()

    // Ordered most-specific first: "recent documents" must not be swallowed by
    // the general "where was I" branch.
    if (OPEN_TABS.test(text)) return answerOpenTabs()
    if (RECENTS.test(text)) return answerRecents()
    if (STREAK.test(text)) return answerStreak()
    if (MISSION.test(text)) return answerMission()
    return answerWhereWasI()
  },
}
