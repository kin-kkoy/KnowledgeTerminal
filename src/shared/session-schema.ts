/**
 * Session state: everything needed to make relaunching feel like continuing.
 *
 * Lives in `userData/sessions/<workspaceId>.json`, NOT in the workspace — scroll
 * positions and window geometry must never pollute the user's notes folder.
 * (Favorites are the opposite case: intentional and portable, so they live in
 * the workspace's settings.json.)
 *
 * Written atomically with one .bak. Losing every tab to a bad shutdown would be
 * this application's worst possible failure.
 */
import { z } from 'zod'

export const SESSION_VERSION = 1

/**
 * How we get back to the exact line. Pixels alone fail three ways — see
 * `useScrollRestore.ts` for the full argument. The restore cascade is:
 *
 *   1. blockId      — exact block, trusted ONLY if contentHash still matches
 *   2. headingSlug  — survives edits above it
 *   3. ratio        — proportional, survives a rewrite
 *   4. top          — raw pixels, last resort
 */
export const scrollAnchorSchema = z.object({
  /** Raw scrollTop at save time. Fallback #4. */
  top: z.number().default(0),
  /** scrollTop / (scrollHeight - clientHeight). Fallback #3. */
  ratio: z.number().min(0).max(1).default(0),
  /** `data-kt-block` id of the block at the viewport top. Primary anchor. */
  blockId: z.string().nullable().default(null),
  /** Pixels from that block's top to the viewport top (negative = scrolled in). */
  blockOffset: z.number().default(0),
  /** Nearest preceding heading slug. Fallback #2. */
  headingSlug: z.string().nullable().default(null),
  /** Hash of the file when the anchor was taken. Guards blockId. */
  contentHash: z.string().nullable().default(null),
  /** scrollHeight at save time — reserved as min-height so restore never clamps. */
  lastHeight: z.number().default(0),
})

export type ScrollAnchor = z.infer<typeof scrollAnchorSchema>

export const EMPTY_SCROLL_ANCHOR: ScrollAnchor = scrollAnchorSchema.parse({})

export const tabStateSchema = z.object({
  id: z.string(),
  path: z.string(),
  pinned: z.boolean().default(false),
  scroll: scrollAnchorSchema.default({}),
})

export const paneStateSchema = z.object({
  id: z.string(),
  activeTabId: z.string().nullable().default(null),
  tabs: z.array(tabStateSchema).default([]),
  /** Back/forward stack for Alt+Left / Alt+Right, per pane. */
  history: z
    .object({
      entries: z.array(z.string()).default([]),
      index: z.number().int().default(-1),
    })
    .default({ entries: [], index: -1 }),
})

export const bookmarkSchema = z.object({
  id: z.string(),
  path: z.string(),
  headingSlug: z.string().nullable().default(null),
  blockId: z.string().nullable().default(null),
  label: z.string().default(''),
  note: z.string().default(''),
  createdAt: z.number(),
})

export type Bookmark = z.infer<typeof bookmarkSchema>

export const sessionSchema = z.object({
  version: z.number().int().default(SESSION_VERSION),
  workspaceId: z.string(),
  root: z.string(),
  savedAt: z.number().default(0),
  /** When the PREVIOUS session ended — this is what "2 days ago" reads from. */
  lastSessionAt: z.number().nullable().default(null),

  window: z
    .object({
      x: z.number().nullable().default(null),
      y: z.number().nullable().default(null),
      width: z.number().default(1440),
      height: z.number().default(900),
      maximized: z.boolean().default(false),
    })
    .default({}),

  ui: z
    .object({
      theme: z.enum(['dark', 'light', 'system']).default('dark'),
      explorer: z
        .object({
          visible: z.boolean().default(true),
          width: z.number().default(280),
          activeSection: z.string().default('tree'),
        })
        .default({}),
      contextPanel: z
        .object({ visible: z.boolean().default(true), width: z.number().default(320) })
        .default({}),
      outlineVisible: z.boolean().default(true),
      zoom: z.number().default(1),
    })
    .default({}),

  explorerState: z
    .object({
      expandedDirs: z.array(z.string()).default([]),
      scrollTop: z.number().default(0),
      selected: z.string().nullable().default(null),
    })
    .default({}),

  layout: z
    .object({
      /** 'vertical' means the split runs top-to-bottom, i.e. panes side by side. */
      orientation: z.enum(['vertical', 'horizontal']).default('vertical'),
      sizes: z.array(z.number()).default([1]),
      activePaneId: z.string().nullable().default(null),
      panes: z.array(paneStateSchema).default([]),
    })
    .default({}),

  /** ISO dates (YYYY-MM-DD) on which a session happened. Drives the streak. */
  sessionDates: z.array(z.string()).default([]),
  recents: z
    .array(z.object({ path: z.string(), title: z.string().default(''), openedAt: z.number() }))
    .default([]),
  bookmarks: z.array(bookmarkSchema).default([]),

  /** Namespaced plugin state. Plugins never get raw fs write access. */
  plugins: z.record(z.unknown()).default({}),
})

export type SessionState = z.infer<typeof sessionSchema>
export type PaneState = z.infer<typeof paneStateSchema>
export type TabState = z.infer<typeof tabStateSchema>

export function emptySession(workspaceId: string, root: string): SessionState {
  return sessionSchema.parse({ workspaceId, root })
}
