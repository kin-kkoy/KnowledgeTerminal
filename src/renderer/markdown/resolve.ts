/**
 * Link and asset resolution against the workspace.
 *
 * Written here rather than pulled from `remark-wiki-link` because resolution
 * has to consult the actual file list: `[[cp1]]` should find
 * `curriculum/checkpoints/cp1.md` no matter which folder the linking document
 * lives in, and no published plugin can know that.
 */
import { basename, isMarkdown, joinRel, resolveFrom, stem } from '@shared/paths'
import type { DocRef, RelPath } from '@shared/types'

export interface ResolvedLink {
  path: RelPath | null
  /** The heading slug after `#`, if any. */
  heading: string | null
}

function normaliseKey(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Resolve a wiki-link target in four passes, most specific first:
 *   1. exact relative path (with or without the .md extension)
 *   2. exact path from the workspace root
 *   3. basename match — `[[cp1]]` finds `.../checkpoints/cp1.md`
 *   4. case-insensitive basename match
 * An unresolved target returns null and renders as a broken link rather than
 * silently pointing nowhere.
 */
export function resolveWikiLink(target: string, from: RelPath, docs: DocRef[]): RelPath | null {
  const cleaned = target.trim().replace(/\\/g, '/')
  if (!cleaned) return null

  const candidates = new Set<string>()
  for (const suffix of ['', '.md', '.markdown']) {
    candidates.add(resolveFrom(from, cleaned + suffix))
    candidates.add(joinRel(cleaned + suffix))
  }

  const byPath = new Map(docs.map((d) => [d.path, d.path]))
  for (const candidate of candidates) {
    const hit = byPath.get(candidate)
    if (hit) return hit
  }

  // Basename match, markdown first so `[[README]]` prefers a document over an
  // image that happens to share the stem.
  const wanted = normaliseKey(stem(cleaned))
  const markdownDocs = docs.filter((d) => isMarkdown(d.path))
  for (const pool of [markdownDocs, docs]) {
    const exact = pool.find((d) => stem(d.path) === stem(cleaned))
    if (exact) return exact.path
    const insensitive = pool.find((d) => normaliseKey(stem(d.path)) === wanted)
    if (insensitive) return insensitive.path
  }

  return null
}

/** Split `Target#Heading` into its parts. */
export function splitTarget(raw: string): { target: string; heading: string | null } {
  const hash = raw.indexOf('#')
  if (hash === -1) return { target: raw, heading: null }
  return { target: raw.slice(0, hash), heading: raw.slice(hash + 1) || null }
}

/**
 * Resolve an asset reference: document-relative first, then each configured
 * asset root. That ordering is what lets `![](Stonejaw.png)` work from a note
 * in `notes/` when the file actually lives in `assets/`.
 */
export function resolveAsset(
  src: string,
  from: RelPath,
  docs: DocRef[],
  assetRoots: string[],
): RelPath | null {
  const cleaned = decodeURIComponent(src.trim().replace(/\\/g, '/'))
  const known = new Set(docs.map((d) => d.path))

  const relative = resolveFrom(from, cleaned)
  if (known.has(relative)) return relative

  const fromRoot = joinRel(cleaned)
  if (known.has(fromRoot)) return fromRoot

  for (const root of assetRoots) {
    const candidate = joinRel(root, basename(cleaned))
    if (known.has(candidate)) return candidate
  }

  // Last resort: a unique basename match anywhere in the workspace.
  const name = normaliseKey(basename(cleaned))
  const matches = docs.filter((d) => normaliseKey(basename(d.path)) === name)
  return matches.length === 1 ? matches[0]!.path : null
}

/** True for anything that should open in the system browser, not a tab. */
export function isExternal(href: string): boolean {
  return /^(https?|mailto|tel):/i.test(href)
}
