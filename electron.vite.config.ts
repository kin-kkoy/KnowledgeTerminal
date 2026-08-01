import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@shared': resolve('src/shared'),
  '@main': resolve('src/main'),
  '@renderer': resolve('src/renderer'),
}

export default defineConfig({
  main: {
    // CJS output. chokidar v4 and friends are ESM-only, so Rollup bundles them in
    // rather than us require()-ing ESM at runtime. See plan risk #7.
    plugins: [externalizeDepsPlugin({ exclude: ['chokidar', 'minisearch', 'image-size'] })],
    resolve: { alias },
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // A separate entry: worker_threads loads it by path at runtime.
          'search-worker': resolve('src/main/search/worker.ts'),
        },
        output: { format: 'cjs', entryFileNames: '[name].js' },
      },
    },
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias },
    build: {
      rollupOptions: {
        // sandbox: true means the preload must be a single CJS file with no ESM syntax.
        output: { format: 'cjs', inlineDynamicImports: true, entryFileNames: '[name].js' },
      },
    },
  },

  renderer: {
    root: resolve('src/renderer'),
    resolve: { alias },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
        output: {
          manualChunks(id) {
            // mermaid is ~600KB and dynamically imported; keep it out of the main chunk
            // so first paint never pays for it.
            if (id.includes('node_modules/mermaid')) return 'mermaid'
            if (id.includes('node_modules/shiki') || id.includes('@shikijs')) return 'shiki'
          },
        },
      },
    },
  },
})
