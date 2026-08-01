# Game Module (Unity) 01 — Unity Basics

**Days:** 5 · **Prereq:** PICK ENGINE crossroad · **Engine:** Unity 6 (LTS line) · **Lang:** C#

## Mission brief

Unity is the industry-standard engine — biggest job market, largest asset ecosystem, strong tooling (Visual Studio / Rider). You already have the game-core concepts; here you learn *where Unity puts them*: GameObjects hold Components, `MonoBehaviour` gives you lifecycle hooks (`Awake`/`Start`/`Update`/`FixedUpdate`), the physics engine handles collision, and the editor is your level tool. Licensing note (2026): Unity Personal is free under a revenue threshold; Pro/Enterprise are paid seats — fine for learning and small releases.

**Bridges:** your `Vec2` → `UnityEngine.Vector2/3` · your loop → `Update(dt = Time.deltaTime)` and `FixedUpdate` for physics · your FSM → a component with an enum · your AABB → Colliders + Rigidbody (don't hand-roll physics unless you want to).

Reference: Unity Learn + the Manual (docs.unity3d.com). Read the page for the task, then build in the editor.

---

## Day blocks

### Day 1 — Editor, GameObjects, the scene
- [ ] **Do:** install Unity Hub + Unity 6, create a 2D (URP) project. Build a scene with a ground and a player sprite. Learn Hierarchy, Inspector, Scene vs Game view, and **Prefabs** (make the player a prefab, instantiate two).
  - **Done-when:** you can create/duplicate/prefab a GameObject and explain what a Component is without notes.

### Day 2 — MonoBehaviour lifecycle & C# scripting
- [ ] **Build:** a `PlayerController : MonoBehaviour`. Use `[SerializeField] private float speed;` (inspector-tunable, still encapsulated), read input in `Update`, print with `Debug.Log`. Understand `Awake` vs `Start`, and `Update` (per-frame, use `Time.deltaTime`) vs `FixedUpdate` (physics tick).
  - **Done-when:** the player moves with frame-rate-independent speed and you can say which lifecycle method runs when, and why physics goes in FixedUpdate.
- [ ] ⭐ Stretch: `[Header]`, `[Range]`, and `[Tooltip]` attributes to build a clean inspector.

### Day 3 — Physics & the Input System
- [ ] **Build:** give the player a `Rigidbody2D` + `Collider2D` and move it via `rigidbody.linearVelocity` (not transform hacks). Add ground with a collider. Wire jump using the **new Input System** package (actions, not `Input.GetKey`).
  - **Done-when:** the player runs and jumps with real physics; collisions with the ground work without you writing collision math.

### Day 4 — Interaction: triggers, tags, layers
- [ ] **Build:** collectibles that vanish on `OnTriggerEnter2D`, a score counter, and a hazard that resets the player. Use tags/layers to filter collisions.
  - **Done-when:** collecting increments score; hitting a hazard resets — all via trigger callbacks.
- [ ] ⭐ Stretch: object pooling for collectibles (reuse, don't Instantiate/Destroy each time) — explain the GC pressure you avoided.

### Day 5 — Camera, tilemap, and a playable slice
- [ ] **Build:** a follow camera (Cinemachine or a simple `LateUpdate` follow), a small tilemap level, and assemble a 30-second playable slice: move, jump, collect, avoid.
- [ ] Run all Unity drills cold.

---

## Coding drills
1. **movecontroller**: frame-independent horizontal move + jump via Rigidbody2D from scratch.
2. **trigger-collect**: OnTriggerEnter2D increments a score field.
3. **lifecycle-order**: predict then verify Awake/Start/Update/FixedUpdate order with Debug.Log.
4. **serialize-tune**: expose 3 tunables with [SerializeField]/[Range] and tune in play mode.

## Portable takeaway
Notice how little Unity-specific code you wrote — your movement/FSM/collision *reasoning* came from Game Module 00. That transfer is the whole point: the engine is I/O around logic you already own.
