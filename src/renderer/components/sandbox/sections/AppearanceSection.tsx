/**
 * The full appearance surface — including `system` theme and `density`, which
 * the reading-comfort dialog cannot reach.
 *
 * Same preview bargain as SettingsModal: `previewAppearance` swaps CSS custom
 * properties on the document element with no re-render and no disk write, and
 * only pointer/key release commits. The specimen block below is styled from
 * those same properties, so it shows the real result rather than an
 * approximation.
 */
import { useState } from 'react'
import { ACCENTS, type AccentName } from '@shared/config-schema'
import { previewAppearance } from '../../../hooks/useAppearance'
import { Field, FieldGroup } from '../../primitives/Field'
import { Segmented } from '../controls'
import { useSettings } from '../useSettings'
import styles from './AppearanceSection.module.css'

/** `"78ch"` → `78`. */
function chOf(measure: string): number {
  return Number.parseInt(measure, 10) || 78
}

export function AppearanceSection(): React.JSX.Element {
  const { settings, defaults, patch } = useSettings()
  const a = settings.appearance
  const base = defaults.appearance

  const [measure, setMeasure] = useState(() => chOf(a.measure))
  const [fontSize, setFontSize] = useState(a.fontSize)
  const [lineHeight, setLineHeight] = useState(a.lineHeight)

  const commit = (value: Record<string, unknown>): void => patch({ appearance: value })

  return (
    <>
      <FieldGroup title="Theme">
        <Field name="Flavour" hint="Catppuccin. Mocha is dark, Latte is light.">
          <Segmented
            value={a.theme}
            options={[
              { value: 'dark', label: 'Mocha' },
              { value: 'light', label: 'Latte' },
              { value: 'system', label: 'System' },
            ]}
            onChange={(theme) => commit({ theme })}
          />
        </Field>

        <Field name="Accent" hint="The active rule, links, and the primary button.">
          <div className={styles.accents}>
            {ACCENTS.map((name: AccentName) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                aria-pressed={a.accent === name}
                title={name}
                className={a.accent === name ? `${styles.acc} ${styles.accOn}` : styles.acc}
                style={{ background: `var(--${name})` }}
                onClick={() => {
                  previewAppearance({ accent: name })
                  commit({ accent: name })
                }}
              />
            ))}
          </div>
        </Field>

        <Field name="Density" hint="Compact tightens row heights and panel padding.">
          <Segmented
            value={a.density}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
            onChange={(density) => {
              previewAppearance({ density })
              commit({ density })
            }}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Reading">
        <Field
          name="Reading width"
          hint="How wide the text column gets. Wider fits more; narrower is easier on the eye."
          value={`${measure}ch`}
          changed={measure !== chOf(base.measure)}
          onReset={() => {
            const v = chOf(base.measure)
            setMeasure(v)
            previewAppearance({ measure: base.measure })
            commit({ measure: base.measure })
          }}
        >
          <input
            type="range"
            className={styles.range}
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
        </Field>

        <Field
          name="Font size"
          hint="Body text in the reading pane."
          value={`${fontSize}px`}
          changed={fontSize !== base.fontSize}
          onReset={() => {
            setFontSize(base.fontSize)
            previewAppearance({ fontSize: base.fontSize })
            commit({ fontSize: base.fontSize })
          }}
        >
          <input
            type="range"
            className={styles.range}
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
        </Field>

        <Field
          name="Line height"
          hint="Space between lines."
          value={lineHeight.toFixed(2)}
          changed={lineHeight !== base.lineHeight}
          onReset={() => {
            setLineHeight(base.lineHeight)
            previewAppearance({ lineHeight: base.lineHeight })
            commit({ lineHeight: base.lineHeight })
          }}
        >
          <input
            type="range"
            className={styles.range}
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
        </Field>

        <Field name="Prose font" hint="Applies to document text, not to the interface.">
          <Segmented
            value={a.proseFont}
            options={[
              { value: 'sans', label: 'Sans' },
              { value: 'serif', label: 'Serif' },
              { value: 'mono', label: 'Mono' },
            ]}
            onChange={(proseFont) => {
              previewAppearance({ proseFont })
              commit({ proseFont })
            }}
          />
        </Field>

        <Field
          name="Details panel"
          hint="Where the dashboard's “Everything else” opens."
        >
          <Segmented
            value={a.revealMode}
            options={[
              { value: 'side', label: 'Beside' },
              { value: 'below', label: 'Below' },
            ]}
            onChange={(revealMode) => {
              previewAppearance({ revealMode })
              commit({ revealMode })
            }}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Specimen">
        <p className={styles.specimenNote}>
          Styled from the same custom properties the reading pane uses, so this is the result and
          not an impression of it.
        </p>
        <div className={styles.specimen}>
          <h4>A paragraph, at this size</h4>
          <p>
            Reading width is the setting people get wrong most often. Too wide and the eye loses
            the start of the next line; too narrow and you spend the whole page jumping. Somewhere
            between sixty and ninety characters is where prose stops fighting you — which is
            roughly what this block is showing right now.
          </p>
          <p>
            Inline <code>code</code> and <em>emphasis</em> sit here too, since they are what
            actually breaks when the line height is wrong.
          </p>
        </div>
      </FieldGroup>
    </>
  )
}
