# Module 04 — LINQ

**Days:** 5 · **Checkpoint:** `04-checkpoints/cp4.md` · **Prefix:** `02-practice/m04-…`
**Unlocks:** project **p1** (this module's mini-project IS p1 — move it in `03-projects/PIPELINE.md`).

## Mission brief

LINQ is the single most-asked C# interview topic and the thing you'll write most at work — because in module 07 the *same* operators compile to SQL via EF Core. Learn it as two ideas: (1) `map/filter/reduce` you know from JS, with SQL's vocabulary (`Where/Select/GroupBy/Join`); (2) **deferred execution** — a query is a description, not a result (like a JS generator), and misunderstanding this causes real production bugs you must be able to name.

**Bridges:** `Select`=JS `map` · `Where`=`filter` · `Aggregate`=`reduce` · `SelectMany`=`flatMap` · Java Streams are the same idea with worse ergonomics. You hand-built `GroupBy` in module 03 — today it's one line.

Method syntax only (`x.Where(...)`), not query syntax (`from x in ...`) — method syntax is what codebases use; recognize query syntax, don't write it.

---

## Day blocks

### Day 1 — The core five + pipelines
- [ ] **Build** `m04-d1-core/`: against an in-memory `List<Transaction>` (write a generator for ~1000 fake rows): 10 queries — filters, projections to anonymous types and records, `OrderBy/ThenBy/Take`, `Sum/Average/Count` with predicates, `Distinct`.
  - **Done-when:** each query is one chained expression; zero `foreach` used for anything a query could do; you re-implement module 01's word-frequency drill in 3 lines.
- [ ] **Drill:** rewrite module 03's group-by-hand as `GroupBy` + `ToDictionary`.
- [ ] ⭐ Stretch: `Aggregate` for running balance — then decide aloud if a `foreach` was clearer (sometimes it is — that's a senior answer).

### Day 2 — Deferred execution: the interview day
- [ ] **Build** `m04-d2-deferred/` demonstrating, with printed evidence, four traps: (1) a query over a list, list mutated *after* query definition, query enumerated — results include the mutation; (2) multiple enumeration — a `Where` with a side-effect counter enumerated twice, counter = 2×; (3) the captured-loop-variable/closure trap; (4) `First()` throwing vs `FirstOrDefault()` on empty.
  - **Done-when:** for each trap you can state the production symptom (e.g. "expensive query silently runs twice") and the fix (`ToList()` to materialize — and the cost of doing that too early).
- [ ] **Drill:** `Single` vs `First` vs `FirstOrDefault` — write the one-sentence rule for when each is *correct*, as comments above working examples.

### Day 3 — GroupBy, Join, SelectMany
- [ ] **Build** `m04-d3-relational/`: two lists (`Customers`, `Orders`) — `Join` them; `GroupBy` customer with per-group aggregates (count, sum, max date); `SelectMany` to flatten customers→orders; a `GroupJoin` (left-join shape) including customers with zero orders.
  - **Done-when:** the zero-orders customer appears in your left-join output; you can sketch each operation as the SQL it resembles.
- [ ] ⭐ Stretch: top spender *per month* (GroupBy a composite key — anonymous type or tuple).

### Days 4–5 — Mini-project = p1
Build p1 (below). Day 5 ends with drills cold + moving p1 to "Tested" in the pipeline.

---

## Coding drills

1. **freq-3-lines**: word frequency top-N in ≤3 statements, <5 min.
2. **group-aggregate**: per-category count+sum+avg as a dictionary, <8 min.
3. **deferred-trap**: from memory, write code demonstrating multiple enumeration, <8 min.
4. **left-join**: GroupJoin keeping empty groups, <10 min.
5. **flatten**: nested list → flat projection with parent context (`SelectMany` with result selector), <8 min.

## Mini-project — p1: "CSV expense analyzer" (portfolio item #1)

A CLI: `analyzer report transactions.csv --month 2026-05 --top 5`. Reads real-shaped CSV (date, amount, category, description, account), produces: monthly summary, per-category breakdown with % of total, top-N merchants, month-over-month delta, anomaly list (transactions >3× category average).

**Acceptance criteria:**
- [ ] All analytics in LINQ; parsing via your module 01 Try-pattern style; malformed rows reported, not fatal.
- [ ] Architecture: `Parser` / `Analyzer` (pure, fully unit-tested) / `Renderer` — module 02 seams.
- [ ] 12+ tests; the anomaly rule has edge-case tests (empty category, single transaction).
- [ ] Materialization deliberate: parse once to a `List`, queries over it — a comment explains why.
- [ ] README with sample output. Pipeline: move p1 → Tested → Documented (CLI skips Docker columns).

## Common mistakes checklist

- [ ] `ToList()` reflexively after every query (kills deferred composition) — or never (multiple enumeration).
- [ ] `Count() > 0` instead of `Any()`.
- [ ] `Where(...).First()` chains that should be `FirstOrDefault` + null handling.
- [ ] Side effects inside `Select`/`Where` lambdas.
- [ ] A 5-operator chain where a `foreach` reads better — LINQ is for clarity, not golf.
- [ ] Filtering after materializing ("`ToList()` then `Where`") — harmless here, fatal with EF in module 07. Build the habit now.

## Mastery checkpoint — cp4

**Timed: 90 min, closed-book (no docs — LINQ must be in your fingers), from scratch.**
Given a dataset spec (orders + customers + products, you generate fake data first, ~15 min budget), implement 12 listed query tasks: 3 filters/projections, 3 aggregations, 2 joins (one left), 2 GroupBy with composite keys, 1 SelectMany, 1 deliberately-trapped deferred-execution question where you must predict output *before* running.
**Pass criteria:** 10/12 correct on first run · the deferred-execution prediction correct · zero `foreach` where an operator exists · finished inside 90 min.

## Interview relevance

"Explain deferred execution" and "IEnumerable vs IQueryable" are near-guaranteed in C# interviews (the second completes in module 07). Live-coding screens routinely say "now give me total per category" — drill 2 *is* that question. Recruiter expectation: LINQ fluency is treated as the proxy for overall C# fluency.

## Integration notes

Every LINQ operator here becomes a SQL clause in module 07 — `Where`→WHERE, `Select`→SELECT, `GroupBy`→GROUP BY, your left-join→LEFT JOIN — and the materialize-too-early mistake becomes the "filters in C# instead of SQL" production bug. p1 is your first pipeline-complete portfolio item and your first résumé bullet (harvest it).
