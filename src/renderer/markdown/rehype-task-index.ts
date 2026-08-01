/**
 * Number each task checkbox in document order.
 *
 * The click handler needs to know WHICH `- [ ]` it is editing, and a line
 * number is not available in the rendered tree. Counting occurrences is, and it
 * matches how the source is scanned in `tasks.ts` — both skip fenced code, so
 * the two counts agree.
 */
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

export const rehypeTaskIndex: Plugin<[], Root> = () => {
  return (tree: Root) => {
    let index = 0
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'input') return
      if (node.properties?.['type'] !== 'checkbox') return
      node.properties = {
        ...node.properties,
        'data-kt-task': String(index++),
        // remark-gfm marks these disabled; ours is interactive.
        disabled: undefined,
      }
    })
  }
}
