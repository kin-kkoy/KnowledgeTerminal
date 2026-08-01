/**
 * THE ONLY MODULE IN THE APPLICATION THAT IMPORTS A PLUGIN.
 *
 * Keeping that true is what makes the seam real rather than decorative: if a
 * second file ever imports a plugin directly, the core has started depending on
 * it and the boundary is gone.
 *
 * Adding a plugin is one line here plus a `plugins.<id>` entry in the
 * workspace's settings.json.
 */
import type { KTPlugin } from './api'
import { curriculumPlugin } from './curriculum'

export const BUILTIN_PLUGINS: KTPlugin[] = [curriculumPlugin]
