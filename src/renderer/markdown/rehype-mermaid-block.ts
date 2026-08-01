/**
 * Lift ```mermaid fences out of the code path.
 *
 * MUST run before the Shiki plugin: otherwise the diagram source gets
 * tokenised into spans and the original text is no longer recoverable as a
 * single string.
 */
import { visit } from 'unist-util-visit'
import { toString } from 'hast-util-to-string'
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { contextOf } from './context'

export const rehypeMermaidBlock: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const { markdown } = contextOf(file.data)
    if (!markdown.mermaid) return

    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || index === undefined) return
      const code = node.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'code',
      )
      if (!code) return

      const classes = code.properties?.['className']
      const list = Array.isArray(classes) ? classes.map(String) : []
      if (!list.includes('language-mermaid')) return

      const replacement: Element = {
        type: 'element',
        tagName: 'div',
        properties: { 'data-kt-mermaid': '' },
        children: [{ type: 'text', value: toString(code) }],
      }
      parent.children[index] = replacement
    })
  }
}
