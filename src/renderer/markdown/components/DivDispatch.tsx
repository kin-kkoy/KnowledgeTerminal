/**
 * Callouts and mermaid blocks both arrive as `<div>` carrying a data attribute.
 * Dispatching here keeps the pipeline's component map flat — one `div` entry
 * instead of a bespoke tag name per feature.
 */
import type { ReactNode } from 'react'
import { Callout } from './Callout'
import { Mermaid } from './Mermaid'

interface Props {
  children?: ReactNode
  'data-kt-callout'?: string
  'data-kt-callout-title'?: string
  'data-kt-callout-fold'?: string
  'data-kt-mermaid'?: string
  [key: string]: unknown
}

/** hast may deliver a text child as a nested array; flatten to a string. */
function textOf(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(textOf).join('')
  return ''
}

export function DivDispatch(props: Props): React.JSX.Element {
  const { children, ...rest } = props

  const calloutType = props['data-kt-callout']
  if (calloutType) {
    return (
      <Callout
        type={calloutType}
        title={props['data-kt-callout-title']}
        fold={props['data-kt-callout-fold']}
        blockId={props['data-kt-block'] as string | undefined}
      >
        {children}
      </Callout>
    )
  }

  if ('data-kt-mermaid' in props) {
    return (
      <Mermaid code={textOf(children)} blockId={props['data-kt-block'] as string | undefined} />
    )
  }

  return <div {...rest}>{children}</div>
}
