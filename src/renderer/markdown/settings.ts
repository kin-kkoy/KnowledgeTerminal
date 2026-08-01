import type { WorkspaceSettings } from '@shared/config-schema'

export type MarkdownSettings = WorkspaceSettings['markdown']

export const DEFAULT_MARKDOWN_SETTINGS: MarkdownSettings = {
  wikiLinks: true,
  callouts: true,
  mermaid: true,
  footnotes: true,
  tableOfContents: { enabled: true, minHeadings: 3, maxDepth: 3 },
}
