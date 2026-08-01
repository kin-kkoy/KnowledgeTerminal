import type { KtBridge } from '@shared/ipc-contract'

declare global {
  interface Window {
    /** Exposed by the preload via contextBridge. See src/preload/index.ts. */
    readonly kt: KtBridge
  }
}

export {}
