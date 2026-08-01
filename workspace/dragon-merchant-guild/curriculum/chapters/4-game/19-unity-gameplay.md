# Unity Gameplay

A character that moves isn't a game. This chapter is the systems that turn movement into *play* —
spawning, scoring, game state, UI, audio — and then shipping a build someone else can run. The goal is
one small, complete, finished game, because "complete and small" teaches far more than "ambitious and
abandoned."

> ⚠ **Fast-moving area.** Engine editors and export tooling change between versions; the concepts
> below are stable, but verify menu paths and version specifics against the engine's current docs.

---

## 1. Gameplay systems

Real games are a few systems talking to each other:

- **Spawning** — instantiate prefabs at runtime (enemies, pickups, bullets) with `Instantiate`, and
  **pool** them if they're frequent.
- **Scoring / game state** — a central place that holds score, lives, and the current phase
  (Playing / Paused / GameOver). A simple **singleton `GameManager`** MonoBehaviour is the common
  starter pattern.
- **ScriptableObjects** — data assets that live *outside* any scene: enemy stats, level configs, item
  definitions. They decouple *data* from *behaviour* (a designer edits an asset, no code change) — the
  same "data as editable files" idea this very app uses for its curriculum.

```csharp
using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager I { get; private set; }   // simple singleton
    public int Score { get; private set; }

    void Awake() => I = this;
    public void AddScore(int n) { Score += n; /* raise an event / update UI */ }
}
// from anywhere:  GameManager.I.AddScore(10);
```

**Use-case:** a coin's `OnTriggerEnter2D` calls `GameManager.I.AddScore(10)`; the UI listens and
updates. Keep systems loosely coupled — ideally via **events** (LINQ chapter), so the coin doesn't know
the UI exists.

> **Try it (Unity):** add a `GameManager` singleton that tracks score; have coins call `AddScore` on
> pickup; print the score to the console. Then make enemy stats a `ScriptableObject` and spawn from it.

---

## 2. UI & audio

- **UI** — Unity has **uGUI** (Canvas + Text/Button/Image, easy to start) and the newer **UI Toolkit**
  (more like web/CSS, better for complex UIs — beyond this book's scope; the engine's built-in docs
  cover it). A HUD is UI elements bound to game state — a score label
  that updates when `AddScore` fires, a health bar, a Game Over panel.
- **Audio** — an **`AudioSource`** plays clips; one-shots for SFX (`PlayOneShot`), a looping source for
  music. Sound is the cheapest way to make a game feel alive — a pickup *ding* and a jump *whoosh* do
  more than a week of polish.

```csharp
[SerializeField] private AudioClip coinSfx;
[SerializeField] private AudioSource audioSource;
void Collect() { audioSource.PlayOneShot(coinSfx); GameManager.I.AddScore(10); }
```

> **Try it (Unity):** add a score `Text` that updates on pickup and a `PlayOneShot` coin sound. Add a
> "Game Over" panel that shows when a lose condition is met. Tiny additions, big "it's a game now" jump.

---

## 3. Build & ship

A game that only runs in the editor doesn't count. Unity **builds** a standalone player (Windows/Mac/
Linux/WebGL) from **File → Build Settings**: add your scenes, pick a platform, set player settings
(name, icon, resolution), and build. Then put it somewhere people can play — **itch.io** is the
standard free home for small games (a WebGL build plays right in the browser).

The discipline that matters here: **scope down to finish.** A 60-second game with a start, a goal, a
lose condition, sound, and a Game Over screen — *shipped* — beats a sprawling prototype forever. Cut
features ruthlessly until it's completable.

## Performance notes

- **Object pooling** for anything spawned frequently (bullets, particles, enemies) — instantiate/
  destroy churn causes GC stutter, the most common "why is my game hitching?" cause.
- **Batch UI updates / use events** — don't poll game state every frame in `Update` when an event can
  push the change.
- **Profile before optimizing** — Unity's Profiler shows where frame time goes; guess less.
- **Compress textures/audio** and strip unused assets so the build downloads fast (crucial for WebGL).

## Build it (make the chapter real — the Unity checkpoint)

Ship one **small complete game** (a 60-second arcade loop is perfect):

1. A controllable player (last chapter) in a small level.
2. Spawned pickups/enemies from prefabs; a `GameManager` tracking score + game state.
3. A HUD (score), a sound on pickup, and a **Game Over** screen with a restart.
4. A **build** you upload to itch.io (WebGL so anyone can click and play).

Success test: a stranger opens your itch.io link, plays a complete little game start-to-finish, and
sees a score and a Game Over. That "small but finished and shared" is exactly the Unity checkpoint —
and the defense: explain your architecture and *why* to Claude Code.
