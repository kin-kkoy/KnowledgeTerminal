# Knowledge Terminal

A local-first learning workspace. It reads a folder of Markdown and a
`settings.json`, and it knows nothing about any particular subject.

Point it at a different folder and it is a different study environment — no code
changes, no rebuild. The first workspace here is **Dragon Merchant Guild**
(learning C# by building a merchant guild simulation); the application itself
contains no reference to C#, dragons, or curricula.

```
npm install
npm run dev       # the real app window, with hot reload
npm run build     # typecheck + bundle
npm run package   # AppImage + .deb into release/
```

---

## What it does

**Opening it answers one question: what should I be doing right now?**

Launch shows a Home screen — workspace, current mission, when you were last
here, and `Resume Workspace [Enter]`. Press Enter and you are back exactly where
you were: same tabs, same split, same expanded folders, and the same line of the
same document.

- **Reading** — Markdown with syntax highlighting, Mermaid diagrams, tables,
  callouts, footnotes, images, wiki-links, and a table of contents that follows
  you down the page.
- **Navigation** — folder tree, breadcrumbs, favorites, bookmarks, recents,
  Quick Open, full-text search.
- **Productivity** — command palette, split view, tabs, pinning, multiple
  workspaces, and a keyboard path to essentially everything.
- **Session** — everything above is restored on relaunch.

### Keyboard

| | |
|---|---|
| `Ctrl P` | Quick Open |
| `Ctrl Shift P` | Command palette |
| `Ctrl /` | Search the workspace |
| `Ctrl B` / `Ctrl J` | Toggle explorer / context panel |
| `Ctrl \` | Split right |
| `Alt ←` / `Alt →` | Back / forward |
| `Ctrl W` | Close tab |
| `Ctrl D` | Bookmark this position |
| `Ctrl K Ctrl T` | Toggle theme |

All of it is rebindable — see `keybindings` below.

---

## A workspace

A workspace is just a folder. The only thing that makes it one is `.kt/`:

```
my-workspace/
  .kt/settings.json      the only file the app requires, and it is optional
  anything/              your folders, discovered automatically
  assets/                images
```

To start a new one: copy an existing workspace, delete the Markdown, put your
own in, edit `settings.json`. That is the whole procedure.

### `.kt/settings.json`

Every key is optional; anything missing falls back to a default. If the file
fails to parse, the app loads defaults, **leaves your file untouched**, and
reports the problem in the status bar.

```jsonc
{
  "workspace": {
    "name": "Dragon Merchant Guild",
    "mission": "Module 01 — C# Fundamentals · Day 1",   // Home + context panel
    "goal": "Close Milestone 0",
    "quote": { "text": "…", "source": "curriculum/README.md" },
    "entryDocument": "PROGRESS.md",   // opened when there is no prior session
    "startupPage": "home"             // "home" | "resume" | "document"
  },

  "files": {
    "include": ["**/*.md", "**/*.png", "**/*.pdf"],
    "ignore": ["**/.git/**", "**/node_modules/**"],
    "assetRoots": ["assets"],         // where `![](x.png)` looks, Obsidian-style
    "maxRenderBytes": 2000000
  },

  "appearance": {
    "theme": "dark",                  // "dark" | "light" | "system"
    "accent": "#6E9BC5",
    "fontSize": 16.5,
    "proseFont": "serif",             // "serif" | "sans" | "mono"
    "lineHeight": 1.68,
    "measure": "68ch",                // reading column width
    "density": "comfortable"          // "comfortable" | "compact"
  },

  "layout": {
    "explorer": { "visible": true, "width": 280 },
    "contextPanel": { "visible": true, "width": 320 },
    "explorerSections": ["tree", "curriculum", "search", "favorites", "recents", "bookmarks"],
    "contextWidgets": [
      { "id": "core.currentMission" },
      { "id": "curriculum.currentModule", "options": { "showEstimate": true } },
      { "id": "core.recents", "options": { "limit": 8 } },
      { "id": "core.dailyNotes", "options": { "path": "notes/daily/{{date}}.md" } },
      { "id": "core.quickActions", "options": {
          "actions": [{ "label": "Roadmap", "command": "file.open", "args": ["roadmap/08.md"] }]
      }}
    ]
  },

  "favorites": [{ "label": "Progress", "path": "PROGRESS.md" }],

  // Additive over the defaults: same key replaces, `"command": null` unbinds.
  "keybindings": [
    { "key": "ctrl+e", "command": "palette.quickOpen" },
    { "key": "ctrl+p", "command": null }
  ],

  "markdown": {
    "wikiLinks": true, "callouts": true, "mermaid": true, "footnotes": true,
    "tableOfContents": { "enabled": true, "minHeadings": 3, "maxDepth": 3 }
  },

  "plugins": {
    "curriculum": { "enabled": true, "source": "curriculum/curriculum.json", "docBase": "curriculum" }
  }
}
```

**Core widget ids:** `core.currentMission`, `core.currentGoal`, `core.openTabs`,
`core.recents`, `core.dailyNotes`, `core.quickActions`.
**Core explorer sections:** `tree`, `search`, `favorites`, `recents`,
`bookmarks`.

An unknown widget or section id is skipped with a console warning — never a
crash. That is what lets a workspace list `curriculum` whether or not the
curriculum plugin is enabled.

`when` clauses on keybindings are a closed set: `always`, `workspace`,
`documentFocus`, `explorerFocus`, `overlayOpen`.

### Markdown

Standard GFM, plus:

- `[[Target]]`, `[[Target#Heading]]`, `[[Target|Alias]]` — resolved against the
  whole workspace, so `[[cp1]]` finds `curriculum/checkpoints/cp1.md` from
  anywhere. Unresolved links render visibly broken rather than as dead text.
- `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]`, `> [!CAUTION]` and friends. `-`/`+`
  after the marker makes them foldable.
- ` ```mermaid ` diagrams.

`notes/markdown-reference.md` in the sample workspace exercises every feature at
once — it is the page to open when checking that rendering still works.

---

## Architecture

```
src/
  shared/     types, IPC contract, config + session schemas — no node, no DOM
  main/       fs, search worker, session store, kt:// asset protocol
  preload/    the context bridge
  renderer/   React: store, markdown pipeline, components, plugins
```

Four things are worth knowing before changing anything:

**`src/shared/platform.ts` is the filesystem boundary.** Every fs operation in
the app goes through it. `src/renderer/platform/index.ts` picks the
implementation — porting to Tauri means writing a sibling of `electron.ts` and
changing one line there. Nothing in the UI, store, markdown pipeline or plugins
would change.

**The markdown pipeline's order is load-bearing** (`renderer/markdown/pipeline.ts`).
Each placement fixes a specific failure, and they are documented in the file.
`rehypeBlockIds` in particular must stay last: it stamps the scroll anchors, and
they are only as stable as the tree they were numbered against.

**Scroll restoration is the subtlest thing here** (`hooks/useScrollRestore.ts`).
Pixels alone fail three different ways; the file explains each and what
counteracts it. If you change how documents render, read it first.

**Shiki uses the JavaScript regex engine, not Oniguruma.** The WASM engine would
require `script-src 'wasm-unsafe-eval'` in the CSP. That is a real weakening of
the policy in exchange for a syntax highlighter, so the app imports languages
individually through `shiki/core` instead.

### Plugins

Optional, isolated, and registered statically. The curriculum plugin
(`renderer/plugins/curriculum/`) is the worked example: it reads the workspace's
`curriculum.json` and contributes an explorer section, two context widgets and
four commands. Everything it knows about modules and checkpoints lives in its
own folder — which is what keeps the core generic.

```ts
export default definePlugin({
  id: 'pomodoro',
  name: 'Pomodoro',
  activate(ctx) {
    ctx.registerCommand({ id: 'pomodoro.start', title: 'Start Timer', run: () => {} })
    ctx.registerContextWidget({ id: 'pomodoro.timer', title: 'Timer', component: Timer })
  },
})
```

Add it to `BUILTIN_PLUGINS` in `renderer/plugins/builtin.ts` — the only module in
the app that imports a plugin — and enable it under `plugins.<id>` in a
workspace's settings.

The context offers `registerCommand`, `registerContextWidget`,
`registerExplorerSection`, `registerKeybinding`, `registerStatusItem`, plus
capabilities: **read-only** `fs`, namespaced `state`, and an `app` facade
(`openDocument`, `runCommand`, `notify`, `onDocumentOpened`).

`fs` is read-only deliberately: a plugin that wants to persist something uses
`ctx.state`, which main writes into `userData/plugin-state/`. That one rule
means **no plugin can corrupt your Markdown**.

A plugin that throws during activation is disabled, its registrations rolled
back, and a warning shown — the workspace keeps working. Each widget also
renders inside its own error boundary.

**Being straight about v1:** plugins are in-process modules compiled into the
app. There is no dynamic loading of third-party code and no sandbox. "Isolated"
here means a narrow API plus error containment, nothing more. Because the
context is a plain object of functions and plugins never import app internals,
moving to an out-of-process host later would replace the implementation rather
than the contract.

### Where state lives

| | |
|---|---|
| `<workspace>/.kt/settings.json` | Portable, committable. Layout, theme, favorites, widgets. |
| `userData/sessions/<id>.json` | Machine-local. Tabs, scroll positions, window geometry. |
| `userData/config.json` | Recent workspaces, theme, zoom. |
| `userData/plugin-state/` | Per-workspace, per-plugin. |

Favorites are in the workspace because they are intentional and travel with the
folder. Scroll offsets are not, because they are machine state and have no
business in your notes directory.

---

## `tools/convert-pdfs.py`

A one-time script that converted the original design PDFs (still in
`documents/`) into the workspace Markdown. It is workspace *preparation*, not an
app feature — Knowledge Terminal reads Markdown and never shells out to
`pdftotext`. Kept in the repo so the conversion is reproducible and reviewable.
