/**
 * Pure path helpers. No `node:path` — this file is typechecked for the browser
 * too, and workspace-relative paths are always POSIX-style regardless of host.
 */
import type { RelPath } from './types'

export const MARKDOWN_EXTS = new Set(['md', 'markdown', 'mdx'])
export const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'])

/** Collapse `\` to `/`, strip leading `./` and any leading/trailing slash. */
export function normalizeRel(p: string): RelPath {
  return p
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\/{2,}/g, '/')
}

export function joinRel(...parts: string[]): RelPath {
  return normalizeRel(parts.filter(Boolean).join('/'))
}

export function dirnameRel(p: RelPath): RelPath {
  const i = normalizeRel(p).lastIndexOf('/')
  return i === -1 ? '' : normalizeRel(p).slice(0, i)
}

export function basename(p: RelPath): string {
  const n = normalizeRel(p)
  const i = n.lastIndexOf('/')
  return i === -1 ? n : n.slice(i + 1)
}

export function extname(p: RelPath): string {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase()
}

/** Filename without extension — the fallback document title. */
export function stem(p: RelPath): string {
  const b = basename(p)
  const i = b.lastIndexOf('.')
  return i <= 0 ? b : b.slice(0, i)
}

export function isMarkdown(p: RelPath): boolean {
  return MARKDOWN_EXTS.has(extname(p))
}

export function isImage(p: RelPath): boolean {
  return IMAGE_EXTS.has(extname(p))
}

/** Resolve `rel` against the directory of `fromDoc`, handling `.` and `..`. */
export function resolveFrom(fromDoc: RelPath, rel: string): RelPath {
  if (rel.startsWith('/')) return normalizeRel(rel)
  const base = dirnameRel(fromDoc).split('/').filter(Boolean)
  for (const seg of normalizeRel(rel).split('/')) {
    if (seg === '.' || seg === '') continue
    if (seg === '..') base.pop()
    else base.push(seg)
  }
  return base.join('/')
}

export function segments(p: RelPath): string[] {
  return normalizeRel(p).split('/').filter(Boolean)
}

/** Every ancestor directory of `p`, shallowest first. Used to auto-expand the tree. */
export function ancestorDirs(p: RelPath): RelPath[] {
  const segs = segments(dirnameRel(p))
  return segs.map((_, i) => segs.slice(0, i + 1).join('/'))
}

/**
 * Encode a relative path for a custom-scheme URL, per segment.
 *
 * Encoding the whole path at once would eat the separators. Real filenames in
 * this project contain spaces AND an underscore-space
 * ("Emberclaw_ Dragon Bestiary Dossier.png") — this is not hypothetical.
 */
export function encodePathSegments(p: RelPath): string {
  return segments(p).map(encodeURIComponent).join('/')
}

export function decodePathSegments(p: string): RelPath {
  return p.split('/').filter(Boolean).map(decodeURIComponent).join('/')
}

/**
 * Non-cryptographic 32-bit hash (FNV-1a), rendered as 8 hex chars.
 * Used for workspace ids and content hashes — fast and stable across processes.
 */
export function hashString(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Human-readable elapsed time for the Home screen's "Last Session" line. */
export function relativeTime(from: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.round((now - from) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return m === 1 ? '1 minute ago' : `${m} minutes ago`
  const h = Math.round(m / 60)
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`
  const d = Math.round(h / 24)
  if (d < 30) return d === 1 ? 'yesterday' : `${d} days ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return mo === 1 ? '1 month ago' : `${mo} months ago`
  const y = Math.round(mo / 12)
  return y === 1 ? '1 year ago' : `${y} years ago`
}

/**
 * Minimal glob matcher for the include/ignore lists in settings.json.
 * Supports `**`, `*` and `?`. Deliberately not a full glob implementation —
 * config globs here only ever need to match paths, not brace-expand.
 */
export function globToRegExp(glob: string): RegExp {
  let out = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // `**/` may match zero directories, so the slash is part of the group.
        if (glob[i + 2] === '/') {
          out += '(?:.*\\/)?'
          i += 2
        } else {
          out += '.*'
          i += 1
        }
      } else {
        out += '[^/]*'
      }
    } else if (c === '?') out += '[^/]'
    else if ('\\^$.|+()[]{}'.includes(c)) out += '\\' + c
    else if (c === '/') out += '\\/'
    else out += c
  }
  return new RegExp('^' + out + '$')
}

export function matchesAny(path: RelPath, globs: string[]): boolean {
  const p = normalizeRel(path)
  return globs.some((g) => globToRegExp(normalizeRel(g)).test(p))
}
