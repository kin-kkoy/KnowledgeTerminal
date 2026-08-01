/**
 * Links.
 *
 * Three kinds, distinguished by data attributes the pipeline stamped on:
 *   internal   — open in a tab (Ctrl/Middle-click opens in the split)
 *   external   — hand to the system browser, never navigate the window
 *   unresolved — render as broken, visibly, rather than as dead plain text
 */
import type { ReactNode } from 'react'
import { platform } from '../../platform'
import { useStore } from '../../store'
import styles from './InternalLink.module.css'

interface Props {
  href?: string
  children?: ReactNode
  'data-kt-link'?: string
  'data-kt-target'?: string
  'data-kt-heading'?: string
  'data-kt-unresolved'?: string
  [key: string]: unknown
}

export function InternalLink(props: Props): React.JSX.Element {
  const { href, children, ...rest } = props
  const kind = props['data-kt-link']
  const target = props['data-kt-target']
  const heading = props['data-kt-heading']
  const unresolved = props['data-kt-unresolved'] === 'true'

  const openDocument = useStore((s) => s.openDocument)
  const pushNotice = useStore((s) => s.pushNotice)

  // A plain in-page anchor: let the outline and footnote links work normally.
  if (href?.startsWith('#') && !kind) {
    return (
      <a href={href} className={styles.anchor} {...rest}>
        {children}
      </a>
    )
  }

  if (kind === 'external') {
    return (
      <a
        href={href}
        className={styles.external}
        onClick={(event) => {
          event.preventDefault()
          if (href) void platform.openExternal(href)
        }}
        {...rest}
      >
        {children}
      </a>
    )
  }

  if (unresolved) {
    return (
      <span
        className={styles.unresolved}
        title={`Unresolved link: ${target ?? href ?? ''}`}
        onClick={() =>
          pushNotice({
            level: 'info',
            message: `No document matches “${target ?? href ?? ''}”`,
          })
        }
      >
        {children}
      </span>
    )
  }

  return (
    <a
      href={href}
      className={styles.internal}
      onClick={(event) => {
        event.preventDefault()
        if (!target) return
        // Ctrl/Cmd-click opens beside, matching every editor's convention.
        const pane = event.ctrlKey || event.metaKey ? 'right' : 'active'
        openDocument(target, { pane })
        if (heading) {
          // The document mounts asynchronously; scroll once it exists.
          requestAnimationFrame(() => {
            document.getElementById(heading)?.scrollIntoView({ block: 'start' })
          })
        }
      }}
      onAuxClick={(event) => {
        if (event.button === 1 && target) {
          event.preventDefault()
          openDocument(target, { pane: 'right' })
        }
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
