/**
 * Which Markdown extensions are on.
 *
 * These are pipeline switches, not appearance — turning wiki-links off means
 * `[[Something]]` renders as literal brackets, which is a content-level change
 * and worth being explicit about.
 */
import { Field, FieldGroup } from '../../primitives/Field'
import { NumberInput, Toggle } from '../controls'
import { useSettings } from '../useSettings'

export function MarkdownSection(): React.JSX.Element {
  const { settings, defaults, patch } = useSettings()
  const md = settings.markdown
  const base = defaults.markdown
  const toc = md.tableOfContents

  return (
    <>
      <FieldGroup title="Syntax">
        <Field
          name="Wiki links"
          hint="Resolves [[Document Name]] against everything indexed. Off renders the brackets literally."
        >
          <Toggle
            label="Wiki links"
            checked={md.wikiLinks}
            onChange={(wikiLinks) => patch({ markdown: { wikiLinks } })}
          />
        </Field>

        <Field
          name="Callouts"
          hint="Obsidian-style > [!note] blocks. Off leaves them as ordinary blockquotes."
        >
          <Toggle
            label="Callouts"
            checked={md.callouts}
            onChange={(callouts) => patch({ markdown: { callouts } })}
          />
        </Field>

        <Field name="Mermaid" hint="Renders ```mermaid fences as diagrams.">
          <Toggle
            label="Mermaid"
            checked={md.mermaid}
            onChange={(mermaid) => patch({ markdown: { mermaid } })}
          />
        </Field>

        <Field name="Footnotes" hint="[^1] references, collected at the end of the document.">
          <Toggle
            label="Footnotes"
            checked={md.footnotes}
            onChange={(footnotes) => patch({ markdown: { footnotes } })}
          />
        </Field>
      </FieldGroup>

      <FieldGroup title="Table of contents">
        <Field
          name="Show a table of contents"
          hint="Built from the headings in the open document."
        >
          <Toggle
            label="Table of contents"
            checked={toc.enabled}
            onChange={(enabled) => patch({ markdown: { tableOfContents: { enabled } } })}
          />
        </Field>

        <Field
          name="Minimum headings"
          hint="Below this, a document is short enough to read without one."
          changed={toc.minHeadings !== base.tableOfContents.minHeadings}
          onReset={() =>
            patch({
              markdown: { tableOfContents: { minHeadings: base.tableOfContents.minHeadings } },
            })
          }
        >
          <NumberInput
            value={toc.minHeadings}
            min={0}
            max={20}
            onCommit={(minHeadings) => patch({ markdown: { tableOfContents: { minHeadings } } })}
          />
        </Field>

        <Field
          name="Maximum depth"
          hint="How many heading levels to include."
          changed={toc.maxDepth !== base.tableOfContents.maxDepth}
          onReset={() =>
            patch({ markdown: { tableOfContents: { maxDepth: base.tableOfContents.maxDepth } } })
          }
        >
          <NumberInput
            value={toc.maxDepth}
            min={1}
            max={6}
            onCommit={(maxDepth) => patch({ markdown: { tableOfContents: { maxDepth } } })}
          />
        </Field>
      </FieldGroup>
    </>
  )
}
