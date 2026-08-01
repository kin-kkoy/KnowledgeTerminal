/**
 * Stamp `data-kt-block` on every top-level block.
 *
 * These are the scroll anchors. Restoring a position means finding the block
 * that was at the viewport top last time — so the ids must correspond to what
 * actually ends up in the DOM.
 *
 * That is why this plugin runs LAST in the chain. If anything after it added,
 * removed or reordered a top-level node, the ids would drift by one and every
 * restore would land in the wrong place. Keep it last.
 */
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

export const rehypeBlockIds: Plugin<[], Root> = () => {
  return (tree: Root) => {
    let index = 0
    for (const child of tree.children) {
      if (child.type !== 'element') continue
      const element = child as Element
      element.properties = { ...element.properties, 'data-kt-block': `b-${index++}` }
    }
  }
}
