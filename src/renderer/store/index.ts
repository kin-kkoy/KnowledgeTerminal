/**
 * The store.
 *
 * zustand, not Context and not Redux:
 *  - Context has no selector granularity, so a search result or a tab switch
 *    would re-render the tree, the tab strip and every context widget. Avoiding
 *    that by hand means a dozen contexts and memo wrappers — a worse store.
 *  - Redux's action/reducer ceremony would roughly double this directory for no
 *    capability we need here.
 *  - zustand also gives a VANILLA store usable outside React, which the
 *    keybinding handler, the command palette and the plugin API all depend on.
 */
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { createAskSlice } from './askSlice'
import { createPluginSlice } from './pluginSlice'
import { createSearchSlice } from './searchSlice'
import { createTabsSlice } from './tabsSlice'
import { createUiSlice } from './uiSlice'
import { createWorkspaceSlice } from './workspaceSlice'
import type { Store } from './types'

export const useStore = create<Store>()(
  subscribeWithSelector((...a) => ({
    ...createWorkspaceSlice(...a),
    ...createUiSlice(...a),
    ...createTabsSlice(...a),
    ...createSearchSlice(...a),
    ...createAskSlice(...a),
    ...createPluginSlice(...a),
  })),
)

/**
 * Non-hook access, for code that runs outside React: keybinding handlers,
 * command implementations, the plugin context, and the session serialiser.
 */
export const store = {
  get: useStore.getState,
  set: useStore.setState,
  subscribe: useStore.subscribe,
}

export { useShallow }
export type { Store }
