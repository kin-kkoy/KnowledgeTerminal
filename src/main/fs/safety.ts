/**
 * The path guard. EVERY filesystem handler routes through `resolveInsideRoot`.
 *
 * The renderer only ever sends workspace-relative paths, but a compromised or
 * buggy renderer could send `../../.ssh/id_rsa`. Resolving and then verifying
 * containment — after realpath, so symlinks can't escape either — is the whole
 * defence, and it is one function so it can be reasoned about and tested.
 */
import { realpath } from 'node:fs/promises'
import { isAbsolute, resolve, sep } from 'node:path'
import { normalizeRel } from '@shared/paths'
import type { RelPath } from '@shared/types'

export class PathEscapeError extends Error {
  constructor(rel: string) {
    super(`Refused path outside workspace: ${rel}`)
    this.name = 'PathEscapeError'
  }
}

function isContained(root: string, target: string): boolean {
  return target === root || target.startsWith(root + sep)
}

/**
 * Resolve a workspace-relative path to an absolute one, or throw.
 *
 * `realpath` is attempted on the target so a symlink pointing outside the
 * workspace is rejected. A path that does not exist yet cannot be realpath'd,
 * so in that case we fall back to checking the lexical resolution — which is
 * still safe, because `resolve` has already collapsed every `..`.
 */
export async function resolveInsideRoot(root: string, rel: RelPath): Promise<string> {
  const cleaned = normalizeRel(rel ?? '')
  if (isAbsolute(cleaned)) throw new PathEscapeError(rel)

  const realRoot = await realpath(root)
  const target = resolve(realRoot, cleaned)
  if (!isContained(realRoot, target)) throw new PathEscapeError(rel)

  try {
    const realTarget = await realpath(target)
    if (!isContained(realRoot, realTarget)) throw new PathEscapeError(rel)
    return realTarget
  } catch (err) {
    // ENOENT is expected for files we are about to create; anything else is real.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    return target
  }
}

/** Synchronous, lexical-only variant for the asset protocol's hot path. */
export function resolveInsideRootSync(root: string, rel: RelPath): string {
  const cleaned = normalizeRel(rel ?? '')
  if (isAbsolute(cleaned)) throw new PathEscapeError(rel)
  const target = resolve(root, cleaned)
  if (!isContained(resolve(root), target)) throw new PathEscapeError(rel)
  return target
}
