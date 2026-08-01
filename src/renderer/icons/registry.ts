/**
 * The icon set, and how a path gets one.
 *
 * There used to be three unrelated hardcoded maps — folder names in the tree,
 * file extensions in the Miscellaneous section, and a named set behind the
 * `<Icon>` wrapper — none of them exported, so nothing could enumerate the
 * available icons and the user could not override a single one. This is the one
 * place now.
 *
 * Resolution order, cheapest and most specific first:
 *
 *   1. `settings.files.icons[path]`   what the user explicitly chose
 *   2. name / extension heuristics    a decent guess
 *   3. plain folder or document       always something
 *
 * The heuristics stay because a fresh workspace should already look legible.
 * They are the FALLBACK, not the rule — that distinction is the whole point.
 */
import {
  Bookmark,
  Boxes,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Code,
  Columns2,
  Database,
  File,
  FileText,
  FileType,
  Flag,
  Folder,
  FolderOpen,
  GraduationCap,
  Hammer,
  Image,
  Inbox,
  Landmark,
  Layers,
  Library,
  Lightbulb,
  ListChecks,
  ListTree,
  Map as MapIcon,
  Microscope,
  Music,
  NotebookPen,
  Package,
  Pin,
  Search,
  Sparkles,
  Star,
  Swords,
  Table,
  Target,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import type { IconColour, IconOverride } from '@shared/config-schema'
import type { RelPath } from '@shared/types'

/** `settings.files.icons` — path → chosen icon. */
export type IconOverrides = Record<string, IconOverride>

/**
 * Every icon the app can render, by name. EXPORTED and runtime-enumerable —
 * the Sandbox's picker is `Object.entries(ICON_SET)`, so adding an icon here is
 * the only step needed to make it choosable.
 */
export const ICON_SET = {
  // structure
  folder: Folder,
  folderOpen: FolderOpen,
  file: File,
  fileText: FileText,
  fileType: FileType,
  outline: ListTree,
  layers: Layers,
  package: Package,
  boxes: Boxes,
  // subject matter
  graduationCap: GraduationCap,
  library: Library,
  notebook: NotebookPen,
  calendar: Calendar,
  listChecks: ListChecks,
  map: MapIcon,
  target: Target,
  flag: Flag,
  lightbulb: Lightbulb,
  microscope: Microscope,
  landmark: Landmark,
  swords: Swords,
  sparkles: Sparkles,
  hammer: Hammer,
  wrench: Wrench,
  users: Users,
  inbox: Inbox,
  // media & data
  image: Image,
  music: Music,
  database: Database,
  table: Table,
  code: Code,
  // chrome
  bookmark: Bookmark,
  star: Star,
  pin: Pin,
  clock: Clock,
  search: Search,
  split: Columns2,
  close: X,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof ICON_SET

export function isIconName(name: string): name is IconName {
  return Object.prototype.hasOwnProperty.call(ICON_SET, name)
}

export interface ResolvedIcon {
  icon: LucideIcon
  /** A CSS colour, already wrapped: `var(--peach)`. */
  colour: string
  /**
   * The set member that was chosen. Lets a colour-only edit write a complete
   * override — "make this folder peach" should not require also re-picking the
   * icon it already has.
   */
  name: IconName
}

const DEFAULT_DIR_COLOUR = 'var(--text-faint)'
const DEFAULT_FILE_COLOUR = 'var(--blue)'

/**
 * Folder icons by what a folder CONTAINS, matched on its name.
 *
 * A tree of twelve identical folder glyphs is a tree you read letter by letter;
 * a distinct silhouette per kind is findable at a glance. Anything unmatched
 * falls back to a plain folder, so this never has to be exhaustive.
 */
export const FOLDER_HEURISTICS: Array<{ test: RegExp; icon: IconName; colour: IconColour }> = [
  { test: /^(assets|images|media|attachments)$/i, icon: 'image', colour: 'pink' },
  { test: /^(curriculum|modules|course|lessons)$/i, icon: 'graduationCap', colour: 'mauve' },
  { test: /^(checkpoints|exams|tests|quizzes)$/i, icon: 'listChecks', colour: 'red' },
  { test: /^(journal|daily|log|logs)$/i, icon: 'calendar', colour: 'yellow' },
  { test: /(meeting|minutes|people)/i, icon: 'users', colour: 'teal' },
  { test: /^(notes|scratch|inbox)$/i, icon: 'notebook', colour: 'green' },
  { test: /^(roadmap|plan|milestones)$/i, icon: 'map', colour: 'peach' },
  { test: /^(documentation|docs|reference)$/i, icon: 'fileText', colour: 'sky' },
]

/** File icons by extension. Markdown is deliberately absent — it is the norm. */
export const EXTENSION_HEURISTICS: Array<{ test: RegExp; icon: IconName; colour: IconColour }> = [
  { test: /\.(png|jpe?g|gif|webp|svg|avif)$/i, icon: 'image', colour: 'pink' },
  { test: /\.pdf$/i, icon: 'fileType', colour: 'red' },
  { test: /\.(json|ya?ml|toml|csv|xml)$/i, icon: 'database', colour: 'yellow' },
  { test: /\.(mp3|wav|ogg|m4a|flac)$/i, icon: 'music', colour: 'teal' },
]

function colourVar(name: IconColour): string {
  return `var(--${name})`
}

/**
 * The icon for a tree node.
 *
 * Takes the override MAP rather than the whole settings object so callers can
 * subscribe to just `files.icons` — the tree must not re-render every time the
 * reading measure moves.
 */
export function resolveIcon(
  path: RelPath,
  name: string,
  kind: 'dir' | 'file',
  expanded: boolean,
  overrides: IconOverrides = {},
): ResolvedIcon {
  const override = overrides[path]
  if (override && isIconName(override.icon)) {
    return {
      icon: ICON_SET[override.icon],
      name: override.icon,
      colour: override.colour
        ? colourVar(override.colour)
        : kind === 'dir'
          ? DEFAULT_DIR_COLOUR
          : DEFAULT_FILE_COLOUR,
    }
  }

  if (kind === 'dir') {
    const match = FOLDER_HEURISTICS.find((f) => f.test.test(name))
    if (match) return { icon: ICON_SET[match.icon], name: match.icon, colour: colourVar(match.colour) }
    const fallback: IconName = expanded ? 'folderOpen' : 'folder'
    return { icon: ICON_SET[fallback], name: fallback, colour: DEFAULT_DIR_COLOUR }
  }

  const match = EXTENSION_HEURISTICS.find((f) => f.test.test(name))
  if (match) return { icon: ICON_SET[match.icon], name: match.icon, colour: colourVar(match.colour) }
  return { icon: ICON_SET.fileText, name: 'fileText', colour: DEFAULT_FILE_COLOUR }
}

/** For contributed sections and widgets, which name an icon but have no path. */
export function iconByName(name: string | undefined, fallback: IconName): LucideIcon {
  return name && isIconName(name) ? ICON_SET[name] : ICON_SET[fallback]
}
