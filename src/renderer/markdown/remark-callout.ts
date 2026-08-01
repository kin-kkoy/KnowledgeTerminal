/**
 * Obsidian-style callouts: a blockquote whose first line is `> [!TYPE] Title`.
 *
 * `> [!NOTE]-` starts collapsed, `> [!NOTE]+` starts expanded.
 *
 * Must run BEFORE remark-rehype, since it rewrites an mdast blockquote.
 */
import { visit } from 'unist-util-visit'
import type { Blockquote, Paragraph, Root, Text } from 'mdast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { contextOf } from './context'

const CALLOUT = /^\[!([A-Za-z]+)\]([-+])?\s*(.*)$/

const KNOWN_TYPES = new Set([
  'note',
  'tip',
  'info',
  'important',
  'warning',
  'caution',
  'danger',
  'success',
  'question',
  'example',
  'quote',
  'abstract',
  'todo',
  'failure',
  'bug',
])

export const remarkCallout: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const { markdown } = contextOf(file.data)
    if (!markdown.callouts) return

    visit(tree, 'blockquote', (node: Blockquote) => {
      const first = node.children[0]
      if (!first || first.type !== 'paragraph') return

      const paragraph = first as Paragraph
      const lead = paragraph.children[0]
      if (!lead || lead.type !== 'text') return

      const text = lead as Text
      // Only the FIRST line can carry the marker; the rest is the body.
      const newlineAt = text.value.indexOf('\n')
      const head = newlineAt === -1 ? text.value : text.value.slice(0, newlineAt)
      const match = CALLOUT.exec(head.trim())
      if (!match) return

      const type = match[1]!.toLowerCase()
      if (!KNOWN_TYPES.has(type)) return

      const fold = match[2]
      const title = match[3]?.trim() ?? ''

      // Strip the marker line out of the body.
      const rest = newlineAt === -1 ? '' : text.value.slice(newlineAt + 1)
      if (rest.trim()) {
        text.value = rest
      } else {
        paragraph.children.shift()
        if (paragraph.children.length === 0) node.children.shift()
      }

      node.data = {
        ...node.data,
        hName: 'div',
        hProperties: {
          'data-kt-callout': type,
          'data-kt-callout-title': title || undefined,
          'data-kt-callout-fold': fold ?? undefined,
        },
      }
    })
  }
}
