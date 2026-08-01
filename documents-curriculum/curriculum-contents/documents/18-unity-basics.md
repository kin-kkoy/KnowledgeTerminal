# Unity Basics

Unity is the industry-standard engine — the biggest job market and asset ecosystem. This chapter maps
the game-core ideas onto Unity's model. You can't run Unity inside this app, so treat the code here as
patterns to recognize and reproduce in the Unity editor; the *concepts* are all things you already met
in the previous chapter. This is an overview — deep Unity mastery is beyond this book's scope, and the
engine's built-in docs and tutorials cover it.

> ⚠ **Fast-moving area.** Engine editors and export tooling change between versions; the concepts
> below are stable, but verify menu paths and version specifics against the engine's current docs.

---

## 1. The editor & GameObjects

A Unity game is a **scene** — a tree of **GameObjects**. A GameObject is an empty container; what it
*does* comes from the **Components** you attach (a sprite renderer, a collider, a rigidbody, your
scripts). This is **composition over inheritance** (OOP chapter) as an engine philosophy: a "player" is
a GameObject with a Sprite + Collider + Rigidbody + `PlayerController` script, not a subclass of some
`Player` base.

- **Scene** — the hierarchy of objects currently in play.
- **Inspector** — edit a selected object's components and their values.
- **Prefab** — a reusable GameObject template (an enemy, a bullet); instantiate many at runtime, edit
  the prefab once to change them all.

**Mental model:** GameObject = the noun, Components = its abilities, Prefab = a stamp you press to make
copies. You'll spend most of your time wiring components in the Inspector and writing the scripts that
give them behaviour.

> **Try it (Unity):** in a new 2D project, create a GameObject, add a Sprite Renderer and a Box
> Collider 2D, then drag it into the Project window to make a **prefab**. Instantiate three copies.

---

## 2. MonoBehaviour — the script lifecycle

Your scripts inherit **`MonoBehaviour`** and Unity calls specific methods at specific times. This is the
game loop from last chapter, handed to you as named hooks:

```csharp
using UnityEngine;

public class PlayerController : MonoBehaviour
{
    [SerializeField] private float speed = 5f;    // shows up in the Inspector, tweakable without code

    void Awake()  { /* once, when the object loads — set up references */ }
    void Start()  { /* once, before the first frame — initial state */ }

    void Update() // EVERY FRAME — input and non-physics logic
    {
        float h = Input.GetAxis("Horizontal");                 // -1..1 from arrow/WASD
        transform.position += Vector3.right * h * speed * Time.deltaTime;  // dt!
    }

    void FixedUpdate() { /* fixed timestep — do physics here */ }
}
```

The key hooks: **`Awake`/`Start`** (setup, once), **`Update`** (every frame — input, game logic),
**`FixedUpdate`** (fixed rate — physics). Notice `Time.deltaTime` — that's the delta time from the
core chapter, and `[SerializeField]` exposes a private field to the Inspector so designers tweak values
without touching code (encapsulation, but designer-friendly).

> **Try it (Unity):** write a `PlayerController` that moves with `Input.GetAxis` × `speed` ×
> `Time.deltaTime`, expose `speed` with `[SerializeField]`, and tune it live in the Inspector while the
> game runs. Confirm movement feels the same regardless of frame rate.

---

## 3. Physics & input

Unity has a full physics system so you rarely hand-roll collision (though now you understand it):

- **`Rigidbody2D`** — makes an object obey physics (gravity, forces, velocity). Move physics objects by
  setting velocity or `AddForce` **in `FixedUpdate`**, not by teleporting `transform` (which fights the
  physics engine).
- **Colliders** (`BoxCollider2D`, `CircleCollider2D`) — the shapes that detect contact. Mark one a
  **trigger** for "overlap without a bounce" (pickups, zones); handle contacts via `OnCollisionEnter2D`
  / `OnTriggerEnter2D` callbacks.
- **Input System** — read keyboard/gamepad. The older `Input.GetAxis`/`GetKey` is simplest to start;
  the newer Input System package scales to rebindable controls and multiple devices (its full setup is
  beyond this book's scope — the engine's built-in docs cover it).

```csharp
void OnTriggerEnter2D(Collider2D other)
{
    if (other.CompareTag("Coin")) { /* collect it */ Destroy(other.gameObject); }
}
```

**The one gotcha:** input in `Update`, physics in `FixedUpdate`. Reading input in `FixedUpdate` misses
presses; moving a rigidbody in `Update` stutters. Respect the split from the core chapter.

## Performance notes

- **Cache component lookups** — `GetComponent<>()` isn't free; call it in `Awake`/`Start` and store the
  result, never every frame in `Update`.
- **Prefabs + object pooling** — instantiating/destroying constantly (bullets!) causes GC hitches;
  reuse a pool of objects instead.
- **`FixedUpdate` for physics forces, `Update` for input** — mixing them causes missed input or jitter.
- **Avoid heavy work every frame** — spread it out or cache; 60 FPS means a 16ms budget per frame.

## Build it (make the chapter real)

In Unity, build a controllable character:

1. A player GameObject (Sprite + `Rigidbody2D` + `Collider2D`) with a `[SerializeField] speed`.
2. `Update` reads input; move with `Time.deltaTime` (or set rigidbody velocity in `FixedUpdate`).
3. A coin **prefab** with a trigger collider; `OnTriggerEnter2D` collects it and destroys it.
4. Cache any `GetComponent` calls in `Awake`.

Success test: you drive a character that collects coins, tuned live in the Inspector, at a consistent
speed. Every piece is a game-core concept wearing a Unity name.
