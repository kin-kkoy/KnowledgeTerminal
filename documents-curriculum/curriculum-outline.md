# AndastandC# — Curriculum Outline

Source: `facet-app/public/curriculum/curriculum.json` (v2.0, .NET 10 LTS / C# 14), expanded for the
Core chapters from the module docs in `facet-app/public/curriculum/modules/`.

The C# Core chapters below are broken down day-by-day with the exact language constructs each
topic introduces — see also the **Construct unlock index** at the end of Part 1, which lists every
notable construct against the first topic where it appears.

The Map has four branches: **C# Core** (the shared spine), then three specializations —
**Backend / Web .NET**, **Cloud & DevOps (Azure)**, and **Game Dev (C#)**. Big nodes are
chapters (modules), small nodes are topics (day-blocks), diamonds are crossroads, hexagons
are checkpoints and project defenses.

---

# Part 1 — Chapters & Topics

## Branch: C# Core

The mandatory spine. Everything else assumes it. Each chapter below lists its topics with the
exact constructs introduced, the day it lands on, and what the learner can build once it's theirs.

---

### m01 — C# Fundamentals *(5 days)*
Where C# differs from C/Java: value vs reference types, nullability, patterns, the Try-pattern.
This is what interviewers screen on in the first 10 minutes. The framing is deliberately *not*
"learn to program" — it's "port your existing C/Java model onto C#'s type system."
Cert alignment: Foundational C# (free, Microsoft × freeCodeCamp).

#### m01-t1 — Value vs reference *(Day 1)*
The memory model, first and hardest. A `struct` is copied on assignment, a `class` is shared;
that single fact explains stack vs heap, what `==` means for each, and what boxing costs.

- **Constructs introduced:** `struct`, `class`, assignment/copy semantics, stack vs heap, reference
  equality vs value equality, `==` overloading behaviour, boxing/unboxing, `record` (first sighting,
  via `record Money(decimal Amount, string Currency)`), `var`, built-in types (`int`, `decimal`,
  `string`, `bool`), string interpolation.
- **What gets built:** a "typelab" console app that *prints evidence* — a struct assigned to a second
  variable and mutated (original unchanged), the same as a class (original changes), and what `==`
  reports for each. Plus a `Money` record showing value equality against a class's reference equality.
- **Stretch:** demonstrate boxing by putting a struct into an `object` and narrating the allocation.
- **Mechanic hook:** this is the first topic where "two things that look identical behave differently"
  — copies vs shared references, i.e. clones vs links.

#### m01-t2 — Nullability & patterns *(Day 2)*
Null is a compiler-tracked property of a type, not a runtime surprise. Pattern matching replaces
if-chains as the default branching tool.

- **Constructs introduced:** nullable reference types (`string?`, `<Nullable>enable</Nullable>`),
  null-conditional `?.`, null-coalescing `??`, the null-forgiving `!` (and why leaning on it is a
  smell), `switch` **expressions**, constant/relational/property patterns, the discard `_`,
  `Dictionary<string,int>` (first use — as a word-frequency counter, *before* the collections
  chapter formalizes it), `StringBuilder`, string immutability and why `+=` in a loop is O(n²),
  composite format alignment (`{word,-15}`).
- **What gets built:** `Describe(string? input)` compiling with **zero** nullable warnings while
  handling null / empty / whitespace / long inputs — via one switch expression containing at least
  one property pattern and one relational pattern. Plus a word-frequency counter over a text file
  using a raw `Dictionary` (no LINQ — that's the point; LINQ collapses it in m04).
- **Mechanic hook:** "the value might not be there" becomes checkable at design time. Also the first
  branching-by-shape construct — patterns are a natural fit for state/condition mechanics.

#### m01-t3 — Methods & the C-corner *(Day 3)*
The parts of C# that feel like C: parameter passing by reference, and the .NET-wide convention for
failure without exceptions.

- **Constructs introduced:** the **Try-pattern** (`bool TryParseDuration(string s, out TimeSpan result)`),
  `out` parameters, `ref` parameters, optional parameters (defaults), named arguments,
  **extension methods** (`string.Truncate(int max)`), value tuples with named elements
  (`(int min, int max, double avg)`), tuple deconstruction at the call site, expression-bodied members.
- **What gets built:** all four forms in one app — a Try-parse method, a `ref` method, a method with
  optional + named parameters, and an extension method — each exercised from `Main` with printed
  proof. Plus a min/max/avg tuple-returning method, deconstructed by the caller.
- **The judgement call taught:** when the Try-pattern beats throwing (expected failure vs exceptional
  failure). That distinction is the setup for the next topic.
- **Mechanic hook:** two distinct failure vocabularies — "returns false" vs "throws" — arrive one day
  apart, deliberately contrasted.

#### m01-t4 — Errors & IO *(Day 4)*
**This is where exceptions are formally learned.** Typed exceptions, exit codes, and the first tests.

- **Constructs introduced:** `try`/`catch`/`finally`, catching **specific** exception types
  (`FileNotFoundException`, `UnauthorizedAccessException`, …), why bare `catch (Exception)` is banned
  except as one top-level handler, `throw`, custom exception types carrying context data, process
  exit codes, command-line args, `File.ReadAllText`/file IO basics, and the **first xUnit test
  project** — `[Fact]`, `Assert.*`, `Assert.Throws`.
- **What gets built:** a robust CLI that takes a file path and prints stats, handling missing file,
  unreadable file, and bad args with distinct documented exit codes and messages. Verified with
  `./app missing.txt; echo $?`. Then 5+ xUnit tests over Day 3's `TryParseDuration`, failure cases
  included.
- **Stretch:** a custom exception type with context data plus a test asserting it's thrown.
- **Mechanic hook:** the failure/recovery vocabulary is complete here — typed failure categories,
  cleanup that always runs (`finally`), and exit codes as a "run outcome" signal.

#### m01-t5 — Mini-project: C→C# port *(Day 5)*
Consolidation, not new syntax: take a real 100–300-line C program the learner already wrote and port
it to *idiomatic* C#.

- **Acceptance criteria (all mandatory):** no `getX()/setX()` and no public fields — properties only;
  nullable enabled with zero warnings; at least one record, one switch expression, one Try-pattern
  method; errors via typed exceptions or the Try-pattern, never C-style return-code checking; 5+
  xUnit tests on the core logic; a README section "3 things C# let me delete from the C version."
- **Also on Day 5:** every module drill run cold (<10 min each, from an empty file) —
  struct-vs-class, null-gauntlet, try-pattern, switch-shapes, freq-count.

---

### m02 — OOP *(5 days)*
Not school OOP (Animal→Dog). The professional framing: **interfaces as seams** for testing and
dependency injection, plus C#'s sharper tools — explicit `virtual`/`override`, `sealed`, `init`,
records as immutable models. Module 06's DI container consumes exactly what's built here.

#### m02-t1 — Encapsulation & properties *(Day 1)*
Making invalid state unrepresentable from outside the type.

- **Constructs introduced:** access modifiers (`public`/`private`/`protected`/`internal`),
  auto-properties, asymmetric accessors (`{ get; private set; }`), computed get-only properties,
  `init`-only setters, constructors enforcing invariants, `static` factory methods, immutable
  `record` state transitions via **`with`-expressions**, `decimal` for money.
- **What gets built:** a `BankAccount` where an invalid account is impossible to construct or mutate
  from outside — proven by 5 tests including `Assert.Throws`. Then the *same* model rebuilt as an
  immutable record with `with`-expression state transitions, plus a written comparison of which
  design suits a multi-threaded system.
- **Stretch:** static factory (`Account.Open(...)`) vs public constructor — build both, pick one, justify.
- **Mechanic hook:** rules that can't be broken from the outside; and two ways to "change" a thing —
  mutate it, or produce a modified copy.

#### m02-t2 — Inheritance & polymorphism *(Day 2)*
Virtual dispatch, and — just as important — when *not* to inherit.

- **Constructs introduced:** `abstract` classes and `abstract` members, `virtual`, `override`, `base`
  calls, method hiding with `new` (taught specifically as a trap), `sealed`, polymorphic collections
  (`List<Shape>`), and **composition as the alternative** (`Shape` taking an `IAreaStrategy`).
- **What gets built:** a `Shape` hierarchy — abstract base, `abstract double Area()`,
  `virtual string Describe()`, three shapes, one polymorphic list. Then deliberately hide a method
  with `new` instead of `override`, observe the surprise, delete it, and encode the lesson as a test
  name. Success = predicting what `Shape s = new Circle(); s.Describe()` prints under each, *before*
  running. Then refactor the same variance to composition, feeling both trade-offs.
- **Mechanic hook:** one call, many behaviours, resolved at runtime by the concrete type — plus the
  explicit lesson that inheritance is a poor tool for code reuse.

#### m02-t3 — Interfaces & abstraction *(Day 3)*
**Where interfaces are formally learned** — and framed as the employable skill: seams.

- **Constructs introduced:** `interface` declarations and the `IThing` naming convention, implementing
  multiple interfaces, default interface members, **constructor injection by hand** (no container yet),
  hand-written fakes/test doubles (`FakeClock`), programming against abstractions with zero references
  to concrete types, and the `IClock` pattern for making time-dependent code testable.
- **What gets built:** a `ReportService` depending on `IClock` and `IReportStore` (both learner-defined),
  with real implementations (`SystemClock`, `FileReportStore`), wired by constructor injection.
  Success = `ReportService` contains zero `new` calls for its dependencies and zero concrete-type
  references. Then it's tested with hand-written fakes — no mocking library, deliberately, so the
  learner discovers what a mock *is*.
- **Mechanic hook:** contracts. A type declares what it can do; anything satisfying the contract slots
  in interchangeably — the natural basis for swappable/pluggable systems.

#### m02-t4 — Records & value equality *(Day 4–5)*
Immutable modelling, plus polymorphism applied at scale in a plugin engine.

- **Constructs introduced:** `record` vs `class` in depth, positional records, value-based equality
  semantics, `with`-expressions for state transitions, immutability as a design stance, an ordered
  pipeline of interface implementations, factory-based dispatch replacing `if (type == ...)` chains,
  and a first taste of `System.Text.Json`.
- **What gets built:** a text-processing pipeline — `ITextProcessor { string Process(string input); }`,
  four-plus processors (trim, censor, capitalize, truncate), and a `Pipeline` class running an ordered
  list configured from a spec string like `"trim|censor:badword|truncate:80"`. Success = adding a
  fifth processor touches *only* the new class and the factory.
- **Mini-project:** extend that into a pluggable report engine — `IReportSection` implementations
  (summary, top-N, anomalies) composing into a `Report`, rendered through `IReportRenderer` with two
  renderers (plain text, markdown). Criteria: a new section or renderer = one new class + one
  registration line; no type-checking dispatch anywhere; one use each of inheritance and composition,
  each justified in a comment.
- **Mechanic hook:** ordered, composable, hot-swappable stages — and immutable value objects whose
  identity is their contents.

---

### m03 — Collections & Generics *(4 days)*
Where coding interviews live, and where C# beats Java: generics are **reified** (real at runtime,
no erasure) and work with value types without boxing. Also unlocks the LeetCode log — 2–3 problems
a week in C# from here on.

#### m03-t1 — The core collections *(Day 1)*
**Where `Dictionary`, `HashSet`, `Queue` and `Stack` are formally learned** (a `Dictionary` was used
informally back in m01-t2, and a `List` throughout).

- **Constructs introduced:** `T[]` arrays, `List<T>`, `Dictionary<TKey,TValue>`, `HashSet<T>`,
  `Queue<T>`, `Stack<T>`, complexity (Big-O) of each operation, hashing → bucket lookup as the reason
  for O(1), `Stopwatch` micro-benchmarking, and the API-design question of which interface to *expose*
  (`IEnumerable<T>` / `IReadOnlyList<T>` vs `List<T>`).
- **What gets built:** a benchmark printing `List.Contains` vs `HashSet.Contains` vs
  `Dictionary.ContainsKey` at 10³/10⁵/10⁷ elements — the printed table must show the O(n)-vs-O(1)
  cliff, explained without notes. Then a de-duplication tool preserving first-seen order (the correct
  answer needs *two* structures — working out why is the exercise).
- **Stretch:** a `Stack`-based bracket-matching validator with tests.
- **Mechanic hook:** each structure has a distinct access shape — keyed lookup, membership, FIFO,
  LIFO — and a cost. Choosing wrong is a felt penalty, not an abstract one.

#### m03-t2 — Generics & constraints *(Day 3)*
Writing generic code, not just consuming it.

- **Constructs introduced:** generic types and methods (`Result<T>`, `T Max<T>(...)`), type-parameter
  constraints (`where T : IEntity`, `where T : IComparable<T>`, `where T : struct`, `where T : class`),
  why constraints buy more than `object`, reified generics vs Java erasure, the repository pattern, and
  a discriminated-union-ish `Result<T>` (`Ok(T)` / `Fail(string)`) with `Map` and `Match`.
- **What gets built:** `Result<T>` as an exception-free error channel; a generic
  `InMemoryRepository<T> where T : IEntity` (Add/GetById/GetAll/Remove) that compiles against two
  unrelated entity types; and `Paginate<T>(IEnumerable<T> src, int page, int size)` returning items
  plus total count — a function that ships verbatim in Project 2.
- **Mechanic hook:** one implementation, many concrete types, with compile-time guarantees about what
  those types can do.

#### m03-t3 — Iterators & equality *(Day 2, plus Day 4)*
The equality contract that makes hashed lookups work — and lazy sequence generation.

- **Constructs introduced:** `Equals` / `GetHashCode` and the contract binding them (equal objects ⇒
  equal hash codes), `IEquatable<T>`, custom `IEqualityComparer<T>`, `IComparer<T>` + `List.Sort` with
  multi-key ordering, `IEnumerable<T>`, `yield return` iterators, and the mutable-key bug
  (mutating a key after insertion silently loses the entry).
- **What gets built:** the `Money` record used as a Dictionary key (works — *why?*), then a class key
  without `Equals`/`GetHashCode` whose lookups fail, then fixed by overriding both. The mutable-key
  bug is reproduced **live**. Plus grouping transactions into `Dictionary<string, List<Transaction>>`
  by hand — which m04's `GroupBy` collapses to one line.
- **Mini-project:** an `LruCache<TKey,TValue>` with O(1) Get/Put and least-recently-used eviction
  (Dictionary + LinkedList, the canonical design), then a `CachedRepository<T>` decorating the
  generic repository — composition from m02 applied. The cached and raw repositories must pass the
  *same* test suite. Thread-safety is explicitly declared out of scope (m05 revisits).
- **Mechanic hook:** identity — when are two things "the same thing"? — plus lazy, pull-based
  sequences that produce values only as they're consumed.

---

### m04 — LINQ *(5 days)*
The single most-asked C# interview topic, taught as two ideas: map/filter/reduce with SQL's
vocabulary, and **deferred execution** (a query is a description, not a result). Method syntax only
(`x.Where(...)`) — query syntax is recognized, not written. Unlocks Project 1.

#### m04-t1 — The core five + pipelines *(Day 1)*
**Where lambdas are formally learned**, as the input to every operator.

- **Constructs introduced:** lambda expressions (`x => x.Amount > 100`), `Where`, `Select`, `OrderBy`
  / `ThenBy` / `Take` / `Skip`, `First` / `Single`, `Aggregate`, `Sum` / `Average` / `Count` / `Min` /
  `Max` with predicates, `Distinct`, `Any` vs `Count() > 0`, **anonymous types** (`new { x.Name, Total }`),
  projection into records, `ToDictionary` / `ToList`, and method chaining as a pipeline.
- **What gets built:** ~1000 generated fake `Transaction` rows, then 10 queries — filters, projections
  to anonymous types and records, ordering, aggregations, `Distinct`. Success = every query is one
  chained expression with zero `foreach` where an operator exists, and m01's word-frequency drill
  rewritten in three lines.
- **Stretch:** `Aggregate` for a running balance — then deciding aloud whether a `foreach` was clearer
  (sometimes it is; saying so is the senior answer).
- **Mechanic hook:** behaviour passed around as a value (the lambda), and chained transformations over
  a stream of things.

#### m04-t2 — Deferred execution *(Day 2 — "the interview day")*
The semantics behind the syntax, taught through four reproducible traps.

- **Constructs introduced:** lazy evaluation, query-as-description vs query-as-result, multiple
  enumeration, materialization (`ToList` / `ToArray`) and the cost of doing it too early, closures and
  the captured-variable trap, `First` vs `FirstOrDefault` vs `Single` vs `SingleOrDefault` and when
  each is *correct*.
- **What gets built:** one program demonstrating, with printed evidence, all four traps: (1) a list
  mutated *after* the query is defined but before enumeration — results include the mutation; (2) a
  `Where` with a side-effect counter enumerated twice, counter reads 2×; (3) the captured-loop-variable
  closure trap; (4) `First()` throwing vs `FirstOrDefault()` on an empty sequence. Success = for each
  trap, naming the production symptom *and* the fix.
- **Mechanic hook:** a plan that hasn't run yet, re-evaluated every time it's observed — and the choice
  to freeze it.

#### m04-t3 — GroupBy, Join, SelectMany *(Day 3)*
Relational operators over in-memory objects — the same shapes that become SQL in module 07.

- **Constructs introduced:** `GroupBy` (including composite keys via anonymous types or tuples),
  `IGrouping<TKey,TElement>`, per-group aggregates, `Join`, `GroupJoin` (the left-join shape),
  `SelectMany` with a result selector (flatten while keeping parent context).
- **What gets built:** two lists (`Customers`, `Orders`) joined; grouped by customer with count / sum /
  max-date aggregates; flattened customers→orders; and a `GroupJoin` that **keeps the customer with
  zero orders** — that row appearing in the output is the pass condition. Success also requires
  sketching each operation as the SQL it resembles.
- **Stretch:** top spender *per month* — a composite-key `GroupBy`.
- **Mechanic hook:** bucketing, correlating two sets, and flattening nesting — the three shapes most
  reporting and inventory logic reduces to.

#### m04-t4 — Delegates & events *(Day 3–4)*
**Where delegates and events are formally learned** — placed here deliberately, *after* lambdas have
been used for a day, so the type behind the lambda is revealed rather than introduced cold.

- **Constructs introduced:** `delegate` type declarations, `Func<...>` and `Action<...>`, `Predicate<T>`,
  method-group conversion, multicast delegates, `event` declarations, `EventHandler` / `EventArgs`,
  subscribing and unsubscribing (`+=` / `-=`), the publish/subscribe pattern, and the through-line that
  LINQ operators, callbacks and async continuations are all built on these types.
- **Mechanic hook:** the single most directly game-mechanical construct in the Core spine — "when X
  happens, notify everyone listening." Broadcasting, subscription, and handlers registered at runtime.

#### Days 4–5 — Mini-project = **Project 1**
The p1 CSV expense analyzer (detailed in Part 2) is this chapter's mini-project; Day 5 also runs the
drills cold (word-frequency in ≤3 statements, per-category aggregate dictionary, a from-memory
multiple-enumeration demo, a `GroupJoin` left-join, a `SelectMany` flatten).

---

### m05 — Async / Await *(4 days)*
A hard prerequisite for module 06 — every ASP.NET action written from there on is `async Task<...>`.
The syntax is JavaScript's; the semantics are not: a JS Promise runs on one event loop, a .NET `Task`
may hop real threads from a pool. Blocked threads = dead server.

#### m05-t1 — Tasks & await *(Day 1)*
Mechanics first: what actually happens at an `await`.

- **Constructs introduced:** `Task` and `Task<T>`, `async` / `await`, `await Task.Delay`, async method
  chains, the thread pool and thread hops (`Environment.CurrentManagedThreadId` before/after each
  await), `HttpClient` + `GetStringAsync`, `Task` vs `Thread` (and the ~1MB-stack cost that motivates
  async), `async void` and why its exceptions are unhandleable, the one legitimate `async void` use
  (event handlers — connecting straight back to m04-t4), `ValueTask` (read-only awareness), and the
  IO-bound vs CPU-bound distinction.
- **What gets built:** an async console app printing thread IDs across a three-deep async chain, then
  a real API call. Success = narrating aloud what the thread does during the `Delay` — nothing; it's
  returned to the pool, *no thread waits*. Then all three of `Task<T>` / `Task` / `async void`, with
  an exception thrown in the `async void` one to observe why it can't be caught.
- **Mechanic hook:** work that is in flight but not blocking — started now, resumed later.

#### m05-t2 — Cancellation & parallelism *(Days 2–3)*
Composing many operations, bounding them, and stopping them.

- **Constructs introduced:** `Task.WhenAll`, `Task.WhenAny` (first-response-wins, rest cancelled),
  `AggregateException` and harvesting *all* failures vs partial results, `CancellationToken`,
  `CancellationTokenSource`, **linked** token sources for per-operation timeouts,
  `OperationCanceledException` handled at the top only, cleanup via `finally`, `SemaphoreSlim` for
  bounded concurrency, a single shared `HttpClient` (socket exhaustion), and the async interface
  convention (`Task<T?> GetByIdAsync(int id, CancellationToken ct)` — literally p2's signature).
- **What gets built:** ten URLs fetched sequentially vs with `WhenAll`, both wall-clock times printed
  — success = WhenAll is ~N× faster *and* the learner can explain where the concurrency comes from
  with no extra threads. Then failure semantics: one of the ten throws — what does `WhenAll` throw,
  how do you get every exception, how do you get partial results (all three patterns implemented).
  Then a cancellable pipeline with the token flowing through every level, cancelled from a keypress,
  with cleanup proven to run. Finally, m03's repository interface converted to async.
- **Mechanic hook:** fan-out with a concurrency cap, timeouts, and cooperative cancellation that
  propagates down a whole call tree.

#### m05-t3 — Async gotchas *(Day 3, continued)*
The failure modes, built deliberately rather than described.

- **Constructs introduced:** the `.Result` / `.Wait()` / `GetAwaiter().GetResult()` deadlock and the
  synchronization context that causes it, `ConfigureAwait(false)` in libraries, "async all the way" as
  the real fix, exception flow through async methods, fire-and-forget tasks with unobserved exceptions,
  sequential awaits in a loop over independent work (the silent N× slowdown), decorative cancellation
  (a token accepted but never passed down), and wrapping sync CPU work in `Task.Run` and calling it async.
- **What gets built:** the deadlock itself — a method calling `.Result` on an async method. In a console
  app it sneaks through (no sync context), so the learner writes out where it *does* kill you (classic
  ASP.NET, UI threads) and both fixes. This exact narrative is checkpoint 5 material.
- **Mini-project:** a concurrent site checker — `sitecheck urls.txt --concurrency 5 --timeout 3s` —
  with bounded concurrency proven by logs (≤5 in flight), per-request timeouts via linked token
  sources, graceful Ctrl+C (in-flight requests cancel, the summary still prints), one dead URL unable
  to hang or kill the run, a single shared `HttpClient`, and core logic unit-tested by faking the
  fetch behind an interface (m02 + m05 composing).
- **Mechanic hook:** the whole vocabulary of things going wrong concurrently — stalls, partial
  failure, orphaned work, and abandoned results.

> **Crossroad — SPECIALIZE.** C# fluency proven. The branches aren't either/or; they're a
> separation of concerns to focus on. Backend gets you hired, Cloud makes you deployable,
> Game is where you want to build.

---

## Branch: Backend / Web .NET

### m06 — ASP.NET Core *(8 days)*
Minimal APIs, middleware, DI, model binding & validation, ProblemDetails, OpenAPI. Builds the
skeleton of Project 2.

| Topic | What it covers |
| --- | --- |
| Hosting & minimal API | The host, endpoints, routing, the request pipeline. |
| Middleware & DI | Middleware ordering, service lifetimes (transient/scoped/singleton). |
| Binding, DTOs & validation | Model binding, DTO boundaries, data annotations / FluentValidation. |
| Errors & ProblemDetails | Consistent error responses, exception middleware, RFC 7807. |
| Config, logging, OpenAPI, tests | Configuration, structured logging, Swagger/OpenAPI, integration tests. |

### m07 — SQL + EF Core *(8 days)*
Relational modelling and the ORM on top of it — puts Project 2 on a real Postgres database.

| Topic | What it covers |
| --- | --- |
| SQL foundations | Hand-written SQL: SELECT/JOIN/GROUP BY, aggregates & subqueries, CREATE/ALTER, keys, indexes, transactions — then read the SQL EF Core generates. |
| EF Core modeling & migrations | `DbContext`, entities, conventions, code-first migrations. |
| Querying & relationships | LINQ-to-SQL translation, includes, tracking vs no-tracking, the N+1 problem. |
| Transactions & performance | Unit of work, transactions, query performance, projections. |

### m08 — Auth (N + Z) *(5 days)*
Authe**n**tication and authori**z**ation — locking Project 2 down.

| Topic | What it covers |
| --- | --- |
| Authentication & JWT | Tokens, claims, the auth middleware, the login flow. |
| Authorization | Roles, policies, resource-based authorization. |
| Security hardening | Password hashing, secrets, HTTPS, common OWASP pitfalls. |

### m09 — Deployment *(5 days)*
Getting Project 2 live on the public internet. Bridges into the Cloud branch.

| Topic | What it covers |
| --- | --- |
| Docker & images | Dockerfile for .NET, multi-stage builds, running containers. |
| CI/CD | A GitHub Actions pipeline: build, test, publish. |
| Hosting, HTTPS & monitoring | Deploy target, TLS, health checks, logs and metrics. |

### m10 — Capstone *(4 weeks)*
Repeat the whole arc solo, bigger, against a formal spec — the portfolio centrepiece,
deployed and documented.

| Topic | What it covers |
| --- | --- |
| Spec & design | Write the spec, model the domain, plan the build. |
| Build & test | Implement the vertical slices with tests and CI. |
| Ship & document | Deploy, write the README, polish for reviewers. |

---

## Branch: Cloud & DevOps (Azure)

### c01 — Cloud & Azure Foundations *(4 days)*
Orientation before you deploy anything: the cloud model, portal + CLI, resource groups, RBAC, cost.
Cert alignment: AZ-900 (optional) → AI-200 path.

| Topic | What it covers |
| --- | --- |
| Cloud model & Azure map | IaaS/PaaS/serverless, regions, the service landscape. |
| Portal, CLI & resource model | `az` CLI, resource groups, ARM, tagging. |
| Identity, RBAC & cost | Entra ID basics, role assignments, budgets and cost alerts. |

### c02 — Containers *(4 days)*
Containerize your .NET app properly and push it to a registry — the unit the cloud deploys.

| Topic | What it covers |
| --- | --- |
| Dockerize .NET | Multi-stage Dockerfile, small images, non-root user, healthchecks. |
| Registries (ACR) | Azure Container Registry, tags, pull secrets. |

### c03 — Azure Compute *(5 days)*
Run your app on Azure and pick the right host for it.

| Topic | What it covers |
| --- | --- |
| App Service | Deploying a web API, deployment slots, scaling, config. |
| Azure Functions | Serverless triggers/bindings, the isolated worker, when to use it. |
| Container Apps | Managed containers, ingress, revisions, scale-to-zero. |

### c04 — Storage & Config *(5 days)*
Persist and configure at cloud scale.

| Topic | What it covers |
| --- | --- |
| Blob & Cosmos DB | Object storage, NoSQL modelling, SDK usage from C#. |
| Key Vault & config | Secrets, managed identity, app configuration. |
| Messaging | Service Bus / Storage Queues, async decoupling. |

### c05 — CI/CD & IaC *(5 days)*
Automate everything.

| Topic | What it covers |
| --- | --- |
| GitHub Actions to Azure | Build/test/deploy pipeline, OIDC auth, environments. |
| Infrastructure as Code (Bicep) | Declarative infra, repeatable environments. |
| Monitoring | Application Insights, logs, metrics, alerts. |

### c06 — AI-Integrated Cloud *(5 days)*
Where Azure development is heading. Note: AZ-204 retires 2026-07-31; AI-200 is the successor.
Cert alignment: AI-200 (Azure AI Cloud Developer).

| Topic | What it covers |
| --- | --- |
| Azure OpenAI & AI services | Calling models/services from .NET, prompting, safety. |
| RAG basics | Embeddings, vector search, grounding an API in your own data. |

---

## Branch: Game Dev (C#)

### g00 — C# for Games *(6 days)*
Engine-agnostic foundations, traceable in Facet's lenses.

| Topic | What it covers |
| --- | --- |
| Game loop & delta time | Update/render loop, frame independence, fixed vs variable timestep. |
| Vectors & 2D math | Position/velocity, normalize, dot product, lerp. |
| Input & state machines | Input polling, a simple FSM for game/entity state (idle/run/jump). |
| Collision basics | AABB and circle overlap tests, spatial reasoning. |

> **Crossroad — PICK ENGINE.** Same C#, two engines. Unity = industry standard, biggest job
> market, paid tiers. Godot = free/OSS, great 2D, but C# can't export to web yet. Learn one
> deeply, or both.

### u01 — Unity Basics *(5 days)*
Unity 6 editor, GameObjects, components, the MonoBehaviour lifecycle and C# scripting model.

| Topic | What it covers |
| --- | --- |
| Editor & GameObjects | Scenes, hierarchy, inspector, prefabs. |
| MonoBehaviour lifecycle | `Awake`/`Start`/`Update`/`FixedUpdate`, serialized fields. |
| Physics & input | Rigidbody, colliders, the Input System. |

### u02 — Unity Gameplay *(6 days)*
Build real gameplay, then ship a small game.

| Topic | What it covers |
| --- | --- |
| Gameplay systems | Spawning, scoring, game state, ScriptableObjects. |
| UI & audio | uGUI / UI Toolkit, canvases, audio sources. |
| Build & ship | Player settings, builds, itch.io release. |

### gd01 — Godot Basics *(5 days)*
Godot 4.6 editor, nodes & scenes, the C# (.NET) workflow. Free/OSS and excellent for 2D.

| Topic | What it covers |
| --- | --- |
| Editor, nodes & scenes | The node tree, scenes, the composition model. |
| C# in Godot & signals | The C# workflow, `_Process`/`_PhysicsProcess`, signals. |
| 2D physics & input | `CharacterBody2D`, areas, the input map. |

### gd02 — Godot Gameplay *(6 days)*
Full 2D gameplay, then ship a small game.

| Topic | What it covers |
| --- | --- |
| Gameplay & scene flow | Spawning, scoring, autoloads/singletons, state. |
| UI & audio | Control nodes, themes, audio streams. |
| Export & ship | Export templates, desktop builds (C# web export is N/A). |

---

# Construct unlock index (C# Core)

Every notable construct in the Core spine against the topic where it is **first** taught. Ordered by
when it lands, so anything above a given row can be assumed known at that point.

| Construct | First taught | Chapter · day |
| --- | --- | --- |
| `class`, `struct`, value vs reference, stack/heap, boxing | m01-t1 | m01 · D1 |
| `var`, built-in types, string interpolation | m01-t1 | m01 · D1 |
| `record` (first sighting, value equality) | m01-t1 | m01 · D1 |
| Nullable reference types, `?.`, `??`, `!` | m01-t2 | m01 · D2 |
| `switch` expressions; constant / relational / property patterns; `_` | m01-t2 | m01 · D2 |
| `Dictionary<K,V>` *(informal first use)* | m01-t2 | m01 · D2 |
| `StringBuilder`, string immutability | m01-t2 | m01 · D2 |
| Try-pattern, `out`, `ref` | m01-t3 | m01 · D3 |
| Optional & named parameters | m01-t3 | m01 · D3 |
| Extension methods | m01-t3 | m01 · D3 |
| Tuples + deconstruction | m01-t3 | m01 · D3 |
| **Exceptions** — `try`/`catch`/`finally`, typed catches, `throw` | m01-t4 | m01 · D4 |
| Custom exception types | m01-t4 | m01 · D4 |
| File IO, CLI args, exit codes | m01-t4 | m01 · D4 |
| xUnit — `[Fact]`, `Assert.*`, `Assert.Throws` | m01-t4 | m01 · D4 |
| Access modifiers, auto-properties, `{ get; private set; }` | m02-t1 | m02 · D1 |
| `init`-only setters, computed properties, invariants | m02-t1 | m02 · D1 |
| `with`-expressions, static factory methods | m02-t1 | m02 · D1 |
| `abstract`, `virtual`, `override`, `base`, `sealed` | m02-t2 | m02 · D2 |
| Method hiding with `new` *(taught as a trap)* | m02-t2 | m02 · D2 |
| Composition-over-inheritance refactor | m02-t2 | m02 · D2 |
| **Interfaces** (`IThing`), default interface members | m02-t3 | m02 · D3 |
| Constructor injection (by hand), test fakes, the `IClock` seam | m02-t3 | m02 · D3 |
| Positional records, immutability as design | m02-t4 | m02 · D4 |
| Pipeline of interface implementations, factory dispatch | m02-t4 | m02 · D4 |
| `System.Text.Json` *(first taste)* | m02-t4 | m02 · D4 |
| Arrays, `List<T>`, **`Dictionary`**, `HashSet`, `Queue`, `Stack` (formal) | m03-t1 | m03 · D1 |
| Big-O per operation, hashing → buckets, `Stopwatch` | m03-t1 | m03 · D1 |
| Exposing `IEnumerable<T>` / `IReadOnlyList<T>` in APIs | m03-t1 | m03 · D1 |
| `Equals` / `GetHashCode` contract, `IEquatable<T>` | m03-t3 | m03 · D2 |
| `IEqualityComparer<T>`, `IComparer<T>`, multi-key sort | m03-t3 | m03 · D2 |
| Generic types & methods, `where` constraints | m03-t2 | m03 · D3 |
| `Result<T>` (Ok/Fail, `Map`, `Match`), generic repository | m03-t2 | m03 · D3 |
| `IEnumerable<T>`, `yield return` iterators | m03-t3 | m03 · D3–4 |
| Decorator pattern, LRU cache (Dictionary + LinkedList) | m03-t3 | m03 · D4 |
| **Lambdas**; `Where` / `Select` / `OrderBy` / `First` / `Aggregate` | m04-t1 | m04 · D1 |
| Anonymous types, `ToList` / `ToDictionary`, `Any` | m04-t1 | m04 · D1 |
| Deferred execution, multiple enumeration, closures | m04-t2 | m04 · D2 |
| `First`/`Single`/`FirstOrDefault`/`SingleOrDefault` semantics | m04-t2 | m04 · D2 |
| `GroupBy` (incl. composite keys), `IGrouping<K,E>` | m04-t3 | m04 · D3 |
| `Join`, `GroupJoin` (left join), `SelectMany` | m04-t3 | m04 · D3 |
| **`delegate`**, `Func`/`Action`/`Predicate`, multicast | m04-t4 | m04 · D3–4 |
| **`event`**, `EventHandler`/`EventArgs`, `+=` / `-=`, pub-sub | m04-t4 | m04 · D3–4 |
| `Task`, `Task<T>`, `async`/`await`, thread pool | m05-t1 | m05 · D1 |
| `HttpClient` async calls, `async void`, `ValueTask` | m05-t1 | m05 · D1 |
| IO-bound vs CPU-bound | m05-t1 | m05 · D1 |
| `Task.WhenAll` / `WhenAny`, `AggregateException` | m05-t2 | m05 · D2 |
| `CancellationToken(Source)`, linked tokens, timeouts | m05-t2 | m05 · D3 |
| `SemaphoreSlim` bounded concurrency, shared `HttpClient` | m05-t2 | m05 · D3 |
| Async interface conventions (`…Async`, token param) | m05-t2 | m05 · D3 |
| `.Result` deadlock, sync context, `ConfigureAwait(false)` | m05-t3 | m05 · D3 |
| Async exception flow, fire-and-forget hazards | m05-t3 | m05 · D3 |

### Notes for mechanic design

- **Interfaces (m02-t3) are the earliest "pluggable contract" construct** — anything that needs
  swappable implementations can't be gated earlier than m02 day 3.
- **Exceptions land early (m01-t4)** but the Try-pattern arrives one day *before* them (m01-t3); the
  curriculum deliberately teaches "expected failure" and "exceptional failure" as separate tools.
- **Dictionary is used informally in m01-t2** (word frequency) and taught properly with complexity
  reasoning in m03-t1. A mechanic needing *correct* keyed lookup should gate on m03-t1; one needing
  only "count things by name" can gate on m01-t2.
- **Delegates/events are the latest arrival in the Core spine (m04-t4)** despite being the most
  event-mechanic-shaped construct. Lambdas precede them by two days — if a mechanic only needs
  "pass behaviour as a value", it can unlock at m04-t1.
- **Nothing is concurrent before m05.** Anything involving simultaneous, timed, cancellable or
  interruptible action belongs to the last Core chapter.
- **Generics (m03-t2) gate any "same machine, different cargo" mechanic**, and the equality contract
  (m03-t3) gates anything about two objects counting as the same thing.

---

# Part 2 — Checkpoints, Projects & Capstones

**Checkpoints** are closed-book, timed, no-AI exams gating the next chapter — they prove you can
write the material cold. **Projects** are shipped artifacts followed by a defense: you hand the
work to Claude Code and justify every decision.

## Checkpoints — C# Core

| # | Gates | What you must prove |
| --- | --- | --- |
| Checkpoint 1 | after m01 | Closed-book, timed, no AI. Write idiomatic fundamentals from scratch. |
| Checkpoint 2 | after m02 | Design a small type hierarchy from scratch, under time. |
| Checkpoint 3 | after m03 | Pick the correct data structures and implement generic code cold. |
| Checkpoint 4 | after m04 | Write non-trivial LINQ (GroupBy/Join) from memory. |
| Checkpoint 5 | after m05 | Concurrency exam — build correct async code cold. |

## Checkpoints — Backend

| # | Gates | What you must prove |
| --- | --- | --- |
| Checkpoint 6 | after m06 | Build a small API with DI + validation from scratch. |
| Checkpoint 7 | after m07 | Model, migrate and query a schema cold. |
| Checkpoint 8 | after m08 | Secure an endpoint end-to-end under time. |
| Checkpoint 9 | after m09 | Containerize and deploy a service cold. |
| Checkpoint 10 (rubric) | after m10 | Capstone rubric review — a graded read of the finished capstone rather than a timed exam. |

## Checkpoints — Cloud

| # | Gates | What you must prove |
| --- | --- | --- |
| Cloud Checkpoint 1 | after c03 | Deploy a containerized API to Azure compute from scratch. |
| Cloud Checkpoint 2 | after c05 | Stand up an environment via IaC + pipeline, cold. |

## Checkpoints — Game

| # | Gates | What you must prove |
| --- | --- | --- |
| Unity Checkpoint | after u02 | Build a small complete Unity game from a spec. |
| Godot Checkpoint | after gd02 | Build a small complete Godot game from a spec. |

## Projects & Defenses

### Project 1 — Console Analyzer *(Core, after Checkpoint 4)*
Ship a LINQ-powered console data tool.
**Defense:** explain it to Claude Code — why these queries, and where deferred execution bit you.

### Project 2 — Data-backed API *(Backend, after Checkpoint 8)*
Build a real REST API on Postgres with EF Core — model the schema, migrations, relationships,
transactions — then lock it down with JWT auth.
**Defense:** justify your schema and indexes, and show Claude Code where you killed N+1.

### Project 3 — Capstone Defense *(Backend, after Checkpoint 10)*
The big one, built across module 10's four weeks: spec → build & test → ship & document.
**Defense:** hand the repo to Claude Code — explain every architectural choice like I'm 5, and
justify why *not* the alternatives.

### Cloud Cert Track *(Cloud, after c06)*
A guidance node rather than a build: AZ-204 (retires 2026-07-31) → AI-200.
**Defense:** hand your deployed cloud project to Claude Code and justify every service choice.

### Unity Game Defense *(Game, after Unity Checkpoint)*
Ship a small Unity game.
**Defense:** explain your architecture and the reasoning behind it to Claude Code.

### Godot Game Defense *(Game, after Godot Checkpoint)*
Ship a small Godot game.
**Defense:** explain your architecture and the reasoning behind it to Claude Code.
