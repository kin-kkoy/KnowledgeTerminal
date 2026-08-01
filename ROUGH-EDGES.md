# Rough edges

Things that work but are not finished. Nothing here is broken — it either does
less than it looks like it does, or it costs you a hand-edit that a UI should
have handled.

The app links here from a warning before you use one of these. Each has an id;
that id is what the warning suppresses for the session.

---

## `lobby` — the Lobby

**Still a prototype, and says so.** The component is literally
`LobbyPrototype.tsx` and there is a `PROTOTYPE` strip along the bottom of it.
It is wired into the real app and does real work, but it has not been renamed or
promoted.

What is genuinely live: the title and eyebrow, and the *Read a topic* /
*Today's tasks* targets. Those come from the curriculum plugin through
`registerDashboardSource`, recompute when your progress moves, and cannot go
stale.

What is not:

- **"You are on step two" is hardcoded.** The day loop does not know which step
  you are on. Working it out means tracking which documents you opened this
  session against the day block's tasks — new state and new heuristics, and it
  would be wrong sometimes. Deliberately not attempted.
- **The day loop's document list is hardcoded in core.** Each step names things
  like `stuck-protocol` and `weekly-protocol` as string literals inside
  `LobbyPrototype.tsx`. That is workspace-specific knowledge sitting in core —
  the same mistake the map had before it moved to config. It should become a
  `lobby.steps` block alongside `lobby.map`.
- **Only the map is config-driven.** `settings.lobby.map` works properly and
  falls back to deriving top-level folders when unset. The rest does not.

## `lobby-map-editing` — editing the Lobby's map

`lobby.map` in `.kt/settings.json` has to be edited **by hand**. The Sandbox has
no section for it, which is the exact thing the Sandbox exists to prevent.

The schema is in `src/shared/config-schema.ts` (`lobbySchema`). An entry is a
path, an optional label, an optional note, and an `emphasis` flag. Icons are not
configured there — they resolve through `files.icons` and the name heuristics,
same as the file tree.

## `new-workspace` — creating a workspace

The happy path works and has been driven end to end. Two things are thin:

- **The native folder dialog is the least-tested part of the app.** It cannot be
  driven from the outside, so it was verified by stubbing the dialog rather than
  clicking it. The button, the IPC and everything downstream are verified; the
  OS dialog itself is Electron's.
- **Adopting an existing workspace is a narrow path.** Pointing it at a folder
  that already has `.kt/settings.json` disables the identity fields and says the
  existing file wins, which is correct — but it means the form looks half-dead
  and that is not obvious until you have read the notice.

## `keybindings` — the Sandbox's keybinding editor

Key capture works, and it writes real overrides. But:

- **Conflict detection is shallow.** Two overrides collide only if the key AND
  the `when` clause match exactly. `ctrl+k` bound with `when: always` and again
  with `when: workspace` will not be flagged, and the second silently wins.
- **Chords are not capturable.** `ctrl+k ctrl+t` exists in the default keymap
  but the capture control records single chords only. Type chords by hand.

## `plugin-options` — per-plugin configuration

The Sandbox's Plugins section shows a plugin's own options as **read-only JSON**.
The enable toggle is real; nothing else is editable there.

This is deliberate as far as it goes — `settings.plugins.<id>` is the one branch
of the schema that passes unknown keys through, because a plugin's options are
its own business. But a plugin that declared its options (the `OptionSpec` seam
that context widgets already use) could get real controls, and none does.

## `light-theme` — Latte, and `system`

Everything in this app was built and checked in **Mocha**. Light mode is wired
and the tokens exist, but no surface built recently — the Sandbox, the Lobby,
the icon picker, the repair view — has been looked at in Latte. `system` theme
is reachable from the Sandbox and has never been exercised at all.

Expect contrast problems rather than breakage.

---

## Not rough, for the record

These were verified in the running app and are not on the list:

- Settings round-tripping. Keys you hand-write survive every write; a file that
  fails to parse is never overwritten, and the Sandbox refuses to save until you
  repair it.
- The icon system: overrides win, heuristics fall back, both directions checked.
- The workspace tidy: 128 wiki-links resolve, 0 broken.
- Tab pinning, the close confirmation, and the Lobby as a tab.
