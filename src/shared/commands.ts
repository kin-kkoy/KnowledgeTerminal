/**
 * The canonical command list and the default keymap.
 *
 * Workspace `settings.json` keybindings are applied ADDITIVELY over this table
 * (VSCode's mental model): a matching `key` replaces the default, and
 * `{ "key": "...", "command": null }` unbinds it.
 */

/**
 * `when` is a small CLOSED enum, not an expression language. Resist growing it
 * — it is evaluated by a ~20 line function in the renderer.
 */
export const WHEN_CLAUSES = [
  'always',
  'workspace',
  'documentFocus',
  'explorerFocus',
  'overlayOpen',
] as const

export type WhenClause = (typeof WHEN_CLAUSES)[number]

export interface CommandDescriptor {
  id: string
  title: string
  category: string
  when?: WhenClause
}

/**
 * Core commands. Plugins contribute more at runtime through the same registry,
 * which is why a plugin command appears in the palette with no extra work.
 */
export const CORE_COMMANDS: CommandDescriptor[] = [
  // Palettes and search
  { id: 'palette.quickOpen', title: 'Quick Open File…', category: 'Go', when: 'workspace' },
  { id: 'palette.commands', title: 'Show All Commands', category: 'Go' },
  { id: 'search.openGlobal', title: 'Search in Workspace', category: 'Search', when: 'workspace' },
  { id: 'ask.open', title: 'Ask the Workspace…', category: 'Search', when: 'workspace' },
  { id: 'ask.copyContext', title: 'Copy Context for an Assistant', category: 'Search', when: 'workspace' },
  { id: 'overlay.dismiss', title: 'Dismiss Overlay', category: 'View', when: 'overlayOpen' },

  // View
  { id: 'view.toggleExplorer', title: 'Toggle Explorer', category: 'View', when: 'workspace' },
  { id: 'view.toggleContextPanel', title: 'Toggle Context Panel', category: 'View', when: 'workspace' },
  { id: 'view.toggleOutline', title: 'Toggle Outline', category: 'View', when: 'workspace' },
  { id: 'view.focusExplorer', title: 'Focus Explorer', category: 'View', when: 'workspace' },
  { id: 'view.focusDocument', title: 'Focus Document', category: 'View', when: 'workspace' },
  { id: 'view.splitRight', title: 'Split Editor Right', category: 'View', when: 'workspace' },
  { id: 'view.closeSplit', title: 'Close Split', category: 'View', when: 'workspace' },
  { id: 'view.focusOtherPane', title: 'Focus Other Pane', category: 'View', when: 'workspace' },
  { id: 'view.toggleTheme', title: 'Toggle Light/Dark Theme', category: 'View' },
  { id: 'view.zoomIn', title: 'Zoom In', category: 'View' },
  { id: 'view.zoomOut', title: 'Zoom Out', category: 'View' },
  { id: 'view.zoomReset', title: 'Reset Zoom', category: 'View' },

  // Tabs and navigation
  { id: 'tab.close', title: 'Close Tab', category: 'Tab', when: 'workspace' },
  { id: 'tab.closeOthers', title: 'Close Other Tabs', category: 'Tab', when: 'workspace' },
  { id: 'tab.togglePin', title: 'Pin / Unpin Tab', category: 'Tab', when: 'workspace' },
  { id: 'tab.next', title: 'Next Tab', category: 'Tab', when: 'workspace' },
  { id: 'tab.previous', title: 'Previous Tab', category: 'Tab', when: 'workspace' },
  { id: 'nav.back', title: 'Go Back', category: 'Go', when: 'workspace' },
  { id: 'nav.forward', title: 'Go Forward', category: 'Go', when: 'workspace' },

  // Documents
  { id: 'file.open', title: 'Open Document', category: 'File', when: 'workspace' },
  { id: 'file.toggleFavorite', title: 'Add / Remove Favorite', category: 'File', when: 'workspace' },
  { id: 'file.addBookmark', title: 'Bookmark This Position', category: 'File', when: 'documentFocus' },
  { id: 'file.revealInFileManager', title: 'Reveal in File Manager', category: 'File', when: 'workspace' },
  { id: 'file.copyPath', title: 'Copy Workspace Path', category: 'File', when: 'workspace' },

  // Workspace
  { id: 'workspace.open', title: 'Open Workspace…', category: 'Workspace' },
  { id: 'workspace.switch', title: 'Switch Workspace…', category: 'Workspace' },
  { id: 'workspace.goHome', title: 'Go to Home Screen', category: 'Workspace', when: 'workspace' },
  { id: 'lobby.open', title: 'Open the Lobby', category: 'Go', when: 'workspace' },
  /**
   * The Sandbox. Deliberately unbound by default — it is a mode you enter on
   * purpose, not one to land in by mistyping a chord while reading.
   */
  { id: 'workspace.configure', title: 'Configure Workspace (Sandbox)', category: 'Workspace', when: 'workspace' },
  { id: 'workspace.create', title: 'New Workspace…', category: 'Workspace' },
  { id: 'notes.openToday', title: "Open Today's Note", category: 'File', when: 'workspace' },
  { id: 'session.closeOut', title: 'Close Out the Session', category: 'Workspace', when: 'workspace' },
  { id: 'workspace.reindex', title: 'Rebuild Search Index', category: 'Workspace', when: 'workspace' },
  { id: 'workspace.reloadSettings', title: 'Reload Workspace Settings', category: 'Workspace', when: 'workspace' },
]

export interface KeybindingEntry {
  key: string
  /** null unbinds whatever default holds this key. */
  command: string | null
  when?: WhenClause
}

export const DEFAULT_KEYBINDINGS: KeybindingEntry[] = [
  { key: 'ctrl+p', command: 'palette.quickOpen' },
  { key: 'ctrl+shift+p', command: 'palette.commands' },
  { key: 'ctrl+/', command: 'search.openGlobal' },
  // NOT ctrl+k: that is the prefix of the `ctrl+k ctrl+t` theme chord, and a
  // direct binding on a chord prefix makes the chord unreachable.
  { key: 'ctrl+shift+k', command: 'ask.open' },
  { key: 'escape', command: 'overlay.dismiss', when: 'overlayOpen' },

  { key: 'ctrl+b', command: 'view.toggleExplorer' },
  { key: 'ctrl+j', command: 'view.toggleContextPanel' },
  { key: 'ctrl+shift+o', command: 'view.toggleOutline' },
  { key: 'ctrl+shift+e', command: 'view.focusExplorer' },
  { key: 'ctrl+\\', command: 'view.splitRight' },
  { key: 'ctrl+k ctrl+t', command: 'view.toggleTheme' },
  { key: 'ctrl+=', command: 'view.zoomIn' },
  { key: 'ctrl+-', command: 'view.zoomOut' },
  { key: 'ctrl+0', command: 'view.zoomReset' },

  { key: 'ctrl+w', command: 'tab.close', when: 'workspace' },
  { key: 'ctrl+tab', command: 'tab.next', when: 'workspace' },
  { key: 'ctrl+shift+tab', command: 'tab.previous', when: 'workspace' },
  { key: 'alt+left', command: 'nav.back', when: 'workspace' },
  { key: 'alt+right', command: 'nav.forward', when: 'workspace' },

  { key: 'ctrl+d', command: 'file.addBookmark', when: 'documentFocus' },
  { key: 'ctrl+shift+d', command: 'notes.openToday', when: 'workspace' },
  { key: 'ctrl+shift+enter', command: 'session.closeOut', when: 'workspace' },
  { key: 'ctrl+shift+h', command: 'workspace.goHome', when: 'workspace' },
  { key: 'ctrl+shift+l', command: 'lobby.open', when: 'workspace' },
]
