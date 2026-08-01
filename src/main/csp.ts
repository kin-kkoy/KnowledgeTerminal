/**
 * Content Security Policy and permission lockdown.
 *
 * The policy stays strict because of one deliberate dependency choice: Shiki
 * runs on `@shikijs/engine-javascript`, not its default Oniguruma WASM engine.
 * The WASM engine would force `script-src 'wasm-unsafe-eval'` — a meaningful
 * weakening for a syntax highlighter.
 *
 * `style-src 'unsafe-inline'` is unavoidable: Shiki emits inline token colours
 * and React sets inline styles. Scripts stay locked, which is what matters.
 */
import { session, shell } from 'electron'
import { ASSET_SCHEME } from './protocol'

function policy(isDev: boolean): string {
  const directives = [
    `default-src 'none'`,
    // Vite's dev server injects an inline module preamble and uses a websocket.
    isDev ? `script-src 'self' 'unsafe-inline'` : `script-src 'self'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${ASSET_SCHEME}:`,
    `font-src 'self' data:`,
    `media-src 'self' ${ASSET_SCHEME}:`,
    isDev ? `connect-src 'self' ws: http://localhost:*` : `connect-src 'self'`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'none'`,
  ]
  return directives.join('; ')
}

export function applySecurityPolicy(isDev: boolean): void {
  const ses = session.defaultSession

  ses.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy(isDev)],
      },
    })
  })

  // Deny every powerful web API by default. This app reads local Markdown; it
  // has no business asking for a camera, a microphone or a location.
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  ses.setPermissionCheckHandler(() => false)
}

/**
 * Nothing in this app should ever navigate away from its own document, and no
 * link should be able to open a second Electron window. External links go to
 * the system browser instead.
 */
export function lockdownWebContents(contents: Electron.WebContents, allowedOrigin: string): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith(allowedOrigin)) {
      event.preventDefault()
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    }
  })

  contents.on('will-attach-webview', (event) => event.preventDefault())
}
