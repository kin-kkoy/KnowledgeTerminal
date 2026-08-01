/**
 * Renderer entry.
 *
 * Fonts are imported here, bundled locally — no network fetch, no FOUT, works
 * offline. Everything else is deferred so the first frame is cheap.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'

import './styles/tokens.css'
import './styles/themes.css'
import './styles/base.css'
import './styles/prose.css'

import { App } from './App'
import { ErrorBoundary } from './components/primitives/ErrorBoundary'

// We restore scroll ourselves, per pane. Leaving this on 'auto' would let the
// browser take a guess first and fight the settle loop.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

const container = document.getElementById('root')
if (!container) throw new Error('#root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary label="Knowledge Terminal">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
