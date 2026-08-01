/**
 * File reads and writes. Everything routes through `resolveInsideRoot`.
 */
import type { Dirent } from 'node:fs'
import { mkdir, readdir, readFile, stat, stat as fsStat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { hashString } from '@shared/paths'
import type { FileStat, NoteFile, RelPath, TextFile } from '@shared/types'
import { resolveInsideRoot } from './safety'

export async function readTextFile(root: string, path: RelPath): Promise<TextFile> {
  const abs = await resolveInsideRoot(root, path)

  // A folder reaches here whenever config names one where a document was
  // expected — an `entryDocument` typed by hand, a favorite, a quick action.
  // Node's own answer is `EISDIR: illegal operation on a directory, read`,
  // which tells a reader nothing about what to do. Say the useful thing.
  const info = await fsStat(abs)
  if (info.isDirectory()) {
    throw new Error(`${path} is a folder, not a document.`)
  }

  const content = await readFile(abs, 'utf8')
  return {
    path,
    content,
    // Guards scroll anchors: a block id is only trusted while this matches.
    hash: hashString(content),
    mtimeMs: info.mtimeMs,
    size: info.size,
  }
}

export async function writeTextFile(
  root: string,
  path: RelPath,
  content: string,
): Promise<void> {
  const abs = await resolveInsideRoot(root, path)
  // The parent may not exist yet — creating today's `notes/daily/2026-08-01.md`
  // in a workspace that has never had a daily note is the common case, and it
  // used to throw ENOENT. `resolveInsideRoot` has already contained the path,
  // so the directories we create are provably inside the workspace.
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, content, 'utf8')
}

/** Create a directory (and its parents) inside the workspace. */
export async function makeDir(root: string, path: RelPath): Promise<void> {
  const abs = await resolveInsideRoot(root, path)
  await mkdir(abs, { recursive: true })
}

export async function statPath(root: string, path: RelPath): Promise<FileStat | null> {
  try {
    const abs = await resolveInsideRoot(root, path)
    const info = await fsStat(abs)
    return {
      path,
      kind: info.isDirectory() ? 'dir' : 'file',
      size: info.size,
      mtimeMs: info.mtimeMs,
    }
  } catch {
    return null
  }
}

export async function pathExists(root: string, path: RelPath): Promise<boolean> {
  return (await statPath(root, path)) !== null
}


/**
 * List a notes folder.
 *
 * `root` may be workspace-relative or ABSOLUTE — this is the one call in the
 * API permitted to look outside the workspace, so the close-out gate can watch
 * a vault belonging to another application.
 *
 * It is read-only by construction: there is no write counterpart, and it
 * returns names and timestamps only, never contents. `~` is expanded because
 * users write paths that way.
 */
export async function listNotes(workspaceRoot: string, root: string): Promise<NoteFile[]> {
  const expanded = root.startsWith('~') ? join(homedir(), root.slice(1)) : root
  const dir = isAbsolute(expanded) ? expanded : join(workspaceRoot, expanded)

  let entries: Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    // A missing or unreadable notes folder is a configuration fact, not an
    // error — the gate still works, it just reports nothing found.
    return []
  }

  const out: NoteFile[] = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    try {
      const info = await stat(join(dir, entry.name))
      out.push({ name: entry.name, mtimeMs: info.mtimeMs, size: info.size })
    } catch {
      /* vanished between readdir and stat */
    }
  }
  return out
}
