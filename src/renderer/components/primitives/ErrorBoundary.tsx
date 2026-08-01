/**
 * A boundary that degrades to an inline message instead of a white screen.
 *
 * Used at the app root, around each pane, and — importantly — around every
 * context-panel widget, so a broken plugin widget shows "failed to render" in
 * its own frame while the rest of the workspace keeps working.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './ErrorBoundary.module.css'

interface Props {
  label: string
  children: ReactNode
  /** Rendered instead of the default message when provided. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label}] render failed`, error, info.componentStack)
  }

  private reset = (): void => this.setState({ error: null })

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className={styles.boundary} role="alert">
        <p className={styles.title}>{this.props.label} failed to render</p>
        <p className={styles.message}>{error.message}</p>
        {/* In development the stack is the whole point of an inline failure —
            a message with no location just means opening DevTools anyway. In a
            packaged build it is noise the reader cannot act on. */}
        {import.meta.env.DEV && error.stack && (
          <pre className={styles.stack}>{error.stack}</pre>
        )}
        <button type="button" className={styles.retry} onClick={this.reset}>
          Try again
        </button>
      </div>
    )
  }
}
