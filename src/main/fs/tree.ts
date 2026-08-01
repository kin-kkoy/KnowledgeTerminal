/**
 * The workspace walk.
 *
 * Uses `opendir`'s async iterator rather than a recursive `readdir` so that
 * directories are streamed instead of materialised, and so a pruned directory
 * costs nothing. Pruning happens AT THE WALK, not by filtering afterwards —
 * that difference is what keeps `node_modules` and `.git` from being descended
 * into at all (and, in Phase 6, from consuming inotify watches).
 */
import { opendir } from 'node:fs/promises'
import { join } from 'node:path'
import { extname, joinRel, matchesAny, normalizeRel } from '@shared/paths'
import type { RelPath, TreeNode } from '@shared/types'
import { resolveInsideRoot } from './safety'

/**
 * Directories never descended into, regardless of config. A user can add more
 * via `files.ignore`, but they cannot remove these — descending into `.git` on
 * a large repo is never what anyone wants.
 */
const ALWAYS_PRUNE = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.kt',
  '.obsidian',
  '.trash',
  '__pycache__',
  '.venv',
])

export interface WalkOptions {
  /** Globs from `files.include`. Empty means "every file". */
  include: string[]
  /** Globs from `files.ignore`. */
  ignore: string[]
  /** Guard against pathological trees and symlink loops. */
  maxDepth?: number
  maxEntries?: number
}

function includesFile(path: RelPath, opts: WalkOptions): boolean {
  if (opts.ignore.length > 0 && matchesAny(path, opts.ignore)) return false
  if (opts.include.length === 0) return true
  return matchesAny(path, opts.include)
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  // Directories first, then case-insensitive natural order — the arrangement
  // every file explorer uses, because it is the one people can scan.
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/** Walk the whole workspace into a nested tree. */
export async function walkTree(root: string, opts: WalkOptions): Promise<TreeNode> {
  const maxDepth = opts.maxDepth ?? 24
  const maxEntries = opts.maxEntries ?? 100_000
  let seen = 0

  async function walk(absDir: string, relDir: RelPath, depth: number): Promise<TreeNode[]> {
    if (depth > maxDepth || seen >= maxEntries) return []
    const out: TreeNode[] = []

    let dir
    try {
      dir = await opendir(absDir)
    } catch {
      // An unreadable directory is not a reason to fail the whole workspace.
      return out
    }

    for await (const entry of dir) {
      if (seen >= maxEntries) break
      const rel = joinRel(relDir, entry.name)

      if (entry.isDirectory()) {
        if (ALWAYS_PRUNE.has(entry.name)) continue
        if (opts.ignore.length > 0 && matchesAny(rel, opts.ignore)) continue
        const children = await walk(join(absDir, entry.name), rel, depth + 1)
        // Hide directories that contain nothing the user asked to see.
        if (children.length === 0) continue
        seen++
        out.push({ path: rel, name: entry.name, kind: 'dir', children: sortNodes(children) })
      } else if (entry.isFile()) {
        if (!includesFile(rel, opts)) continue
        seen++
        out.push({ path: rel, name: entry.name, kind: 'file', ext: extname(entry.name) })
      }
      // Symlinks are deliberately skipped: following them invites cycles, and
      // `resolveInsideRoot` would reject anything pointing outside anyway.
    }
    return out
  }

  const children = await walk(root, '', 0)
  return { path: '', name: 'workspace', kind: 'dir', children: sortNodes(children) }
}

/** Single-level listing, for lazy expansion of very large trees. */
export async function readDirShallow(
  root: string,
  relDir: RelPath,
  opts: WalkOptions,
): Promise<TreeNode[]> {
  const absDir = await resolveInsideRoot(root, relDir)
  const out: TreeNode[] = []
  const dir = await opendir(absDir)

  for await (const entry of dir) {
    const rel = joinRel(normalizeRel(relDir), entry.name)
    if (entry.isDirectory()) {
      if (ALWAYS_PRUNE.has(entry.name)) continue
      if (opts.ignore.length > 0 && matchesAny(rel, opts.ignore)) continue
      out.push({ path: rel, name: entry.name, kind: 'dir' })
    } else if (entry.isFile() && includesFile(rel, opts)) {
      out.push({ path: rel, name: entry.name, kind: 'file', ext: extname(entry.name) })
    }
  }
  return sortNodes(out)
}

/** Flatten a walked tree to its file paths, for the search index and Quick Open. */
export function flattenFiles(node: TreeNode, out: RelPath[] = []): RelPath[] {
  for (const child of node.children ?? []) {
    if (child.kind === 'file') out.push(child.path)
    else flattenFiles(child, out)
  }
  return out
}
