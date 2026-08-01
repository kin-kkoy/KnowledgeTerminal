/**
 * Contributions from plugins and from the core itself.
 *
 * Core commands and plugin commands land in the SAME registry, which is why a
 * plugin's command shows up in the command palette, the menu and the keymap
 * with no extra wiring.
 */
import type { AnswerProvider } from '@shared/answers'
import type { WhenClause } from '@shared/commands'
import type { ComponentType } from 'react'
import type { OptionSpec } from '../components/context/widgetRegistry'
import type { SliceCreator } from './types'

export interface RegisteredCommand {
  id: string
  title: string
  category: string
  when?: WhenClause
  run(args?: unknown[]): void | Promise<void>
  /** Which plugin contributed it, or 'core'. Used to unregister on deactivate. */
  owner: string
}

export interface RegisteredWidget {
  id: string
  title: string
  component: ComponentType<{ options: Record<string, unknown> }>
  /** One line for the Sandbox's widget picker. */
  description?: string
  /** A name from the shared icon set. */
  icon?: string
  /**
   * Which options this widget reads. Without it the Sandbox can only offer a
   * raw JSON box for `options`, because the schema types it as unknown.
   */
  options?: OptionSpec[]
  owner: string
}

export interface RegisteredSection {
  id: string
  title: string
  icon?: string
  component: ComponentType
  owner: string
}

export interface RegisteredStatusItem {
  id: string
  align: 'left' | 'right'
  component: ComponentType
  owner: string
}

export interface RegisteredKeybinding {
  key: string
  command: string
  when?: WhenClause
  owner: string
}

/**
 * A plugin's contribution to the dashboard.
 *
 * This is how the app stays subject-agnostic: the core knows about a headline,
 * a streak and a counter, but has no idea what a "module" is. The curriculum
 * plugin fills those in; a workspace with no plugin simply shows less.
 */
export interface DashboardSource {
  owner: string
  get(): Partial<import('@shared/types').HomeSnapshot>
}

/**
 * A plugin's contribution to the answer router.
 *
 * The same separation as `DashboardSource`, one layer up: core owns the walk
 * and the layer ordering, plugins own everything subject-specific inside it.
 * This is the ONLY route by which a question like "have I learned delegates"
 * becomes answerable — the word "delegate", and the very idea of a curriculum,
 * never appear in core.
 */
export interface RegisteredAnswerProvider extends AnswerProvider {
  owner: string
}

/**
 * Typed relationships a plugin asserts.
 *
 * The derived graph can only know what the Markdown says. "This dragon is
 * connected to mining" is true of the workspace but stated nowhere in prose, so
 * it needs an assertion — and that assertion has to live outside core, or the
 * word "dragon" ends up in the search engine.
 */
export interface GraphEdgeSource {
  owner: string
  get(): import('@shared/types').TypedEdge[]
}

export interface PluginSlice {
  commands: Record<string, RegisteredCommand>
  widgets: Record<string, RegisteredWidget>
  sections: Record<string, RegisteredSection>
  statusItems: Record<string, RegisteredStatusItem>
  pluginKeybindings: RegisteredKeybinding[]
  dashboardSources: DashboardSource[]
  /**
   * Bumped whenever a contributor's data changes underneath its `get()`.
   *
   * `dashboardSources` are PULL-based, so their array identity says nothing
   * about whether the values inside would differ. A surface that stays mounted
   * — the Lobby tab — has no other way to know it should recompute. Core never
   * learns *what* changed, only that something did.
   */
  contributionVersion: number
  answerProviders: Record<string, RegisteredAnswerProvider>
  graphEdgeSources: GraphEdgeSource[]
  /** Plugins that threw during activation, shown once in the status bar. */
  failedPlugins: Array<{ id: string; error: string }>

  registerCommand(command: RegisteredCommand): void
  registerWidget(widget: RegisteredWidget): void
  registerSection(section: RegisteredSection): void
  registerStatusItem(item: RegisteredStatusItem): void
  registerKeybinding(binding: RegisteredKeybinding): void
  registerDashboardSource(source: DashboardSource): void
  /** Called by a contributor when its own state moved. */
  bumpContributions(): void
  registerAnswerProvider(provider: RegisteredAnswerProvider): void
  registerGraphEdges(source: GraphEdgeSource): void
  unregisterOwner(owner: string): void
  markPluginFailed(id: string, error: string): void

  runCommand(id: string, args?: unknown[]): void
}

export const createPluginSlice: SliceCreator<PluginSlice> = (set, get) => ({
  commands: {},
  widgets: {},
  sections: {},
  statusItems: {},
  pluginKeybindings: [],
  dashboardSources: [],
  contributionVersion: 0,
  answerProviders: {},
  graphEdgeSources: [],
  failedPlugins: [],

  registerCommand: (command) =>
    set((s) => ({ commands: { ...s.commands, [command.id]: command } })),
  registerWidget: (widget) => set((s) => ({ widgets: { ...s.widgets, [widget.id]: widget } })),
  registerSection: (section) =>
    set((s) => ({ sections: { ...s.sections, [section.id]: section } })),
  registerStatusItem: (item) =>
    set((s) => ({ statusItems: { ...s.statusItems, [item.id]: item } })),
  registerKeybinding: (binding) =>
    set((s) => ({ pluginKeybindings: [...s.pluginKeybindings, binding] })),
  registerDashboardSource: (source) =>
    set((s) => ({ dashboardSources: [...s.dashboardSources, source] })),

  bumpContributions: () => set((s) => ({ contributionVersion: s.contributionVersion + 1 })),
  registerAnswerProvider: (provider) =>
    set((s) => ({ answerProviders: { ...s.answerProviders, [provider.id]: provider } })),
  registerGraphEdges: (source) =>
    set((s) => ({ graphEdgeSources: [...s.graphEdgeSources, source] })),

  unregisterOwner(owner) {
    const drop = <T extends { owner: string }>(rec: Record<string, T>): Record<string, T> =>
      Object.fromEntries(Object.entries(rec).filter(([, v]) => v.owner !== owner))
    set((s) => ({
      commands: drop(s.commands),
      widgets: drop(s.widgets),
      sections: drop(s.sections),
      statusItems: drop(s.statusItems),
      pluginKeybindings: s.pluginKeybindings.filter((k) => k.owner !== owner),
      dashboardSources: s.dashboardSources.filter((d) => d.owner !== owner),
      answerProviders: drop(s.answerProviders),
      graphEdgeSources: s.graphEdgeSources.filter((g) => g.owner !== owner),
    }))
  },

  markPluginFailed(id, error) {
    set((s) => ({ failedPlugins: [...s.failedPlugins.filter((p) => p.id !== id), { id, error }] }))
    get().pushNotice({ level: 'warn', message: `Plugin "${id}" was disabled`, detail: error })
  },

  runCommand(id, args) {
    const command = get().commands[id]
    if (!command) {
      // An unknown command id is a config or plugin problem, never a crash.
      console.warn(`[commands] unknown command: ${id}`)
      return
    }
    try {
      void command.run(args)
    } catch (err) {
      get().pushNotice({ level: 'error', message: `Command "${id}" failed`, detail: String(err) })
    }
  },
})
