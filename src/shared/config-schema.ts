/**
 * Config schemas. Everything the application does is driven from here — layout,
 * theme, keybindings, favorites, context widgets, plugins. Changing workspaces
 * must never require editing source.
 *
 * Config is validated on read. On failure the app loads defaults, LEAVES THE
 * BAD FILE UNTOUCHED, and surfaces a dismissible notice with the zod path.
 * Never silently rewrite a user's config.
 */
import { z } from 'zod'
import { WHEN_CLAUSES } from './commands'

const whenClause = z.enum(WHEN_CLAUSES)

// ── workspace settings: <root>/.kt/settings.json ──────────────────────────

export const quoteSchema = z.object({
  text: z.string(),
  source: z.string().optional(),
})

export const workspaceMetaSchema = z.object({
  name: z.string().default('Workspace'),
  /** Free text. Shown on the Home screen and the Current Mission widget. */
  mission: z.string().nullable().default(null),
  goal: z.string().nullable().default(null),
  quote: quoteSchema.nullable().default(null),
  /** Opened when the user resumes and there is no prior session. */
  entryDocument: z.string().nullable().default(null),
  startupPage: z.enum(['home', 'resume', 'document']).default('home'),
})

/**
 * Catppuccin palette names usable for an icon. Wider than `ACCENTS` — an accent
 * has to work as a link colour and a focus ring, an icon tint does not.
 */
export const ICON_COLOURS = [
  'rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach',
  'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender',
] as const
export type IconColour = (typeof ICON_COLOURS)[number]

export const iconOverrideSchema = z.object({
  /**
   * A name from the renderer's icon set. Kept as a loose string on purpose: an
   * unrecognised name falls back to the guessed icon rather than failing the
   * whole file to parse, so a typo costs you one icon and not your config.
   */
  icon: z.string(),
  colour: z.enum(ICON_COLOURS).optional(),
})

export type IconOverride = z.infer<typeof iconOverrideSchema>

export const filesSchema = z.object({
  /**
   * What is INDEXED and resolvable — search, wiki-links and embedded images all
   * work against this list.
   *
   * Deliberately separate from `treeFilter` below: dropping images from here to
   * tidy the tree would also stop `![](x.png)` resolving, which is a confusing
   * way to lose your illustrations.
   */
  include: z
    .array(z.string())
    .default(['**/*.md', '**/*.markdown', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.svg', '**/*.pdf', '**/*.json']),
  ignore: z
    .array(z.string())
    .default(['**/.git/**', '**/node_modules/**', '**/.kt/**', '**/.obsidian/**']),
  /**
   * Obsidian-style asset roots. `![](images/x.png)` resolves doc-relative first,
   * then against each of these from the workspace root.
   */
  assetRoots: z.array(z.string()).default([]),
  /** Files larger than this render as plain text with a notice. */
  maxRenderBytes: z.number().int().positive().default(2_000_000),
  /**
   * What the file TREE shows. Everything indexed but not matching this lands in
   * the explorer's "Miscellaneous" section, grouped by kind.
   */
  treeFilter: z.array(z.string()).default(['**/*.md', '**/*.markdown']),
  /**
   * Manual icon overrides, keyed by EXACT workspace-relative path
   * (`"curriculum"`, `"roadmap/PLAN.md"`).
   *
   * The name-based guesses in the explorer are a decent default and a bad rule —
   * they cannot know that `roadmap/` is the important folder here and `notes/`
   * is a scratchpad. An entry in this map wins over the guess; everything not
   * listed still falls through to it.
   *
   * Deliberately not globs: the "Set icon…" gesture on a tree row must write one
   * unambiguous entry, and a matching order is a thing to debug later.
   */
  icons: z.record(iconOverrideSchema).default({}),
})

/** Catppuccin accents, by NAME. See themes.css for why not a hex. */
export const ACCENTS = ['mauve', 'blue', 'teal', 'green', 'peach', 'pink', 'lavender'] as const
export type AccentName = (typeof ACCENTS)[number]

export const appearanceSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  /**
   * A palette name rather than a hex, so the same choice resolves correctly in
   * both flavours — Mocha's mauve is a pastel, Latte's is a saturated violet.
   * A legacy hex is accepted and quietly mapped to the nearest name.
   */
  accent: z
    .union([z.enum(ACCENTS), z.string().regex(/^#[0-9a-fA-F]{6}$/)])
    .transform((v): AccentName => (v.startsWith('#') ? 'mauve' : (v as AccentName)))
    .default('mauve'),
  fontSize: z.number().min(11).max(28).default(16),
  proseFont: z.enum(['serif', 'sans', 'mono']).default('sans'),
  lineHeight: z.number().min(1.2).max(2.2).default(1.7),
  /** Reading measure. A `ch` value keeps the line length font-relative. */
  measure: z.string().default('78ch'),
  density: z.enum(['comfortable', 'compact']).default('comfortable'),
  /** How the dashboard's "Everything else" panel opens. */
  revealMode: z.enum(['side', 'below']).default('side'),
})

export const panelSchema = z.object({
  visible: z.boolean().default(true),
  width: z.number().int().min(180).max(720).default(280),
})

export const contextWidgetSchema = z.object({
  /** Unknown ids are SKIPPED with a warning, never a crash — that is what makes
   *  a disabled plugin harmless. */
  id: z.string(),
  collapsed: z.boolean().default(false),
  options: z.record(z.unknown()).default({}),
})

export const layoutSchema = z.object({
  explorer: panelSchema.default({ visible: true, width: 280 }),
  contextPanel: panelSchema.default({ visible: true, width: 320 }),
  explorerSections: z
    .array(z.string())
    .default(['tree', 'search', 'favorites', 'recents', 'bookmarks']),
  contextWidgets: z
    .array(contextWidgetSchema)
    .default([
      { id: 'core.currentMission', collapsed: false, options: {} },
      { id: 'core.currentGoal', collapsed: false, options: {} },
      { id: 'core.quickActions', collapsed: false, options: {} },
      { id: 'core.recents', collapsed: true, options: {} },
    ]),
})

/**
 * Daily notes and the close-out gate.
 *
 * `root` may point OUTSIDE the workspace — at another app's vault, say. It is
 * read-only in every case: the app lists and reads notes there so the dashboard
 * and the gate can see them, and never writes.
 */
export const notesSchema = z.object({
  /** Workspace-relative, or absolute to read an external vault. */
  root: z.string().default('notes/daily'),
  /**
   * Tokens: {{date}} {{module}} {{moduleNumber}} {{day}} {{title}}
   * Default gives "2026-08-01 - Module 01 (Day 1)".
   */
  filename: z.string().default('{{date}} - {{module}} (Day {{day}})'),
  /** Prompts shown in the close-out gate. */
  prompts: z
    .array(z.string())
    .default([
      'What did you actually build?',
      'Where did you get stuck, and for how long?',
      "What's the first thing tomorrow?",
    ]),
})

export const gateSchema = z.object({
  enabled: z.boolean().default(true),
  /**
   * Never on a timer — the gate opens only when the session is deliberately
   * ended, because an unprompted modal mid-flow is the most annoying thing an
   * app like this could do.
   */
  title: z.string().default("Write today's log before you stop."),
  body: z
    .string()
    .default(
      "Open your notes app and write it. This window stays until you say you're done — drag it aside if you need the screen.",
    ),
})

export const favoriteSchema = z.object({
  label: z.string().optional(),
  path: z.string(),
})

export const keybindingSchema = z.object({
  key: z.string(),
  command: z.string().nullable(),
  when: whenClause.optional(),
})

export const markdownSchema = z.object({
  wikiLinks: z.boolean().default(true),
  callouts: z.boolean().default(true),
  mermaid: z.boolean().default(true),
  footnotes: z.boolean().default(true),
  tableOfContents: z
    .object({
      enabled: z.boolean().default(true),
      minHeadings: z.number().int().min(0).default(3),
      maxDepth: z.number().int().min(1).max(6).default(3),
    })
    .default({ enabled: true, minHeadings: 3, maxDepth: 3 }),
})

/**
 * The Lobby's orientation map: which places in the workspace are worth knowing,
 * and why.
 *
 * This is subject knowledge — "chapters/ is what you read" is true of one
 * workspace and meaningless in another — so it lives in config rather than in
 * core. Leave it empty and the Lobby derives a plain list from the top-level
 * folders instead, which is duller but never wrong.
 *
 * Icons are deliberately absent: an entry is a path, and paths already resolve
 * icons through `files.icons` and the name heuristics. One icon system.
 */
export const lobbySchema = z.object({
  map: z
    .array(
      z.object({
        group: z.string(),
        entries: z
          .array(
            z.object({
              /** Workspace-relative. A folder or a document. */
              path: z.string(),
              /** Defaults to the path's last segment. */
              label: z.string().optional(),
              /** One line on why it exists. */
              note: z.string().optional(),
              /** Draw attention to it — the one or two that matter most. */
              emphasis: z.boolean().default(false),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
})

export type LobbyConfig = z.infer<typeof lobbySchema>

export const workspaceSettingsSchema = z.object({
  version: z.number().int().default(1),
  workspace: workspaceMetaSchema.default({}),
  files: filesSchema.default({}),
  appearance: appearanceSchema.default({}),
  notes: notesSchema.default({}),
  gate: gateSchema.default({}),
  layout: layoutSchema.default({}),
  lobby: lobbySchema.default({}),
  favorites: z.array(favoriteSchema).default([]),
  keybindings: z.array(keybindingSchema).default([]),
  markdown: markdownSchema.default({}),
  /** Per-plugin config. `enabled: false` deactivates without removing config. */
  plugins: z.record(z.object({ enabled: z.boolean().default(true) }).passthrough()).default({}),
})

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>
export type ContextWidgetConfig = z.infer<typeof contextWidgetSchema>
export type Favorite = z.infer<typeof favoriteSchema>

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = workspaceSettingsSchema.parse({})

// ── app config: userData/config.json ──────────────────────────────────────

export const appConfigSchema = z.object({
  version: z.number().int().default(1),
  workspaces: z
    .array(
      z.object({
        id: z.string(),
        root: z.string(),
        name: z.string(),
        lastOpenedAt: z.number(),
        pinned: z.boolean().default(false),
      }),
    )
    .default([]),
  lastWorkspaceId: z.string().nullable().default(null),
  /**
   * false + workspace.startupPage "home" is what enforces the spec's
   * "do NOT immediately open the document viewer".
   */
  openLastWorkspaceOnLaunch: z.boolean().default(false),
  theme: z.enum(['dark', 'light', 'system']).default('dark'),
  zoom: z.number().min(0.5).max(2.5).default(1),
  /**
   * Last window geometry. The per-workspace session also stores this, but the
   * first window is created before any workspace is known — without a copy
   * here, every launch would start at the default size for a moment.
   */
  window: z
    .object({
      x: z.number().nullable().default(null),
      y: z.number().nullable().default(null),
      width: z.number().int().min(480).default(1440),
      height: z.number().int().min(360).default(900),
      maximized: z.boolean().default(false),
    })
    .default({}),
  search: z
    .object({
      maxResults: z.number().int().positive().default(200),
      fuzzy: z.number().min(0).max(1).default(0.2),
    })
    .default({ maxResults: 200, fuzzy: 0.2 }),

})

export type AppConfig = z.infer<typeof appConfigSchema>
export const DEFAULT_APP_CONFIG: AppConfig = appConfigSchema.parse({})

// ── parsing helper ────────────────────────────────────────────────────────

export interface ParseOutcome<T> {
  value: T
  /** Human-readable zod issues. Empty when the file parsed cleanly. */
  problems: string[]
}

/**
 * Parse config defensively: on failure return defaults plus the issues, so the
 * caller can show a notice instead of crashing or rewriting the file.
 *
 * Generic over the schema rather than over a value type: because every schema
 * here uses `.default()`, its input and output types differ, and a plain
 * `ZodType<T>` parameter would unify `T` with the *input* side and reject every
 * call site.
 */
export function parseConfig<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  fallback: z.output<S>,
): ParseOutcome<z.output<S>> {
  const result = schema.safeParse(raw)
  if (result.success) return { value: result.data as z.output<S>, problems: [] }
  return {
    value: fallback,
    problems: result.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    ),
  }
}
