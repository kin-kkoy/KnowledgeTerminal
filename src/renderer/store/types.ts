/**
 * Shared slice typing. Kept apart from `index.ts` so individual slices can
 * import the composed `Store` type without a circular import.
 */
import type { StateCreator } from 'zustand'
import type { AskSlice } from './askSlice'
import type { PluginSlice } from './pluginSlice'
import type { SearchSlice } from './searchSlice'
import type { TabsSlice } from './tabsSlice'
import type { UiSlice } from './uiSlice'
import type { WorkspaceSlice } from './workspaceSlice'

export type Store = WorkspaceSlice & UiSlice & TabsSlice & SearchSlice & AskSlice & PluginSlice

/** Every slice is written against the whole store, so slices can read each other. */
export type SliceCreator<T> = StateCreator<Store, [['zustand/subscribeWithSelector', never]], [], T>
