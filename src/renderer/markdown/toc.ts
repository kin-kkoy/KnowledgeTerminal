/**
 * Table of contents extraction.
 *
 * Slugs are produced with the SAME github-slugger algorithm rehype-slug uses,
 * and — critically — with a slugger instance reset per document, so duplicate
 * headings get the same `-1`, `-2` suffixes the DOM ids will have. If these two
 * ever disagree, outline clicks and bookmark anchors silently land nowhere.
 */
import GithubSlugger from 'github-slugger'
import type { TocEntry } from '@shared/types'

const FENCE = /^\s{0,3}(```+|~~~+)/
const ATX = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/

/** Strip inline markdown so the outline shows text, not syntax. */
function plainText(input: string): string {
  return input
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .trim()
}

export function extractToc(markdown: string): TocEntry[] {
  const slugger = new GithubSlugger()
  const body = markdown.replace(FRONTMATTER, '')
  const entries: TocEntry[] = []

  let fence: string | null = null
  for (const line of body.split('\n')) {
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      // A `# comment` inside a bash block is not a heading.
      const marker = fenceMatch[1]!
      if (fence === null) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    if (fence !== null) continue

    const heading = ATX.exec(line)
    if (!heading) continue

    const text = plainText(heading[2]!)
    if (!text) continue
    entries.push({ depth: heading[1]!.length, text, slug: slugger.slug(text) })
  }

  return entries
}

/**
 * Should the outline be shown at all? A three-heading document does not need a
 * navigation aid, and showing one for every file adds clutter without value.
 */
export function shouldShowToc(
  entries: TocEntry[],
  config: { enabled: boolean; minHeadings: number; maxDepth: number },
): boolean {
  if (!config.enabled) return false
  return entries.filter((e) => e.depth <= config.maxDepth).length >= config.minHeadings
}
