import { relativeTime } from '@shared/paths'
import { useStore, useShallow } from '../../store'
import { EntryList, type Entry } from './EntryList'

export function RecentsView(): React.JSX.Element {
  const recents = useStore(useShallow((s) => s.recents))

  const entries: Entry[] = recents.map((r) => ({
    key: r.path,
    path: r.path,
    label: r.title,
    meta: relativeTime(r.openedAt),
  }))

  return (
    <EntryList
      entries={entries}
      icon="clock"
      emptyMessage="Nothing opened yet this session."
    />
  )
}
