import { stem } from '@shared/paths'
import { useStore, useShallow } from '../../store'
import { EntryList, type Entry } from './EntryList'

export function BookmarksView(): React.JSX.Element {
  const bookmarks = useStore(useShallow((s) => s.bookmarks))
  const removeBookmark = useStore((s) => s.removeBookmark)

  const entries: Entry[] = bookmarks.map((b) => ({
    key: b.id,
    path: b.path,
    label: b.label || stem(b.path),
    // The heading is the useful thing to show: a bookmark's whole point is that
    // it points inside a document, not at it.
    meta: b.note || b.headingSlug || stem(b.path),
    headingSlug: b.headingSlug,
  }))

  return (
    <EntryList
      entries={entries}
      icon="bookmark"
      emptyMessage="No bookmarks. Press Ctrl+D while reading to mark your place."
      onRemove={(entry) => removeBookmark(entry.key)}
    />
  )
}
