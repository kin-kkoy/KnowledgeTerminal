/**
 * The markdown pipeline.
 *
 * Renders to REACT ELEMENTS, never to innerHTML. Combined with sanitisation
 * that means a document cannot inject script into the app.
 *
 * ORDER IS LOAD-BEARING. Each of these placements fixes a specific failure:
 *
 *   remarkCallout      before remark-rehype  — it rewrites an mdast blockquote
 *   remarkWikiLink     before remark-rehype  — it produces mdast link nodes
 *   rehypeRaw          before rehypeSanitize — otherwise raw HTML from the
 *                                              document skips sanitisation
 *   rehypeMermaidBlock before shiki          — otherwise the diagram source is
 *                                              tokenised into spans and can no
 *                                              longer be read back as text
 *   rehypeBlockIds     LAST                  — the scroll anchors must match
 *                                              the final DOM exactly
 *
 * Shiki runs INSIDE the pipeline, not after mount. That is what makes code
 * blocks part of the first committed tree, so nothing re-highlights and nothing
 * re-flows under the reader.
 */
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeRaw from 'rehype-raw'
import rehypeReact from 'rehype-react'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import { unified, type Processor } from 'unified'
import type { ReactElement } from 'react'
import type { RenderContext } from './context'
import { rehypeAssetSrc } from './rehype-asset-src'
import { rehypeBlockIds } from './rehype-block-ids'
import { rehypeCodeLanguage } from './rehype-code-language'
import { rehypeMermaidBlock } from './rehype-mermaid-block'
import { rehypeTaskIndex } from './rehype-task-index'
import { remarkCallout } from './remark-callout'
import { remarkWikiLink } from './remark-wikilink'
import { Callout } from './components/Callout'
import { CodeBlock } from './components/CodeBlock'
import { DivDispatch } from './components/DivDispatch'
import { Image } from './components/Image'
import { InternalLink } from './components/InternalLink'
import { TaskCheckbox } from './components/TaskCheckbox'

/**
 * Languages bundled for highlighting.
 *
 * Imported individually through `shiki/core` rather than via the `shiki`
 * convenience bundle. The bundle's entry point pulls in the Oniguruma engine,
 * whose WASM would demand `script-src 'wasm-unsafe-eval'` in the CSP — a real
 * weakening of the policy in exchange for a syntax highlighter. Going through
 * the core API means that module is never loaded at all.
 *
 * A language that is not listed here renders as plain monospace, not an error.
 */
const LANG_LOADERS = [
  import('@shikijs/langs/csharp'),
  import('@shikijs/langs/typescript'),
  import('@shikijs/langs/javascript'),
  import('@shikijs/langs/tsx'),
  import('@shikijs/langs/json'),
  import('@shikijs/langs/bash'),
  import('@shikijs/langs/shellscript'),
  import('@shikijs/langs/sql'),
  import('@shikijs/langs/yaml'),
  import('@shikijs/langs/xml'),
  import('@shikijs/langs/html'),
  import('@shikijs/langs/css'),
  import('@shikijs/langs/python'),
  import('@shikijs/langs/rust'),
  import('@shikijs/langs/go'),
  import('@shikijs/langs/java'),
  import('@shikijs/langs/c'),
  import('@shikijs/langs/cpp'),
  import('@shikijs/langs/diff'),
  import('@shikijs/langs/markdown'),
  import('@shikijs/langs/toml'),
  import('@shikijs/langs/ini'),
  import('@shikijs/langs/powershell'),
]

const THEME_LOADERS = [
  import('@shikijs/themes/github-dark-dimmed'),
  import('@shikijs/themes/github-light'),
]

/**
 * The sanitisation schema, widened for exactly what our own plugins emit and
 * nothing more. Everything here is an attribute WE add, not something a
 * document can smuggle in.
 */
const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'className',
      'style',
      'id',
      'tabindex',
      // `data*` is a PREFIX match, and it has to be a prefix match: every
      // marker our plugins add (data-kt-callout, data-kt-block, the link
      // attributes) is a data attribute, and naming them individually silently
      // fails — hast canonicalises `data-kt-callout` to `dataKtCallout`
      // internally, so the literal names never match the allowlist and the
      // attributes are quietly dropped. Callouts then render as bare divs and
      // broken links render as working ones.
      //
      // Allowing all data attributes is safe: they carry no behaviour on their
      // own, and the components that read ours would at worst let a document
      // style itself as a callout.
      'data*',
    ],
    img: [...(defaultSchema.attributes?.['img'] ?? []), 'width', 'height', 'loading', 'decoding'],
    // Shiki emits inline colour styles and dual-theme CSS variables on these.
    span: [...(defaultSchema.attributes?.['span'] ?? []), 'style', 'className'],
    pre: [...(defaultSchema.attributes?.['pre'] ?? []), 'style', 'className', 'tabindex'],
    code: [...(defaultSchema.attributes?.['code'] ?? []), 'style', 'className'],
  },
  // `kt://` is ours; `kt-doc:` is the internal-link marker InternalLink reads.
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.['src'] ?? []), 'kt'],
    href: [...(defaultSchema.protocols?.['href'] ?? []), 'kt', 'kt-doc'],
  },
}

type MarkdownProcessor = Processor<undefined, undefined, undefined, undefined, ReactElement>

let processorPromise: Promise<MarkdownProcessor> | null = null

/**
 * Built once and reused. Constructing it per document would rebuild the Shiki
 * highlighter every time — a visible stall on every tab switch.
 */
function getProcessor(): Promise<MarkdownProcessor> {
  processorPromise ??= buildProcessor()
  return processorPromise
}

async function buildProcessor(): Promise<MarkdownProcessor> {
  const highlighter: HighlighterCore = await createHighlighterCore({
    themes: THEME_LOADERS,
    langs: LANG_LOADERS,
    // The JavaScript regex engine, NOT Oniguruma. `forgiving` keeps a grammar
    // the JS engine cannot fully express from throwing — it degrades that one
    // pattern instead of failing the whole document.
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  })

  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm) // tables, task lists, strikethrough, autolinks, FOOTNOTES
    .use(remarkCallout)
    .use(remarkWikiLink)
    .use(remarkRehype, { allowDangerousHtml: true, footnoteLabel: 'Footnotes' })
    .use(rehypeRaw)
    .use(rehypeSanitize, schema)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: { className: 'heading-anchor', ariaHidden: true, tabIndex: -1 },
      content: { type: 'text', value: '#' },
    })
    .use(rehypeMermaidBlock)
    .use(rehypeCodeLanguage)
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      // Dual-theme CSS variables: switching theme swaps which variable is read
      // rather than re-highlighting, so a theme toggle causes zero relayout.
      defaultColor: false,
      cssVariablePrefix: '--shiki-',
      // A fence tagged with a language we did not bundle still renders, as
      // plain monospace, instead of throwing.
      fallbackLanguage: 'text',
    })
    .use(rehypeAssetSrc)
    .use(rehypeTaskIndex)
    .use(rehypeBlockIds)
    .use(rehypeReact, {
      Fragment,
      jsx,
      jsxs,
      components: {
        pre: CodeBlock,
        img: Image,
        a: InternalLink,
        input: TaskCheckbox,
        // Callouts and mermaid blocks both arrive as <div> with a data
        // attribute; one dispatcher keeps the component map flat.
        div: DivDispatch,
        blockquote: (props: Record<string, unknown>) => jsx('blockquote', props),
      },
    }) as MarkdownProcessor
}

export interface RenderResult {
  tree: ReactElement
}

export async function renderMarkdown(
  markdown: string,
  context: RenderContext,
): Promise<RenderResult> {
  const processor = await getProcessor()
  const file = await processor.process({ value: markdown, data: { kt: context } })
  return { tree: file.result }
}

/**
 * Warm the highlighter during idle time after launch, so the first document
 * does not pay the (~80ms) construction cost.
 */
export function warmMarkdownPipeline(): void {
  void getProcessor()
}

export { Callout }
