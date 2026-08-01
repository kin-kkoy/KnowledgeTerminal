/**
 * Application root: dashboard or workspace shell.
 *
 * The launch path deliberately does NOT open the document viewer. The spec is
 * explicit about it, and `openLastWorkspaceOnLaunch: false` plus
 * `workspace.startupPage: "home"` are what enforce it in config rather than in
 * code.
 */
import { useCallback, useEffect } from 'react'
import { registerCoreCommands } from './commands/core'
import { useAppearance } from './hooks/useAppearance'
import { invalidateDocument, isSelfWrite } from './hooks/useDocument'
import { useKeybindings } from './hooks/useKeybindings'
import { invalidateRendered } from './hooks/useRenderedMarkdown'
import { warmMarkdownPipeline } from './markdown/pipeline'
import { platform } from './platform'
import { activatePlugins } from './plugins/registry'
import { useStore } from './store'
import {
  flushSession,
  markSessionToday,
  restoreSession,
  startSessionSync,
  watchActiveDocument,
  writeHomeSnapshot,
} from './store/sessionSync'
import { Dashboard } from './components/home/Dashboard'
import { Modals } from './components/modals/Modals'
import { Sandbox } from './components/sandbox/Sandbox'
import { WorkspaceShell } from './components/shell/WorkspaceShell'

export function App(): React.JSX.Element {
  const screen = useStore((s) => s.screen)
  const hasWorkspace = useStore((s) => s.workspace !== null)
  const openWorkspace = useStore((s) => s.openWorkspace)
  const setScreen = useStore((s) => s.setScreen)
  const openModal = useStore((s) => s.openModal)
  const applySettings = useStore((s) => s.applySettings)
  const applyFileChanges = useStore((s) => s.applyFileChanges)
  const setIndexStatus = useStore((s) => s.setIndexStatus)
  const runCommand = useStore((s) => s.runCommand)

  useAppearance()
  useKeybindings()

  // Core commands register once; plugins add to the same registry later.
  useEffect(registerCoreCommands, [])

  // Build the Shiki highlighter while the user is still reading the dashboard,
  // so the first document does not pay for it.
  useEffect(() => {
    const id = window.setTimeout(warmMarkdownPipeline, 300)
    return () => window.clearTimeout(id)
  }, [])

  // Main-process pushes. Subscribed once, for the life of the window.
  useEffect(() => {
    const offFiles = platform.onFileChanged((batch) => {
      const workspaceId = useStore.getState().workspace?.id
      // Our own writes (a ticked checkbox) must not bounce back as an external
      // edit and re-render the page under the reader.
      const external = batch.filter((c) => !isSelfWrite(c.path))
      for (const change of external) {
        if (workspaceId) invalidateDocument(workspaceId, change.path)
        invalidateRendered(change.path)
      }
      if (external.length > 0) applyFileChanges(external)
    })
    const offIndex = platform.onIndexStatus(setIndexStatus)
    // settings.json was edited outside the app. `.kt` is pruned from the file
    // watcher, so this comes from a dedicated watch in main rather than evt:files.
    const offSettings = platform.onSettingsChanged((_id, settings, problems) =>
      applySettings(settings, problems),
    )
    const offCommand = platform.onMenuCommand((commandId) => runCommand(commandId))

    // Main gives the renderer a bounded window to hand over the freshest scroll
    // position before the process exits. See main/window.ts `close`.
    const offQuit = platform.onBeforeQuit(() => {
      void flushSession()
      void writeHomeSnapshot()
    })

    return () => {
      offFiles()
      offIndex()
      offSettings()
      offCommand()
      offQuit()
    }
  }, [applyFileChanges, applySettings, runCommand, setIndexStatus])

  // Losing focus is the other moment worth persisting: the user may be about to
  // close the laptop rather than the window.
  useEffect(() => {
    const onBlur = (): void => {
      if (useStore.getState().workspace) void flushSession()
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  const resume = useCallback(
    async (root: string, opts: { lastDocument?: boolean } = {}) => {
      const info = await openWorkspace(root)
      if (!info) return

      platform.setWindowTitle(`${info.name} — Knowledge Terminal`)

      // Restore BEFORE showing the shell, so the first DocumentView that mounts
      // already finds its scroll anchor in the registry.
      const hadTabs = await restoreSession(info)

      // Plugins activate before the shell renders, so their explorer sections
      // and context widgets are registered when the panels first ask for them.
      await activatePlugins(info)

      startSessionSync(info.id)
      watchActiveDocument()
      setScreen('workspace')
      await markSessionToday()

      // `Begin` opens today's work; `Shift+Enter` returns to the open tabs.
      if (!opts.lastDocument || !hadTabs) {
        const entry = info.settings.workspace.entryDocument
        if (entry && (await platform.exists(info.id, entry))) {
          useStore.getState().openDocument(entry)
        }
      }

      void writeHomeSnapshot()
    },
    [openWorkspace, setScreen],
  )

  // `workspace.open` runs from the command registry, which has no access to
  // this component's `resume`. A window event is the smallest bridge that does
  // not turn the command list into a React dependency.
  useEffect(() => {
    const onOpen = (event: Event): void => {
      const root = (event as CustomEvent<string>).detail
      if (root) void resume(root)
    }
    window.addEventListener('kt:open-workspace', onOpen)
    return () => window.removeEventListener('kt:open-workspace', onOpen)
  }, [resume])

  return (
    <>
      {screen === 'sandbox' ? (
        <Sandbox />
      ) : screen === 'workspace' && hasWorkspace ? (
        <WorkspaceShell />
      ) : (
        <Dashboard onResume={resume} onOpenModal={openModal} />
      )}
      <Modals />
    </>
  )
}
