# Game Module (Unity) 02 — Unity Gameplay & Ship

**Days:** 6 · **Prereq:** Unity Basics · **Checkpoint:** Unity Checkpoint · **Project:** Unity Game Defense

## Mission brief

Basics get a thing moving; this module makes it a *game* — systems that create a loop of challenge and reward, UI/audio for feel, scene flow, and an actual build you can hand someone. The deliverable is a small, complete, shippable game. Employers and your own motivation both respond to "finished and playable," not "prototype in a folder."

**Bridges:** ScriptableObjects ≈ data assets / config records · game state ≈ your FSM one level up (menu → play → game-over) · events ≈ the observer pattern (UnityEvent / C# `event`).

---

## Day blocks

### Day 1 — Gameplay systems & ScriptableObjects
- [ ] **Build:** a spawner (enemies/collectibles over time), a scoring system, and a lives/health system. Store tunables (spawn rate, point values) in **ScriptableObjects** so designers change data without touching code.
  - **Done-when:** difficulty ramps via data you can edit in the inspector, no recompile.

### Day 2 — Game state & scene flow
- [ ] **Build:** a `GameManager` (singleton or a bootstrapped scene) driving `Menu → Playing → Paused → GameOver`. Scene loading/reloading, pause that actually stops time (`Time.timeScale`).
  - **Done-when:** you can start, pause, die, and restart cleanly with no leaked state between runs.

### Day 3 — UI (UI Toolkit / uGUI)
- [ ] **Build:** a HUD (score, lives), a main menu, and a game-over screen with restart. Bind UI to game state via events, not per-frame polling.
  - **Done-when:** UI reflects state through events; no `Update` scraping game values into labels every frame.

### Day 4 — Audio & juice
- [ ] **Build:** SFX on key events (jump, collect, hit), background music, and a little "juice": screen shake, hit flash, or a tween on pickup. Feel is a feature.
  - **Done-when:** every major action has audio/visual feedback.

### Day 5 — Build & publish
- [ ] **Do:** configure Player Settings, make a desktop/WebGL build, and publish to **itch.io**. Fix at least one build-only bug (there's always one).
  - **Done-when:** a stranger can click a link / run an exe and play your game.

### Day 6 — Polish + drills cold
- [ ] Playtest, fix the top 3 issues, write a short README (controls, what it demonstrates). Run drills cold.

---

## Mini-project — "Ship a small Unity game"
Pick ONE tight scope (endless runner, arena survival, simple platformer level, brick-breaker). Acceptance:
- [ ] A real loop: clear goal, challenge, win/lose.
- [ ] Menu → play → game-over → restart, no state leaks.
- [ ] Data-driven tuning via ScriptableObjects.
- [ ] Audio + at least one juice effect.
- [ ] A published build (itch.io link) and a README.

## Checkpoint & Defense
- **Unity Checkpoint** (closed-book, no AI): rebuild a small mechanic from a spec in a fresh project under time.
- **Unity Game Defense** (AI probe): hand the repo to Claude Code — explain your architecture, why a GameManager singleton vs alternatives, why ScriptableObjects, where you'd refactor. If you can't defend a choice, you don't understand it yet.
