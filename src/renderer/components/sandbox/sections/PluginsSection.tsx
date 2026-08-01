/**
 * Which plugins are active, and what they were given.
 *
 * `settings.plugins.<id>` is the ONLY branch of the schema that passes unknown
 * keys through, because a plugin's options are the plugin's business. So this
 * shows what is there rather than pretending to understand it: the enable
 * toggle is a real control, and everything else is presented honestly as the
 * plugin's own configuration.
 *
 * The list comes from two places that do not agree, and the difference matters:
 * ACTIVE plugins are in the runtime registry, CONFIGURED plugins are in
 * settings. A plugin configured but not active either failed to load or is
 * disabled, and saying so is more use than hiding it.
 */
import { AlertTriangle } from 'lucide-react'
import { BUILTIN_PLUGINS } from '../../../plugins/builtin'
import { useShallow, useStore } from '../../../store'
import { FieldGroup } from '../../primitives/Field'
import { Toggle } from '../controls'
import { useSettings } from '../useSettings'
import styles from './PluginsSection.module.css'

export function PluginsSection(): React.JSX.Element {
  const { settings, patch } = useSettings()
  const failed = useStore(useShallow((s) => s.failedPlugins))
  const widgets = useStore(useShallow((s) => s.widgets))
  const sections = useStore(useShallow((s) => s.sections))
  const commands = useStore(useShallow((s) => s.commands))

  // Everything the app could run, plus anything the file names that we cannot.
  const ids = [
    ...new Set([...BUILTIN_PLUGINS.map((p) => p.id), ...Object.keys(settings.plugins)]),
  ].sort()

  return (
    <FieldGroup title="Plugins">
      <p className={styles.note}>
        A plugin absent from this file never activates. <code>enabled: false</code> turns one off
        while keeping its configuration, which is the difference between pausing something and
        losing its settings.
      </p>

      {ids.map((id) => {
        const config = settings.plugins[id]
        const known = BUILTIN_PLUGINS.some((p) => p.id === id)
        const enabled = config?.enabled ?? false
        const problem = failed.find((p) => p.id === id)?.error

        const contributions = [
          Object.values(widgets).filter((w) => w.owner === id).length,
          Object.values(sections).filter((s) => s.owner === id).length,
          Object.values(commands).filter((c) => c.owner === id).length,
        ]
        const extraKeys = Object.keys(config ?? {}).filter((k) => k !== 'enabled')

        return (
          <article key={id} className={styles.card}>
            <header className={styles.head}>
              <div className={styles.text}>
                <h4 className={styles.name}>{id}</h4>
                {!known && (
                  <p className={styles.warn}>
                    <AlertTriangle size={12} strokeWidth={2} />
                    Configured here, but this build has no such plugin. Its settings are kept.
                  </p>
                )}
                {problem && (
                  <p className={styles.warn}>
                    <AlertTriangle size={12} strokeWidth={2} />
                    Failed to activate: {problem}
                  </p>
                )}
                {known && !problem && enabled && (
                  <p className={styles.meta}>
                    {contributions[0]} widget{contributions[0] === 1 ? '' : 's'} ·{' '}
                    {contributions[1]} section{contributions[1] === 1 ? '' : 's'} ·{' '}
                    {contributions[2]} command{contributions[2] === 1 ? '' : 's'}
                  </p>
                )}
              </div>

              <Toggle
                label={`Enable ${id}`}
                checked={enabled}
                disabled={!known}
                onChange={(next) => patch({ plugins: { [id]: { enabled: next } } })}
              />
            </header>

            {extraKeys.length > 0 && (
              <div className={styles.options}>
                <p className={styles.optionsLabel}>
                  Its own options — this app does not interpret these, and never rewrites them.
                </p>
                <pre className={styles.json}>
                  {JSON.stringify(
                    Object.fromEntries(extraKeys.map((k) => [k, config?.[k]])),
                    null,
                    2,
                  )}
                </pre>
              </div>
            )}
          </article>
        )
      })}

      {ids.length === 0 && <p className={styles.empty}>No plugins configured.</p>}
    </FieldGroup>
  )
}
