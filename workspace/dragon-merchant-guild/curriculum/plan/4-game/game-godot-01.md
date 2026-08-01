# Game Module (Godot) 01 — Godot Basics (C#)

**Days:** 5 · **Prereq:** PICK ENGINE crossroad · **Engine:** Godot 4.6 (.NET build) · **Lang:** C#

## Mission brief

Godot is free and open-source (MIT — no royalties, no seats, ever), lightweight, and genuinely excellent for 2D. Its model is a **tree of Nodes** composed into **Scenes** — composition over inheritance, baked into the engine. You script in C# via the .NET build. Learn the node tree, the C# lifecycle (`_Ready`, `_Process`, `_PhysicsProcess`), and **signals** (Godot's built-in observer pattern).

**One real caveat (2026):** Godot's **C# projects can't export to the web yet** (GDScript can; a C# web export was prototyped but not shipped). So for browser games, either use GDScript or target desktop with C#. Desktop/mobile export works fine.

**Bridges:** Node tree ≈ composition you learned in OOP · signals ≈ C# `event` / observer · `_PhysicsProcess(delta)` ≈ your fixed-step loop · `CharacterBody2D` ≈ collision handled for you.

Reference: the Godot docs (docs.godotengine.org) — pick the C# tab.

---

## Day blocks

### Day 1 — Editor, nodes & scenes
- [ ] **Do:** install Godot 4.6 **.NET** build + the .NET SDK. Create a project, build a scene: a `Node2D` root, a `Sprite2D`, a `CharacterBody2D` player. Learn the Scene dock, instancing sub-scenes, and how the node tree *is* your composition.
  - **Done-when:** you can build, instance, and save a reusable scene and explain the node/scene model.

### Day 2 — C# scripting & the lifecycle
- [ ] **Build:** attach a C# script to the player. Use `_Ready` (setup), `_Process(double delta)` (per-frame), `_PhysicsProcess(double delta)` (fixed physics). Export tunables with `[Export] float Speed;` (inspector-editable, encapsulated).
  - **Done-when:** the player moves frame-independently; you can say which method to use for movement vs rendering.
- [ ] ⭐ Stretch: `GD.Print` + the debugger; understand the C# build/reload cycle (slower than GDScript — know why).

### Day 3 — Signals & input
- [ ] **Build:** wire input via the **Input Map** (actions, not raw keys). Emit and connect a custom **signal** (e.g. `Collected`) from a pickup to the player/score — Godot's decoupled event system. Connect in the editor and in code.
  - **Done-when:** a pickup emits a signal that another node handles, with zero direct references between them.

### Day 4 — 2D physics & movement
- [ ] **Build:** move a `CharacterBody2D` with `Velocity` + `MoveAndSlide()`, add gravity and jump, and detect floor with `IsOnFloor()`. Add `Area2D` triggers for pickups/hazards.
  - **Done-when:** run + jump + collect works via engine physics, no hand-rolled collision.

### Day 5 — Tilemap & a playable slice
- [ ] **Build:** a `TileMap` level with collision, a follow `Camera2D`, and a 30-second playable slice.
- [ ] Run Godot drills cold.

---

## Coding drills
1. **charbody-move**: gravity + jump + MoveAndSlide from scratch.
2. **signal-wire**: emit a custom signal from a pickup, handle it elsewhere.
3. **lifecycle**: _Process vs _PhysicsProcess — put movement in the right one and justify it.
4. **export-tune**: three `[Export]` tunables adjusted live in the editor.

## Portable takeaway
Same C#, same game-core reasoning as Unity — different host. Learning both proves the concepts are yours, not the engine's. Signals here are just the observer pattern you already know, given a UI.
