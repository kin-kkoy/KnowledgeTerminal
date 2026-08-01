/**
 * THE FILE A TAURI PORT CHANGES.
 *
 * Everything else in the renderer imports `platform` from here and never learns
 * which shell it is running in. Swapping hosts means adding `./tauri.ts` that
 * implements `Platform` (see `@shared/platform`) and changing the export below.
 */
import type { Platform } from '@shared/platform'
import { electronPlatform } from './electron'

export const platform: Platform = electronPlatform

export type { Platform }
