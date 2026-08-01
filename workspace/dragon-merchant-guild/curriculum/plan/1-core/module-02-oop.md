# Module 02 — OOP in C#

**Days:** 5 · **Checkpoint:** `checkpoints/cp2.md` · **Prefix:** `02-practice/m02-…`

## Mission brief

You know OOP from Java. This module is about (a) C#'s sharper tools — explicit `virtual`/`override`, interfaces with default members, `sealed`, `init`, records as immutable models — and (b) the *professional* use of OOP: interfaces as seams for testing and dependency injection. Module 06's DI container consumes exactly what you build here; OOP-as-taught-in-school (Animal→Dog) is not what jobs use OOP for.

**Bridges:** Java `@Override` is mandatory-by-keyword here (`override`, and the base must say `virtual`) · Java interfaces ≈ C# interfaces (naming: `IThing`) · there's no `final` — it's `sealed` · C# properties make many Java patterns one-liners.

---

## Day blocks

### Day 1 — Classes done the C# way
- [ ] **Build** `m02-d1-modeling/`: model a `BankAccount` — constructor enforcing invariants, `decimal Balance { get; private set; }`, methods that protect invariants (no negative withdrawal), a `get`-only computed property, an `init`-only `Owner`.
  - **Done-when:** it's impossible to construct or mutate an invalid account from outside the class; 5 tests prove it (including `Assert.Throws`).
- [ ] **Build:** the same model as an immutable `record` with `with`-expressions for state transitions (`account with { Balance = … }`). Write one sentence in code comments: which design fits a multi-threaded system and why.
- [ ] ⭐ Stretch: static factory method (`Account.Open(...)`) vs public constructor — implement both, pick one, justify aloud.

### Day 2 — Inheritance, virtual dispatch, and when not to
- [ ] **Build** `m02-d2-dispatch/`: `Shape` hierarchy (abstract base, `abstract double Area()`, `virtual string Describe()`), 3 shapes, polymorphic list. Then add a method *hidden* with `new` instead of `override` and print the surprise. Delete it and write the lesson as a test name.
  - **Done-when:** you can predict, before running, what `Shape s = new Circle(); s.Describe()` prints under `override` vs `new`.
- [ ] **Refactor:** replace the hierarchy's behavior variance with *composition* — `Shape` takes an `IAreaStrategy`. Feel where inheritance was simpler and where composition is more flexible.
- [ ] ⭐ Stretch: `sealed` the leaves; read aloud why libraries seal by default.

### Day 3 — Interfaces as seams (the employable part)
- [ ] **Build** `m02-d3-seams/`: a `ReportService` that depends on `IClock` and `IReportStore` (interfaces you define), with real implementations (`SystemClock`, `FileReportStore`). Wire by constructor injection — by hand, no container.
  - **Done-when:** `ReportService` has zero `new` calls for its dependencies and zero references to concrete types.
- [ ] **Build:** test `ReportService` with hand-written fakes (`FakeClock` returning a fixed time). No mocking library yet — write the fakes; that's how you learn what mocks are.
  - **Done-when:** a test asserts time-dependent behavior deterministically.

### Day 4 — Polymorphism in anger: a plugin engine
- [ ] **Build** `m02-d4-pipeline/`: a text-processing pipeline — `ITextProcessor { string Process(string input); }`, 4+ processors (trim, censor, capitalize, truncate), a `Pipeline` class running an ordered list of them, configured from a string spec like `"trim|censor:badword|truncate:80"`.
  - **Done-when:** adding a 5th processor requires touching *only* the new class and the factory — nothing else. Tests for each processor + one end-to-end.
- [ ] ⭐ Stretch: load processor configs from a JSON file (`System.Text.Json` — your first taste, it's module 06's bread and butter).

### Day 5 — Mini-project finish + drills cold
- [ ] Complete mini-project acceptance criteria; run all drills cold.

---

## Coding drills

1. **invariant-class**: a class where an invalid state is unrepresentable, in <25 lines + 2 tests.
2. **override-predict**: write base/derived with `virtual`/`override`/`new`; predict 4 call results on paper, then run.
3. **seam-extract**: given a class that calls `DateTime.Now` directly (write it first), extract `IClock` and make it testable, <10 min.
4. **iface-vs-abstract**: implement the same contract both ways; say aloud the two real differences (state/ctor; multiple implementation).
5. **record-with**: model a 3-state order flow with an immutable record + `with`, invalid transitions throwing.

## Mini-project — "Pluggable report engine"

Extend Day 4's pipeline into a small report engine: input = the CSV-ish data from module 01's mini-project; `IReportSection` implementations (summary, top-N, anomalies) compose into a `Report`; output via `IReportRenderer` with two renderers (plain text, markdown).

**Acceptance criteria:**
- [ ] New section or renderer = new class + one registration line, nothing else changes.
- [ ] No `if (type == ...)` dispatch anywhere — polymorphism does it.
- [ ] Service classes take dependencies via constructor; zero hidden `new` of collaborators.
- [ ] Tests: every section tested with fake data; renderers tested by string comparison.
- [ ] One inheritance use and one composition use, each justified in a one-line comment.

## Common mistakes checklist

- [ ] Inheritance for code reuse where composition fits (the #1 junior design smell).
- [ ] God classes — one class that knows everything; no seams, untestable.
- [ ] `new` (hiding) used accidentally where `override` was meant.
- [ ] Interfaces with one implementation *and* no test seam value (interface ≠ ceremony — know why each exists).
- [ ] Public setters everywhere; invariants enforced nowhere.
- [ ] Calling `DateTime.Now`/`File.ReadAllText` deep inside logic — untestable by construction.

## Mastery checkpoint — cp2

**Timed: 2 hours, from scratch, docs allowed, AI/own-code not.**
Spec: build a notification system — `INotificationChannel` (email, SMS, console — fake transports that record sends), a `NotificationService` that takes channels + an `IClock`, supports quiet-hours (no SMS 22:00–07:00, queued instead), and a priority rule (urgent overrides quiet hours).
**Pass criteria:** behavior fully tested with fakes incl. quiet-hours edge at exactly 22:00 · no concrete dependencies inside the service · adding a channel touches no existing class · invalid construction impossible · explain your design aloud in ≤2 min (record yourself).

## Interview relevance

Interface vs abstract class, composition over inheritance, "design a parking lot / notification system" (this checkpoint *is* that genre), why DI, how do you make time-dependent code testable. Recruiters expect juniors to write testable classes — the IClock trick alone has won interviews.

## Integration notes

`IClock`/fakes → exactly how you'll test services in p2 and the capstone. Constructor injection by hand → module 06 replaces your hands with the ASP.NET DI container, same shape. The pipeline pattern → middleware (module 06) is literally this. Records-as-immutable-models → DTOs and EF entities.
