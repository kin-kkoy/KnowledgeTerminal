/**
 * Plugin activation.
 *
 * The important property is error containment: a plugin that throws during
 * activation is disabled, its registrations are rolled back, and a warning
 * appears in the status bar — while the workspace carries on working. That is
 * the entire point of having a seam rather than just calling the code.
 */
import type { WorkspaceInfo } from '@shared/platform'
import type { FileChange, RelPath } from '@shared/types'
import { platform } from '../platform'
import { store } from '../store'
import type { Disposable, KTPlugin, PluginContext } from './api'
import { BUILTIN_PLUGINS } from './builtin'

const active = new Map<string, { plugin: KTPlugin; disposables: Disposable[] }>()

function buildContext(plugin: KTPlugin, workspace: WorkspaceInfo): {
  ctx: PluginContext
  disposables: Disposable[]
} {
  const disposables: Disposable[] = []
  const track = (dispose: () => void): Disposable => {
    const disposable = { dispose }
    disposables.push(disposable)
    return disposable
  }

  /** Plugin ids must be namespaced, or two plugins could shadow each other. */
  const requireNamespaced = (id: string, kind: string): void => {
    if (!id.startsWith(`${plugin.id}.`)) {
      throw new Error(`${kind} id "${id}" must start with "${plugin.id}."`)
    }
  }

  const state = store.get()
  const options = (workspace.settings.plugins[plugin.id] ?? {}) as Record<string, unknown>

  const ctx: PluginContext = {
    id: plugin.id,
    workspace: { id: workspace.id, root: workspace.root, settings: workspace.settings },
    options,

    registerCommand(command) {
      requireNamespaced(command.id, 'command')
      state.registerCommand({
        id: command.id,
        title: command.title,
        category: command.category ?? plugin.name,
        ...(command.when ? { when: command.when } : {}),
        run: command.run,
        owner: plugin.id,
      })
      return track(() => state.unregisterOwner(plugin.id))
    },

    registerContextWidget(widget) {
      requireNamespaced(widget.id, 'widget')
      state.registerWidget({ ...widget, owner: plugin.id })
      return track(() => state.unregisterOwner(plugin.id))
    },

    registerExplorerSection(section) {
      // Explorer section ids are referenced by `layout.explorerSections` in
      // user config, so they stay short and unnamespaced by design.
      state.registerSection({ ...section, owner: plugin.id })
      return track(() => state.unregisterOwner(plugin.id))
    },

    registerKeybinding(binding) {
      state.registerKeybinding({ ...binding, owner: plugin.id })
      return track(() => state.unregisterOwner(plugin.id))
    },

    registerStatusItem(item) {
      requireNamespaced(item.id, 'status item')
      state.registerStatusItem({ ...item, owner: plugin.id })
      return track(() => state.unregisterOwner(plugin.id))
    },

    registerDashboardSource(get) {
      state.registerDashboardSource({ owner: plugin.id, get })
      return track(() => state.unregisterOwner(plugin.id))
    },

    registerAnswerProvider(provider) {
      requireNamespaced(provider.id, 'answer provider')
      state.registerAnswerProvider({ ...provider, owner: plugin.id })
      return track(() => state.unregisterOwner(plugin.id))
    },

    registerGraphEdges(get) {
      state.registerGraphEdges({ owner: plugin.id, get })
      return track(() => state.unregisterOwner(plugin.id))
    },

    fs: {
      async readText(path: RelPath) {
        return (await platform.readTextFile(workspace.id, path)).content
      },
      async exists(path: RelPath) {
        return await platform.exists(workspace.id, path)
      },
      watch(cb: (changes: FileChange[]) => void) {
        const off = platform.onFileChanged(cb)
        return track(off)
      },
    },

    state: {
      async get<T>() {
        // A workspace-relative `stateFile` keeps the data with the notes rather
        // than in userData — see the API docs for why that is the right default
        // for anything the user would miss.
        const file = typeof options['stateFile'] === 'string' ? options['stateFile'] : null
        if (file) {
          if (!(await platform.exists(workspace.id, file))) return null
          try {
            const text = await platform.readTextFile(workspace.id, file)
            return JSON.parse(text.content) as T
          } catch {
            return null
          }
        }
        return (await platform.pluginState.get(workspace.id, plugin.id)) as T | null
      },
      async set<T>(value: T) {
        const file = typeof options['stateFile'] === 'string' ? options['stateFile'] : null
        if (file) {
          await platform.writeTextFile(workspace.id, file, JSON.stringify(value, null, 2) + '\n')
          return
        }
        await platform.pluginState.set(workspace.id, plugin.id, value)
      },
    },

    app: {
      openDocument(path, opts) {
        store.get().openDocument(path, opts?.pane ? { pane: opts.pane } : undefined)
        if (opts?.heading) {
          requestAnimationFrame(() => {
            document.getElementById(opts.heading!)?.scrollIntoView({ block: 'start' })
          })
        }
      },
      runCommand(id, args) {
        store.get().runCommand(id, args)
      },
      notify(message, level = 'info') {
        store.get().pushNotice({ level, message })
      },
      refreshContributions() {
        store.get().bumpContributions()
      },
      onDocumentOpened(cb) {
        const unsubscribe = store.subscribe(
          (s) => s.activeTab()?.path ?? null,
          (path) => {
            if (path) cb(path)
          },
        )
        return track(unsubscribe)
      },
    },
  }

  return { ctx, disposables }
}

/** Activate every enabled built-in plugin for a workspace. */
export async function activatePlugins(workspace: WorkspaceInfo): Promise<void> {
  await deactivatePlugins()

  for (const plugin of BUILTIN_PLUGINS) {
    const config = workspace.settings.plugins[plugin.id]
    // Absent config means "not configured for this workspace" — stay quiet.
    if (!config || config.enabled === false) continue

    const { ctx, disposables } = buildContext(plugin, workspace)
    try {
      await plugin.activate(ctx)
      active.set(plugin.id, { plugin, disposables })
    } catch (err) {
      for (const disposable of disposables) {
        try {
          disposable.dispose()
        } catch {
          /* a failing teardown must not mask the original error */
        }
      }
      store.get().unregisterOwner(plugin.id)
      store.get().markPluginFailed(plugin.id, err instanceof Error ? err.message : String(err))
    }
  }
}

export async function deactivatePlugins(): Promise<void> {
  for (const [id, entry] of active) {
    try {
      await entry.plugin.deactivate?.()
    } catch (err) {
      console.error(`[plugins] ${id} failed to deactivate`, err)
    }
    for (const disposable of entry.disposables) {
      try {
        disposable.dispose()
      } catch {
        /* ignore */
      }
    }
    store.get().unregisterOwner(id)
  }
  active.clear()
}
