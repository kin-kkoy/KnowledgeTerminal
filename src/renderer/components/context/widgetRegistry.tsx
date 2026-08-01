/**
 * The core context widgets, as DESCRIPTORS rather than a private map.
 *
 * Two consumers need this list: the panel, which renders whatever
 * `layout.contextWidgets` names, and the Sandbox, which has to offer the ones
 * you have not added yet. A module-private map served the first and made the
 * second impossible.
 *
 * `options` is the small part that earns its keep: every widget option in the
 * schema is `Record<string, unknown>`, so without a descriptor the Sandbox could
 * only offer a raw JSON box. Declaring the handful of options each widget
 * actually reads is what turns that into real controls.
 */
import type { ComponentType } from 'react'
import type { IconName } from '../../icons/registry'
import {
  CurrentGoal,
  CurrentMission,
  DailyNotes,
  OpenTabs,
  QuickActions,
  Recents,
} from './widgets/CoreWidgets'

export type WidgetComponent = ComponentType<{ options: Record<string, unknown> }>

/**
 * One editable option on a widget.
 *
 * Deliberately a tiny closed set of types — this describes config, not a form
 * library. Anything that needs more than these belongs in a plugin with its own
 * UI.
 */
export type OptionSpec =
  | { key: string; label: string; hint?: string; type: 'boolean'; default: boolean }
  | {
      key: string
      label: string
      hint?: string
      type: 'number'
      default: number
      min?: number
      max?: number
    }
  | { key: string; label: string; hint?: string; type: 'string'; default: string }
  | { key: string; label: string; hint?: string; type: 'stringList'; default: string[] }
  /** The one structured option in core: Quick Actions' `{label, command, icon}` list. */
  | { key: string; label: string; hint?: string; type: 'actions'; default: never[] }

export interface WidgetDescriptor {
  title: string
  /** One line, shown in the Sandbox's picker. */
  description: string
  icon: IconName
  component: WidgetComponent
  options?: OptionSpec[]
}

export const CORE_WIDGETS: Record<string, WidgetDescriptor> = {
  'core.currentMission': {
    title: 'Today',
    description: 'The workspace mission, plus where you left off.',
    icon: 'target',
    component: CurrentMission,
  },
  'core.currentGoal': {
    title: 'Current Goal',
    description: 'The single long-range goal from workspace settings.',
    icon: 'flag',
    component: CurrentGoal,
  },
  'core.openTabs': {
    title: 'Open Tabs',
    description: 'Everything currently open, in tab order.',
    icon: 'layers',
    component: OpenTabs,
  },
  'core.recents': {
    title: 'Recent',
    description: 'Documents you opened lately, most recent first.',
    icon: 'clock',
    component: Recents,
    options: [
      {
        key: 'limit',
        label: 'How many',
        hint: 'Rows before the list is cut off.',
        type: 'number',
        default: 8,
        min: 3,
        max: 30,
      },
    ],
  },
  'core.dailyNotes': {
    title: 'Daily Note',
    description: "Opens or creates today's note.",
    icon: 'calendar',
    component: DailyNotes,
    options: [
      {
        key: 'path',
        label: 'Path template',
        hint: '{{date}} is replaced with today, ISO-style.',
        type: 'string',
        default: 'notes/daily/{{date}}.md',
      },
    ],
  },
  'core.quickActions': {
    title: 'Quick Actions',
    description: 'A row of buttons that run commands.',
    icon: 'sparkles',
    component: QuickActions,
    options: [
      {
        key: 'actions',
        label: 'Actions',
        hint: 'Each runs one command. The icon is guessed from the label if you leave it blank.',
        type: 'actions',
        default: [],
      },
    ],
  },
}

/** The ids a workspace can name, for the Sandbox picker. */
export function coreWidgetIds(): string[] {
  return Object.keys(CORE_WIDGETS)
}
