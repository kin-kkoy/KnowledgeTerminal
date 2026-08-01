/**
 * Main process entry.
 *
 * Ordering here is load-bearing:
 *   1. `registerAssetScheme()` runs at module load — `registerSchemesAsPrivileged`
 *      silently does nothing once the app is ready.
 *   2. The single-instance lock is taken before anything else, so a second
 *      launch focuses the existing window instead of racing it for the session
 *      file.
 *   3. Quit flushes the renderer's freshest scroll state, with a timeout, so a
 *      wedged renderer can never make the app unquittable.
 */
import { app, BrowserWindow } from 'electron'
import { applySecurityPolicy } from './csp'
import { stopAllWatching } from './fs/watcher'
import { broadcast, registerIpcHandlers } from './ipc'
import { buildMenu } from './menu'
import { handleAssetScheme, registerAssetScheme } from './protocol'
import { loadAppConfig } from './store/appConfig'
import { shutdown as shutdownSearch } from './search/service'
import { flushSessions } from './store/session'
import { createWindow, focusExisting } from './window'

// MUST be before app.whenReady(). See protocol.ts.
registerAssetScheme()

const isDev = !app.isPackaged
const RENDERER_DEV_URL = process.env['ELECTRON_RENDERER_URL'] ?? 'http://localhost:5173'

let mainWindow: BrowserWindow | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => focusExisting(mainWindow))

  app.whenReady().then(async () => {
    handleAssetScheme()
    applySecurityPolicy(isDev)
    registerIpcHandlers()

    const config = await loadAppConfig()
    mainWindow = await createWindow(isDev, RENDERER_DEV_URL)
    mainWindow.webContents.setZoomFactor(config.zoom)
    buildMenu((commandId) => broadcast('evt:command', commandId))

    mainWindow.on('closed', () => {
      mainWindow = null
    })

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = await createWindow(isDev, RENDERER_DEV_URL)
      }
    })
  })

  // On Linux and Windows, closing the last window means quitting.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  /**
   * The renderer holds scroll positions that main has not seen yet. Give it a
   * moment to hand them over — but only a moment. Without the timeout, a hung
   * renderer would make the application impossible to close, which is a far
   * worse failure than losing one scroll offset.
   */
  const FLUSH_TIMEOUT_MS = 300
  let quitting = false

  app.on('before-quit', (event) => {
    if (quitting) return
    quitting = true
    event.preventDefault()

    broadcast('evt:quitting')

    // The renderer's final `session:write` arrives through the normal IPC path,
    // so all we need is a bounded window for it to land in before we drain the
    // debounced writer.
    const grace = new Promise<void>((resolve) => setTimeout(resolve, FLUSH_TIMEOUT_MS))

    void grace
      .then(async () => {
        stopAllWatching()
        shutdownSearch()
        await flushSessions()
      })
      .catch((err) => console.error('[main] flush on quit failed', err))
      .finally(() => app.exit(0))
  })
}
