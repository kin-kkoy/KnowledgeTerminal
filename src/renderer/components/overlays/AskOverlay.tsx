/**
 * Ctrl+Shift+K — ask the workspace a question.
 *
 * Not the search overlay with a different placeholder. Search answers "which
 * files contain these words"; this answers the question itself, and says which
 * layer produced the answer so the routing is never a mystery.
 *
 * It does not run while you type. See `askSlice` for why — routing a half-typed
 * question classifies it wrongly, and layer 4 would assemble a context block for
 * a question that is not finished being asked.
 *
 * (Ctrl+K on its own is unavailable: it is the prefix of the `ctrl+k ctrl+t`
 * theme chord, and binding it directly would make that chord unreachable.)
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../../store'
import type { RelPath } from '@shared/types'
import { AnswerCard } from '../ask/AnswerCard'
import overlay from './Overlay.module.css'
import styles from './AskOverlay.module.css'

const EXAMPLES = ['Where was I?', "What's open?", 'What have I been reading?']

export function AskOverlay(): React.JSX.Element {
  const query = useStore((s) => s.askQuery)
  const answer = useStore((s) => s.askAnswer)
  const asking = useStore((s) => s.asking)
  const tried = useStore((s) => s.askTried)
  const context = useStore((s) => s.askContext)
  const setAskQuery = useStore((s) => s.setAskQuery)
  const runAsk = useStore((s) => s.runAsk)
  const closeOverlay = useStore((s) => s.closeOverlay)
  const openDocument = useStore((s) => s.openDocument)

  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  const submit = (value: string): void => {
    void runAsk(value)
  }

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit(query)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeOverlay()
    }
  }

  const openEvidence = (path: RelPath, opts: { alt: boolean }): void => {
    openDocument(path, { pane: opts.alt ? 'right' : 'active' })
    closeOverlay()
  }

  return (
    <div className={overlay.backdrop} onMouseDown={closeOverlay} role="presentation">
      <div
        className={`${overlay.panel} ${styles.panel}`}
        role="dialog"
        aria-modal="true"
        aria-label="Ask the workspace"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={input}
          type="text"
          className={overlay.input}
          placeholder="Ask about your workspace…"
          value={query}
          onChange={(e) => setAskQuery(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoComplete="off"
          aria-label="Ask about your workspace"
        />

        <div className={styles.body}>
          {asking && <div className={styles.status}>Working…</div>}

          {!asking && answer && <AnswerCard answer={answer} onOpen={openEvidence} />}

          {/* Keyed off `context`, not `tried`: a question that explicitly asks
              for reasoning skips every deterministic layer, so `tried` is empty
              and the panel would otherwise render blank. */}
          {!asking && !answer && context && (
            <div className={styles.status}>
              Nothing in the workspace matched that. Try Ctrl+/ to search the text instead.
            </div>
          )}

          {!query.trim() && (
            <div className={styles.hint}>
              <div className={styles.hintLead}>
                Questions about where you are and what you have read are answered from your own
                session — instantly, and without leaving this machine.
              </div>
              <div className={styles.examples}>
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className={styles.example}
                    onClick={() => {
                      setAskQuery(example)
                      submit(example)
                    }}
                  >
                    <span className={styles.exampleMark} aria-hidden="true">
                      &rsaquo;
                    </span>
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {answer && (
          <div className={overlay.footer}>
            <span className={styles.trace}>
              answered at layer {answer.layer}
              {tried.length > 1 && ` · tried ${tried.join(', ')}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
