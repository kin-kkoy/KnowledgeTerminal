/**
 * What is indexed, what the tree shows, and what everything looks like.
 *
 * The two glob lists are deliberately separate and the hint says why: dropping
 * images from `include` to tidy the tree also stops `![](x.png)` resolving,
 * which is a confusing way to lose your illustrations.
 */
import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { IconColour } from '@shared/config-schema'
import { matchesAny } from '@shared/paths'
import { ICON_SET, isIconName, resolveIcon } from '../../../icons/registry'
import { useShallow, useStore } from '../../../store'
import { Field, FieldGroup } from '../../primitives/Field'
import { IconPicker, NumberInput, StringList } from '../controls'
import { sameValue, useSettings } from '../useSettings'
import styles from './FilesSection.module.css'

export function FilesSection(): React.JSX.Element {
  const { settings, defaults, patch } = useSettings()
  const files = settings.files
  const base = defaults.files
  const docs = useStore(useShallow((s) => s.docs))
  const tree = useStore((s) => s.tree)

  const [target, setTarget] = useState<string | null>(null)

  /** Every folder and document, so the icon picker has something to aim at. */
  const paths = useMemo(() => {
    const dirs: string[] = []
    const walk = (node: { children?: Array<{ kind: string; path: string; children?: never[] }> }): void => {
      for (const child of (node.children ?? []) as Array<{
        kind: string
        path: string
        children?: never[]
      }>) {
        if (child.kind === 'dir') {
          dirs.push(child.path)
          walk(child)
        }
      }
    }
    if (tree) walk(tree as never)
    return { dirs, docs: docs.map((d) => d.path) }
  }, [tree, docs])

  const overrides = Object.entries(files.icons)
  const hiddenCount = docs.filter((d) => !matchesAny(d.path, files.treeFilter)).length

  const setIcon = (path: string, next: { icon: string; colour?: IconColour } | null): void => {
    const copy = { ...files.icons }
    if (next === null) delete copy[path]
    else copy[path] = next
    patch({ files: { icons: copy } })
  }

  return (
    <>
      <FieldGroup title="What is indexed">
        <Field
          name="Include"
          hint="Search, wiki-links and embedded images all resolve against this list. Order does not matter; each entry is a glob."
          stacked
          changed={!sameValue(files.include, base.include)}
          onReset={() => patch({ files: { include: base.include } })}
        >
          <StringList
            values={files.include}
            placeholder="**/*.md"
            onChange={(include) => patch({ files: { include } })}
          />
        </Field>

        <Field
          name="Ignore"
          hint="Skipped entirely — never walked, never indexed."
          stacked
          changed={!sameValue(files.ignore, base.ignore)}
          onReset={() => patch({ files: { ignore: base.ignore } })}
        >
          <StringList
            values={files.ignore}
            placeholder="**/node_modules/**"
            onChange={(ignore) => patch({ files: { ignore } })}
          />
        </Field>

        <Field
          name="Asset roots"
          hint="Obsidian-style. An image path is tried document-relative first, then against each of these from the workspace root."
          stacked
          changed={!sameValue(files.assetRoots, base.assetRoots)}
          onReset={() => patch({ files: { assetRoots: base.assetRoots } })}
        >
          <StringList
            values={files.assetRoots}
            placeholder="assets"
            onChange={(assetRoots) => patch({ files: { assetRoots } })}
          />
        </Field>

        <Field
          name="Max render size"
          hint="Bigger files still open — they render as plain text with a notice instead of going through the full pipeline."
          value={`${Math.round(files.maxRenderBytes / 1000)} kB`}
          changed={files.maxRenderBytes !== base.maxRenderBytes}
          onReset={() => patch({ files: { maxRenderBytes: base.maxRenderBytes } })}
        >
          <NumberInput
            value={files.maxRenderBytes}
            min={10_000}
            step={100_000}
            onCommit={(maxRenderBytes) => patch({ files: { maxRenderBytes } })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="What the tree shows">
        <Field
          name="Tree filter"
          hint={`Anything indexed but not matching lands in the explorer's Miscellaneous section, grouped by kind. Right now that is ${hiddenCount} file${hiddenCount === 1 ? '' : 's'}.`}
          stacked
          changed={!sameValue(files.treeFilter, base.treeFilter)}
          onReset={() => patch({ files: { treeFilter: base.treeFilter } })}
        >
          <StringList
            values={files.treeFilter}
            placeholder="**/*.md"
            onChange={(treeFilter) => patch({ files: { treeFilter } })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Icons">
        <p className={styles.note}>
          Folder and file icons are guessed from the name. The guess is a decent default and a bad
          rule — it cannot know which folder here is the important one. Anything you set below wins;
          everything else still falls through to the guess.
        </p>

        {overrides.length > 0 && (
          <ul className={styles.overrides}>
            {overrides.map(([path, override]) => {
              const Glyph = isIconName(override.icon) ? ICON_SET[override.icon] : null
              return (
                <li key={path} className={styles.override}>
                  <span className={styles.overrideIcon}>
                    {Glyph ? (
                      <Glyph
                        size={15}
                        strokeWidth={1.8}
                        style={{ color: override.colour ? `var(--${override.colour})` : undefined }}
                      />
                    ) : (
                      <span className={styles.unknown} title="Unknown icon name — falling back">
                        ?
                      </span>
                    )}
                  </span>
                  <span className={styles.overridePath}>{path}</span>
                  <button
                    type="button"
                    className={styles.clear}
                    title="Clear this override"
                    aria-label={`Clear icon for ${path}`}
                    onClick={() => setIcon(path, null)}
                  >
                    <Trash2 size={13} strokeWidth={2} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <Field
          name="Set an icon"
          hint="Pick a folder or document, then an icon. You can also right-click any row in the file tree."
          stacked
        >
          <>
            <select
              className={styles.select}
              value={target ?? ''}
              onChange={(e) => setTarget(e.target.value === '' ? null : e.target.value)}
            >
              <option value="">Choose a folder or document…</option>
              <optgroup label="Folders">
                {paths.dirs.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Documents">
                {paths.docs.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
              </optgroup>
            </select>

            {target && (
              <div className={styles.pickerWrap}>
                <PreviewRow path={target} icons={files.icons} />
                <IconPicker
                  icon={files.icons[target]?.icon ?? null}
                  colour={files.icons[target]?.colour}
                  onChange={(next) => setIcon(target, next)}
                />
              </div>
            )}
          </>
        </Field>
      </FieldGroup>
    </>
  )
}

/** What the tree will actually render for this path, override applied. */
function PreviewRow({
  path,
  icons,
}: {
  path: string
  icons: Record<string, { icon: string; colour?: IconColour }>
}): React.JSX.Element {
  const name = path.split('/').pop() ?? path
  const isDir = !/\.[a-z0-9]+$/i.test(name)
  const { icon: Glyph, colour } = resolveIcon(path, name, isDir ? 'dir' : 'file', false, icons)
  return (
    <div className={styles.preview}>
      <Glyph size={13} strokeWidth={1.8} style={{ color: colour }} />
      <span>{name.replace(/\.mdx?$/i, '')}</span>
    </div>
  )
}
