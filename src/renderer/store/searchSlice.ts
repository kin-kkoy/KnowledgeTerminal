/**
 * Full-text search state.
 *
 * Queries are debounced here and superseded by `queryId`, so a slow result for
 * an abandoned query can never overwrite a newer one.
 */
import type { SearchHit } from '@shared/types'
import { platform } from '../platform'
import type { SliceCreator } from './types'

const DEBOUNCE_MS = 120

export interface SearchSlice {
  query: string
  hits: SearchHit[]
  searching: boolean
  truncated: boolean
  total: number

  setQuery(query: string): void
  runSearch(query: string): Promise<void>
  clearSearch(): void
}

let timer: ReturnType<typeof setTimeout> | null = null
let latestQueryId = 0

export const createSearchSlice: SliceCreator<SearchSlice> = (set, get) => ({
  query: '',
  hits: [],
  searching: false,
  truncated: false,
  total: 0,

  setQuery(query) {
    set({ query })
    if (timer) clearTimeout(timer)
    if (!query.trim()) {
      get().clearSearch()
      return
    }
    timer = setTimeout(() => void get().runSearch(query), DEBOUNCE_MS)
  },

  async runSearch(query) {
    const id = get().workspace?.id
    if (!id || !query.trim()) return

    const queryId = String(++latestQueryId)
    set({ searching: true })
    try {
      const result = await platform.search(id, query, { queryId })
      // A result for a superseded query is discarded rather than rendered.
      if (result.queryId !== String(latestQueryId)) return
      set({ hits: result.hits, total: result.total, truncated: result.truncated, searching: false })
    } catch (err) {
      set({ searching: false })
      get().pushNotice({ level: 'error', message: 'Search failed', detail: String(err) })
    }
  },

  clearSearch() {
    if (timer) clearTimeout(timer)
    latestQueryId++
    set({ query: '', hits: [], searching: false, truncated: false, total: 0 })
  },
})
