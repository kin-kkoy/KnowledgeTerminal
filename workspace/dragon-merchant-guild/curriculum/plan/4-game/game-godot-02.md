# Game Module (Godot) 02 — Godot Gameplay & Ship (C#)

**Days:** 6 · **Prereq:** Godot Basics · **Checkpoint:** Godot Checkpoint · **Project:** Godot Game Defense

## Mission brief

Turn nodes-that-move into a finished 2D game: gameplay systems, scene flow via **autoloads** (singletons), UI with Control nodes, audio, and a desktop export. Godot's 2D pipeline is a joy — lean into it. The deliverable is a small, complete, shipped game.

**Bridges:** autoload/singleton ≈ your `GameManager` · Control nodes ≈ a retained-mode UI tree · resources (`.tres`) ≈ ScriptableObjects / config records · scene changes ≈ your top-level menu/play/gameover FSM.

---

## Day blocks

### Day 1 — Gameplay systems & Resources
- [ ] **Build:** a spawner, scoring, and health. Store tunables in custom **Resource** types (`.tres`) — Godot's data-asset equivalent of ScriptableObjects — so you edit data, not code.
  - **Done-when:** difficulty/values are data assets editable in the inspector.

### Day 2 — Autoloads, scene flow & state
- [ ] **Build:** an autoload `GameManager` singleton driving `Menu → Playing → Paused → GameOver`; scene switching via `GetTree().ChangeSceneToFile`, pause via `GetTree().Paused`.
  - **Done-when:** start/pause/die/restart works with no leaked state.

### Day 3 — UI with Control nodes
- [ ] **Build:** HUD (score/lives), main menu, game-over + restart, using Control nodes + a Theme. Update UI via signals, not polling.
  - **Done-when:** UI is signal-driven and themed consistently.

### Day 4 — Audio & feel
- [ ] **Build:** `AudioStreamPlayer` SFX on events, music, and a juice effect (tween on pickup, camera shake, hit flash). Godot's `Tween` makes this easy.
  - **Done-when:** every major action has feedback.

### Day 5 — Export & publish
- [ ] **Do:** install export templates, make a **desktop** build (Windows/Linux), and publish to itch.io. (Remember: C# → no web export yet; ship desktop, or note it.)
  - **Done-when:** a downloadable build runs on a clean machine.

### Day 6 — Polish + drills cold
- [ ] Playtest, fix top 3 issues, README (controls + what it shows). Drills cold.

---

## Mini-project — "Ship a small Godot game"
One tight scope (top-down shooter, platformer level, puzzle). Acceptance:
- [ ] Real loop with win/lose.
- [ ] Autoload-driven scene flow, no state leaks.
- [ ] Data-driven tuning via Resources.
- [ ] Signal-driven UI + audio + one juice effect.
- [ ] A desktop build + README.

## Checkpoint & Defense
- **Godot Checkpoint** (closed-book, no AI): rebuild a mechanic from a spec in a fresh project under time.
- **Godot Game Defense** (AI probe): hand the repo to Claude Code — justify autoloads vs alternatives, signal wiring, node structure, and where composition helped or hurt.
