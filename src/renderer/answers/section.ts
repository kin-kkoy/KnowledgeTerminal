/**
 * Pulling out the section a reader is actually looking at.
 *
 * "Why does this use an interface here?" needs a *here*. The scroll registry
 * tracks which heading the reader is parked on — it has to, for restore — so
 * the information already exists; this turns that slug back into the prose
 * underneath it.
 *
 * Slugs are produced with the SAME github-slugger algorithm rehype-slug uses,
 * so a slug recorded from the rendered DOM matches the heading found here.
 */
import GithubSlugger from 'github-slugger'

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const FENCE = /^\s{0,3}(```+|~~~+)/

export interface Section {
  heading: string
  /** The heading line and everything under it, to the next same-or-higher one. */
  text: string
}

/**
 * The section owning `slug`, or null when the document has no such heading.
 *
 * Stops at the next heading of the same or higher level, so asking about a
 * subsection gives the subsection rather than the rest of the chapter.
 */
export function sectionForSlug(markdown: string, slug: string): Section | null {
  const slugger = new GithubSlugger()
  const lines = markdown.split('\n')

  let start = -1
  let startLevel = 0
  let heading = ''
  let fence: string | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // Headings inside code fences are examples, not structure — and the
    // slugger must not consume a slug for them either, or every later slug
    // shifts and stops matching the DOM.
    const fenceMatch = FENCE.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]!
      if (fence === null) fence = marker[0]!
      else if (marker[0] === fence) fence = null
      continue
    }
    if (fence !== null) continue

    const match = HEADING.exec(line)
    if (!match) continue

    const level = match[1]!.length
    const text = match[2]!

    if (start === -1) {
      // Still looking. Slug every heading so the counter stays in step with
      // how rehype-slug numbered duplicates.
      if (slugger.slug(text) === slug) {
        start = i
        startLevel = level
        heading = text
      }
      continue
    }

    if (level <= startLevel) {
      return { heading, text: lines.slice(start, i).join('\n').trim() }
    }
  }

  if (start === -1) return null
  return { heading, text: lines.slice(start).join('\n').trim() }
}
