/**
 * The curriculum plugin — the worked example of the plugin seam.
 *
 * It reads the workspace's own `curriculum.json` and contributes an explorer
 * section, two context widgets and four commands. Everything it knows about
 * modules, checkpoints and branches lives in this folder; the core application
 * knows none of it.
 *
 * Progress is stored through `ctx.state`, which is precisely what that file's
 * own metadata already anticipates:
 *
 *   "Progress is tracked by the app, not stored here."
 *
 * Every path it touches is treated as possibly-missing. Of the 117 nodes in the
 * real file only 31 carry a `doc`, and the rest must degrade quietly rather
 * than produce dead links.
 */
import { definePlugin } from '../api'
import { curriculumAnswerProvider } from './answers'
import type { LobbyBoard, RelPath } from '@shared/types'
import {
  chaptersOf,
  completionOf,
  currentChapter,
  currentDay,
  currentMilestone,
  parseCurriculum,
  parseDayBlocks,
  parseMilestones,
  EMPTY_PROGRESS,
  type Progress,
} from './model'
import { CurriculumView } from './CurriculumView'
import { CurrentModule, CurriculumProgress } from './widgets'
import {
  reset,
  getState,
  setCurriculum,
  setDays,
  setMilestones,
  setPersister,
  setProgress,
  subscribeExternal,
  updateProgress,
} from './store'

/** Torn down in `deactivate`; module-level because `activate` cannot hold it. */
let unwatchStore: (() => void) | null = null

export const curriculumPlugin = definePlugin({
  id: 'curriculum',
  name: 'Curriculum',
  description: 'Reads a curriculum.json skill tree and tracks progress through it.',

  async activate(ctx) {
    const source = typeof ctx.options['source'] === 'string' ? ctx.options['source'] : null
    const docBase = typeof ctx.options['docBase'] === 'string' ? ctx.options['docBase'] : ''
    /**
     * The project's own milestone ladder, which is a different document from
     * the curriculum: one is what you learn, the other is what you build. A
     * workspace with no such thing simply leaves this unset and no board is
     * contributed.
     */
    const roadmap =
      typeof ctx.options['roadmap'] === 'string' ? (ctx.options['roadmap'] as RelPath) : null

    if (!source) {
      setCurriculum(null, 'Set `plugins.curriculum.source` in .kt/settings.json.')
      return
    }
    if (!(await ctx.fs.exists(source))) {
      // Missing content is a configuration fact, not a crash.
      setCurriculum(null, `No curriculum at ${source}.`)
      return
    }

    const curriculum = parseCurriculum(JSON.parse(await ctx.fs.readText(source)), docBase)
    setCurriculum(curriculum)

    const saved = await ctx.state.get<Progress>()
    setProgress(saved ?? EMPTY_PROGRESS)
    setPersister(async (progress) => ctx.state.set(progress))

    /**
     * Tell core whenever this plugin's state moves, so long-lived core surfaces
     * (the Lobby tab) recompute. Core is told only THAT something changed —
     * `refreshContributions` carries no payload and no vocabulary.
     */
    unwatchStore?.()
    unwatchStore = subscribeExternal(() => ctx.app.refreshContributions())

    /**
     * Re-read the current module and work out which day is live.
     *
     * Derived from the document's own `Day N` headings and their checkboxes —
     * so ticking the last box of Day 1 advances it, with nothing to keep in
     * sync and no separate counter to go stale.
     */
    const refreshDays = async (): Promise<void> => {
      const { curriculum: c, progress: prog } = getState()
      const chapter = c ? currentChapter(c, prog) : null
      if (!chapter?.doc || !(await ctx.fs.exists(chapter.doc))) {
        setDays([])
        return
      }
      try {
        setDays(parseDayBlocks(await ctx.fs.readText(chapter.doc)))
      } catch {
        setDays([])
      }
    }
    /**
     * Re-read the roadmap and work out which milestone is live.
     *
     * Same bargain as `refreshDays`: derived from the document, never stored,
     * so the milestone advances the moment its deliverable is ticked — whether
     * that happened in this app or in any other Markdown editor.
     */
    const refreshMilestones = async (): Promise<void> => {
      if (!roadmap || !(await ctx.fs.exists(roadmap))) {
        setMilestones([], null)
        return
      }
      try {
        setMilestones(parseMilestones(await ctx.fs.readText(roadmap)), roadmap)
      } catch {
        setMilestones([], null)
      }
    }

    await Promise.all([refreshDays(), refreshMilestones()])

    // Reload when the curriculum, the module document OR the roadmap changes
    // on disk — the last two are what make ticking a checkbox move things on.
    ctx.fs.watch((changes) => {
      void (async () => {
        if (changes.some((c) => c.path === source)) {
          try {
            setCurriculum(parseCurriculum(JSON.parse(await ctx.fs.readText(source)), docBase))
          } catch (err) {
            setCurriculum(null, `curriculum.json could not be parsed: ${String(err)}`)
          }
        }
        await Promise.all([refreshDays(), refreshMilestones()])
      })()
    })

    /**
     * The milestone ladder, translated out of this plugin's vocabulary.
     *
     * Core is handed a heading, some tickable lines, some untickable ones and
     * a gate. The word "milestone" appears only in the strings — which is what
     * lets the same surface show something else entirely in another workspace.
     */
    const board = (): LobbyBoard | null => {
      const { milestones, roadmapPath } = getState()
      if (milestones.length === 0 || !roadmapPath) return null
      const m = currentMilestone(milestones)
      if (!m) return null
      return {
        tab: 'What to build',
        eyebrow: `Milestone ${m.number} of ${milestones.length}`,
        title: m.title,
        note: m.goal || null,
        meta: m.curriculum ? `Pairs with ${m.curriculum}` : null,
        path: roadmapPath,
        items: m.tasks,
        groups: m.scope,
        gate: m.deliverable,
      }
    }

    // Feeds the dashboard. The core knows none of these words — it just draws
    // whatever the source hands back.
    ctx.registerDashboardSource(() => {
      const { curriculum: c, progress } = getState()
      // The board does not depend on the curriculum, so it is offered even
      // when there is no chapter to talk about.
      if (!c) return { board: board() }
      const chapter = currentChapter(c, progress)
      if (!chapter) return { board: board() }
      const core = completionOf(c, progress, 'core')
      const branch = c.branches.find((b) => b.key === chapter.branch)
      const { days } = getState()
      const day = currentDay(days)

      // A module number, if the label or id carries one — used by the
      // daily-note filename, and left out entirely when there is none.
      const moduleNo = /(\d+)/.exec(chapter.id)?.[1]
      const moduleLabel = moduleNo ? `Module ${moduleNo.padStart(2, '0')}` : chapter.label

      // The headline is a TITLE. A chapter's `summary` is a paragraph and makes
      // a five-line heading, which defeats the point of a one-glance dashboard.
      return {
        eyebrow:
          [branch?.label, day ? `Day ${day.number} of ${days.length}` : chapter.est]
            .filter(Boolean)
            .join(' · ') || null,
        headline: day?.title || chapter.label,
        nextGate: chapter.checkpoint ?? null,
        progressLabel: 'Core modules',
        progressValue: `${core.done} of ${core.total} done`,
        tasks: [],
        board: board(),
        // Offered under generic roles. The core surface that renders these has
        // no idea what a chapter or a day plan is — it only knows one of them
        // was nominated as the thing to read and one as the thing to do.
        links: [
          ...(chapter.chapter
            ? [{
                role: 'read',
                path: chapter.chapter,
                label: chapter.label,
                ...(day ? { hint: `Day ${day.number}: ${day.title}` } : {}),
              }]
            : []),
          ...(chapter.doc
            ? [{
                role: 'do',
                path: chapter.doc,
                label: moduleLabel,
                ...(day ? { hint: `Day ${day.number} of ${days.length}` } : {}),
              }]
            : []),
        ],
        tokens: {
          module: moduleLabel,
          moduleTitle: chapter.label,
          day: String(day?.number ?? 1),
          totalDays: String(days.length || 1),
          dayTitle: day?.title ?? '',
        },
      }
    })

    // Layer 1 of the answer router. Everything it knows about modules and
    // topics stays in this folder; the router just sees a provider.
    ctx.registerAnswerProvider(curriculumAnswerProvider)

    ctx.registerExplorerSection({
      id: 'curriculum',
      title: 'Curriculum',
      icon: 'graduationCap',
      component: CurriculumView,
    })

    ctx.registerContextWidget({
      id: 'curriculum.currentModule',
      title: 'Current Module',
      description: 'Where you are in the curriculum, and what is next.',
      icon: 'graduationCap',
      component: CurrentModule,
      options: [
        {
          key: 'showEstimate',
          label: 'Show time estimate',
          hint: 'Reads the estimate declared on the module.',
          type: 'boolean',
          default: true,
        },
      ],
    })

    ctx.registerContextWidget({
      id: 'curriculum.progress',
      title: 'Progress',
      description: 'Completion across the curriculum.',
      icon: 'listChecks',
      component: CurriculumProgress,
      options: [
        {
          key: 'branches',
          label: 'Branches',
          hint: 'Which branches to count. Empty means all of them.',
          type: 'stringList',
          default: [],
        },
      ],
    })

    ctx.registerCommand({
      id: 'curriculum.openToday',
      title: "Open Today's Module",
      run() {
        const { curriculum: c, progress } = getState()
        if (!c) return
        const chapter = currentChapter(c, progress)
        if (chapter?.doc) ctx.app.openDocument(chapter.doc)
        else ctx.app.notify('No document is attached to the current module.', 'warn')
      },
    })

    ctx.registerCommand({
      id: 'curriculum.markComplete',
      title: 'Mark Current Module Complete',
      run() {
        const { curriculum: c, progress } = getState()
        if (!c) return
        const chapter = currentChapter(c, progress)
        if (!chapter) return
        void updateProgress({
          done: [...new Set([...progress.done, chapter.id])],
          activeNodeId: null,
        })
        ctx.app.notify(`${chapter.label} marked complete.`)
      },
    })

    ctx.registerCommand({
      id: 'curriculum.nextNode',
      title: 'Go to Next Module',
      run() {
        const { curriculum: c, progress } = getState()
        if (!c) return
        const chapters = chaptersOf(c, 'core')
        const current = currentChapter(c, progress)
        const index = current ? chapters.findIndex((ch) => ch.id === current.id) : -1
        const next = chapters[index + 1]
        if (!next) {
          ctx.app.notify('That is the end of the core spine.')
          return
        }
        void updateProgress({ ...progress, activeNodeId: next.id })
        if (next.doc) ctx.app.openDocument(next.doc)
      },
    })

    ctx.registerCommand({
      id: 'curriculum.jumpToCheckpoint',
      title: 'Open the Checkpoint for the Current Module',
      run() {
        void (async () => {
          const { curriculum: c, progress } = getState()
          if (!c) return
          const chapter = currentChapter(c, progress)
          if (!chapter?.checkpoint) {
            ctx.app.notify('This module has no checkpoint.', 'warn')
            return
          }
          // The JSON names checkpoints by id, not by path; look for the
          // conventional location and say so plainly if it is not there.
          const candidate = `${docBase}/checkpoints/${chapter.checkpoint}.md`
          if (await ctx.fs.exists(candidate)) ctx.app.openDocument(candidate)
          else ctx.app.notify(`No file found for checkpoint ${chapter.checkpoint}.`, 'warn')
        })()
      },
    })
  },

  deactivate() {
    unwatchStore?.()
    unwatchStore = null
    setPersister(null)
    reset()
  },
})
