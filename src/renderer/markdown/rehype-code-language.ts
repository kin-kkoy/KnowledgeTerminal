/**
 * Copy a fence's language onto its `<pre>` as `data-language`.
 *
 * Markdown puts the language on the `<code>` element as `language-csharp`, but
 * the component map hooks `pre` — and by the time Shiki has run it has replaced
 * the children with token spans and the original class is gone. So the label is
 * captured here, before Shiki, and read back by CodeBlock.
 */
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'
import type { Plugin } from 'unified'

export const rehypeCodeLanguage: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'pre') return
      const code = node.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'code',
      )
      if (!code) return

      const classes = code.properties?.['className']
      const list = Array.isArray(classes) ? classes.map(String) : []
      const language = list.find((c) => c.startsWith('language-'))?.slice('language-'.length)
      if (language) node.properties = { ...node.properties, 'data-language': language }
    })
  }
}
