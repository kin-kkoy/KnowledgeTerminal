/**
 * The wrapper around Shiki's output.
 *
 * Shiki has already produced the highlighted spans inside the pipeline, so this
 * component only adds chrome: a language label and a copy button. It must not
 * re-render the code, or the layout would shift after mount.
 */
import { platform } from '../../platform'
import { useCallback, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import styles from './CodeBlock.module.css'

interface Props {
  children?: ReactNode
  className?: string
  style?: React.CSSProperties
  'data-language'?: string
  [key: string]: unknown
}

/** Recover the raw text for the copy button without touching the DOM. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object' && 'props' in node) {
    return textOf((node.props as { children?: ReactNode }).children)
  }
  return ''
}

export function CodeBlock({ children, className, style, ...rest }: Props): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  const language = (rest['data-language'] as string | undefined) ?? null

  const copy = useCallback(() => {
    void platform.copyText(textOf(children)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }, [children])

  return (
    <div className={styles.wrapper}>
      <div className={styles.chrome}>
        {language && language !== 'text' && <span className={styles.language}>{language}</span>}
        <button
          type="button"
          className={styles.copy}
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy code'}
          title={copied ? 'Copied' : 'Copy'}
        >
          {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={1.8} />}
        </button>
      </div>
      <pre className={className ? `${styles.pre} ${className}` : styles.pre} style={style} tabIndex={0}>
        {children}
      </pre>
    </div>
  )
}
