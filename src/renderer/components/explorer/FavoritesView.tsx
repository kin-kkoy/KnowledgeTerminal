/**
 * Favorites come from the workspace's settings.json, so they travel with the
 * folder — unlike recents and bookmarks, which are machine-local session state.
 */
import { dirnameRel, stem } from '@shared/paths'
import { useStore, useShallow } from '../../store'
import { EntryList, type Entry } from './EntryList'

export function FavoritesView(): React.JSX.Element {
  const favorites = useStore(useShallow((s) => s.settings?.favorites ?? []))
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  const entries: Entry[] = favorites.map((f) => ({
    key: f.path,
    path: f.path,
    label: f.label ?? stem(f.path),
    meta: dirnameRel(f.path) || 'workspace root',
  }))

  return (
    <EntryList
      entries={entries}
      icon="star"
      emptyMessage="No favorites yet. Add one from the command palette, or list them under `favorites` in .kt/settings.json."
      onRemove={(entry) => void toggleFavorite(entry.path)}
    />
  )
}
