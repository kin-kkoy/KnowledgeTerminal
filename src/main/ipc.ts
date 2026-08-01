/**
 * The ONLY place `ipcMain.handle` is called.
 *
 * The `handle` helper below is typed against `IpcRequests`, so a channel typo,
 * a wrong argument type or a wrong return type is a compile error rather than
 * a runtime `undefined` in the renderer.
 */
import { BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell, type IpcMainInvokeEvent } from 'electron'
import type { IpcEventChannel, IpcEvents, IpcRequestChannel, IpcRequests } from '@shared/ipc-contract'
import { loadAppConfig, saveAppConfig } from './store/appConfig'
import {
  readHomeSnapshot,
  readPluginState,
  readSession,
  writeHomeSnapshot,
  writePluginState,
  writeSession,
  flushSessions,
} from './store/session'
import { registerFsHandlers } from './fs/handlers'
import { registerSearchHandlers } from './search/handlers'
import { requireRoot } from './fs/registry'
import { resolveInsideRoot } from './fs/safety'

export function handle<K extends IpcRequestChannel>(
  channel: K,
  fn: (event: IpcMainInvokeEvent, ...args: IpcRequests[K]['in']) => Promise<IpcRequests[K]['out']>,
): void {
  ipcMain.handle(channel, fn as never)
}

/** Push an event to every open window. */
export function broadcast<K extends IpcEventChannel>(channel: K, ...args: IpcEvents[K]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

export function registerIpcHandlers(): void {
  registerFsHandlers()
  registerSearchHandlers()

  // ── config ──────────────────────────────────────────────────────────────
  handle('cfg:readApp', async () => await loadAppConfig())
  handle('cfg:writeApp', async (_e, patch) => await saveAppConfig(patch))

  // ── session ─────────────────────────────────────────────────────────────
  handle('session:read', async (_e, id) => await readSession(id))
  handle('session:write', async (_e, id, session) => {
    writeSession(id, session)
  })
  handle('session:flush', async () => {
    await flushSessions()
  })
  handle('home:read', async () => await readHomeSnapshot())
  handle('home:write', async (_e, snapshot) => {
    await writeHomeSnapshot(snapshot)
  })

  // ── plugin state ────────────────────────────────────────────────────────
  handle('plugin:stateGet', async (_e, id, pluginId) => await readPluginState(id, pluginId))
  handle('plugin:stateSet', async (_e, id, pluginId, value) => {
    await writePluginState(id, pluginId, value)
  })

  // ── shell & window ──────────────────────────────────────────────────────
  handle('shell:openExternal', async (_e, url) => {
    // Only ever hand http(s) to the system browser. `file://` or a custom
    // scheme arriving here would mean something went wrong upstream.
    if (/^https?:\/\//i.test(url)) await shell.openExternal(url)
  })

  /**
   * Clipboard writes go through MAIN, not `navigator.clipboard`.
   *
   * The renderer is permission-locked (`setPermissionCheckHandler` denies
   * everything in csp.ts), which includes `clipboard-write` — so the web API
   * fails with NotAllowedError even when the window is focused. Electron's own
   * clipboard module needs no permission and no focus.
   */
  handle('shell:copyText', async (_e, text) => {
    clipboard.writeText(text)
  })

  handle('fs:reveal', async (_e, id, path) => {
    const abs = await resolveInsideRoot(requireRoot(id), path)
    shell.showItemInFolder(abs)
  })

  handle('ws:pickFolder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showOpenDialog(window, {
          title: 'Open Workspace Folder',
          properties: ['openDirectory', 'createDirectory'],
        })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  handle('win:setTitle', async (event, title) => {
    BrowserWindow.fromWebContents(event.sender)?.setTitle(title)
  })

  handle('win:setTheme', async (_e, theme) => {
    nativeTheme.themeSource = theme
    await saveAppConfig({ theme })
  })

  handle('win:setZoom', async (event, factor) => {
    event.sender.setZoomFactor(factor)
    await saveAppConfig({ zoom: factor })
  })

  handle('win:saveBounds', async (_e, bounds) => {
    await saveAppConfig({ window: bounds })
  })
}
