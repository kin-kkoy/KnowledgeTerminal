/**
 * State for the Ask overlay.
 *
 * Unlike `searchSlice`, this does NOT run on every keystroke. Searching is a
 * live filter and should feel like one; asking is a question you finish typing
 * before you expect a reply. Debouncing an answer would mean routing partial
 * questions — "have I lear" classifies as recall, "have I learned X" as lookup
 * — and burning layer-4 requests on prefixes.
 */
import type { Answer, AnswerLayer, QueryContext } from '@shared/answers'
import { route } from '../answers/router'
import type { SliceCreator } from './types'

export interface AskSlice {
  askQuery: string
  askAnswer: Answer | null
  askContext: QueryContext | null
  askTried: AnswerLayer[]
  asking: boolean

  setAskQuery(query: string): void
  runAsk(query: string): Promise<void>
  clearAsk(): void
}

export const createAskSlice: SliceCreator<AskSlice> = (set, get) => {
  /** Monotonic, so a slow layer-4 answer cannot overwrite a newer question. */
  let latest = 0

  return {
    askQuery: '',
    askAnswer: null,
    askContext: null,
    askTried: [],
    asking: false,
    setAskQuery: (askQuery) => set({ askQuery }),

    async runAsk(query) {
      const trimmed = query.trim()
      if (!trimmed) {
        get().clearAsk()
        return
      }

      const id = ++latest
      set({ askQuery: query, asking: true, askAnswer: null, askTried: [] })

      const result = await route(trimmed)
      if (id !== latest) return

      set({
        asking: false,
        askAnswer: result.answer,
        askContext: result.context,
        askTried: result.tried,
      })
    },

    clearAsk() {
      latest++
      set({
        askQuery: '',
        askAnswer: null,
        askContext: null,
        askTried: [],
        asking: false,
      })
    },
  }
}
