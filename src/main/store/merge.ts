/**
 * Deep merge for config patches.
 *
 * Arrays are REPLACED, not concatenated. If a user removes a favorite or a
 * context widget, a concatenating merge would silently resurrect it — for
 * ordered config lists, replace is the only behaviour that isn't surprising.
 */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (patch === undefined) return base
  if (patch === null) return patch as T
  if (Array.isArray(patch)) return patch as T
  if (typeof patch !== 'object') return patch as T
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return patch as T

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    out[key] = deepMerge((base as Record<string, unknown>)[key], value)
  }
  return out as T
}
