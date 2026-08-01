/**
 * What this workspace is for.
 *
 * These fields write to settings.json and nothing else. The scaffolded
 * README.md is written once when a workspace is created and never touched
 * again — this is not a Markdown editor, and editing the name here must not
 * silently rewrite a document you have since made your own.
 */
import { useMemo } from 'react'
import { Field, FieldGroup } from '../../primitives/Field'
import { useStore, useShallow } from '../../../store'
import { Segmented, TextInput } from '../controls'
import { sameValue, useSettings } from '../useSettings'

export function IdentitySection(): React.JSX.Element {
  const { settings, defaults, patch } = useSettings()
  const meta = settings.workspace
  const base = defaults.workspace
  const docs = useStore(useShallow((s) => s.docs))

  // A datalist rather than a picker: the tree can hold thousands of files, and
  // typing three characters beats scrolling all of them.
  const markdownDocs = useMemo(
    () => docs.filter((d) => /\.mdx?$/i.test(d.path)).map((d) => d.path),
    [docs],
  )

  return (
    <>
      <FieldGroup title="Identity">
        <Field
          name="Name"
          hint="Shown in the window title and on the dashboard. Falls back to the folder name."
          changed={meta.name !== base.name}
          onReset={() => patch({ workspace: { name: base.name } })}
        >
          <TextInput
            value={meta.name}
            placeholder="Workspace"
            onCommit={(name) => patch({ workspace: { name } })}
          />
        </Field>

        <Field
          name="Mission"
          hint="One or two sentences on what you are doing here. The Today widget shows it."
          stacked
          changed={meta.mission !== base.mission}
          onReset={() => patch({ workspace: { mission: base.mission } })}
        >
          <TextInput
            value={meta.mission ?? ''}
            multiline
            placeholder="Learn enough C# to ship the thing."
            onCommit={(v) => patch({ workspace: { mission: v.trim() === '' ? null : v } })}
          />
        </Field>

        <Field
          name="Goal"
          hint="The single long-range target. Deliberately one, not a list."
          stacked
          changed={meta.goal !== base.goal}
          onReset={() => patch({ workspace: { goal: base.goal } })}
        >
          <TextInput
            value={meta.goal ?? ''}
            multiline
            placeholder="A playable prototype by the end of the year."
            onCommit={(v) => patch({ workspace: { goal: v.trim() === '' ? null : v } })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Quote">
        <Field
          name="Text"
          hint="Optional. Shown on the dashboard. Leave blank for none."
          stacked
          changed={!sameValue(meta.quote, base.quote)}
          onReset={() => patch({ workspace: { quote: base.quote } })}
        >
          <TextInput
            value={meta.quote?.text ?? ''}
            multiline
            onCommit={(text) =>
              patch({
                workspace: {
                  quote: text.trim() === '' ? null : { text, source: meta.quote?.source },
                },
              })
            }
          />
        </Field>

        <Field name="Source" hint="Who said it.">
          <TextInput
            value={meta.quote?.source ?? ''}
            disabled={!meta.quote}
            placeholder={meta.quote ? 'Attribution' : 'Add a quote first'}
            onCommit={(source) => {
              if (!meta.quote) return
              patch({
                workspace: {
                  quote: { text: meta.quote.text, ...(source.trim() ? { source } : {}) },
                },
              })
            }}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Opening">
        <Field
          name="Startup page"
          hint="Launch deliberately does not drop you into a document unless you ask it to."
        >
          <Segmented
            value={meta.startupPage}
            options={[
              { value: 'home', label: 'Dashboard' },
              { value: 'resume', label: 'Last session' },
              { value: 'document', label: 'Entry document' },
            ]}
            onChange={(startupPage) => patch({ workspace: { startupPage } })}
          />
        </Field>

        <Field
          name="Entry document"
          hint="Opened by Begin when there is no prior session. A workspace-relative path."
          changed={meta.entryDocument !== base.entryDocument}
          onReset={() => patch({ workspace: { entryDocument: base.entryDocument } })}
        >
          <>
            <TextInput
              value={meta.entryDocument ?? ''}
              mono
              list="kt-entry-docs"
              placeholder="README.md"
              onCommit={(v) =>
                patch({ workspace: { entryDocument: v.trim() === '' ? null : v.trim() } })
              }
            />
            <datalist id="kt-entry-docs">
              {markdownDocs.map((path) => (
                <option key={path} value={path} />
              ))}
            </datalist>
          </>
        </Field>
      </FieldGroup>
    </>
  )
}
