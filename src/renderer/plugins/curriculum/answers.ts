/**
 * Layer 1 — deterministic answers from the curriculum data.
 *
 * "Have I learned delegates" is a set membership test. "Which module introduces
 * LINQ" is a lookup. Neither needs a model, an index, or a network, and neither
 * should ever be slower than a keystroke.
 *
 * Everything subject-specific about these questions lives here, in the plugin.
 * The core router knows only that something registered at layer 1 and that it
 * returned an `Answer` — it has no idea what a module is.
 */
import type { Answer, AnswerProvider, Evidence, QueryContext } from '@shared/answers'
import type { RelPath } from '@shared/types'
import {
  chaptersOf,
  completionOf,
  currentChapter,
  currentDay,
  type Curriculum,
  type CurriculumNode,
  type Progress,
} from './model'
import { getState } from './store'

/**
 * Curriculum-flavoured scaffolding the core classifier does not strip, because
 * the core classifier has no business knowing these words.
 */
const SUBJECT_NOISE =
  /^(?:module|lesson|chapter|topic|section)s?\s+(?:that\s+)?(?:introduces?|covers?|teaches?|contains?|has|includes?|for|of|about)?\s*/

/** Left over from "when do I get to learn X" once core has stripped "when do". */
const VERB_NOISE = /^(?:i\s+)?(?:get\s+to\s+|be\s+able\s+to\s+|will\s+|can\s+)*(?:learn|study|cover|reach|do|start|get)\s+(?:about\s+)?/

const HAVE_I = /\b(?:have|did) i (?:learned?|done|covered|finished|completed)\b/
const WHICH_MODULE = /\b(?:which|what) (?:module|lesson|chapter)\b/
const PREREQS = /\bprerequisites?\b|\bprereqs?\b/
const COMPLETED = /\b(?:show|list) (?:completed|finished|done)\b|\bcompleted (?:topics|modules|chapters)\b/
const WHERE_AM_I = /\b(?:what|which) module am i\b|\bam i (?:in|on)\b|\bcurrent (?:module|milestone|chapter)\b/
const NEXT = /\bnext\b|\bwhat should i work on\b|\btoday'?s\b/

/* ── orientation: "don't let me get lost" ─────────────────────────────────── */

const START = /\b(?:where|how) (?:do|should|shall|can|would) i (?:start|begin)\b|\bwhere (?:do i|to) (?:start|begin)\b|\bwhere (?:do|should) i go\b/
const WHEN_LEARN = /\bwhen (?:do|will|can) i\b/
const HOW_FAR = /\bhow (?:far|much|many|long)\b|\bwhat(?:'s| is)? (?:left|remaining)\b|\bam i (?:on track|behind|ahead|nearly|almost)\b/
const AFTER = /\b(?:what|which) (?:comes |is )?after\b/

/**
 * This plugin's OWN vocabulary.
 *
 * The core classifier deliberately does not know these words, so a question
 * shaped around them arrives unclassified. Recognising them here is what keeps
 * "which module introduces LINQ" answerable without core learning that modules
 * exist.
 */
const OWN_VOCABULARY = /\b(?:module|lesson|chapter|milestone|checkpoint|curriculum)s?\b/

function subjectOf(topic: string): string {
  return topic
    .replace(SUBJECT_NOISE, '')
    .replace(VERB_NOISE, '')
    .replace(/[?.!]+$/, '')
    .trim()
}

/** The ordered spine a chapter belongs to, and where it sits on it. */
function placeOf(
  curriculum: Curriculum,
  chapter: CurriculumNode,
): { spine: CurriculumNode[]; index: number } {
  const spine = chaptersOf(curriculum, chapter.branch)
  return { spine, index: spine.findIndex((c) => c.id === chapter.id) }
}

function openAction(chapter: CurriculumNode): Answer['actions'] {
  return chapter.doc
    ? [{ label: `Open ${chapter.label}`, command: 'file.open', args: [chapter.doc] }]
    : undefined
}

/** Normalised for comparison: lowercase, punctuation and separators flattened. */
function norm(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+#]+/g, ' ').trim()
}

/** Every contiguous run of words in a phrase, longest first. */
function grams(needle: string): string[] {
  const words = needle.split(' ').filter(Boolean)
  const out: string[] = []
  for (let len = words.length; len >= 1; len--) {
    for (let i = 0; i + len <= words.length; i++) out.push(words.slice(i, i + len).join(' '))
  }
  return out
}

/**
 * Best node for a phrase.
 *
 * Matching is done against every contiguous run of words rather than the whole
 * phrase, because the leftover scaffolding varies too much to strip reliably —
 * "what prerequisites does Generics have" reduces to a subject only if
 * "generics" alone is allowed to match "Generics & constraints".
 *
 * Longer runs outrank shorter ones so "async streams" is not shadowed by
 * "async", and a label that STARTS with the run outranks one that merely
 * contains it, which is what picks "Generics & constraints" over
 * "Collections & Generics".
 */
function findNode(curriculum: Curriculum, phrase: string): CurriculumNode | null {
  const needle = norm(phrase)
  if (!needle) return null

  const candidates = grams(needle)
  let best: CurriculumNode | null = null
  let bestScore = 0

  for (const node of curriculum.byId.values()) {
    const label = norm(node.label)
    if (!label) continue

    /**
     * Every run is scored and the BEST kept.
     *
     * Stopping at the first run that matched was wrong: runs are tried longest
     * first, so a weak whole-phrase match ("comes after oop" loosely containing
     * a short label) preempted the exact match on "oop" later in the list.
     */
    let nodeScore = 0
    for (const gram of candidates) {
      // One-word runs must be substantial; "of" matching a label is noise.
      const words = gram.split(' ').length
      if (words === 1 && gram.length < 3) continue

      /**
       * Containment is checked on WORD boundaries, by padding both sides.
       * A plain `includes` made "oop" match "Game **loop** & delta time", which
       * is how "what comes after OOP" ended up pointing at a game module.
       */
      const paddedLabel = ` ${label} `
      const paddedGram = ` ${gram} `

      let score = 0
      if (label === gram) score = 1000
      else if (norm(node.id) === gram) score = 900
      else if (label.startsWith(`${gram} `)) score = 600
      else if (paddedLabel.includes(paddedGram)) score = 400
      else if (paddedGram.includes(paddedLabel) && label.length >= 3) score = 300
      if (score === 0) continue

      // More words matched is a stronger signal. On a tie, the SHORTER label
      // wins: "async" should land on "Async / Await", not "Async gotchas".
      score += words * 20 - Math.min(label.length, 40) / 10
      if (score > nodeScore) nodeScore = score
    }

    if (nodeScore > bestScore) {
      bestScore = nodeScore
      best = node
    }
  }

  return best
}

/** The chapter a node sits under, for nodes that are topics rather than chapters. */
function chapterFor(curriculum: Curriculum, node: CurriculumNode): CurriculumNode | null {
  if (node.kind === 'chapter') return node
  for (const candidate of curriculum.nodes) {
    if (candidate.topics.some((t) => t.id === node.id)) return candidate
  }
  return null
}

function docEvidence(node: CurriculumNode | null, reason: string): Evidence[] {
  if (!node?.doc) return []
  return [{ path: node.doc as RelPath, title: node.label, reason }]
}

/** A node counts as learned if it, or the chapter containing it, is complete. */
function isDone(curriculum: Curriculum, progress: Progress, node: CurriculumNode): boolean {
  if (progress.done.includes(node.id)) return true
  const chapter = chapterFor(curriculum, node)
  return chapter ? progress.done.includes(chapter.id) : false
}

// ── question shapes ───────────────────────────────────────────────────────

function answerHaveILearned(
  curriculum: Curriculum,
  progress: Progress,
  subject: string,
): Answer | null {
  const node = findNode(curriculum, subject)
  if (!node) {
    return {
      layer: 1,
      source: 'Curriculum',
      text: `“${subject}” isn’t a topic in ${curriculum.title}.`,
      evidence: [],
    }
  }

  const chapter = chapterFor(curriculum, node)
  const done = isDone(curriculum, progress, node)
  const where = chapter && chapter.id !== node.id ? ` It sits in ${chapter.label}.` : ''

  return {
    layer: 1,
    source: 'Curriculum',
    text: done
      ? `Yes — ${node.label} is marked complete.${where}`
      : `Not yet. ${node.label} is still open.${where}`,
    evidence: docEvidence(node.doc ? node : chapter, done ? 'covered here' : 'where it is covered'),
    ...(node.doc || chapter?.doc
      ? {
          actions: [
            {
              label: 'Open it',
              command: 'file.open',
              args: [node.doc ?? chapter?.doc],
            },
          ],
        }
      : {}),
  }
}

function answerWhichModule(curriculum: Curriculum, subject: string): Answer | null {
  const node = findNode(curriculum, subject)
  if (!node) return null

  const chapter = chapterFor(curriculum, node)
  if (!chapter) {
    return {
      layer: 1,
      source: 'Curriculum',
      text: `${node.label} is not attached to a module.`,
      evidence: docEvidence(node, 'the topic itself'),
    }
  }

  return {
    layer: 1,
    source: 'Curriculum',
    text:
      chapter.id === node.id
        ? `${chapter.label} is a module in its own right.`
        : `${node.label} is introduced in ${chapter.label}.`,
    evidence: docEvidence(chapter, 'the module document'),
    ...(chapter.doc
      ? { actions: [{ label: `Open ${chapter.label}`, command: 'file.open', args: [chapter.doc] }] }
      : {}),
  }
}

function answerPrereqs(curriculum: Curriculum, subject: string): Answer | null {
  const node = findNode(curriculum, subject)
  if (!node) return null

  if (node.prereqs.length === 0) {
    return {
      layer: 1,
      source: 'Curriculum',
      text: `${node.label} has no listed prerequisites.`,
      evidence: docEvidence(node, 'the topic'),
    }
  }

  const prereqs = node.prereqs.map((id) => curriculum.byId.get(id)).filter((n): n is CurriculumNode => !!n)
  const labels = prereqs.map((p) => p.label)

  return {
    layer: 1,
    source: 'Curriculum',
    text: `${node.label} depends on ${labels.join(', ')}.`,
    evidence: prereqs.flatMap((p) => docEvidence(p, 'prerequisite')),
  }
}

function answerCompleted(curriculum: Curriculum, progress: Progress): Answer | null {
  const done = curriculum.nodes.filter((n) => progress.done.includes(n.id))
  if (done.length === 0) {
    return {
      layer: 1,
      source: 'Curriculum',
      text: 'Nothing is marked complete yet.',
      evidence: [],
    }
  }

  return {
    layer: 1,
    source: 'Curriculum',
    text: `${done.length} complete: ${done.map((n) => n.label).join(', ')}.`,
    evidence: done.flatMap((n) => docEvidence(n, 'completed')),
  }
}

function answerWhereAmI(curriculum: Curriculum, progress: Progress): Answer | null {
  const chapter = currentChapter(curriculum, progress)
  if (!chapter) return null

  const day = currentDay(getState().days)
  const core = completionOf(curriculum, progress, 'core')
  const dayLine = day ? ` You're on Day ${day.number}${day.title ? ` — ${day.title}` : ''}.` : ''

  return {
    layer: 1,
    source: 'Curriculum',
    text: `${chapter.label}.${dayLine} ${core.done} of ${core.total} core modules done.`,
    evidence: docEvidence(chapter, 'the current module'),
    ...(chapter.doc
      ? { actions: [{ label: 'Open it', command: 'file.open', args: [chapter.doc] }] }
      : {}),
  }
}

function answerNext(curriculum: Curriculum, progress: Progress): Answer | null {
  const chapter = currentChapter(curriculum, progress)
  if (!chapter) return null

  const day = currentDay(getState().days)
  const remaining = day ? day.total - day.done : 0
  const chapters = chaptersOf(curriculum, 'core')
  const index = chapters.findIndex((c) => c.id === chapter.id)
  const upcoming = chapters[index + 1]

  const lines = [
    day && remaining > 0
      ? `Finish Day ${day.number}${day.title ? ` — ${day.title}` : ''}: ${remaining} task${remaining === 1 ? '' : 's'} left.`
      : `Continue ${chapter.label}.`,
    chapter.checkpoint ? `Its gate is ${chapter.checkpoint}.` : null,
    upcoming ? `After that: ${upcoming.label}.` : null,
  ].filter(Boolean)

  return {
    layer: 1,
    source: 'Curriculum',
    // Blank lines, not single newlines: answer text renders as Markdown.
    text: lines.join('\n\n'),
    evidence: docEvidence(chapter, 'the current module'),
    ...(chapter.doc
      ? { actions: [{ label: 'Open it', command: 'file.open', args: [chapter.doc] }] }
      : {}),
  }
}

// ── orientation ───────────────────────────────────────────────────────────

/**
 * "Where should I start?"
 *
 * The question that used to fail worst: with no distinctive words of its own it
 * fell through to text search and matched documents containing "start", which
 * in a curriculum means the capstone — pointing a beginner at the finish line.
 * It is really a question about position, and position is known exactly.
 */
function answerWhereToStart(curriculum: Curriculum, progress: Progress): Answer | null {
  const chapter = currentChapter(curriculum, progress)
  if (!chapter) return null

  const { spine, index } = placeOf(curriculum, chapter)
  const day = currentDay(getState().days)
  const untouched = progress.done.length === 0 && index <= 0

  const lines = [
    untouched
      ? `Start at the beginning: ${chapter.label}.`
      : `Pick up at ${chapter.label} — module ${index + 1} of ${spine.length}.`,
    day
      ? `You're on Day ${day.number}${day.title ? ` — ${day.title}` : ''}, with ${day.total - day.done} of ${day.total} task${day.total === 1 ? '' : 's'} left.`
      : null,
    chapter.checkpoint ? `The gate for this module is ${chapter.checkpoint}.` : null,
  ].filter(Boolean)

  return {
    layer: 1,
    source: 'Curriculum',
    text: lines.join('\n\n'),
    evidence: docEvidence(chapter, 'where to start'),
    ...(openAction(chapter) ? { actions: openAction(chapter) } : {}),
  }
}

/** "When do I get to learn X?" — distance, not just location. */
function answerWhenLearn(
  curriculum: Curriculum,
  progress: Progress,
  subject: string,
): Answer | null {
  const node = findNode(curriculum, subject)
  if (!node) {
    return {
      layer: 1,
      source: 'Curriculum',
      text: `“${subject}” isn’t anywhere in ${curriculum.title}.`,
      evidence: [],
    }
  }

  const chapter = chapterFor(curriculum, node) ?? node
  const current = currentChapter(curriculum, progress)
  const { spine, index } = placeOf(curriculum, chapter)
  const branch = curriculum.branches.find((b) => b.key === chapter.branch)

  const where =
    index >= 0
      ? `${chapter.label} — module ${index + 1} of ${spine.length}${branch && branch.key !== 'core' ? ` on the ${branch.label} track` : ''}`
      : chapter.label

  if (isDone(curriculum, progress, node)) {
    return {
      layer: 1,
      source: 'Curriculum',
      text: `Already covered — ${node.label} is in ${where}, which you've finished.`,
      evidence: docEvidence(chapter, 'covered here'),
      ...(openAction(chapter) ? { actions: openAction(chapter) } : {}),
    }
  }

  const here = current ? placeOf(curriculum, current) : null
  const sameSpine = here && current && current.branch === chapter.branch
  const gap = sameSpine && here.index >= 0 && index >= 0 ? index - here.index : null

  const distance =
    gap === null
      ? `It sits in ${where}.`
      : gap <= 0
        ? `That's where you are now — ${where}.`
        : gap === 1
          ? `It's next after your current module: ${where}.`
          : `${gap} modules from where you are now: ${where}.`

  const prereqs = node.prereqs
    .map((id) => curriculum.byId.get(id))
    .filter((n): n is CurriculumNode => !!n)
    .filter((n) => !isDone(curriculum, progress, n))

  const lines = [
    distance,
    prereqs.length > 0 ? `Still to do first: ${prereqs.map((p) => p.label).join(', ')}.` : null,
  ].filter(Boolean)

  return {
    layer: 1,
    source: 'Curriculum',
    text: lines.join('\n\n'),
    evidence: docEvidence(chapter, 'where it is covered'),
    ...(openAction(chapter) ? { actions: openAction(chapter) } : {}),
  }
}

/** "How far am I?" / "What's left?" */
function answerHowFar(curriculum: Curriculum, progress: Progress): Answer | null {
  const chapter = currentChapter(curriculum, progress)
  const core = completionOf(curriculum, progress, 'core')
  if (core.total === 0) return null

  const { spine, index } = chapter
    ? placeOf(curriculum, chapter)
    : { spine: chaptersOf(curriculum, 'core'), index: -1 }
  // From the module AFTER the current one: listing the one you are working on
  // as "still ahead" reads as though it had not been started.
  const remaining = index >= 0 ? spine.slice(index + 1) : spine
  const day = currentDay(getState().days)

  const lines = [
    `${core.done} of ${core.total} core modules done${chapter ? `, currently on ${chapter.label}` : ''}.`,
    day ? `Day ${day.number} of ${getState().days.length} in this module.` : null,
    remaining.length > 0
      ? `Still ahead: ${remaining.slice(0, 6).map((c) => c.label).join(', ')}${remaining.length > 6 ? `, and ${remaining.length - 6} more` : ''}.`
      : 'Nothing left on the core track.',
  ].filter(Boolean)

  return {
    layer: 1,
    source: 'Curriculum',
    text: lines.join('\n\n'),
    evidence: chapter ? docEvidence(chapter, 'where you are') : [],
  }
}

/** "What comes after X?" — or after the current module when X is unnamed. */
function answerAfter(curriculum: Curriculum, progress: Progress, subject: string): Answer | null {
  const named = subject ? findNode(curriculum, subject) : null
  const anchor = named
    ? (chapterFor(curriculum, named) ?? named)
    : currentChapter(curriculum, progress)
  if (!anchor) return null

  const { spine, index } = placeOf(curriculum, anchor)
  const next = index >= 0 ? spine[index + 1] : undefined

  if (!next) {
    return {
      layer: 1,
      source: 'Curriculum',
      text: `${anchor.label} is the end of that track.`,
      evidence: docEvidence(anchor, 'the last module'),
    }
  }

  return {
    layer: 1,
    source: 'Curriculum',
    text: `After ${anchor.label} comes ${next.label}${next.summary ? ` — ${next.summary}` : ''}.`,
    evidence: docEvidence(next, 'the next module'),
    ...(openAction(next) ? { actions: openAction(next) } : {}),
  }
}

// ── the provider ──────────────────────────────────────────────────────────

export const curriculumAnswerProvider: AnswerProvider = {
  id: 'curriculum.answers',
  layer: 1,

  /**
   * Where the learner stands, for ANY question that reaches layer 4.
   *
   * This is what makes the assistant bounded to the curriculum rather than
   * inferring from wording. Asking "why an interface here?" is a reasoning
   * question, so `answer()` below declines it — but the fact that they are on
   * Module 02, Day 3, having finished Module 01, is exactly the context that
   * turns a generic explanation into a useful one.
   */
  async context(): Promise<Evidence[]> {
    const { curriculum, progress, days } = getState()
    if (!curriculum) return []

    const chapter = currentChapter(curriculum, progress)
    if (!chapter) return []

    const day = currentDay(days)
    const core = completionOf(curriculum, progress, 'core')
    const done = curriculum.nodes.filter((n) => progress.done.includes(n.id)).map((n) => n.label)

    const lines = [
      `Currently on: ${chapter.label}${chapter.summary ? ` — ${chapter.summary}` : ''}.`,
      day ? `Day ${day.number} of ${days.length}: ${day.title} (${day.done}/${day.total} tasks done).` : null,
      `${core.done} of ${core.total} core modules complete.`,
      done.length > 0 ? `Finished so far: ${done.join(', ')}.` : 'Nothing marked complete yet.',
      chapter.checkpoint ? `Next gate: ${chapter.checkpoint}.` : null,
    ].filter(Boolean)

    const out: Evidence[] = [
      {
        path: '' as RelPath,
        title: 'Curriculum position',
        excerpt: lines.join('\n'),
        reason: 'curriculum',
      },
    ]

    // The module document itself, so an explanation can build on what the
    // learner has actually been taught rather than on the model's own idea of
    // how the topic is usually introduced.
    if (chapter.doc) {
      out.push({ path: chapter.doc, title: chapter.label, reason: 'the current module' })
    }
    return out
  },

  async answer(ctx: QueryContext): Promise<Answer | null> {
    const text = ctx.query.toLowerCase()

    // Claim the question if core classified it as a lookup, or if it uses this
    // plugin's own vocabulary — core does not recognise those words, so an
    // unclassified query is exactly where they turn up. Everything else is
    // declined: without this guard "the next dragon" would trip the `next`
    // branch purely because it contains the word.
    const claimed =
      ctx.intent.kind === 'lookup' || (ctx.intent.kind === 'recall' && OWN_VOCABULARY.test(text))
    if (!claimed) return null

    const { curriculum, progress } = getState()
    // No curriculum configured for this workspace is the normal case for most
    // workspaces. Decline quietly and let the walk continue.
    if (!curriculum) return null

    const subject = subjectOf(ctx.intent.topic)

    // Ordered most-specific first. `NEXT` matches the bare word "next" and so
    // must stay last, or "what comes after LINQ" never reaches its own branch.
    if (HAVE_I.test(text)) return answerHaveILearned(curriculum, progress, subject)
    if (PREREQS.test(text)) return answerPrereqs(curriculum, subject)
    if (COMPLETED.test(text)) return answerCompleted(curriculum, progress)
    if (START.test(text)) return answerWhereToStart(curriculum, progress)
    if (WHEN_LEARN.test(text)) return answerWhenLearn(curriculum, progress, subject)
    if (AFTER.test(text)) return answerAfter(curriculum, progress, subject)
    if (HOW_FAR.test(text)) return answerHowFar(curriculum, progress)
    if (WHICH_MODULE.test(text)) return answerWhichModule(curriculum, subject)
    if (WHERE_AM_I.test(text)) return answerWhereAmI(curriculum, progress)
    if (NEXT.test(text)) return answerNext(curriculum, progress)

    return null
  },
}
