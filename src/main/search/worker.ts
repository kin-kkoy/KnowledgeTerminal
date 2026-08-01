/**
 * The search index, in a worker thread.
 *
 * Runs off the main thread so a cold crawl of a few thousand documents never
 * blocks the window — indexing must be invisible, not merely fast.
 *
 * MiniSearch rather than the alternatives:
 *   - lunr's index is IMMUTABLE. A file watcher needs per-document updates, and
 *     rebuilding the whole index on every save is not a real option.
 *   - Fuse.js has no inverted index; every query scans every document. Fine at
 *     62 files, unusable at 5,000.
 *   - FlexSearch is faster still, but its document store and TypeScript types
 *     are rough and its index serialisation is awkward.
 *
 * THE MEMORY DECISION: body text is INDEXED BUT NOT STORED. Keeping full text
 * for thousands of documents would roughly double resident memory for no
 * benefit — snippets are produced by re-reading the handful of top-scoring
 * files from disk, which the OS page cache makes essentially free.
 */
import { readFile, stat } from 'node:fs/promises'
import { opendir } from 'node:fs/promises'
import { join } from 'node:path'
import { parentPort } from 'node:worker_threads'
import MiniSearch from 'minisearch'
import { basename, extname, joinRel, matchesAny, stem } from '@shared/paths'
import type { RelPath, SearchHit, SearchMatch } from '@shared/types'
import { extract } from './extract'
import { buildGraph, findByTerm, neighborsOf, type FileFacts, type Graph } from './graph'
import type { WorkerMessage, WorkerRequest } from './protocol'

const port = parentPort
if (!port) throw new Error('search worker must be started as a worker thread')

const PRUNE_DIRS = new Set([
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

const INDEXABLE = new Set(['md', 'markdown', 'mdx', 'txt'])
const PROGRESS_EVERY = 250
const MAX_SNIPPET_FILES = 20
const MAX_MATCHES_PER_FILE = 4

interface IndexedDoc {
  id: string
  path: RelPath
  title: string
  headings: string
  body: string
  frontmatter: string
  mtimeMs: number
}

interface WorkspaceIndex {
  root: string
  search: MiniSearch<IndexedDoc>
  /** path → mtime, so a warm crawl can skip unchanged files without reading. */
  manifest: Map<RelPath, number>
  /** Every file, indexable or not — this is what Quick Open searches. */
  docs: Map<RelPath, { title: string; mtimeMs: number }>
  /** Per-file links and tags, kept raw; resolving them needs the full file list. */
  facts: Map<RelPath, FileFacts>
  /** Rebuilt lazily — see `graphOf`. Null means "dirty". */
  graph: Graph | null
}

const indexes = new Map<string, WorkspaceIndex>()

function send(message: WorkerMessage): void {
  port!.postMessage(message)
}

function newIndex(root: string): WorkspaceIndex {
  return {
    root,
    search: new MiniSearch<IndexedDoc>({
      idField: 'id',
      fields: ['title', 'headings', 'body', 'frontmatter'],
      // Only what results need. NOT `body` — see the header comment.
      storeFields: ['path', 'title', 'mtimeMs'],
      searchOptions: {
        boost: { title: 4, headings: 2, frontmatter: 1.5 },
        prefix: true,
        combineWith: 'AND',
      },
    }),
    manifest: new Map(),
    docs: new Map(),
    facts: new Map(),
    graph: null,
  }
}

/**
 * The graph is rebuilt on demand rather than patched on every file change.
 *
 * A watcher batch can invalidate arbitrary link targets — renaming one file
 * changes what every wikilink naming it resolves to — so incremental patching
 * would be both fiddly and wrong. A full rebuild is milliseconds at workspace
 * scale, and only happens when something actually asks a graph question.
 */
function graphOf(index: WorkspaceIndex): Graph {
  if (!index.graph) index.graph = buildGraph(index.facts)
  return index.graph
}

/** Walk the workspace, pruning noisy directories at the directory level. */
async function* walk(root: string, rel = ''): AsyncGenerator<RelPath> {
  let dir
  try {
    dir = await opendir(join(root, rel))
  } catch {
    return
  }
  for await (const entry of dir) {
    if (entry.isDirectory()) {
      if (PRUNE_DIRS.has(entry.name)) continue
      yield* walk(root, joinRel(rel, entry.name))
    } else if (entry.isFile()) {
      yield joinRel(rel, entry.name)
    }
  }
}

async function indexFile(index: WorkspaceIndex, path: RelPath): Promise<void> {
  const abs = join(index.root, path)
  const info = await stat(abs)

  index.docs.set(path, { title: stem(path), mtimeMs: info.mtimeMs })

  if (!INDEXABLE.has(extname(path))) return

  const raw = await readFile(abs, 'utf8')
  const parts = extract(raw, stem(path))
  const doc: IndexedDoc = { id: path, path, mtimeMs: info.mtimeMs, ...parts }

  index.docs.set(path, { title: parts.title, mtimeMs: info.mtimeMs })
  index.facts.set(path, { title: parts.title, links: parts.links, tags: parts.tags })
  index.graph = null
  // `replace` handles both "new" and "changed" — exactly what a watcher needs.
  if (index.search.has(path)) index.search.replace(doc)
  else index.search.add(doc)
  index.manifest.set(path, info.mtimeMs)
}

async function crawl(request: Extract<WorkerRequest, { type: 'crawl' }>): Promise<void> {
  const index = newIndex(request.root)
  indexes.set(request.workspaceId, index)

  const paths: RelPath[] = []
  for await (const path of walk(request.root)) {
    if (request.ignore.length > 0 && matchesAny(path, request.ignore)) continue
    if (request.include.length > 0 && !matchesAny(path, request.include)) continue
    paths.push(path)
  }

  let indexed = 0
  for (const path of paths) {
    try {
      await indexFile(index, path)
    } catch {
      // One unreadable file must not abort the crawl.
    }
    indexed++
    if (indexed % PROGRESS_EVERY === 0) {
      send({
        type: 'progress',
        workspaceId: request.workspaceId,
        indexed,
        total: paths.length,
        done: false,
      })
    }
  }

  send({
    type: 'progress',
    workspaceId: request.workspaceId,
    indexed,
    total: paths.length,
    done: true,
  })
  sendDocs(request.workspaceId, index)
}

function sendDocs(workspaceId: string, index: WorkspaceIndex): void {
  send({
    type: 'docs',
    workspaceId,
    docs: [...index.docs.entries()].map(([path, d]) => ({ path, ...d })),
  })
}

/**
 * Build highlighted context lines by re-reading the file.
 *
 * This is the other half of not storing bodies: a handful of reads at query
 * time, against files the OS almost certainly still has cached.
 */
async function snippetsFor(
  index: WorkspaceIndex,
  path: RelPath,
  terms: string[],
): Promise<SearchMatch[]> {
  try {
    const raw = await readFile(join(index.root, path), 'utf8')
    const lines = raw.split('\n')
    const matches: SearchMatch[] = []

    for (let i = 0; i < lines.length && matches.length < MAX_MATCHES_PER_FILE; i++) {
      const line = lines[i]!
      const lower = line.toLowerCase()
      const ranges: Array<[number, number]> = []

      for (const term of terms) {
        let from = 0
        for (;;) {
          const at = lower.indexOf(term, from)
          if (at === -1) break
          ranges.push([at, at + term.length])
          from = at + term.length
        }
      }
      if (ranges.length === 0) continue

      ranges.sort((a, b) => a[0] - b[0])
      // Merge overlaps so two terms in the same word do not double-highlight.
      const merged: Array<[number, number]> = []
      for (const range of ranges) {
        const last = merged[merged.length - 1]
        if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
        else merged.push([...range])
      }

      const trimmed = line.trim()
      const shift = line.length - line.trimStart().length
      matches.push({
        line: i + 1,
        text: trimmed.slice(0, 240),
        ranges: merged
          .map(([a, b]) => [a - shift, b - shift] as [number, number])
          .filter(([a, b]) => a >= 0 && b <= 240),
      })
    }
    return matches
  } catch {
    return []
  }
}

async function query(request: Extract<WorkerRequest, { type: 'query' }>): Promise<void> {
  const index = indexes.get(request.workspaceId)
  if (!index) {
    send({
      type: 'result',
      requestId: request.requestId,
      result: { queryId: request.options.queryId ?? '', hits: [], total: 0, truncated: false },
    })
    return
  }

  const raw = index.search.search(request.query, {
    prefix: true,
    fuzzy: request.fuzzy,
  })

  const terms = request.query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^\p{L}\p{N}_-]/gu, ''))
    .filter((t) => t.length > 1)

  const capped = raw.slice(0, request.maxResults)
  const hits: SearchHit[] = []

  for (let i = 0; i < capped.length; i++) {
    const result = capped[i]!
    const path = result['path'] as RelPath
    hits.push({
      path,
      title: (result['title'] as string) ?? basename(path),
      score: result.score,
      // Snippets only for the visible head of the list; the tail does not need
      // a file read it will never show.
      matches: i < MAX_SNIPPET_FILES ? await snippetsFor(index, path, terms) : [],
    })
  }

  send({
    type: 'result',
    requestId: request.requestId,
    result: {
      queryId: request.options.queryId ?? '',
      hits,
      total: raw.length,
      truncated: raw.length > capped.length,
    },
  })
}

port.on('message', (request: WorkerRequest) => {
  void (async () => {
    try {
      switch (request.type) {
        case 'crawl':
          await crawl(request)
          break

        case 'upsert': {
          const index = indexes.get(request.workspaceId)
          if (!index) break
          for (const path of request.paths) {
            try {
              await indexFile(index, path)
            } catch {
              /* the file may have vanished between the event and the read */
            }
          }
          sendDocs(request.workspaceId, index)
          break
        }

        case 'remove': {
          const index = indexes.get(request.workspaceId)
          if (!index) break
          for (const path of request.paths) {
            if (index.search.has(path)) index.search.discard(path)
            index.manifest.delete(path)
            index.docs.delete(path)
            index.facts.delete(path)
            index.graph = null
          }
          sendDocs(request.workspaceId, index)
          break
        }

        case 'query':
          await query(request)
          break

        case 'neighbors': {
          const index = indexes.get(request.workspaceId)
          send({
            type: 'graph',
            requestId: request.requestId,
            nodes: index ? neighborsOf(graphOf(index), request.path, request.depth) : [],
          })
          break
        }

        case 'graphFind': {
          const index = indexes.get(request.workspaceId)
          send({
            type: 'graph',
            requestId: request.requestId,
            nodes: index ? findByTerm(graphOf(index), request.term) : [],
          })
          break
        }

        case 'drop':
          indexes.delete(request.workspaceId)
          break
      }
    } catch (err) {
      send({
        type: 'error',
        requestId: 'requestId' in request ? request.requestId : undefined,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })()
})
