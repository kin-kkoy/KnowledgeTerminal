# Capstone

Nothing on this page is new material. The capstone is the whole backend branch — ASP.NET Core,
EF Core, auth, async, deployment — assembled by you, solo, into **one deployed, documented,
defensible application**. Every chapter so far handed you a piece and checked that piece in
isolation; this page checks whether you can hold all of them at once, which is the actual job.

The project is fixed so you spend your energy on engineering, not brainstorming: you will build
**Bookable**, an event-booking API. Users browse events, book tickets, and cancel bookings;
organizers create events with limited capacity; the system refuses overbooking and
double-booking. It is deliberately boring — boring domains expose real engineering, because
there is nowhere for vagueness to hide.

This chapter is the **exit gate of the backend branch**. Ship Bookable and defend it, and the
backend arc is genuinely yours; skip it, and the previous four chapters remain nine separate
exercises. Work through the three phases below in order — each ends with a concrete deliverable
checklist.

---

## 1. Spec & design

Resist the urge to open an editor. The single most common way capstones die is "started coding
on day one, discovered on day four the model was wrong, lost heart." One page of spec, written
first, prevents that. Here is how to write one.

### How to write a small spec

A working spec for a project this size has four parts, in this order:

1. **Scope cut** — one sentence for what it does, then an explicit **out of scope** list. Write
   the out-of-scope list *first*, before features tempt you. For Bookable, a sane cut: *in* —
   events, bookings, capacity enforcement, per-user data; *out* — payments, emails, waitlists,
   seat maps, admin UI, recurring events. Anything not written as in-scope is out.
2. **User stories** — one line each, in the form *"As a ⟨role⟩, I can ⟨action⟩ so that ⟨why⟩"*.
   Roles keep you honest about authorization; the *why* keeps you honest about whether the
   story earns its place.
3. **Endpoints table** — each story translated into HTTP. If a story doesn't map to an
   endpoint, it isn't a backend feature; if an endpoint maps to no story, delete it.
4. **Domain model sketch** — the entities, their fields, their relationships, and the
   **invariants** (the rules that must never be false). Draw it like the SQL chapter's table
   diagrams: boxes and foreign keys.

That's the whole technique. A spec is not a formal document; it is *the arguments you'd
otherwise have with yourself mid-build, had cheaply and in advance*.

### Worked example: the Bookable spec, abridged

**What it does.** An API where organizers publish capacity-limited events and users book and
cancel tickets.

**Out of scope.** Payments, notifications, waitlists, event editing after bookings exist,
anything with a UI.

**User stories.**

```text
S1  As anyone, I can register and log in, so the API knows who I am.
S2  As a user, I can list and view upcoming events, so I can pick one.
S3  As an organizer, I can create an event with a capacity, so people can book it.
S4  As a user, I can book a ticket to an event, so I have a seat.
S5  As a user, I can cancel my booking, so the seat frees up.
S6  As a user, I can list my own bookings — and only my own.
```

**Endpoints table.** Every column here is a decision you no longer make while coding:

```text
Story  Method  Route                    Auth        Success  Failure cases
S1     POST    /auth/register           anonymous   201      409 email taken
S1     POST    /auth/login              anonymous   200+JWT  401 bad credentials
S2     GET     /events                  anonymous   200      —
S2     GET     /events/{id}             anonymous   200      404
S3     POST    /events                  organizer   201      400 invalid, 403 not organizer
S4     POST    /events/{id}/bookings    user        201      404, 409 full, 409 already booked
S5     DELETE  /bookings/{id}           owner       204      404, 403 not yours
S6     GET     /me/bookings             user        200      —
```

**Domain model.** Three entities, two relationships, two invariants:

```text
User     (Id, Email unique, PasswordHash, IsOrganizer)
Event    (Id, Title, StartsAtUtc, Capacity, OrganizerId → User)
Booking  (Id, EventId → Event, UserId → User, CreatedAtUtc)

Invariant 1 (capacity):       count(Bookings for Event) <= Event.Capacity
Invariant 2 (no double-book): (EventId, UserId) unique across Bookings
```

Notice what the sketch already settled: invariant 2 is a **unique index** on
`(EventId, UserId)` — the database enforces it, not an `if` that loses a race. Invariant 1
*can't* be an index, so it must be checked in a transaction at booking time. You just made your
two hardest implementation decisions before writing a line of C#. That is what specs are for.

> **C corner:** this is the same instinct as writing the header file first — declare the
> interface and the invariants, then implement against them. The spec is Bookable's `.h`.

### Deliverables — phase 1

- [ ] One page (hard limit) containing: scope cut with an explicit out-of-scope list, user
      stories, an endpoints table with auth and failure columns, and a domain sketch with
      invariants. Extend or trim the example above — but *write your own copy*; retyping it is
      where you notice the decisions.
- [ ] For each invariant, a one-line note on *where* it's enforced (DB constraint vs.
      transactional check).
- [ ] The spec saved in the repo as `docs/spec.md` — it becomes part of phase 3's README story.

---

## 2. Build & test

You have a spec; now build it — but in the right *order*. The instinct from layered tutorials
is horizontal: all entities, then all endpoints, then tests at the end. Don't. Build in
**vertical slices**.

### What a vertical slice actually is

A vertical slice is **one user story taken through every layer to done** — endpoint → DTO +
validation → auth rule → EF query/migration → tests green — before the next story starts.
Concretely, the slice for S3 (*create an event*) means:

```csharp
// One slice = all of this, for one story, before touching the next story:
app.MapPost("/events", async (CreateEventDto dto, AppDbContext db, ClaimsPrincipal user) =>
{
    // validation (ASP.NET chapter): reject bad input at the boundary
    if (dto.Capacity < 1) return Results.ValidationProblem(/* ... */);

    // authZ (Auth chapter): only organizers create events
    // persistence (EF chapter): entity + migration already exist for this slice
    // and a test (below) proves the whole path
})
.RequireAuthorization("Organizer");
```

…plus the `Event` entity, its migration, and a passing test that POSTs and asserts `201`. When
that's green, S3 is *shipped* and you start S4.

Why this beats layers: every slice ends with the project **working**, so motivation and
integration risk both stay under control — you never face a "wire everything together" week,
because everything was wired from slice one. And when you stop early (life happens), you have a
smaller finished product instead of a large broken one.

A sensible slice order for Bookable — dependencies first, hardest logic in the middle where
your energy still is:

```text
Slice 1  S1  register/login (JWT plumbing from the Auth chapter, User entity)
Slice 2  S3  create event (organizer authZ, Event entity)
Slice 3  S2  list/get events (easy win; AsNoTracking reads)
Slice 4  S4  book a ticket  ← the invariants live here; budget the most time
Slice 5  S5+S6  cancel + my-bookings (ownership checks)
```

### The testing pyramid, sized for this project

You know both kinds of test from chapters 06–09; the capstone question is *proportion*. The
pyramid for Bookable:

- **Unit tests (the base — most of them):** pure logic with no HTTP and no real database.
  Prime target: the booking rules. If you extract *"can this user book this event given current
  bookings?"* into a plain method, testing "full event → rejected", "duplicate → rejected",
  "capacity 5, 4 booked → accepted" costs milliseconds each.
- **Integration tests (the middle — roughly one happy path plus the key failures per slice):**
  `WebApplicationFactory` from the ASP.NET chapter — boots the real pipeline (routing,
  validation, auth, EF) in-process and lets tests speak HTTP:

```csharp
public class BookingTests : IClassFixture<WebApplicationFactory<Program>>
{
    [Fact]
    public async Task Booking_a_full_event_returns_409()
    {
        // arrange: seeded event with Capacity = 1 and one existing booking
        var client = _factory.CreateClient();          // real pipeline, in-memory server
        AddJwtFor(client, "second-user@test.dev");

        var response = await client.PostAsync("/events/1/bookings", content: null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }
}
```

- **The tip:** clicking through the deployed app yourself. Necessary, not automated, kept last.

The proportion matters because integration tests are *slow and coarse* — they prove the wiring,
while unit tests prove the logic. A suite that's all integration tests takes minutes and can't
tell you *which* rule broke; all unit tests, and the wiring is unproven. Cover **both
invariants** at both levels: a unit test for the rule, one integration test proving the
endpoint actually enforces it (including the race-loser hitting the unique index → `409`).

Not 100% coverage — *reviewer-trust* coverage: the invariants, the auth boundaries (`401`
without a token, `403` for someone else's booking), and one happy path per slice.

### Wire in CI from day one

You built the pipeline in chapter 09; the capstone habit is starting it at **slice one**, not
the end. Copy your chapter-09 GitHub Actions workflow into the repo before slice 2: every push
runs `dotnet test`, a red pipeline blocks merging. From then on "done" has a mechanical
definition — the pipeline says so — which is exactly the pressure that keeps slices honest.

### Deliverables — phase 2

- [ ] All slices from your spec implemented, in slice order — each one endpoint→validation→
      auth→EF→tests complete before the next began (your commit history should show it).
- [ ] Both invariants enforced where the spec said: unique index for double-booking,
      transactional capacity check — each proven by a unit test *and* an integration test.
- [ ] `async`/`await` on every I/O path; `AsNoTracking` on reads; no N+1 in the events list.
- [ ] CI green on every push since slice one.

---

## 3. Ship & document

An unshipped capstone is a private repo nobody will ever read. This phase turns working code
into something a stranger can run, judge, and trust — which is the entire point of a portfolio
piece.

**Deploy it** exactly as chapter 09 taught, using whichever host you chose there: multi-stage
Dockerfile, container on a host with a **public HTTPS URL**, config in environment variables, a
**managed database** (not a DB in your app container), and `GET /health` responding. The live
URL is the single most convincing artifact this whole branch produces.

### How to write the README

The README is the first — often only — thing a reviewer reads, so write it for a stranger with
two minutes. Structure it **what / why / run / decisions**, in that order:

```markdown
# Bookable

An event-booking API: organizers publish capacity-limited events; users book
and cancel tickets. No overbooking, no double-booking — enforced at the
database, not by hope.

**Live:** https://bookable.example.dev  ·  **API docs:** /swagger  ·  spec: docs/spec.md

## Run it locally
    docker compose up        # API on :8080, Postgres seeded with demo events
    curl localhost:8080/events

## Design decisions
- Double-booking → unique index on (EventId, UserId): survives races; an
  application-level check alone would not.
- Capacity → transactional check at booking time: can't be an index, so it's
  a serialized read-count-insert.
- JWT over cookie sessions: stateless API, no server session store to scale.

## With more time
Waitlists when full; idempotency keys on booking creation.
```

The ordering is the technique: *what* before *how to run* (nobody runs what they don't
understand), and **decisions with the rejected alternative attached** ("unique index, because
an app-level check loses races") — that one habit is what separates "followed tutorials" from
"engineered this" in a reviewer's eyes. The "with more time" section isn't filler; it shows you
know where the edges are.

### Polish for reviewers

Three cheap upgrades reviewers disproportionately notice:

- **Consistent errors via `ProblemDetails`** — every failure (validation, 404, 409, even
  unhandled exceptions via `AddProblemDetails()` + the exception handler from the ASP.NET
  chapter) returns the same JSON shape. Mixed error shapes read as "assembled from snippets";
  one shape reads as "designed".
- **OpenAPI docs** — the Swagger UI from chapter 06, live at `/swagger` on the deployed URL, so
  your endpoints table from phase 1 is now interactive and self-verifying.
- **Seed data** — a few demo events and a demo login created on startup in Development. A
  reviewer who hits an empty API bounces; one who can book a ticket in 30 seconds stays.

### Code review hygiene (your repo is the interview)

Before calling it done, review the repo the way a stranger will:

- **Commit history tells the story.** Small commits with messages naming the change and the
  slice — `Slice 4: enforce capacity in a transaction (S4)` — not `wip`, `fix`, `asdfg`. If
  your history is a mess, an interactive-free cleanup is fine on a solo project; the point is
  that history is *readable*, because reviewers do read it.
- **No secrets in git — ever, including history.** Grep for connection strings and JWT keys;
  config comes from the environment (chapter 09). A leaked secret in commit 3 is still leaked.
- **Dead code deleted, not commented out.** Git remembers; your reviewer shouldn't have to.
- **Names match the domain.** The spec says *Event*, *Booking*, *capacity* — the code should
  say exactly those words, not `Item`, `Record2`, `max`.
- **Self-review pass:** read your own diff top to bottom, out loud if needed, as the last step.
  Everything that makes you pause — a `TODO`, a magic number, an unexplained `!` — will make a
  reviewer pause longer. Fix it or comment *why* it's right.

### What "done" means

Bookable is done when a stranger can: read the README and understand it in two minutes, click
the live URL and book a ticket against seed data, browse `/swagger`, read the code without
wincing, and watch the tests prove the invariants. At that point you haven't finished a course
exercise — you've **built and shipped software**, which is precisely the thing the previous
nine chapters existed to make possible.

### Deliverables — phase 3

- [ ] Public HTTPS URL serving the app, backed by a managed database, `GET /health` green.
- [ ] README in the what/why/run/decisions structure, live URL at the top, decisions listing
      the rejected alternatives.
- [ ] `ProblemDetails` everywhere, `/swagger` live, seed data so the demo works in 30 seconds.
- [ ] Repo passes the hygiene list: readable history, zero secrets, no dead code, domain names.

---

## Check yourself

One honest yes/no per topic — about *your* Bookable, not the examples on this page:

1. Does a one-page spec exist in your repo with an explicit out-of-scope list, an endpoints
   table with auth and failure columns, and both invariants written down *with* where each is
   enforced — and did you write it before the first line of code? If yes, tick
   *Spec & design* above.
2. Was every story built as a complete vertical slice with CI green since slice one — and do
   both invariants have a unit test for the rule *and* an integration test proving the endpoint
   enforces it? If yes, tick *Build & test* above.
3. Can a stranger, starting from only your README, understand the app in two minutes, hit the
   live HTTPS URL, book a ticket against seed data, and find only one error shape and zero
   secrets in your repo? If yes, tick *Ship & document* above.

All three ticked? Tick the chapter. Then two gates remain, and they're different beasts: take
**checkpoint cp10** to prove the backend skills hold up cold, and hand the repo to the
**project defense p3** — the "defend your code" oral, where every decision in your README's
decisions section gets a *"why this and not the alternative?"*. If you made each decision
yourself as you built, that defense is a conversation, not an interrogation. (See the
*Checkpoints & Defenses* page for how both work.)
