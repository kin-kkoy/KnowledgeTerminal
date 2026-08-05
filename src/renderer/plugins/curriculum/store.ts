/**
 * The curriculum plugin's own little store.
 *
 * Kept out of the app store on purpose: the core must not grow a `curriculum`
 * slice, or the separation the plugin exists to demonstrate is fiction.
 */
import { useSyncExternalStore } from 'react'
import type { RelPath } from '@shared/types'
import type { Curriculum, DayBlock, Milestone, Progress } from './model'
import { EMPTY_PROGRESS } from './model'

interface State {
  curriculum: Curriculum | null
  progress: Progress
  /** Derived from the current module's document, not stored. */
  days: DayBlock[]
  /** Derived from the roadmap document, not stored. Empty when unconfigured. */
  milestones: Milestone[]
  /** Where those milestones were read from, so a tick can be written back. */
  roadmapPath: RelPath | null
  error: string | null
}

const EMPTY: State = {
  curriculum: null,
  progress: EMPTY_PROGRESS,
  days: [],
  milestones: [],
  roadmapPath: null,
  error: null,
}

let state: State = EMPTY
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function setCurriculum(curriculum: Curriculum | null, error: string | null = null): void {
  state = { ...state, curriculum, error }
  emit()
}

export function setDays(days: DayBlock[]): void {
  state = { ...state, days }
  emit()
}

export function setProgress(progress: Progress): void {
  state = { ...state, progress }
  emit()
}

export function setMilestones(milestones: Milestone[], roadmapPath: RelPath | null): void {
  state = { ...state, milestones, roadmapPath }
  emit()
}

export function getState(): State {
  return state
}

export function reset(): void {
  state = EMPTY
  emit()
}

/**
 * Anything outside this plugin that needs to know its state moved.
 *
 * The plugin's own widgets use `useCurriculum`; CORE surfaces cannot, because
 * they must not import a plugin. So `activate` hooks this up to
 * `ctx.app.refreshContributions()` instead — core hears "something changed"
 * without hearing what.
 */
export function subscribeExternal(listener: () => void): () => void {
  return subscribe(listener)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useCurriculum(): State {
  return useSyncExternalStore(subscribe, getState, getState)
}

/** Set by `activate` so widgets can persist without holding the context. */
let persist: ((progress: Progress) => Promise<void>) | null = null

export function setPersister(fn: ((progress: Progress) => Promise<void>) | null): void {
  persist = fn
}

export async function updateProgress(next: Progress): Promise<void> {
  setProgress(next)
  await persist?.(next)
}
