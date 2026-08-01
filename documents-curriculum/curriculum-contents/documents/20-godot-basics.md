# Godot Basics

Godot is the free, open-source engine — no license fees, tiny download, and superb for 2D. It uses C#
via .NET, so your language skills transfer directly. Same game-core ideas as Unity, different vocabulary
and a cleaner scene model. (One caveat up front: **C# in Godot can't export to the web yet** — desktop
builds only. If browser play is a must, that's a point for Unity/WebGL.) This is an overview — deep
Godot mastery is beyond this book's scope, and the engine's built-in docs and tutorials cover it.

> ⚠ **Fast-moving area.** Engine editors and export tooling change between versions; the concepts
> below are stable, but verify menu paths and version specifics against the engine's current docs.

---

## 1. Nodes & scenes

Godot's building block is the **Node**, and everything is a node: a sprite, a collision shape, a camera,
a timer. You compose nodes into a **tree**, and any branch of that tree can be saved as a **Scene** and
reused (Godot's equivalent of Unity's prefab — but scenes *are* the prefab *and* the level; it's one
unified idea).

- **Node** — a single thing with a role (`Sprite2D`, `CollisionShape2D`, `Area2D`).
- **Scene** — a saved tree of nodes (a player, an enemy, a whole level) you instance anywhere.
- **SceneTree** — the running tree of everything currently active.

Compared to Unity's GameObject-plus-Components, Godot leans on **node composition**: a player is a
`CharacterBody2D` with child `Sprite2D` and `CollisionShape2D` nodes. Specialized node *types* replace
Unity's generic-object-plus-components — often cleaner for 2D. It's still composition over inheritance,
just expressed as a node tree.

> **Try it (Godot):** create a scene with a `CharacterBody2D` root, a `Sprite2D` child, and a
> `CollisionShape2D` child. Save it as `Player.tscn` and instance it twice in a level scene.

---

## 2. C# in Godot & the script lifecycle

Attach a C# script to a node by extending its type. Godot calls lifecycle methods much like Unity's:

```csharp
using Godot;

public partial class Player : CharacterBody2D
{
    [Export] public float Speed = 200f;          // [Export] = shows in the Inspector (like [SerializeField])

    public override void _Ready() { /* once, when it enters the tree — setup */ }

    public override void _Process(double delta)  // EVERY FRAME — input, non-physics
    {
        // delta is your delta time
    }

    public override void _PhysicsProcess(double delta)   // fixed timestep — movement/physics
    {
        var dir = Input.GetVector("ui_left", "ui_right", "ui_up", "ui_down");  // -1..1 vector
        Velocity = dir * Speed;
        MoveAndSlide();                          // built-in: move + resolve collisions
    }
}
```

The three hooks: **`_Ready`** runs once for setup, **`_Process(delta)`** runs every frame (input,
non-physics logic), **`_PhysicsProcess(delta)`** runs on the fixed timestep (physics) — if you read the
Unity chapter, that's `Start` / `Update` / `FixedUpdate` in Godot's names. `[Export]` exposes a
field to the editor. `delta` is the same delta time from the core chapter — same rule: multiply motion
by it. `CharacterBody2D.MoveAndSlide()` handles move-and-collide for you.

> **Try it (Godot):** write a `Player : CharacterBody2D` that reads `Input.GetVector`, sets `Velocity =
> dir * Speed`, and calls `MoveAndSlide()`. Tune `[Export] Speed` in the editor while running.

---

## 3. Signals — Godot's events

**Signals** are Godot's built-in **event** system (LINQ chapter, again): a node *emits* a signal when
something happens, and other nodes *connect* to it — decoupling "it happened" from "who reacts." An
`Area2D` emits `body_entered` when something overlaps it; you connect that to your pickup logic:

```csharp
public partial class Coin : Area2D
{
    [Signal] public delegate void CollectedEventHandler();

    public override void _Ready() => BodyEntered += OnBodyEntered;

    private void OnBodyEntered(Node2D body)
    {
        if (body is Player) { EmitSignal(SignalName.Collected); QueueFree(); }  // QueueFree = destroy
    }
}
```

Signals are the idiomatic Godot way to keep nodes loosely coupled — the coin announces it was collected;
it doesn't reach into the score UI. **Input** is configured in the **Input Map** (Project Settings) —
you name actions ("jump", "move_left") and bind keys/pads, then read them by name, so controls are
rebindable from day one.

## Performance notes

- **Physics in `_PhysicsProcess`, input/visuals in `_Process`** — same split as Unity; mixing them
  causes jitter or missed input.
- **`QueueFree()`** (defer deletion) rather than freeing a node mid-signal, which can crash.
- **Instance scenes, reuse them** — like pooling; spawning/freeing constantly still costs.
- **Godot's C# is fast enough for 2D**; the export caveat (no web) is the real constraint, not speed.

## Build it (make the chapter real)

In Godot, build a controllable character in a small scene:

1. A `Player.tscn` (`CharacterBody2D` + `Sprite2D` + `CollisionShape2D`) with an `[Export] Speed`.
2. Movement in `_PhysicsProcess` via `Input.GetVector` + `MoveAndSlide()`; actions defined in the Input
   Map.
3. A `Coin` scene (`Area2D`) that emits a **signal** on `BodyEntered` and `QueueFree()`s itself.

Success test: you drive a character (rebindable controls) that collects coins via signals, speed tuned
live in the editor. Every piece is a game-core idea in Godot's clean node vocabulary.
