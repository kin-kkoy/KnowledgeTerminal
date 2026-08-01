/**
 * Settings.
 *
 * Sliders preview LIVE while dragging (a CSS variable swap, no re-render) and
 * only write to settings.json on release — so tuning the reading width feels
 * immediate without producing a hundred disk writes.
 *
 * A reset appears beside any value that differs from its default.
 */
import { useCallback, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { ACCENTS, DEFAULT_WORKSPACE_SETTINGS, type AccentName } from '@shared/config-schema'
import { previewAppearance } from '../../hooks/useAppearance'
import { useStore } from '../../store'
import { Modal } from './Modal'
import styles from './SettingsModal.module.css'

/**
 * Derived from the schema, never hand-copied — a second copy of the defaults is
 * a second thing to keep in sync, and the reset buttons would quietly start
 * resetting to the wrong value.
 */
const APPEARANCE_DEFAULTS = DEFAULT_WORKSPACE_SETTINGS.appearance
const DEFAULTS = {
  measure: Number.parseInt(APPEARANCE_DEFAULTS.measure, 10),
  fontSize: APPEARANCE_DEFAULTS.fontSize,
  lineHeight: APPEARANCE_DEFAULTS.lineHeight,
}

const MD_ONLY = DEFAULT_WORKSPACE_SETTINGS.files.treeFilter

function same(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/** `"78ch"` → `78`. */
function chOf(measure: string): number {
  return Number.parseInt(measure, 10) || DEFAULTS.measure
}

export function SettingsModal({ onClose }: { onClose(): void }): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const patchSettings = useStore((s) => s.patchSettings)
  const appearance = settings?.appearance

  const [measure, setMeasure] = useState(() => chOf(appearance?.measure ?? '78ch'))
  const [fontSize, setFontSize] = useState(appearance?.fontSize ?? DEFAULTS.fontSize)
  const [lineHeight, setLineHeight] = useState(appearance?.lineHeight ?? DEFAULTS.lineHeight)

  const commit = useCallback(
    (patch: Record<string, unknown>) => void patchSettings({ appearance: patch }),
    [patchSettings],
  )

  if (!settings) return <Modal title="Settings" onClose={onClose}>No workspace open.</Modal>

  // This checkbox can only honestly represent two states: the schema default
  // (Markdown only) and "everything indexed". A hand-written treeFilter is
  // neither, and toggling would silently destroy it — so say so and stand down.
  const { treeFilter, include } = settings.files
  const mdOnly = same(treeFilter, MD_ONLY)
  const showsAll = same(treeFilter, include)
  const custom = !mdOnly && !showsAll

  return (
    <Modal title="Settings" onClose={onClose}>
      <p className={styles.section}>Reading</p>

      <Row
        name="Reading width"
        hint="How wide the text column gets. Wider fits more; narrower is easier on the eye."
        value={`${measure}ch`}
        changed={measure !== DEFAULTS.measure}
        onReset={() => {
          setMeasure(DEFAULTS.measure)
          previewAppearance({ measure: `${DEFAULTS.measure}ch` })
          commit({ measure: `${DEFAULTS.measure}ch` })
        }}
      >
        <input
          type="range"
          min={54}
          max={130}
          value={measure}
          onChange={(e) => {
            const v = Number(e.target.value)
            setMeasure(v)
            previewAppearance({ measure: `${v}ch` })
          }}
          onPointerUp={() => commit({ measure: `${measure}ch` })}
          onKeyUp={() => commit({ measure: `${measure}ch` })}
        />
      </Row>

      <Row
        name="Font size"
        hint="Body text in the reading pane."
        value={`${fontSize}px`}
        changed={fontSize !== DEFAULTS.fontSize}
        onReset={() => {
          setFontSize(DEFAULTS.fontSize)
          previewAppearance({ fontSize: DEFAULTS.fontSize })
          commit({ fontSize: DEFAULTS.fontSize })
        }}
      >
        <input
          type="range"
          min={13}
          max={22}
          step={0.5}
          value={fontSize}
          onChange={(e) => {
            const v = Number(e.target.value)
            setFontSize(v)
            previewAppearance({ fontSize: v })
          }}
          onPointerUp={() => commit({ fontSize })}
          onKeyUp={() => commit({ fontSize })}
        />
      </Row>

      <Row
        name="Line height"
        hint="Space between lines."
        value={lineHeight.toFixed(2)}
        changed={lineHeight !== DEFAULTS.lineHeight}
        onReset={() => {
          setLineHeight(DEFAULTS.lineHeight)
          previewAppearance({ lineHeight: DEFAULTS.lineHeight })
          commit({ lineHeight: DEFAULTS.lineHeight })
        }}
      >
        <input
          type="range"
          min={1.3}
          max={2.1}
          step={0.05}
          value={lineHeight}
          onChange={(e) => {
            const v = Number(e.target.value)
            setLineHeight(v)
            previewAppearance({ lineHeight: v })
          }}
          onPointerUp={() => commit({ lineHeight })}
          onKeyUp={() => commit({ lineHeight })}
        />
      </Row>

      <p className={styles.section}>Appearance</p>

      <Row name="Theme" hint="Catppuccin. Mocha is the dark flavour, Latte the light one.">
        <div className={styles.seg}>
          {(['dark', 'light'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={appearance?.theme === t ? `${styles.segb} ${styles.on}` : styles.segb}
              onClick={() => commit({ theme: t })}
            >
              {t === 'dark' ? 'Mocha' : 'Latte'}
            </button>
          ))}
        </div>
      </Row>

      <Row name="Accent" hint="Used for the active rule, links, and the primary button.">
        <div className={styles.accents}>
          {ACCENTS.map((name: AccentName) => (
            <button
              key={name}
              type="button"
              aria-label={name}
              title={name}
              className={appearance?.accent === name ? `${styles.acc} ${styles.on}` : styles.acc}
              style={{ background: `var(--${name})` }}
              onClick={() => {
                previewAppearance({ accent: name })
                commit({ accent: name })
              }}
            />
          ))}
        </div>
      </Row>

      <Row
        name="Details panel"
        hint="Where the dashboard's “Everything else” opens — beside the text, or beneath it."
      >
        <div className={styles.seg}>
          {(['side', 'below'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={appearance?.revealMode === m ? `${styles.segb} ${styles.on}` : styles.segb}
              onClick={() => {
                previewAppearance({ revealMode: m })
                commit({ revealMode: m })
              }}
            >
              {m === 'side' ? 'Beside' : 'Below'}
            </button>
          ))}
        </div>
      </Row>

      <p className={styles.section}>Files</p>

      <Row
        name="Show only Markdown in the tree"
        hint={
          custom
            ? 'This workspace uses a custom tree filter. Edit it in the Sandbox — toggling here would overwrite it.'
            : 'Everything else stays searchable and stays embeddable — it just moves to the Miscellaneous section, grouped by kind.'
        }
      >
        <input
          type="checkbox"
          className={styles.check}
          checked={mdOnly}
          disabled={custom}
          onChange={(e) =>
            void patchSettings({
              files: { treeFilter: e.target.checked ? [...MD_ONLY] : [...include] },
            })
          }
        />
      </Row>

    </Modal>
  )
}

function Row({
  name,
  hint,
  value,
  changed,
  onReset,
  children,
}: {
  name: string
  hint: string
  value?: string
  changed?: boolean
  onReset?(): void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <div className={styles.name}>{name}</div>
        <div className={styles.hint}>{hint}</div>
      </div>
      {children}
      {value !== undefined && <span className={styles.value}>{value}</span>}
      {onReset && (
        <button
          type="button"
          className={changed ? `${styles.reset} ${styles.show}` : styles.reset}
          onClick={onReset}
          title="Reset to default"
          aria-label={`Reset ${name}`}
          tabIndex={changed ? 0 : -1}
        >
          <RotateCcw size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  )
}
