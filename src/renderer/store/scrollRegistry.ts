/**
 * Scroll anchors, deliberately OUTSIDE React.
 *
 * A scroll listener that writes to the store would re-render on every frame of
 * every scroll — in a six-hour reading session that is the difference between
 * smooth and janky. So positions live in a plain module-level Map, and the only
 * thing that ever reads it is the session serialiser.
 */
import { EMPTY_SCROLL_ANCHOR, type ScrollAnchor } from '@shared/session-schema'

const anchors = new Map<string, ScrollAnchor>()

export function setAnchor(tabId: string, anchor: ScrollAnchor): void {
  anchors.set(tabId, anchor)
}

export function getAnchor(tabId: string): ScrollAnchor {
  return anchors.get(tabId) ?? EMPTY_SCROLL_ANCHOR
}

export function hasAnchor(tabId: string): boolean {
  return anchors.has(tabId)
}

export function dropAnchor(tabId: string): void {
  anchors.delete(tabId)
}

/** Seed from a restored session, before the first document mounts. */
export function hydrateAnchors(entries: ReadonlyArray<readonly [string, ScrollAnchor]>): void {
  anchors.clear()
  for (const [id, anchor] of entries) anchors.set(id, anchor)
}

export function allAnchors(): Map<string, ScrollAnchor> {
  return anchors
}
