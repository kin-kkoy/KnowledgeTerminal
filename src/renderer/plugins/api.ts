/**
 * The plugin contract.
 *
 * A seam, not a framework. Its whole job is to let git integration, a pomodoro
 * timer, flashcards or an AI panel arrive later without the core learning
 * anything about them.
 *
 * The capability surface is deliberately narrow, and one rule does most of the
 * work: **`fs` is READ-ONLY**. A plugin that wants to remember something uses
 * `ctx.state`, which main writes into `userData/plugin-state/<workspace>/<id>`.
 * That single restriction means no plugin can corrupt the user's Markdown — a
 * real isolation property, achievable in-process, and worth more than a
 * sandbox that only pretends.
 *
 * HONESTY ABOUT v1: plugins are statically-registered in-process modules. There
 * is no dynamic loading of third-party code and no sandbox. Isolation here
 * means a narrow API plus error containment, nothing more. Because the context
 * is a plain object of functions and plugins never import app internals, moving
 * to an out-of-process host later replaces this implementation rather than the
 * contract.
 */
import type { ComponentType } from 'react'
import type { AnswerProvider } from '@shared/answers'
import type { WhenClause } from '@shared/commands'
import type { WorkspaceSettings } from '@shared/config-schema'
import type { FileChange, HomeSnapshot, RelPath, TypedEdge, WorkspaceId } from '@shared/types'
import type { OptionSpec } from '../components/context/widgetRegistry'

export type { OptionSpec }

export interface Disposable {
  dispose(): void
}

export interface PluginContext {
  readonly id: string
  readonly workspace: { id: WorkspaceId; root: string; settings: WorkspaceSettings }
  /** `settings.plugins[id]`. The plugin validates its own shape. */
  readonly options: Record<string, unknown>

  registerCommand(command: {
    /** MUST be `${pluginId}.${name}` — enforced at registration. */
    id: string
    title: string
    category?: string
    when?: WhenClause
    run(args?: unknown[]): void | Promise<void>
  }): Disposable

  /**
   * `description`, `icon` and `options` are what let the Sandbox present this
   * widget as a real choice with real controls rather than an opaque id. All
   * optional — a widget that declares none still works, it is just harder to
   * configure without editing JSON.
   */
  registerContextWidget(widget: {
    id: string
    title: string
    component: ComponentType<{ options: Record<string, unknown> }>
    description?: string
    icon?: string
    options?: OptionSpec[]
  }): Disposable

  registerExplorerSection(section: {
    id: string
    title: string
    icon?: string
    component: ComponentType
  }): Disposable

  registerKeybinding(binding: { key: string; command: string; when?: WhenClause }): Disposable

  registerStatusItem(item: {
    id: string
    align: 'left' | 'right'
    component: ComponentType
  }): Disposable

  /**
   * Contribute to the dashboard. Called whenever the snapshot is rebuilt.
   *
   * This is the seam that keeps the core subject-agnostic: it knows about a
   * headline, a streak and a labelled counter, and nothing about modules.
   */
  registerDashboardSource(get: () => Partial<HomeSnapshot>): Disposable

  /**
   * Contribute to the answer router.
   *
   * The same bargain as `registerDashboardSource`, one level up: the core owns
   * the layer ordering and the walk, and knows nothing about what is being
   * asked. A provider returns `null` for anything it does not recognise, which
   * is most questions — declining is the normal case, not an error.
   *
   * Layer 1 is the intended home for structured workspace data (a curriculum, a
   * reading list, an issue tracker). Layers 0, 2, 3 and 4 are core and generic;
   * a plugin may register at those too, and will simply be consulted alongside
   * the built-in provider for that layer.
   */
  registerAnswerProvider(provider: AnswerProvider): Disposable

  /**
   * Assert relationships the Markdown does not state.
   *
   * The document graph is derived from links, tags and layout, so it never goes
   * stale — but it can only know what the prose says. A relationship like "this
   * creature is connected to that industry" exists in the workspace's own model
   * of itself and nowhere in the text. Contributing it here keeps that
   * vocabulary in the plugin: core merges the edges without knowing what they
   * mean.
   */
  registerGraphEdges(get: () => TypedEdge[]): Disposable

  // ── capabilities ────────────────────────────────────────────────────────

  /** Read-only. There is no write counterpart, by design. */
  readonly fs: {
    readText(path: RelPath): Promise<string>
    exists(path: RelPath): Promise<boolean>
    watch(cb: (changes: FileChange[]) => void): Disposable
  }

  /**
   * Namespaced per workspace AND per plugin.
   *
   * Where it lands depends on the plugin's own `stateFile` option: a
   * workspace-relative path keeps it WITH the notes (portable, committable,
   * backed up alongside them), and the default keeps it machine-local. Progress
   * through a curriculum is data the user would want to keep, so that plugin
   * asks for the former.
   */
  readonly state: {
    get<T>(): Promise<T | null>
    set<T>(value: T): Promise<void>
  }

  readonly app: {
    openDocument(path: RelPath, opts?: { pane?: 'active' | 'right'; heading?: string }): void
    runCommand(id: string, args?: unknown[]): void
    notify(message: string, level?: 'info' | 'warn'): void
    onDocumentOpened(cb: (path: RelPath) => void): Disposable
    /**
     * Tell core that this plugin's contributed data changed.
     *
     * Contributions are pulled, not pushed, so a long-lived core surface cannot
     * tell a stale value from a fresh one. Call this after mutating whatever
     * `registerDashboardSource` reads.
     */
    refreshContributions(): void
  }
}

export interface KTPlugin {
  id: string
  name: string
  description?: string
  activate(ctx: PluginContext): void | Promise<void>
  deactivate?(): void | Promise<void>
}

/** Identity helper — exists so plugin modules read declaratively. */
export const definePlugin = (plugin: KTPlugin): KTPlugin => plugin
