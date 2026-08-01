/**
 * Markdown for answers — a deliberately smaller pipeline than the document one.
 *
 * Models reply in Markdown whether you ask them to or not, so rendering it as
 * plain text means reading literal `**asterisks**` and `-` bullets. But the
 * document pipeline is the wrong tool: it carries Shiki, Mermaid, `kt://` asset
 * resolution, wikilink resolution, task checkboxes and `rehypeBlockIds` — all
 * of which exist to serve a scrollable document with scroll anchors, and none
 * of which mean anything inside an overlay. Reusing it would also drag its
 * load-bearing plugin order into a second call site, where the ordering
 * constraints are invisible and easy to break.
 *
 * So: the same libraries, a much shorter chain, and no new dependencies.
 *
 * Sanitisation still runs. The answer text is untrusted — it is remote output,
 * and the whole grounding argument rests on not treating it as authoritative.
 */
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
import { useMemo, type ReactElement, type ReactNode } from 'react'
import rehypeReact from 'rehype-react'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { platform } from '../../platform'
import styles from './AnswerText.module.css'

/**
 * Narrower than the document schema. No raw HTML reaches this — `rehypeRaw` is
 * absent — so the only elements are the ones remark produced, and this trims
 * that set to what an answer legitimately needs.
 */
const SCHEMA = {
  ...defaultSchema,
  tagNames: [
    'p', 'strong', 'em', 'del', 'code', 'pre', 'br',
    'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  attributes: {
    a: ['href', 'title'],
    code: ['className'],
    td: ['align'],
    th: ['align'],
  },
  // Anything else the model emits is dropped rather than rendered.
  protocols: { href: ['http', 'https', 'mailto'] },
}

/**
 * Links in an answer point outward — a model citing a URL means the web, not a
 * workspace path. They open in the system browser, the same as any external
 * link in a document, rather than navigating the app away from itself.
 */
function ExternalLink({ href, children }: { href?: string; children?: ReactNode }): ReactElement {
  return (
    <a
      href={href}
      className={styles.link}
      onClick={(event) => {
        event.preventDefault()
        if (href) void platform.openExternal(href)
      }}
    >
      {children}
    </a>
  )
}

/**
 * Headings are flattened to one emphatic size.
 *
 * A model writing `##` is signalling "new section", not asking for 1.3em type.
 * Honouring the level would let a three-line answer contain something visually
 * larger than the document title behind it.
 */
function Heading({ children }: { children?: ReactNode }): ReactElement {
  return <div className={styles.heading}>{children}</div>
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize, SCHEMA)
  .use(rehypeReact, {
    Fragment,
    jsx,
    jsxs,
    components: {
      a: ExternalLink,
      h1: Heading,
      h2: Heading,
      h3: Heading,
      h4: Heading,
      h5: Heading,
      h6: Heading,
    },
  })

/**
 * Rendered on every keystroke of a stream, so the parse is memoised on the
 * text. Partial Markdown mid-stream (an unclosed `**`) simply renders as the
 * literal characters until its closing token arrives, which reads as typing.
 */
export function AnswerText({ text }: { text: string }): ReactElement {
  const tree = useMemo(() => processor.processSync(text).result as ReactElement, [text])
  return <div className={styles.prose}>{tree}</div>
}
