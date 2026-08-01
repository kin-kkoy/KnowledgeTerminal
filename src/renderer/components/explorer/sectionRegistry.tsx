/**
 * The core explorer sections, as descriptors.
 *
 * Same reasoning as `context/widgetRegistry.tsx`: the panel renders whatever
 * `layout.explorerSections` names, and the Sandbox has to offer the ones you
 * have not added. Both read this.
 */
import type { IconName } from '../../icons/registry'
import { BookmarksView } from './BookmarksView'
import { FavoritesView } from './FavoritesView'
import { FileTree } from './FileTree'
import { RecentsView } from './RecentsView'
import { SearchView } from './SearchView'

export interface SectionDescriptor {
  title: string
  description: string
  icon: IconName
  render(): React.JSX.Element
}

export const CORE_SECTIONS: Record<string, SectionDescriptor> = {
  tree: {
    title: 'Files',
    description: 'The workspace tree, filtered by files.treeFilter.',
    icon: 'folder',
    render: () => <FileTree />,
  },
  search: {
    title: 'Search',
    description: 'Full-text search across everything indexed.',
    icon: 'search',
    render: () => <SearchView />,
  },
  favorites: {
    title: 'Favorites',
    description: 'The pinned document list from settings.favorites.',
    icon: 'star',
    render: () => <FavoritesView />,
  },
  recents: {
    title: 'Recent',
    description: 'Documents opened lately, newest first.',
    icon: 'clock',
    render: () => <RecentsView />,
  },
  bookmarks: {
    title: 'Bookmarks',
    description: 'Positions saved inside documents.',
    icon: 'bookmark',
    render: () => <BookmarksView />,
  },
}
