# C# for Games

Before any engine, learn the ideas *every* game is built from — they're the same in Unity, Godot, or a
raw window, and you can prototype them in plain C# right here in the Study lab. Get these four
(the loop, vectors, state, collision) and an engine becomes "where do I type this?" rather than "what
is this?".

---

## 1. The game loop & delta time

A game isn't event-driven like a web API; it's a **loop** running many times per second: read input →
update the world → render → repeat. Each pass is a **frame**.

The catch: frames don't take equal time (60 FPS on one machine, 30 on another). If you move an object
"5 units per frame," it moves twice as fast at 60 FPS. The fix is **delta time** (`dt`) — the seconds
since the last frame — and multiplying motion by it, so you move in units *per second*:

```csharp
double x = 0, speed = 100;              // 100 units per SECOND
void Update(double dt) => x += speed * dt;   // frame-rate independent

// simulate a few frames of ~16ms (≈60 FPS):
double dt = 0.016;
for (int f = 0; f < 3; f++) { x = 0; Update(dt); System.Console.WriteLine($"moved {x:F2}"); }
```

**Rule:** anything that changes over time (movement, timers, animation) multiplies by `dt`. Engines
also give you a **fixed timestep** (`FixedUpdate` / `_PhysicsProcess`) that runs at a steady rate for
physics — variable for rendering, fixed for physics. **Contrast with your console toys:** those ran
once and stopped; a game is a `while (running)` that never blocks.

> **Try it (lab):** write `Update(dt)` that moves an `x` at 100 units/sec. Call it with `dt=0.016`
> (60 FPS) 60 times and with `dt=0.033` (30 FPS) 30 times — confirm `x` ends near the same place. That's
> frame independence.

---

## 2. Vectors & 2D math

Positions, velocities, and directions are **vectors** — an `(x, y)` pair you can add and scale. The
handful of operations every game leans on:

```csharp
double Length(double x, double y) => System.Math.Sqrt(x * x + y * y);

(double x, double y) Normalize(double x, double y)     // same direction, length 1
{
    double l = Length(x, y);
    return l == 0 ? (0, 0) : (x / l, y / l);
}

double Dot(double ax, double ay, double bx, double by) => ax * bx + ay * by;   // >0 = same-ish dir
double Lerp(double a, double b, double t) => a + (b - a) * t;                   // t in [0,1], smooth move
```

- **Add** velocity to position each frame to move.
- **Normalize** a direction so diagonal movement isn't faster than straight (a classic bug: moving
  `(1,1)` is 1.41× speed unless you normalize).
- **Dot product** tells you how aligned two directions are (facing? behind? perpendicular?).
- **Lerp** eases a value from a→b — smooth camera follow, fades, interpolation.

**Use-case:** an enemy chasing the player = normalize `(player − enemy)`, scale by speed × dt, add to
the enemy's position. That's "seeking" in one line of vector math.

> **Try it (lab):** implement `Normalize` and move a point from `(0,0)` toward `(3,4)` at 2 units/frame
> for 5 frames — print the positions and confirm it heads straight for the target at constant speed.

---

## 3. Input & state machines

Games read input every frame (is the jump key down?) and most entities are best modeled as a **finite
state machine (FSM)** — a set of states (Idle, Run, Jump, Fall) with rules for switching. It keeps
"what can this thing do right now?" from becoming a nest of booleans:

```csharp
enum State { Idle, Run, Jump }

State Next(State s, bool moving, bool jumpPressed, bool grounded) => s switch
{
    State.Idle when jumpPressed        => State.Jump,
    State.Idle when moving             => State.Run,
    State.Run  when jumpPressed        => State.Jump,
    State.Run  when !moving            => State.Idle,
    State.Jump when grounded           => State.Idle,
    _                                  => s
};
```

Look familiar? It's the **pattern matching** from the Fundamentals chapter, applied to game state. An
FSM is far cleaner than `if (isJumping && !isFalling && ...)` sprawl, and it's how real character
controllers, enemy AI, and menus are structured.

> **Try it (lab):** build the FSM above and feed it a sequence of inputs (idle→move→jump→land), printing
> each state transition. Add a `Fall` state and the rules for it.

---

## 4. Collision basics

"Did these two things touch?" is answered with cheap overlap tests. Two you'll use constantly:

```csharp
// Axis-aligned bounding boxes (rectangles) overlap?
bool AabbOverlap(double ax, double ay, double aw, double ah,
                 double bx, double by, double bw, double bh)
    => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// Circles overlap? (compare distance to summed radii — squared, to skip the sqrt)
bool CirclesOverlap(double ax, double ay, double ar, double bx, double by, double br)
{
    double dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy <= (ar + br) * (ar + br);
}
```

AABB is the workhorse (fast, good for most 2D). Circles are natural for round things and cheaper.
Engines give you full physics/colliders, but knowing these means you understand what the engine is
doing — and you can hand-roll simple collision when you don't want the whole physics system.

**Perf note:** checking every object against every other is O(n²). Fine for a few dozen objects;
for hundreds you'd add spatial partitioning (a grid) — but don't optimize before you need to.

> **Try it (lab):** write `AabbOverlap`, place two rectangles, and print whether they collide as you
> nudge one across the other. That boolean is the seed of every pickup, hit, and wall in a 2D game.

---

## Build it (make the chapter real)

Prototype a **tiny 2D game loop in plain C#** (right here in the lab — no engine yet):

1. A "player" with position + velocity, moved by `velocity * dt` each simulated frame.
2. Input-driven state via your FSM (fake the input as an array of keypresses).
3. A goal/pickup checked with `AabbOverlap` — detect when the player reaches it.
4. Everything scaled by `dt` so it's frame-rate independent.

Success test: your simulation moves the player at a constant real-world speed regardless of the `dt`
you feed it, transitions states correctly, and reports the pickup collision. You now understand what
an engine automates — which makes learning Unity or Godot mostly about *their* buttons, not new ideas.

**Next:** pick an engine — Unity (industry standard, biggest job market) or Godot
(free/open-source, superb 2D). Same C#, two engines; learn one deeply, or both. The next chapters
give you an overview of each; full engine mastery is beyond this book's scope — the engines' own
built-in docs and tutorials take over from there.
