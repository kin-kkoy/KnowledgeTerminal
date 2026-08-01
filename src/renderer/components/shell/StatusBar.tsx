/**
 * The bottom strip: active path, index progress, and any notices.
 *
 * Config and content problems surface HERE and nowhere else. A modal dialog for
 * "your settings.json has a typo" would interrupt reading to report something
 * the app already recovered from.
 */
import { useStore, useShallow } from '../../store'
import { Icon } from '../primitives/Icon'
import styles from './StatusBar.module.css'

export function StatusBar(): React.JSX.Element {
  const rawPath = useStore((s) => s.activeTab()?.path ?? null)
  // Surfaces get a name; only real documents get a path.
  const activePath = rawPath?.startsWith('kt://') ? 'Lobby' : rawPath
  const indexStatus = useStore((s) => s.indexStatus)
  const notices = useStore(useShallow((s) => s.notices))
  const dismissNotice = useStore((s) => s.dismissNotice)
  const statusItems = useStore(useShallow((s) => Object.values(s.statusItems)))

  const latest = notices[notices.length - 1]

  return (
    <footer className={styles.statusbar}>
      <span className={styles.path} title={activePath ?? undefined}>
        {activePath ?? 'No document open'}
      </span>

      {statusItems
        .filter((i) => i.align === 'left')
        .map((item) => (
          <item.component key={item.id} />
        ))}

      <span className={styles.spacer} />

      {latest && (
        <button
          type="button"
          className={`${styles.notice} ${styles[latest.level]}`}
          onClick={() => dismissNotice(latest.id)}
          title={latest.detail ?? 'Dismiss'}
        >
          {latest.message}
          <Icon name="close" size={11} />
        </button>
      )}

      {statusItems
        .filter((i) => i.align === 'right')
        .map((item) => (
          <item.component key={item.id} />
        ))}

      {indexStatus && indexStatus.phase !== 'ready' && (
        <span className={styles.index}>
          {indexStatus.phase === 'crawling'
            ? `Indexing ${indexStatus.indexed}/${indexStatus.total}`
            : indexStatus.phase}
        </span>
      )}
    </footer>
  )
}
