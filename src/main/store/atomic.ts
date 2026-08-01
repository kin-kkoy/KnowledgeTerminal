/**
 * Atomic JSON persistence.
 *
 * Every write is temp-file + rename, which is atomic on POSIX. One `.bak` is
 * kept and used automatically when the primary file fails to parse. Losing a
 * user's entire tab layout to one abrupt shutdown is the worst failure this
 * application could have, so this is deliberately paranoid for ~60 lines.
 */
import { constants } from 'node:fs'
import { access, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true })
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/** Write JSON atomically, rotating the previous good copy to `<file>.bak`. */
export async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  await ensureDir(dirname(file))
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, JSON.stringify(value, null, 2), 'utf8')

  // Rotate the current file to .bak before replacing it. If this is the first
  // write there is nothing to rotate, which is not an error.
  if (await fileExists(file)) {
    try {
      await unlink(`${file}.bak`)
    } catch {
      /* no previous backup */
    }
    try {
      await rename(file, `${file}.bak`)
    } catch {
      /* rotation is best-effort; the atomic rename below still protects us */
    }
  }
  await rename(tmp, file)
}

/**
 * Read JSON, falling back to `<file>.bak` if the primary is missing or corrupt.
 * Returns null when neither yields valid JSON — callers then use defaults.
 */
export async function readJsonSafe<T = unknown>(file: string): Promise<T | null> {
  for (const candidate of [file, `${file}.bak`]) {
    try {
      const raw = await readFile(candidate, 'utf8')
      return JSON.parse(raw) as T
    } catch {
      // Missing or malformed — try the backup, then give up quietly.
    }
  }
  return null
}

/**
 * Coalesce rapid writes to one disk hit, with a `flush()` the caller can await
 * on quit. Used for session state, which changes on every scroll settle.
 */
export function createDebouncedWriter(delayMs: number) {
  const pending = new Map<string, unknown>()
  let timer: NodeJS.Timeout | null = null
  let inFlight: Promise<void> = Promise.resolve()

  async function drain(): Promise<void> {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const batch = [...pending.entries()]
    pending.clear()
    for (const [file, value] of batch) {
      try {
        await writeJsonAtomic(file, value)
      } catch (err) {
        console.error(`[store] failed to write ${file}`, err)
      }
    }
  }

  return {
    queue(file: string, value: unknown): void {
      pending.set(file, value)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        inFlight = drain()
      }, delayMs)
    },
    /** Await this before the app exits. */
    async flush(): Promise<void> {
      await inFlight
      await drain()
    },
    get hasPending(): boolean {
      return pending.size > 0
    },
  }
}
