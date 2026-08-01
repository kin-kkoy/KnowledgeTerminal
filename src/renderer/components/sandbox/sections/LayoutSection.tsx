/**
 * Panels, context widgets and explorer sections.
 *
 * Reordering is buttons, not drag-and-drop. A drag handle for a list of six
 * items costs pointer maths, a keyboard fallback and an accessibility story,
 * and buys nothing you cannot get from two arrows — which are already
 * keyboard-operable and screen-reader-legible for free.
 *
 * Core and plugin contributions are listed together and treated identically:
 * `layout.contextWidgets` does not distinguish them, and neither should this.
 */
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import type { ContextWidgetConfig } from '@shared/config-schema'
import { ICON_SET, iconByName } from '../../../icons/registry'
import { useShallow, useStore } from '../../../store'
import { CORE_WIDGETS, type OptionSpec } from '../../context/widgetRegistry'
import { CORE_SECTIONS } from '../../explorer/sectionRegistry'
import { Field, FieldGroup } from '../../primitives/Field'
import { NumberInput, StringList, TextInput, Toggle } from '../controls'
import { useSettings } from '../useSettings'
import styles from './LayoutSection.module.css'

interface Available {
  id: string
  title: string
  description: string
  icon: string
  options?: OptionSpec[]
  owner: string
}

export function LayoutSection(): React.JSX.Element {
  const { settings, defaults, patch } = useSettings()
  const layout = settings.layout
  const base = defaults.layout
  const pluginWidgets = useStore(useShallow((s) => s.widgets))
  const pluginSections = useStore(useShallow((s) => s.sections))

  // Core first, then whatever plugins contributed — the same order the panels
  // resolve in, so the list matches what you will get.
  const widgetCatalogue: Available[] = [
    ...Object.entries(CORE_WIDGETS).map(([id, w]) => ({
      id,
      title: w.title,
      description: w.description,
      icon: w.icon as string,
      options: w.options,
      owner: 'core',
    })),
    ...Object.values(pluginWidgets).map((w) => ({
      id: w.id,
      title: w.title,
      description: w.description ?? `Contributed by ${w.owner}.`,
      icon: w.icon ?? 'layers',
      options: w.options,
      owner: w.owner,
    })),
  ]

  const sectionCatalogue: Available[] = [
    ...Object.entries(CORE_SECTIONS).map(([id, s]) => ({
      id,
      title: s.title,
      description: s.description,
      icon: s.icon as string,
      owner: 'core',
    })),
    ...Object.values(pluginSections).map((s) => ({
      id: s.id,
      title: s.title,
      description: `Contributed by ${s.owner}.`,
      icon: s.icon ?? 'layers',
      owner: s.owner,
    })),
  ]

  const setWidgets = (contextWidgets: ContextWidgetConfig[]): void =>
    patch({ layout: { contextWidgets } })

  const move = (index: number, delta: number): void => {
    const next = [...layout.contextWidgets]
    const target = index + delta
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    setWidgets(next)
  }

  const moveSection = (index: number, delta: number): void => {
    const next = [...layout.explorerSections]
    const target = index + delta
    const a = next[index]
    const b = next[target]
    if (a === undefined || b === undefined) return
    next[index] = b
    next[target] = a
    patch({ layout: { explorerSections: next } })
  }

  const unusedWidgets = widgetCatalogue.filter(
    (w) => !layout.contextWidgets.some((c) => c.id === w.id),
  )
  const unusedSections = sectionCatalogue.filter((s) => !layout.explorerSections.includes(s.id))

  return (
    <>
      <FieldGroup title="Panels">
        <Field name="Explorer" hint="The left panel. Width in pixels.">
          <div className={styles.pair}>
            <Toggle
              label="Show explorer"
              checked={layout.explorer.visible}
              onChange={(visible) => patch({ layout: { explorer: { visible } } })}
            />
            <NumberInput
              value={layout.explorer.width}
              min={180}
              max={720}
              onCommit={(width) => patch({ layout: { explorer: { width } } })}
            />
          </div>
        </Field>

        <Field name="Context panel" hint="The right panel, where the widgets below live.">
          <div className={styles.pair}>
            <Toggle
              label="Show context panel"
              checked={layout.contextPanel.visible}
              onChange={(visible) => patch({ layout: { contextPanel: { visible } } })}
            />
            <NumberInput
              value={layout.contextPanel.width}
              min={180}
              max={720}
              onCommit={(width) => patch({ layout: { contextPanel: { width } } })}
            />
          </div>
        </Field>
      </FieldGroup>

      <FieldGroup title="Context widgets">
        <p className={styles.note}>
          Top to bottom, in this order. An id that resolves to nothing — a plugin you disabled — is
          skipped rather than treated as an error, so a list can outlive the thing it names.
        </p>

        <ul className={styles.list}>
          {layout.contextWidgets.map((entry, index) => {
            const known = widgetCatalogue.find((w) => w.id === entry.id)
            const Glyph = iconByName(known?.icon, 'layers')
            return (
              <li key={entry.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <Glyph size={15} strokeWidth={1.8} className={styles.itemIcon} />
                  <div className={styles.itemText}>
                    <span className={styles.itemTitle}>
                      {known?.title ?? entry.id}
                      {!known && <em className={styles.missing}> — not available</em>}
                      {known && known.owner !== 'core' && (
                        <span className={styles.owner}>{known.owner}</span>
                      )}
                    </span>
                    <span className={styles.itemId}>{entry.id}</span>
                  </div>

                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.mini}
                      disabled={index === 0}
                      title="Move up"
                      aria-label={`Move ${entry.id} up`}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronUp size={13} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      className={styles.mini}
                      disabled={index === layout.contextWidgets.length - 1}
                      title="Move down"
                      aria-label={`Move ${entry.id} down`}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronDown size={13} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      className={styles.mini}
                      title="Remove"
                      aria-label={`Remove ${entry.id}`}
                      onClick={() =>
                        setWidgets(layout.contextWidgets.filter((_, i) => i !== index))
                      }
                    >
                      <X size={13} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>

                <label className={styles.collapsed}>
                  <input
                    type="checkbox"
                    checked={entry.collapsed}
                    onChange={(e) => {
                      const next = [...layout.contextWidgets]
                      next[index] = { ...entry, collapsed: e.target.checked }
                      setWidgets(next)
                    }}
                  />
                  Start collapsed
                </label>

                {known?.options && known.options.length > 0 && (
                  <div className={styles.options}>
                    {known.options.map((spec) => (
                      <WidgetOption
                        key={spec.key}
                        spec={spec}
                        value={entry.options[spec.key]}
                        onChange={(value) => {
                          const next = [...layout.contextWidgets]
                          next[index] = {
                            ...entry,
                            options: { ...entry.options, [spec.key]: value },
                          }
                          setWidgets(next)
                        }}
                      />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {unusedWidgets.length > 0 && (
          <div className={styles.add}>
            <span className={styles.addLabel}>Add</span>
            {unusedWidgets.map((w) => {
              const Glyph = iconByName(w.icon, 'layers')
              return (
                <button
                  key={w.id}
                  type="button"
                  className={styles.chip}
                  title={w.description}
                  onClick={() =>
                    setWidgets([
                      ...layout.contextWidgets,
                      { id: w.id, collapsed: false, options: {} },
                    ])
                  }
                >
                  <Glyph size={13} strokeWidth={1.8} />
                  {w.title}
                  <Plus size={12} strokeWidth={2.4} />
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          className={styles.resetAll}
          onClick={() => patch({ layout: { contextWidgets: base.contextWidgets } })}
        >
          Reset widgets to defaults
        </button>
      </FieldGroup>

      <FieldGroup title="The Lobby's map">
        <p className={styles.note}>
          The Lobby's “Where things live” map is configured under <code>lobby.map</code> in
          <code> .kt/settings.json</code>, and has no editor here yet. See{' '}
          <code>ROUGH-EDGES.md</code> → <code>lobby-map-editing</code>.
        </p>
      </FieldGroup>

      <FieldGroup title="Explorer sections">
        <ul className={styles.list}>
          {layout.explorerSections.map((id, index) => {
            const known = sectionCatalogue.find((s) => s.id === id)
            const Glyph = iconByName(known?.icon, 'layers')
            return (
              <li key={id} className={styles.item}>
                <div className={styles.itemHead}>
                  <Glyph size={15} strokeWidth={1.8} className={styles.itemIcon} />
                  <div className={styles.itemText}>
                    <span className={styles.itemTitle}>
                      {known?.title ?? id}
                      {!known && <em className={styles.missing}> — not available</em>}
                    </span>
                    <span className={styles.itemId}>{id}</span>
                  </div>
                  <div className={styles.itemActions}>
                    <button
                      type="button"
                      className={styles.mini}
                      disabled={index === 0}
                      title="Move up"
                      aria-label={`Move ${id} up`}
                      onClick={() => moveSection(index, -1)}
                    >
                      <ChevronUp size={13} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      className={styles.mini}
                      disabled={index === layout.explorerSections.length - 1}
                      title="Move down"
                      aria-label={`Move ${id} down`}
                      onClick={() => moveSection(index, 1)}
                    >
                      <ChevronDown size={13} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      className={styles.mini}
                      title="Remove"
                      aria-label={`Remove ${id}`}
                      onClick={() =>
                        patch({
                          layout: {
                            explorerSections: layout.explorerSections.filter((_, i) => i !== index),
                          },
                        })
                      }
                    >
                      <X size={13} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        {unusedSections.length > 0 && (
          <div className={styles.add}>
            <span className={styles.addLabel}>Add</span>
            {unusedSections.map((s) => {
              const Glyph = iconByName(s.icon, 'layers')
              return (
                <button
                  key={s.id}
                  type="button"
                  className={styles.chip}
                  title={s.description}
                  onClick={() =>
                    patch({ layout: { explorerSections: [...layout.explorerSections, s.id] } })
                  }
                >
                  <Glyph size={13} strokeWidth={1.8} />
                  {s.title}
                  <Plus size={12} strokeWidth={2.4} />
                </button>
              )
            })}
          </div>
        )}
      </FieldGroup>
    </>
  )
}

/** One widget option, rendered from its declared type. */
function WidgetOption({
  spec,
  value,
  onChange,
}: {
  spec: OptionSpec
  value: unknown
  onChange(next: unknown): void
}): React.JSX.Element {
  const label = (
    <div className={styles.optText}>
      <span className={styles.optName}>{spec.label}</span>
      {spec.hint && <span className={styles.optHint}>{spec.hint}</span>}
    </div>
  )

  switch (spec.type) {
    case 'boolean':
      return (
        <div className={styles.opt}>
          {label}
          <Toggle
            label={spec.label}
            checked={typeof value === 'boolean' ? value : spec.default}
            onChange={onChange}
          />
        </div>
      )
    case 'number':
      return (
        <div className={styles.opt}>
          {label}
          <NumberInput
            value={typeof value === 'number' ? value : spec.default}
            min={spec.min}
            max={spec.max}
            onCommit={onChange}
          />
        </div>
      )
    case 'string':
      return (
        <div className={styles.opt}>
          {label}
          <TextInput
            value={typeof value === 'string' ? value : spec.default}
            mono
            onCommit={onChange}
          />
        </div>
      )
    case 'stringList':
      return (
        <div className={styles.optStacked}>
          {label}
          <StringList
            values={Array.isArray(value) ? (value as string[]) : spec.default}
            onChange={onChange}
          />
        </div>
      )
    case 'actions':
      return (
        <div className={styles.optStacked}>
          {label}
          <ActionsEditor value={Array.isArray(value) ? (value as ActionEntry[]) : []} onChange={onChange} />
        </div>
      )
  }
}

interface ActionEntry {
  label: string
  command: string
  icon?: string
}

/**
 * Quick Actions' `{label, command, icon}` list — the one structured option in
 * core. Commands are offered from the live registry, so a plugin's commands
 * appear here the moment it activates.
 */
function ActionsEditor({
  value,
  onChange,
}: {
  value: ActionEntry[]
  onChange(next: ActionEntry[]): void
}): React.JSX.Element {
  const commands = useStore(useShallow((s) => s.commands))
  const available = Object.values(commands).sort((a, b) => a.title.localeCompare(b.title))

  const update = (index: number, patch: Partial<ActionEntry>): void => {
    const next = [...value]
    const current = next[index]
    if (!current) return
    next[index] = { ...current, ...patch }
    onChange(next)
  }

  return (
    <div className={styles.actions}>
      {value.map((action, index) => (
        <div key={index} className={styles.action}>
          <TextInput
            value={action.label}
            placeholder="Label"
            onCommit={(label) => update(index, { label })}
          />
          <select
            className={styles.actionSelect}
            value={action.command}
            onChange={(e) => update(index, { command: e.target.value })}
          >
            <option value="">Choose a command…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category} · {c.title}
              </option>
            ))}
          </select>
          <select
            className={styles.actionSelect}
            value={action.icon ?? ''}
            onChange={(e) => update(index, { icon: e.target.value || undefined })}
          >
            <option value="">Icon from label</option>
            {Object.keys(ICON_SET).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.mini}
            title="Remove"
            aria-label={`Remove ${action.label || 'action'}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X size={13} strokeWidth={2.2} />
          </button>
        </div>
      ))}

      <button
        type="button"
        className={styles.chip}
        onClick={() => onChange([...value, { label: 'New action', command: '' }])}
      >
        <Plus size={12} strokeWidth={2.4} />
        Add action
      </button>
    </div>
  )
}
