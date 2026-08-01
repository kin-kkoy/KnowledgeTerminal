# Module 03 — Collections + Generics

**Days:** 4 · **Checkpoint:** `checkpoints/cp3.md` · **Prefix:** `02-practice/m03-…`
**Side-quest unlock:** start the LeetCode log (`06-interview/leetcode-log.md`) — 2–3 problems/week from here on, in C#.

## Mission brief

Collections are where coding interviews live, and generics are where C# beats Java: they're *reified* (real at runtime, no erasure) and work with value types without boxing — say that sentence in an interview and you've differentiated yourself. Professionally: choosing `Dictionary` vs `List` correctly is the difference between O(1) and O(n) in a hot path, and knowing which interface to *expose* (`IEnumerable` vs `IList`) is API-design literacy that reviewers check in PRs.

**Bridges:** `List<T>`≈`ArrayList`, `Dictionary<K,V>`≈`HashMap`, `HashSet<T>`≈`HashSet` — Java names, C# ergonomics · JS objects/Map → Dictionary · C arrays → `T[]` still exists and is still fastest.

---

## Day blocks

### Day 1 — The big four + complexity
- [ ] **Build** `m03-d1-bench/`: micro-benchmark (Stopwatch is fine) — `List.Contains` vs `HashSet.Contains` vs `Dictionary.ContainsKey` at 10³/10⁵/10⁷ elements; print a table.
  - **Done-when:** your printed table shows the O(n) vs O(1) cliff and you can explain *why* (hashing → bucket) without notes.
- [ ] **Build:** a de-duplication tool: read lines, output unique lines preserving first-seen order. (Correct answer uses two structures — figure out why one isn't enough.)
- [ ] ⭐ Stretch: `Queue<T>`/`Stack<T>` — bracket-matching validator (a LeetCode classic) with tests.

### Day 2 — Dictionary internals + the equality contract
- [ ] **Build** `m03-d2-equality/`: use your `Money` record as a Dictionary key (works — why?). Then write a *class* key without `Equals`/`GetHashCode` and watch lookups fail; fix by overriding both.
  - **Done-when:** you can state the contract (equal objects ⇒ equal hash codes) and what breaks when a key mutates after insertion — demonstrate that bug live.
- [ ] **Build:** group a list of transactions into `Dictionary<string, List<Transaction>>` by category, manually (this is `GroupBy` by hand — module 04 will collapse it to one line).
- [ ] ⭐ Stretch: implement `IComparer<T>` + `List.Sort` with multi-key ordering.

### Day 3 — Writing generics
- [ ] **Build** `m03-d3-generic/`: `Result<T>` type (`Ok(T)`/`Fail(string)`, no exceptions) with `Map` and `Match` methods. Then a generic `InMemoryRepository<T> where T : IEntity` (`IEntity` has `int Id`) with Add/GetById/GetAll/Remove.
  - **Done-when:** repository compiles against two unrelated entity types; tests cover both; you can explain what `where T : IEntity` buys over `object`.
- [ ] **Build:** a generic `Paginate<T>(IEnumerable<T> src, int page, int size)` returning items + total count. (You will ship this exact function in p2.)
- [ ] ⭐ Stretch: `where T : struct` vs `where T : class` — make something that only compiles for one.

### Day 4 — Mini-project + drills cold
- [ ] Build the mini-project; drills cold; 2 LeetCode easies (hash map tag) in C#.

---

## Coding drills

1. **two-sum**: the classic, Dictionary one-pass, <10 min cold.
2. **dedup-ordered**: unique-preserving-order, <8 min.
3. **group-by-hand**: list → `Dictionary<K, List<V>>`, <8 min.
4. **generic-swap-max**: write `T Max<T>(IEnumerable<T>) where T : IComparable<T>`, <8 min.
5. **bracket-match**: Stack-based validator, <12 min.

## Mini-project — "LRU cache + repository"

An `LruCache<TKey, TValue>` with capacity, O(1) Get/Put, evicting least-recently-used (Dictionary + LinkedList — the canonical design). Then wrap module's `InMemoryRepository<T>` with a `CachedRepository<T>` that uses it (decorator pattern — composition from module 02, applied).

**Acceptance criteria:**
- [ ] Get/Put are O(1) — justify in a comment with the data-structure reasoning.
- [ ] Eviction order proven by tests (fill, touch, overflow, assert evictee).
- [ ] `CachedRepository<T>` passes the same test suite as the raw repository (write the suite once, run against both — generics + interfaces paying off).
- [ ] Thread-safety explicitly declared out of scope in the README line (knowing the boundary is the skill; module 05 revisits).

## Common mistakes checklist

- [ ] Linear `List.Contains` inside a loop (accidental O(n²)) — grep your own code for it.
- [ ] Exposing `List<T>` in public APIs where `IEnumerable<T>`/`IReadOnlyList<T>` belongs.
- [ ] Mutable class as Dictionary key, or key mutated after insert.
- [ ] Modifying a collection while `foreach`-ing it (InvalidOperationException — know it on sight).
- [ ] `GetHashCode` overridden without `Equals` (or vice versa).
- [ ] Premature `ToArray()`/`ToList()` copies scattered around.

## Mastery checkpoint — cp3

**Timed: 2 hours, from scratch, docs allowed, AI/own-code not.**
Build a generic `PriorityTaskQueue<T>`: enqueue with integer priority, dequeue highest-priority FIFO-within-priority, O(log n) or better justified in writing, plus `TryDequeue` (Try-pattern), and a generic constraint making `T` displayable (`where T : IDescribable`, your interface).
**Pass criteria:** complexity justification written and correct · FIFO-within-priority proven by a test · Try-pattern correct on empty queue · suite of 8+ tests passes · works with two different `T`s · afterwards, explain aloud why .NET's `PriorityQueue<TElement,TPriority>` exists and how yours differs (look it up *after* time stops).

## Interview relevance

This module is 60% of technical screens: complexity of core operations, hash map internals, two-sum-genre problems, "what collection would you use for X". Plus the C# differentiators: reified generics, constraints, the equality contract. Recruiters expect: instant collection choice with a complexity reason attached.

## Integration notes

`Paginate<T>` ships in p2's list endpoints (module 06). `InMemoryRepository<T>` *is* p2's first data layer until EF Core replaces it in module 07 — same interface, swapped implementation: that's the dependency-inversion payoff, planned three modules ahead. `Result<T>` becomes your service-layer return style. LRU thinking returns when you add caching to the capstone.
