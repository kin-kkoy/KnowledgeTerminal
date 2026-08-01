# Godot Gameplay

Same destination as the Unity gameplay chapter — one small, complete, shipped game — through Godot's
systems: scene flow, a global game state, UI, audio, and a desktop export. If you did the Unity
chapter, you'll recognize every idea; only the node names change.

> ⚠ **Fast-moving area.** Engine editors and export tooling change between versions; the concepts
> below are stable, but verify menu paths and version specifics against the engine's current docs.

---

## 1. Gameplay & scene flow

- **Spawning** — load a packed scene and instance it at runtime:

  ```csharp
  var coinScene = GD.Load<PackedScene>("res://Coin.tscn");
  var coin = coinScene.Instantiate<Area2D>();
  AddChild(coin);               // add it to the running tree
  coin.Position = new Vector2(x, y);
  ```

- **Scene flow** — switch levels/menus with `GetTree().ChangeSceneToFile("res://Level2.tscn")`. Each
  screen (menu, level, game-over) is its own scene; you swap the active one.

- **Global game state (autoloads)** — Godot's clean answer to a cross-scene singleton is an **autoload**
  (Project Settings → Autoload): a script that's always present and reachable from any scene. Perfect for
  score, lives, and settings that must survive scene changes:

  ```csharp
  public partial class Game : Node   // registered as an autoload named "Game"
  {
      public int Score { get; private set; }
      [Signal] public delegate void ScoreChangedEventHandler(int score);
      public void AddScore(int n) { Score += n; EmitSignal(SignalName.ScoreChanged, Score); }
  }
  // from anywhere:  GetNode<Game>("/root/Game").AddScore(10);
  ```

Notice it emits a **signal** on change so the UI updates without the game logic knowing the UI exists —
the same event-driven decoupling as everywhere else. **Use-case:** a coin's signal handler calls
`Game.AddScore`; the HUD is connected to `ScoreChanged` and refreshes.

> **Try it (Godot):** make a `Game` autoload holding score with a `ScoreChanged` signal; have coins add
> score; switch from a menu scene to a level scene with `ChangeSceneToFile`.

---

## 2. UI & audio

- **UI** — Godot's **Control nodes** (`Label`, `Button`, `TextureRect`, containers) build interfaces, and
  **Themes** style them consistently. A HUD is Control nodes connected to your autoload's signals — the
  score `Label` updates when `ScoreChanged` fires; a Game-Over panel shows on a lose condition.
- **Audio** — an **`AudioStreamPlayer`** plays a stream; one for SFX (`Play()` on pickup), a looping one
  for music. As in Unity, sound is the highest polish-per-minute you can add.

```csharp
[Export] public AudioStreamPlayer CoinSound;
private void OnCollected() { CoinSound.Play(); GetNode<Game>("/root/Game").AddScore(10); }
```

> **Try it (Godot):** connect a score `Label` to the autoload's `ScoreChanged` signal, and play an
> `AudioStreamPlayer` on pickup. Add a Game-Over `Control` panel with a Restart button
> (`GetTree().ReloadCurrentScene()`).

---

## 3. Export & ship

Godot exports a standalone game via **Project → Export**: install the **export templates** once, add a
preset for your platform (Windows/Mac/Linux), and export an executable. Then share it — **itch.io** is
again the natural home for a desktop build.

**The caveat, restated:** the **C# build can't export to the web** (HTML5) — Godot's web export supports
GDScript, not C#, for now. So a C# Godot game ships as a **desktop download**. Plan for that: if
browser-instant-play matters to you, that's the trade-off between the engines (Unity's WebGL vs
Godot's free/OSS + great 2D). For a downloadable desktop game, Godot + C# is excellent.

And the same discipline as Unity: **scope down to finish.** A short, complete, shipped game with a
start, a goal, a lose state, sound, and a restart beats an endless prototype.

## Performance notes

- **Physics in `_PhysicsProcess`, visuals/input in `_Process`** — respect the split.
- **Instance and reuse packed scenes**; `QueueFree()` to delete safely; avoid churn for frequent spawns.
- **Autoload for cross-scene state** rather than passing references everywhere or re-finding nodes each
  frame.
- **Godot's editor Profiler/Monitors** show frame time and object counts — measure before optimizing.

## Build it (make the chapter real — the Godot checkpoint)

Ship one **small complete Godot game** (a 60-second loop):

1. A player scene (last chapter) in a small level; spawned pickups/enemies via `PackedScene`.
2. A `Game` **autoload** tracking score/state, emitting **signals** the HUD connects to.
3. A HUD `Label`, a pickup **sound**, and a **Game-Over** Control panel with restart.
4. A **desktop export** you upload to itch.io.

Success test: someone downloads your itch.io build and plays a complete little game with score, sound,
and a Game Over. That "small, finished, shared" is the Godot checkpoint — and the defense is the same:
explain your architecture and *why* to Claude Code.

---

**That's the whole book.** You've gone from C# fundamentals, through OOP, collections, LINQ, and
async, into building and deploying real backends and cloud services, and out to games in two engines.
This book is the explanation; the Atlas is the syntax reference; the Study lab is where it becomes
real; the Map tracks what's yours. Go build something and defend it.
