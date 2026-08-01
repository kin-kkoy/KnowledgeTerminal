/**
 * Exact scroll restoration.
 *
 * Writing `el.scrollTop = saved` on mount fails three separate ways. Each one
 * needs its own countermeasure, and getting any of them wrong produces a
 * different flavour of "it almost works":
 *
 * (a) THE CONTAINER IS NOT TALL ENOUGH YET.
 *     The browser silently clamps scrollTop to `scrollHeight - clientHeight`.
 *     Assign 3184 into a container that is currently 900px tall and you land at
 *     the bottom — then content arrives underneath and you are nowhere.
 *     → We persist `lastHeight` and apply it as `min-height` BEFORE the first
 *       paint, so the assignment never clamps.
 *
 * (b) ASYNC CONTENT SHIFTS LAYOUT AFTER MOUNT.
 *     Removed at the source rather than compensated for: Shiki highlights
 *     inside the pipeline (nothing re-highlights), images carry intrinsic
 *     width/height (the box is reserved on frame one). Mermaid is the one
 *     exception — it must measure text to lay out — so it is bounded by a
 *     remembered height and mopped up by the settle loop below.
 *
 * (c) THE TARGET LINE IS NOT AT A FIXED PIXEL OFFSET.
 *     If the file changed between sessions, pixels are meaningless.
 *     → Anchors, not pixels: block id → heading slug → ratio → raw top.
 *
 * And one rule above all of them: THE USER ALWAYS WINS. Any scroll, wheel or
 * key input aborts restoration immediately. Fighting someone who has started
 * reading is worse than losing the position.
 */
import { useCallback, useEffect, useRef } from 'react'
import { EMPTY_SCROLL_ANCHOR, type ScrollAnchor } from '@shared/session-schema'
import { getAnchor, setAnchor } from '../store/scrollRegistry'
import { scheduleSessionWrite } from '../store/sessionSync'

/** Stop re-applying once the height has been stable this long. */
const SETTLE_QUIET_MS = 250
/** Absolute cap, so a pathological document cannot hold the loop open. */
const SETTLE_MAX_MS = 1500
/** How long the reader must pause before we record a new position. */
const SAVE_QUIET_MS = 150

interface Options {
  tabId: string
  /** Changes when the document's content changes; guards the block anchor. */
  contentHash: string | null
  /** True once the document is fully rendered and committed. */
  ready: boolean
}

interface Result {
  scrollRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
  /** Applied to the content wrapper to reserve height before restore. */
  reservedHeight: number | undefined
}

/**
 * The block element currently at the top of the viewport, and by how much.
 *
 * Two elements, not one, and the distinction matters: `viewport` is the fixed
 * scroll container, `content` is the thing that moves inside it. Measuring
 * against `content` would give a top that is already scrolled away, so the
 * answer would always be the first block in the document.
 */
function blockAtTop(
  viewport: HTMLElement,
  content: HTMLElement,
): { id: string | null; offset: number; slug: string | null } {
  const containerTop = viewport.getBoundingClientRect().top
  const blocks = content.querySelectorAll<HTMLElement>('[data-kt-block]')

  let chosen: HTMLElement | null = null
  for (const block of blocks) {
    // The first block whose bottom is still below the viewport top is the one
    // the reader is looking at — even if it started above the fold.
    if (block.getBoundingClientRect().bottom > containerTop + 4) {
      chosen = block
      break
    }
  }
  if (!chosen) return { id: null, offset: 0, slug: null }

  const offset = containerTop - chosen.getBoundingClientRect().top

  // Nearest preceding heading, so the anchor survives edits above it.
  let slug: string | null = null
  const headings = content.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id]')
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top <= containerTop + 4) slug = heading.id
    else break
  }

  return { id: chosen.dataset['ktBlock'] ?? null, offset, slug }
}

/** Where should we scroll to, given a saved anchor? Most reliable source first. */
function resolveTarget(
  container: HTMLElement,
  content: HTMLElement,
  anchor: ScrollAnchor,
  contentHash: string | null,
): number | null {
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)

  /**
   * Distance from the viewport top to an element, in scroll units.
   *
   * Computed from bounding rects rather than `offsetTop`, which is relative to
   * the nearest POSITIONED ancestor. Neither the content wrapper nor the prose
   * article is positioned, so `offsetTop` would silently be measured against
   * the page instead of the scroller.
   */
  const scrollOffsetOf = (el: HTMLElement): number =>
    container.scrollTop + (el.getBoundingClientRect().top - container.getBoundingClientRect().top)

  // 1. The exact block — but only if the file has not changed since we saved.
  if (anchor.blockId && anchor.contentHash && anchor.contentHash === contentHash) {
    const el = content.querySelector<HTMLElement>(`[data-kt-block="${anchor.blockId}"]`)
    if (el) return Math.min(maxScroll, Math.max(0, scrollOffsetOf(el) + anchor.blockOffset))
  }

  // 2. The nearest heading. Survives edits above it, which is the common case.
  if (anchor.headingSlug) {
    const el = content.querySelector<HTMLElement>(`#${CSS.escape(anchor.headingSlug)}`)
    if (el) return Math.min(maxScroll, Math.max(0, scrollOffsetOf(el)))
  }

  // 3. Proportional. Survives a rewrite; approximate but never absurd.
  if (anchor.ratio > 0) return Math.min(maxScroll, anchor.ratio * maxScroll)

  // 4. Raw pixels.
  if (anchor.top > 0) return Math.min(maxScroll, anchor.top)

  return null
}

export function useScrollRestore({ tabId, contentHash, ready }: Options): Result {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  /** Suppresses the save listener while we are the ones moving the scroll. */
  const restoring = useRef(false)
  /**
   * StrictMode double-invokes effects in development. Without this guard the
   * restorer runs twice and you chase a phantom double-jump that never happens
   * in a packaged build.
   */
  const restoredKey = useRef<string | null>(null)
  const saveTimer = useRef<number | null>(null)
  const rafPending = useRef(false)

  const anchor = getAnchor(tabId)
  const reservedHeight = anchor.lastHeight > 0 ? anchor.lastHeight : undefined

  // ── save ────────────────────────────────────────────────────────────────
  const record = useCallback(() => {
    const container = scrollRef.current
    const content = contentRef.current
    if (!container || !content) return

    const { id, offset, slug } = blockAtTop(container, content)
    const maxScroll = Math.max(1, container.scrollHeight - container.clientHeight)

    setAnchor(tabId, {
      top: container.scrollTop,
      ratio: Math.min(1, Math.max(0, container.scrollTop / maxScroll)),
      blockId: id,
      blockOffset: offset,
      headingSlug: slug,
      contentHash,
      lastHeight: content.scrollHeight,
    })
    scheduleSessionWrite()
  }, [tabId, contentHash])

  // ── restore ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = scrollRef.current
    const content = contentRef.current
    if (!ready || !container || !content) return

    const key = `${tabId}::${contentHash ?? ''}`
    if (restoredKey.current === key) return
    restoredKey.current = key

    const saved = getAnchor(tabId)
    if (saved === EMPTY_SCROLL_ANCHOR || (!saved.blockId && !saved.headingSlug && !saved.top)) {
      return // Nothing to restore; a fresh document starts at the top.
    }

    restoring.current = true

    const apply = (): void => {
      const target = resolveTarget(container, content, saved, contentHash)
      // scrollTop directly — NOT scrollIntoView, and never smooth behaviour.
      // A smooth restore is an animation the reader did not ask for, and it
      // races the settle loop.
      if (target !== null) container.scrollTop = target
    }

    apply()

    // ── settle loop ───────────────────────────────────────────────────────
    let lastHeight = content.scrollHeight
    let quietTimer = window.setTimeout(finish, SETTLE_QUIET_MS)
    const hardStop = window.setTimeout(finish, SETTLE_MAX_MS)

    const observer = new ResizeObserver(() => {
      if (!restoring.current) return
      if (content.scrollHeight === lastHeight) return
      lastHeight = content.scrollHeight
      apply()
      window.clearTimeout(quietTimer)
      quietTimer = window.setTimeout(finish, SETTLE_QUIET_MS)
    })
    observer.observe(content)

    // The user wins, immediately and unconditionally.
    const abort = (): void => finish()
    container.addEventListener('wheel', abort, { passive: true, once: true })
    container.addEventListener('touchstart', abort, { passive: true, once: true })
    container.addEventListener('keydown', abort, { once: true })

    function finish(): void {
      if (!restoring.current) return
      restoring.current = false
      observer.disconnect()
      window.clearTimeout(quietTimer)
      window.clearTimeout(hardStop)
      container?.removeEventListener('wheel', abort)
      container?.removeEventListener('touchstart', abort)
      container?.removeEventListener('keydown', abort)
    }

    return finish
  }, [ready, tabId, contentHash])

  // The listener below is attached ONCE per mount and reads the latest recorder
  // through this ref. Depending on `record` directly would re-run the effect
  // every time `contentHash` changed — and its cleanup would then call
  // `record()` while the document was still empty and scrolled to zero,
  // clobbering the anchor we had just hydrated from the session. The position
  // was saved correctly and then silently overwritten a frame before it could
  // be used.
  const recordRef = useRef(record)
  recordRef.current = record

  // ── the save listener ───────────────────────────────────────────────────
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const onScroll = (): void => {
      if (restoring.current) return // do not overwrite the anchor we are chasing
      // Throttle to one frame, then debounce the actual write. A scroll handler
      // that touches React state would jank a six-hour reading session; this
      // one only writes to a plain Map.
      if (rafPending.current) return
      rafPending.current = true
      requestAnimationFrame(() => {
        rafPending.current = false
        if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(() => recordRef.current(), SAVE_QUIET_MS)
      })
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current)
      // Capture the final position on unmount — a tab switch must not lose it.
      // Only once the document has actually been restored, though: recording an
      // empty, unscrolled view would overwrite a perfectly good anchor.
      if (!restoring.current && restoredKey.current !== null) recordRef.current()
    }
    // Mount/unmount only. See recordRef above for why.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { scrollRef, contentRef, reservedHeight }
}
