/**
 * The `kt://` asset scheme.
 *
 * Images inside a workspace CANNOT be loaded over `file://`: with
 * `webSecurity: true` and an `http://localhost` dev origin the browser blocks
 * them, and turning webSecurity off to "fix" that is how Electron apps get
 * compromised. A privileged custom scheme is the correct answer.
 *
 * URL shape:  kt://<workspaceId>/<percent-encoded/relative/path>
 *
 * Two ordering traps live here, both silent when you get them wrong:
 *   1. `registerSchemesAsPrivileged` MUST run before `app.whenReady()`.
 *   2. Each path SEGMENT is encoded separately, or filenames containing
 *      spaces and slashes break. Real files in this project have both.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { protocol } from 'electron'
import { decodePathSegments, extname } from '@shared/paths'
import { requireRoot } from './fs/registry'
import { resolveInsideRootSync } from './fs/safety'

export const ASSET_SCHEME = 'kt'

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  pdf: 'application/pdf',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  json: 'application/json; charset=utf-8',
}

/** Call at module load in main, BEFORE app.whenReady(). Silently no-ops after. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: false,
      },
    },
  ])
}

export function assetUrl(workspaceId: string, encodedPath: string): string {
  return `${ASSET_SCHEME}://${workspaceId}/${encodedPath}`
}

/** Call after `app.whenReady()`. */
export function handleAssetScheme(): void {
  protocol.handle(ASSET_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)
      const workspaceId = url.hostname
      const rel = decodePathSegments(url.pathname)
      const abs = resolveInsideRootSync(requireRoot(workspaceId), rel)

      const info = await stat(abs)
      if (!info.isFile()) return new Response('Not a file', { status: 404 })

      const type = MIME[extname(rel)] ?? 'application/octet-stream'
      const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream
      return new Response(stream, {
        status: 200,
        headers: {
          'content-type': type,
          'content-length': String(info.size),
          // Assets are workspace-local and may change on disk; the renderer
          // busts the cache with an mtime query param when it needs to.
          'cache-control': 'no-cache',
        },
      })
    } catch (err) {
      const status = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 403
      return new Response(String(err), { status })
    }
  })
}
