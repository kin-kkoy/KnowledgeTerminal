# Game Module 00 — C# for Games (engine-agnostic core)

**Days:** 6 · **Prereq:** the SPECIALIZE crossroad (C# core done) · **Engine:** none yet — plain console/.NET 10

## Mission brief

Before any engine, own the ideas every engine reimplements: a loop that advances time, vector math for movement, input as state, finite state machines for behavior, and collision as geometry. Learn these in raw C# where you can *see* them — and where Facet's own tracing lenses can step through your math. Engines then become "where do I plug these in," not "magic I don't understand." This is also the difference between a scripter and someone who can debug why the jump feels wrong.

**Bridges:** the game loop ≈ your program's `while(true)` but time-aware · vectors ≈ the linear algebra behind every "move toward" · FSM ≈ a `switch` on an enum you already know · delta time ≈ "don't tie speed to frame rate."

Reference: any engine's docs describe *their* loop, but the concepts are universal (Fix Your Timestep by Glenn Fiedler is the canonical read).

---

## Day blocks

### Day 1 — The game loop & delta time
- [ ] **Build** `g00-d1-loop/`: a fixed-count console "loop" that prints simulated frames. Model an object at position `p` with velocity `v`; each frame advance `p += v * dt`. Run it twice — once with `dt = 1.0/60` (60fps) and once `dt = 1.0/30` (30fps) — and show the object reaches the **same** position after the same *elapsed time*, proving frame-rate independence.
  - **Done-when:** your printed output proves that halving the frame rate but doubling dt lands the object in the same place.
- [ ] **Build:** a fixed-timestep accumulator loop (the "Fix Your Timestep" pattern) — simulate at a fixed 60Hz while rendering at a variable rate; print how many sim-steps ran per render.
- [ ] ⭐ Stretch: add a "spiral of death" guard (cap max sim-steps per frame) and explain in a comment why it matters.
- [ ] Close-out: add "delta time / fixed timestep" to your review queue (explain aloud).

### Day 2 — Vectors & 2D math
- [ ] **Build** `g00-d2-vec/`: a small `Vec2` struct (X, Y) with `+`, `-`, scalar `*`, `Length`, `Normalized`, `Dot`, and `Lerp`. Demonstrate: normalize a velocity so speed is constant regardless of direction; use `Dot` to detect if a target is in front of a facing direction; `Lerp` a position toward a target over N frames.
  - **Done-when:** printed output shows constant-speed movement and a correct "in front / behind" test using the dot product's sign.
- [ ] **Trace it in Facet:** paste your movement loop into the Study lab (or use the tree's *Try in lab* example) and watch positions update per step in the Data Structures / Runtime lenses.
- [ ] ⭐ Stretch: implement `Reflect(v, normal)` and bounce a point off a wall.

### Day 3 — Input as state & the input buffer
- [ ] **Build** `g00-d3-input/`: model input without an engine — an `InputState { bool Left, Right, Jump; }` updated each frame from a scripted sequence. Distinguish **held** (down this frame) from **pressed** (down this frame but not last) — the classic "jump only fires once per press" logic.
  - **Done-when:** a scripted input sequence produces exactly one jump event per press, not one per held frame.
- [ ] ⭐ Stretch: a tiny input buffer (queue the last few frames) so a jump pressed slightly early still fires on landing.

### Day 4 — Finite state machines
- [ ] **Build** `g00-d4-fsm/`: an entity FSM with states `Idle → Run → Jump → Fall → Idle`, driven by input + a grounded flag. Implement it two ways: (a) a `switch` on an enum, (b) a `Dictionary<State, ...>` transition table — and argue which scales better.
  - **Done-when:** a scripted input timeline drives the entity through all states with correct transitions and no illegal jumps (e.g. can't jump while falling).
- [ ] ⭐ Stretch: add `enter`/`exit` hooks per state (play sound on enter Jump).

### Day 5 — Collision basics
- [ ] **Build** `g00-d5-collision/`: AABB-vs-AABB overlap, circle-vs-circle overlap, and point-in-rect. Then a minimal "move and resolve": move a box by velocity, detect overlap with a static box, and push it out along the smallest axis.
  - **Done-when:** two boxes that would overlap end up exactly touching, resolved along the correct axis.
- [ ] ⭐ Stretch: swept AABB (detect the collision *before* tunneling through at high speed) — explain why discrete checks miss fast objects.

### Day 6 — Mini-project: text "engine" demo
- [ ] Combine everything: a console/ASCII sim where an entity with the FSM moves via vectors, reads scripted input, and collides with walls — printed frame by frame. This is your proof you understand the machine before an engine hides it.

---

## Coding drills (repeatable — copy the best to `02-practice/katas/`)
1. **dt-independence**: same motion at 30 vs 60 fps lands identically.
2. **vec2-core**: Length/Normalize/Dot/Lerp from an empty file in <10 min.
3. **press-vs-held**: one jump per press from a scripted input array.
4. **fsm-switch**: Idle/Run/Jump/Fall transitions with an illegal-transition guard.
5. **aabb-overlap**: overlap + resolve two boxes along the min-penetration axis.

## Where this goes next
The **PICK ENGINE** crossroad splits into Unity and Godot. Everything here maps directly: your `Vec2` becomes `Vector2`/`Vector2`, your loop becomes `Update(dt)`/`_Process(delta)`, your FSM stays exactly as written. You already built the hard part.
