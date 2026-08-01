/**
 * The context bridge.
 *
 * This is a GENERIC invoke/on pair rather than forty hand-written wrappers.
 * The typing lives in `shared/ipc-contract.ts` and the channel strings live in
 * `renderer/platform/electron.ts` — so a stray channel name can never leak into
 * a component, and adding an IPC method touches two files instead of four.
 *
 * Runs at document_start, before the renderer's first script. That is what lets
 * us stamp `data-theme` ahead of the first paint and avoid a light flash on a
 * dark-theme launch.
 */
import { contextBridge, ipcRenderer } from 'electron'

function argValue(prefix: string, fallback: string): string {
  const found = process.argv.find((a) => a.startsWith(prefix))
  return found ? found.slice(prefix.length) : fallback
}

const initialTheme = argValue('--kt-theme=', 'dark') === 'light' ? 'light' : 'dark'
const assetScheme = argValue('--kt-scheme=', 'kt')

const bridge = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
    ipcRenderer.invoke(channel, ...args),

  on: (channel: string, cb: (...args: unknown[]) => void): (() => void) => {
    const listener = (_event: unknown, ...args: unknown[]): void => cb(...args)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.off(channel, listener)
    }
  },

  initialTheme,
  assetScheme,
}

contextBridge.exposeInMainWorld('kt', bridge)

// Beat first paint. The renderer re-applies this from config once it boots, but
// by then the window has already been painted in the right colours.
document.documentElement.dataset['theme'] = initialTheme
