/**
 * Creating a workspace from nothing.
 *
 * This is the only code in the application that brings files into existence
 * unasked, and it is deliberately tiny. A new workspace should be immediately
 * usable and nothing more — no template gallery, no folders you have to delete
 * before you can start. Four entries:
 *
 *   .kt/settings.json   what the Sandbox form produced
 *   README.md           the entry document
 *   PROGRESS.md         somewhere for the first task to go
 *   notes/daily/        so the daily-note action works on day one
 *
 * Nothing here ever overwrites an existing file. Pointing "new workspace" at a
 * folder that already has Markdown in it is a legitimate thing to do — adopting
 * an existing pile of notes — and it must not damage it.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { DeepPartial } from '@shared/platform'
import type { WorkspaceSettings } from '@shared/config-schema'
import { ensureDir, fileExists } from '../store/atomic'
import { writeTextFile } from './files'
import { initSettings, KT_DIR } from './workspace'

export interface ScaffoldOptions {
  root: string
  seed: DeepPartial<WorkspaceSettings>
  /** When false, only `.kt/settings.json` is written. */
  starterFiles: boolean
}

/** True when the folder holds nothing but our own `.kt` directory. */
export async function isEmptyWorkspace(root: string): Promise<boolean> {
  try {
    const entries = await readdir(root)
    return entries.every((e) => e === KT_DIR || e.startsWith('.'))
  } catch {
    return true
  }
}

export async function scaffoldWorkspace({
  root,
  seed,
  starterFiles,
}: ScaffoldOptions): Promise<void> {
  await ensureDir(root)
  await initSettings(root, seed)
  if (!starterFiles) return

  const name = seed.workspace?.name ?? 'Workspace'
  const mission = seed.workspace?.mission ?? null
  const goal = seed.workspace?.goal ?? null

  await writeIfAbsent(root, 'README.md', readme(name, mission, goal))
  await writeIfAbsent(root, 'PROGRESS.md', progress(name))
  await ensureDir(join(root, 'notes', 'daily'))
}

async function writeIfAbsent(root: string, rel: string, content: string): Promise<void> {
  if (await fileExists(join(root, rel))) return
  await writeTextFile(root, rel, content)
}

function readme(name: string, mission: string | null, goal: string | null): string {
  const lines = [`# ${name}`, '']
  if (mission) lines.push(mission, '')
  if (goal) lines.push(`**Goal.** ${goal}`, '')
  lines.push(
    'Start here. Everything in this folder is Markdown — rename it, move it,',
    'delete it. The app reads the folder; it does not own it.',
    '',
    '- [PROGRESS.md](PROGRESS.md) — what is in flight',
    '- `notes/daily/` — one file per day',
    '',
  )
  return lines.join('\n')
}

function progress(name: string): string {
  return [
    `# Progress — ${name}`,
    '',
    '## Now',
    '',
    '- [ ] Decide what the first thing to work on is',
    '',
    '## Done',
    '',
  ].join('\n')
}
