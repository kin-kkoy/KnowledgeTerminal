/**
 * Markdown → indexable text.
 *
 * What gets stripped matters as much as what is kept. Code fences are removed
 * because a search for "class" should find the sentence explaining classes, not
 * every C# file in the workspace. Link syntax is unwrapped so `[[module-04]]`
 * is searchable as "module 04" rather than as punctuation.
 */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const FENCE = /^\s{0,3}(```+|~~~+)/

export interface Extracted {
  title: string
  headings: string
  body: string
  /** Raw frontmatter values, so `tags:` and `summary:` are searchable too. */
  frontmatter: string
  /**
   * Unresolved link targets: wikilink names and relative markdown hrefs, in
   * document order. Resolution to real paths needs the whole file list, so it
   * happens later — see `graph.ts`.
   */
  links: string[]
  /** Frontmatter `tags:` plus inline `#tag`, lowercased and deduplicated. */
  tags: string[]
}

const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g
const MDLINK = /(?<!!)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const INLINE_TAG = /(?:^|\s)#([a-z][\w-]*(?:\/[\w-]+)*)/gi

/** External and in-page targets are not workspace edges. */
function isInternalTarget(target: string): boolean {
  return !/^(?:[a-z]+:|\/\/|#|mailto:)/i.test(target)
}

function frontmatterTags(frontmatter: string): string[] {
  const inline = /(^|\n)tags:\s*\[([^\]]*)\]/.exec(frontmatter)
  if (inline) return (inline[2] ?? '').split(',').map((t) => t.trim().replace(/^['"]|['"]$/g, ''))

  const block = /(^|\n)tags:\s*\n((?:\s*-\s*.+\n?)+)/.exec(frontmatter)
  if (block) {
    return (block[2] ?? '')
      .split('\n')
      .map((line) => /^\s*-\s*(.+)$/.exec(line)?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? '')
      .filter(Boolean)
  }

  const single = /(^|\n)tags:\s*(.+)/.exec(frontmatter)
  if (single) return (single[2] ?? '').split(/[,\s]+/).map((t) => t.trim()).filter(Boolean)

  return []
}

function unwrapInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_~>#|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extract(markdown: string, fallbackTitle: string): Extracted {
  let frontmatter = ''
  let body = markdown

  const fm = FRONTMATTER.exec(markdown)
  if (fm) {
    frontmatter = fm[1] ?? ''
    body = markdown.slice(fm[0].length)
  }

  // A `title:` in frontmatter beats the filename; a first h1 beats both.
  let title = /(^|\n)title:\s*(.+)/.exec(frontmatter)?.[2]?.trim() ?? ''

  const headings: string[] = []
  const text: string[] = []
  const links: string[] = []
  const tags = new Set(frontmatterTags(frontmatter).map((t) => t.toLowerCase().replace(/^#/, '')))
  let fence: string | null = null

  /** Links inside a code fence are examples, not references. */
  const collectLinks = (line: string): void => {
    for (const match of line.matchAll(WIKILINK)) {
      const target = match[1]?.trim()
      if (target) links.push(target)
    }
    for (const match of line.matchAll(MDLINK)) {
      const target = match[1]?.trim()
      if (target && isInternalTarget(target)) links.push(decodeURI(target))
    }
  }

  for (const line of body.split('\n')) {
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (fence === null) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    if (fence !== null) continue // inside a code block

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (heading) {
      collectLinks(line)
      const value = unwrapInline(heading[2]!)
      headings.push(value)
      if (!title && heading[1]!.length === 1) title = value
      continue
    }

    collectLinks(line)
    for (const match of line.matchAll(INLINE_TAG)) {
      const tag = match[1]?.toLowerCase()
      if (tag) tags.add(tag)
    }
    text.push(line)
  }

  return {
    title: title || fallbackTitle,
    headings: headings.join(' · '),
    body: unwrapInline(text.join('\n')),
    frontmatter: unwrapInline(frontmatter.replace(/^\s*\w+:\s*/gm, ' ')),
    links,
    tags: [...tags],
  }
}
