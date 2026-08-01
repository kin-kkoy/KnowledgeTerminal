/**
 * A thin wrapper over lucide-react so every icon in the app shares a size and
 * stroke weight. Icons are meaningful here, not decorative — they carry the
 * scanning weight in the tree and the tab strip.
 *
 * The set itself lives in `icons/registry.ts`, which is also what the tree
 * resolves against and what the Sandbox's picker enumerates. One set, one
 * source.
 */
import { ICON_SET, type IconName } from '../../icons/registry'

export type { IconName }

interface Props {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 14, className }: Props): React.JSX.Element {
  const Component = ICON_SET[name]
  return (
    <Component
      size={size}
      strokeWidth={1.75}
      className={className}
      aria-hidden="true"
      focusable="false"
    />
  )
}
