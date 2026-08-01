/**
 * The pinned document list.
 *
 * Same array the star button in the tree writes to, so anything pinned while
 * reading shows up here and vice versa. The label is optional in the schema; a
 * blank one falls back to the filename.
 */
import { ChevronDown, ChevronUp, Star, X } from 'lucide-react'
import { stem } from '@shared/paths'
import { useShallow, useStore } from '../../../store'
import { FieldGroup } from '../../primitives/Field'
import { TextInput } from '../controls'
import { useSettings } from '../useSettings'
import styles from './FavoritesSection.module.css'

export function FavoritesSection(): React.JSX.Element {
  const { settings, patch } = useSettings()
  const favorites = settings.favorites
  const docs = useStore(useShallow((s) => s.docs))

  const unpinned = docs.filter((d) => !favorites.some((f) => f.path === d.path))

  const move = (index: number, delta: number): void => {
    const next = [...favorites]
    const a = next[index]
    const b = next[index + delta]
    if (!a || !b) return
    next[index] = b
    next[index + delta] = a
    patch({ favorites: next })
  }

  return (
    <FieldGroup title="Favorites">
      <p className={styles.note}>
        The same list the star in the file tree writes to. Order here is the order they appear in
        the explorer.
      </p>

      {favorites.length === 0 ? (
        <p className={styles.empty}>Nothing pinned yet.</p>
      ) : (
        <ul className={styles.list}>
          {favorites.map((favorite, index) => (
            <li key={favorite.path} className={styles.item}>
              <Star size={14} strokeWidth={1.8} className={styles.star} />
              <div className={styles.fields}>
                <TextInput
                  value={favorite.label ?? ''}
                  placeholder={stem(favorite.path)}
                  onCommit={(label) => {
                    const next = [...favorites]
                    next[index] = { path: favorite.path, ...(label.trim() ? { label } : {}) }
                    patch({ favorites: next })
                  }}
                />
                <span className={styles.path}>{favorite.path}</span>
              </div>
              <div className={styles.itemActions}>
                <button
                  type="button"
                  className={styles.mini}
                  disabled={index === 0}
                  title="Move up"
                  aria-label={`Move ${favorite.path} up`}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp size={13} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={styles.mini}
                  disabled={index === favorites.length - 1}
                  title="Move down"
                  aria-label={`Move ${favorite.path} down`}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown size={13} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={styles.mini}
                  title="Unpin"
                  aria-label={`Unpin ${favorite.path}`}
                  onClick={() => patch({ favorites: favorites.filter((_, i) => i !== index) })}
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <select
        className={styles.select}
        value=""
        onChange={(e) => {
          const path = e.target.value
          if (!path) return
          patch({ favorites: [...favorites, { path, label: stem(path) }] })
        }}
      >
        <option value="">Pin a document…</option>
        {unpinned.map((d) => (
          <option key={d.path} value={d.path}>
            {d.path}
          </option>
        ))}
      </select>
    </FieldGroup>
  )
}
