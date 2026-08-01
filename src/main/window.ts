/**
 * The BrowserWindow.
 *
 * Everything here exists to make the first frame correct. The killers are a
 * white flash on a dark theme, a window that appears at the wrong size and then
 * jumps, and a visible empty shell while content loads. Countermeasures:
 *
 *  - `show: false` + `ready-to-show`, so the window is never seen empty.
 *  - `backgroundColor` from the theme read SYNCHRONOUSLY off disk in main.
 *  - the theme pushed through `additionalArguments`, so the preload can stamp
 *    `data-theme` on <html> before the renderer's first script runs.
 */
import { join } from 'node:path'
import { BrowserWindow, screen, shell } from 'electron'
import { lockdownWebContents } from './csp'
import { ASSET_SCHEME } from './protocol'
import { loadAppConfig, readThemeSync, saveAppConfig } from './store/appConfig'

/** How long the renderer gets to hand over its state before we force the close. */
const FLUSH_GRACE_MS = 300

const BACKGROUND: Record<'dark' | 'light', string> = {
  // Must match --bg in styles/themes.css exactly, or the theme "settles" on load.
  dark: '#151719',
  light: '#FBFAF8',
}

/** Keep a restored window on an actually-connected display. */
function clampToDisplay(bounds: {
  x: number | null
  y: number | null
  width: number
  height: number
}): { x?: number; y?: number; width: number; height: number } {
  const width = Math.max(640, bounds.width)
  const height = Math.max(420, bounds.height)
  if (bounds.x === null || bounds.y === null) return { width, height }

  const area = screen.getDisplayMatching({ x: bounds.x, y: bounds.y, width, height }).workArea
  const visible =
    bounds.x < area.x + area.width &&
    bounds.x + width > area.x &&
    bounds.y < area.y + area.height &&
    bounds.y + height > area.y
  return visible ? { x: bounds.x, y: bounds.y, width, height } : { width, height }
}

export async function createWindow(isDev: boolean, rendererUrl: string): Promise<BrowserWindow> {
  const theme = readThemeSync()
  const config = await loadAppConfig()
  const bounds = clampToDisplay(config.window)

  const window = new BrowserWindow({
    ...bounds,
    minWidth: 720,
    minHeight: 480,
    show: false,
    backgroundColor: BACKGROUND[theme],
    title: 'Knowledge Terminal',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
      // Read by the preload before first paint. See preload/index.ts.
      additionalArguments: [`--kt-theme=${theme}`, `--kt-scheme=${ASSET_SCHEME}`],
    },
  })

  if (config.window.maximized) window.maximize()

  lockdownWebContents(window.webContents, isDev ? rendererUrl : 'file://')

  window.once('ready-to-show', () => window.show())

  // Persist geometry so the next launch opens where this one closed. Debounced
  // via the resize/move events settling, not on every pixel.
  let saveTimer: NodeJS.Timeout | null = null
  const persistBounds = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (window.isDestroyed()) return
      const maximized = window.isMaximized()
      const b = maximized ? window.getNormalBounds() : window.getBounds()
      void saveAppConfig({ window: { x: b.x, y: b.y, width: b.width, height: b.height, maximized } })
    }, 400)
  }
  window.on('resize', persistBounds)
  window.on('move', persistBounds)
  window.on('maximize', persistBounds)
  window.on('unmaximize', persistBounds)

  window.webContents.on('render-process-gone', (_e, details) => {
    console.error('[main] renderer gone:', details.reason)
  })

  /**
   * Ask the renderer for its freshest state BEFORE the window is destroyed.
   *
   * `app.on('before-quit')` is too late for this: closing the last window
   * destroys the renderer first and only then quits, so a handshake issued from
   * `before-quit` is sent to a process that no longer exists. The scroll
   * position the reader just left would be lost every time they closed the
   * window rather than quitting from the menu.
   *
   * The timeout is not optional. Without it a wedged renderer would make the
   * window impossible to close, which is far worse than losing one offset.
   */
  let flushed = false
  window.on('close', (event) => {
    if (flushed || window.webContents.isDestroyed()) return
    event.preventDefault()
    flushed = true
    window.webContents.send('evt:quitting')
    setTimeout(() => {
      if (!window.isDestroyed()) window.destroy()
    }, FLUSH_GRACE_MS)
  })

  if (isDev) {
    await window.loadURL(rendererUrl)
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

export function focusExisting(window: BrowserWindow | null): void {
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.focus()
}

export { shell }
