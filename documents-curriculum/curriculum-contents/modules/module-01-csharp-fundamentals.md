# Module 01 — C# Fundamentals

**Days:** 5 · **Checkpoint:** `04-checkpoints/cp1.md` · **Practice folder prefix:** `02-practice/m01-…`

## Mission brief

You're not learning to program; you're learning where C# *differs* from what you know. C# is "Java with better ergonomics and value types" — your Java model transfers ~80%, your C model explains the other 20% (structs, stack vs heap, `ref`/`out`). Professionally this module matters because interviewers screen on language fluency in the first 10 minutes, and "Java written in C#" (getters/setters, ignored nullability) is the instant junior tell.

**Bridges:** properties replace Java getX/setX · `var` is statically typed (not JS `let`) · string interpolation ≈ JS template literals · structs ≈ C structs (copied by value) · `ref`/`out` will feel like C pointers, minus the arithmetic.

**Your toolchain (2026):** **.NET 10** is the current LTS (supported into 2028); the language is **C# 14**. Everything in this program targets it — `<TargetFramework>net10.0</TargetFramework>`. Nullable reference types and implicit usings are on by default. You don't need C# 14's newest features to be hired, but keep an eye on the ones that cut boilerplate (e.g. the `field` keyword in properties, extended collection expressions) as they show up — learn the fundamentals first, the sugar second.

Reference source for all "read" tasks: Microsoft Learn C# documentation (learn.microsoft.com/dotnet/csharp). Read *only* the page for the task at hand, then close it and build.

---

## Day blocks

### Day 1 — Types, the value/reference split
- [ ] Read: built-in types + structs vs classes (20 min max). Then **build** `m01-d1-typelab/`: a console app that demonstrates, with printed evidence, (a) a `struct Point` assigned to a second variable and mutated — original unchanged; (b) the same as a `class` — original changes; (c) what `==` means for each.
  - **Done-when:** the program's output alone would convince a skeptic of the copy-vs-reference difference.
- [ ] **Build:** a `record Money(decimal Amount, string Currency)` and show value-based equality vs a class's reference equality.
- [ ] ⭐ Stretch: demonstrate boxing — put a struct in an `object`, explain in a printed comment line what allocation just happened.
- [ ] Close-out: add "value vs reference types" to REVIEW-QUEUE (explain-aloud, due tomorrow).

### Day 2 — Nullability, strings, pattern matching
- [ ] **Build** `m01-d2-nullsafe/` with `<Nullable>enable</Nullable>` (default since .NET 8; you're on **.NET 10 / C# 14**): a function `string Describe(string? input)` that compiles with **zero warnings** while handling null, empty, whitespace, and long inputs differently — using a `switch` expression with patterns, not if-chains.
  - **Done-when:** zero compiler warnings AND a `switch` expression with at least one property pattern and one relational pattern.
- [ ] **Build:** read a text file, count word frequencies with a `Dictionary<string,int>`, print top 10 with string interpolation and alignment (`{word,-15}`).
- [ ] ⭐ Stretch: same program with `StringBuilder` for output; explain aloud why `+=` on strings in a loop is O(n²).

### Day 3 — Methods, parameters, the C-flavored corner
- [ ] **Build** `m01-d3-params/`: implement `bool TryParseDuration(string s, out TimeSpan result)` (the Try-pattern — used everywhere in .NET); a method with `ref`; a method with optional + named parameters; an extension method `string.Truncate(int max)`.
  - **Done-when:** all four compile and are exercised from Main with printed proof; you can say aloud when Try-pattern beats throwing.
- [ ] **Build:** tuples — a method returning `(int min, int max, double avg)` over an array; deconstruct it at the call site.

### Day 4 — Errors, IO, project hygiene
- [ ] **Build** `m01-d4-robustcli/`: a CLI that takes a file path argument and prints stats; handles missing file, unreadable file, and bad args with specific exit codes and messages — `catch` specific exception types only, never bare `catch`.
  - **Done-when:** `./app missing.txt; echo $?` shows your documented nonzero code; no `catch (Exception)` in sight except one top-level handler.
- [ ] **Build:** add an xUnit test project (you did this in phase 0); write 5 tests for Day 3's `TryParseDuration`, including the failure cases.
- [ ] ⭐ Stretch: a custom exception type with context data, and a test asserting it's thrown (`Assert.Throws`).

### Day 5 — Mini-project day (see below) + drills cold
- [ ] Build the mini-project.
- [ ] Run all module drills cold (no reference). Any fail → REVIEW-QUEUE stage 1.

---

## Coding drills (repeatable — copy the best to `02-practice/katas/`)

Do each from an empty file. "Cold" = no docs, no past code, <10 min each.

1. **struct-vs-class**: write a struct and a class with the same field; demonstrate the copy difference in 15 lines.
2. **null-gauntlet**: `string Summarize(Person? p)` where `Person` has nullable members — compile warning-free with `?.`, `??`, and one pattern match.
3. **try-pattern**: implement `bool TryDivide(int a, int b, out double result)` + 3 xUnit tests.
4. **switch-shapes**: switch expression mapping `(category, amount)` tuples to a label, with relational + discard patterns.
5. **freq-count**: top-N word frequency from a string, Dictionary only (no LINQ yet — that's the point).

## Practical exercises — done-when criteria are in the day blocks above. No exercise counts without compiled, run, observed output.

## Mini-project — "C-to-C# port"

Take a small C program you have written before (100–300 lines: a parser, a game, a data tool — pick the first one you find, don't shop around). Port it to **idiomatic** C#.

**Acceptance criteria:**
- [ ] No `getX()/setX()` methods — properties. No public fields.
- [ ] Nullable enabled, zero warnings.
- [ ] At least one record, one switch expression, one Try-pattern method.
- [ ] Errors via typed exceptions or Try-pattern — no C-style return-code checking.
- [ ] 5+ xUnit tests on the core logic.
- [ ] A 10-line README section: "3 things C# let me delete from the C version."

## Common mistakes checklist (run against your own code before cp1)

- [ ] Java-isms: `getFoo()/setFoo()`, public fields, `throws`-style thinking.
- [ ] Ignored nullable warnings (or worse, `!` slapped on until they stop).
- [ ] String concatenation in loops.
- [ ] `catch (Exception)` everywhere / swallowed exceptions.
- [ ] `==` on objects expecting value equality (or on structs without understanding why it works).
- [ ] Mutable public structs (a famous C# footgun).
- [ ] `var` confusion: thinking it's dynamic typing.

## Mastery checkpoint — cp1 (mirror: `04-checkpoints/cp1.md`)

**Timed: 2 hours, from `dotnet new console`, docs allowed, AI/own-code not.**
Build `logstat`: a CLI that reads a web-server-style log file (`TIMESTAMP LEVEL MESSAGE` lines, some malformed) and prints: count per level, the 5 most common words in ERROR messages, and the time span covered.
**Pass criteria (all mandatory):** parses with a Try-pattern method · record for the parsed line · switch expression somewhere meaningful · malformed lines counted and reported, never crash · nullable enabled, zero warnings · 5+ passing xUnit tests · specific exit codes for missing/unreadable file.

## Interview relevance

Prepares you for: value vs reference types (top-5 C# question), nullability, string immutability, records, "how is C# different from Java/C". Recruiter expectation at junior level: *idiomatic* C# — they read your code samples for exactly the mistakes-checklist items above.

## Integration notes

Everything here is load-bearing later: records become your API DTOs (module 06), Try-pattern and typed exceptions become your validation/error-handling style (module 06), nullable annotations become your EF model contracts (module 07). The freq-count drill becomes trivial with LINQ in module 04 — you'll rewrite it and feel the difference.
