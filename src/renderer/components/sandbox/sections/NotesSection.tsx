/**
 * Daily notes and the close-out gate.
 *
 * `notes.root` may point OUTSIDE the workspace — at another app's vault — which
 * is why the platform's `listNotes` is the one read allowed to leave the
 * workspace and has no write counterpart. The filename preview below is the
 * honest way to explain a template without a manual.
 */
import { Field, FieldGroup } from '../../primitives/Field'
import { StringList, TextInput, Toggle } from '../controls'
import { sameValue, useSettings } from '../useSettings'
import styles from './NotesSection.module.css'

/** Mirrors the substitutions the daily-note action performs. */
function renderTemplate(template: string): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  return template
    .replaceAll('{{date}}', date)
    .replaceAll('{{module}}', 'Current Topic')
    .replaceAll('{{day}}', '12')
}

export function NotesSection(): React.JSX.Element {
  const { settings, defaults, patch } = useSettings()
  const notes = settings.notes
  const gate = settings.gate
  const base = defaults

  return (
    <>
      <FieldGroup title="Daily notes">
        <Field
          name="Notes folder"
          hint="Workspace-relative, or an absolute path to another app's vault. Read-only either way — the app never writes into a folder it does not own."
          changed={notes.root !== base.notes.root}
          onReset={() => patch({ notes: { root: base.notes.root } })}
        >
          <TextInput
            value={notes.root}
            mono
            placeholder="notes/daily"
            onCommit={(root) => patch({ notes: { root } })}
          />
        </Field>

        <Field
          name="Filename template"
          hint="{{date}}, {{module}} and {{day}} are substituted."
          stacked
          changed={notes.filename !== base.notes.filename}
          onReset={() => patch({ notes: { filename: base.notes.filename } })}
        >
          <>
            <TextInput
              value={notes.filename}
              mono
              onCommit={(filename) => patch({ notes: { filename } })}
            />
            <p className={styles.preview}>
              Today that gives <code>{renderTemplate(notes.filename)}.md</code>
            </p>
          </>
        </Field>

        <Field
          name="Prompts"
          hint="Seeded into a new daily note, one per line."
          stacked
          changed={!sameValue(notes.prompts, base.notes.prompts)}
          onReset={() => patch({ notes: { prompts: base.notes.prompts } })}
        >
          <StringList
            values={notes.prompts}
            placeholder="What did I actually learn?"
            onChange={(prompts) => patch({ notes: { prompts } })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Close-out gate">
        <Field
          name="Ask before closing"
          hint="A prompt on the way out. Off means the session just ends."
        >
          <Toggle
            label="Close-out gate"
            checked={gate.enabled}
            onChange={(enabled) => patch({ gate: { enabled } })}
          />
        </Field>

        <Field
          name="Title"
          changed={gate.title !== base.gate.title}
          onReset={() => patch({ gate: { title: base.gate.title } })}
        >
          <TextInput
            value={gate.title}
            disabled={!gate.enabled}
            onCommit={(title) => patch({ gate: { title } })}
          />
        </Field>

        <Field
          name="Body"
          stacked
          changed={gate.body !== base.gate.body}
          onReset={() => patch({ gate: { body: base.gate.body } })}
        >
          <TextInput
            value={gate.body}
            multiline
            disabled={!gate.enabled}
            onCommit={(body) => patch({ gate: { body } })}
          />
        </Field>
      </FieldGroup>
    </>
  )
}
