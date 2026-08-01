/**
 * `[[Target]]`, `[[Target#Heading]]`, `[[Target|Alias]]`.
 *
 * Resolution happens here, at parse time, against the workspace file list —
 * which is why this is ~60 lines of ours rather than a dependency: the
 * published plugins cannot consult the file index, and their matching rules do
 * not agree with what a reader expects from `[[cp1]]`.
 *
 * Unresolved links are marked rather than dropped. A link that quietly renders
 * as plain text is a link you never find out is broken.
 */
import { findAndReplace } from 'mdast-util-find-and-replace'
import type { Link, Root } from 'mdast'
import type { Plugin } from 'unified'
import type { VFile } from 'vfile'
import { stem } from '@shared/paths'
import { contextOf } from './context'
import { resolveWikiLink, splitTarget } from './resolve'

// [[target]] | [[target#heading]] | [[target|alias]] | [[target#heading|alias]]
const WIKILINK = /\[\[([^\][|#]+)(#[^\][|]+)?(\|[^\][]+)?\]\]/g

export const remarkWikiLink: Plugin<[], Root> = () => {
  return (tree: Root, file: VFile) => {
    const { docPath, docs, markdown } = contextOf(file.data)
    if (!markdown.wikiLinks) return

    findAndReplace(tree, [
      [
        WIKILINK,
        (_full: string, rawTarget: string, rawHeading?: string, rawAlias?: string) => {
          const { target } = splitTarget(rawTarget)
          const heading = rawHeading ? rawHeading.slice(1).trim() : null
          const alias = rawAlias ? rawAlias.slice(1).trim() : null

          const resolved = resolveWikiLink(target, docPath, docs)
          const label = alias ?? (heading && !alias ? `${stem(target)} § ${heading}` : stem(target))

          const node: Link = {
            type: 'link',
            url: resolved ? `kt-doc:${resolved}${heading ? `#${heading}` : ''}` : '#',
            children: [{ type: 'text', value: label }],
            data: {
              hProperties: {
                'data-kt-link': 'wiki',
                'data-kt-target': resolved ?? target,
                'data-kt-heading': heading ?? undefined,
                'data-kt-unresolved': resolved ? undefined : 'true',
                title: resolved ?? `Unresolved: ${target}`,
              },
            },
          }
          return node
        },
      ],
    ])
  }
}
