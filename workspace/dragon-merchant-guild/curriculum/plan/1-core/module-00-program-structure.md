# Module 00 — Programs, Classes & Files

**Days:** 2 · **Checkpoint:** none — this module gates nothing · **Prefix:** `02-practice/m00-…`

## Mission brief

This module exists because the rest of the program assumed it. Every later chapter reads a C# file at you and expects you to already know why a line says `public`, what `static` is for, and which file the thing belongs in. Two days here removes the low-grade confusion that would otherwise follow you through five modules.

It is also Milestone 0 of the game: by the end of Day 2 the solution exists, the `Engine` and `GuildConsole` projects exist, they reference each other in the right direction, and the first real class is in the right folder with the right namespace. Nothing after this has to stop and do setup.

**Bridges:** a class ≈ a C struct plus the functions that take a pointer to it · `using` is *not* `#include` — no preprocessor, no headers, no include guards · a namespace ≈ the `guild_` prefix you'd put on every function in a C library, except the compiler manages it · `private` ≈ file-scope `static` in C, but per-type rather than per-file · a static class ≈ a `.c` file of functions plus file-scope variables · a class library ≈ a `.so`.

**Your toolchain (2026):** **.NET 10** (LTS), **C# 14**, `<TargetFramework>net10.0</TargetFramework>`. Nullable reference types and implicit usings are on by default — which is why the book's examples can call `Console.WriteLine` with no `using System;` at the top, and why a real file often has no `using` block at all.

Reference source for all "read" tasks: Microsoft Learn C# documentation (learn.microsoft.com/dotnet/csharp). Read *only* the page for the task at hand, then close it and build.

---

## Day blocks

### Day 1 — Classes, files, visibility
- [ ] Read: chapter sections 1–3 (`chapters/1-core/00-program-structure.md`). Do the three labs as you go, in the Study tab, before moving on.
  - **Done-when:** you predicted each lab's output before running it, and were right — or know exactly why you weren't.
- [ ] **Build** `m00-d1-nouns/`: take five sentences describing a part of the guild the chapter didn't cover (inspectors, morale, or the daily cycle — pick one), underline the nouns, and declare a class per noun with two or three members each. No methods yet.
  - **Done-when:** you can defend every class on the list as a thing with data of its own, and you dropped at least one candidate noun because it turned out to be a verb.
- [ ] **Build:** a `Dragon` class with a private backing field, a clamping property, a get-only property set only in the constructor, an expression-bodied computed property, and one method — then, from top-level statements, try to break each of those protections and read every compiler error you get.
  - **Done-when:** you have deliberately triggered CS0122 (`inaccessible due to its protection level`) and CS0200 (`cannot be assigned to — it is read only`), and can say in one sentence what each was protecting.
- [ ] ⭐ Stretch: add a subclass and prove to yourself that it can reach `protected` members and cannot reach `private` ones.
- [ ] Close-out: add "what does `using` actually do" to REVIEW-QUEUE (explain-aloud, due tomorrow).

### Day 2 — Static, organisation, and Milestone 0
- [ ] Read: chapter sections 4–5. Do both labs.
  - **Done-when:** you proved the static constructor is lazy by observing print order, and can state the one-sentence test for whether something should be static.
- [ ] **Build** `m00-d2-catalogue/`: a static `GuildCatalogue` populated by a static constructor, holding resource definitions across at least three of the game's five categories, with a lookup that returns `null` when nothing matches.
  - **Done-when:** it works without ever being instantiated, and you can explain why `static readonly List<T>` does not stop anyone calling `.Add()` on it.
- [ ] **Build (Milestone 0):** the real solution, from the CLI — no IDE wizard:
  ```bash
  mkdir -p ~/Projects/DragonMerchantGuild && cd ~/Projects/DragonMerchantGuild
  dotnet new sln -n DragonMerchantGuild
  dotnet new classlib -o Engine
  dotnet new console  -o GuildConsole
  dotnet sln add Engine GuildConsole
  dotnet add GuildConsole reference Engine
  ```
  Then delete `Engine/Class1.cs`, create `Engine/Models/Dragon.cs` with `namespace Engine.Models`, and have `GuildConsole/Program.cs` create one and print it.
  - **Done-when:** `dotnet run --project GuildConsole` prints your dragon, and you can say why the reference points from the console to the Engine and must never point back.
- [ ] ⭐ Stretch: try adding a reference in the other direction (`dotnet add Engine reference GuildConsole`) and read what the tooling says about the cycle. Then undo it.
- [ ] Close-out: commit Milestone 0. This is the repository every later module builds in.

---

## Coding drills (repeatable — copy the best to `02-practice/katas/`)

Do each from an empty file. "Cold" = no docs, no past code, <10 min each.

1. **file-skeleton**: from memory, write a complete `.cs` file with usings, namespace, class, private field, constructor, clamping property, computed property and one method. <6 min.
2. **visibility-gauntlet**: a base class and a subclass where exactly one member is reachable at each of the four access levels; prove each with a line that compiles and a commented line that doesn't.
3. **static-catalogue**: a static class with a static constructor populating a list, plus a lookup returning `null` on miss. <8 min.
4. **extract-method**: given a 25-line method with four comments in it, produce a version with no comments and four well-named members. <10 min.
5. **two-projects**: create a solution with a library and a console app referencing it, from the CLI, from nothing. <5 min.

## Mini-project — "Milestone 0: the guild opens"

Not a throwaway. This is the repository the rest of the program lives in.

A solution with an `Engine` class library and a `GuildConsole` executable. `Engine` holds `Models/Dragon.cs` and `Factories/GuildCatalogue.cs`. `GuildConsole` holds `Program.cs`, which creates two dragons, sends one on a shift, looks up a resource in the catalogue and prints the state of the guild. All game rules live in `Engine`; all printing lives in `GuildConsole`.

**Acceptance criteria:**
- [ ] `dotnet run --project GuildConsole` works from a clean clone.
- [ ] `Engine` contains no `Console.` anywhere — grep it and prove it.
- [ ] Every file declares a namespace matching its folder, and is named after the one public class it holds.
- [ ] Every field is private; everything public is a property or a method, and you can justify each one being public.
- [ ] `GuildCatalogue` is static, populated by a static constructor, and never instantiated.
- [ ] Committed to git with a README saying how to run it.

## Common mistakes checklist

- [ ] A public field anywhere.
- [ ] Two public classes in one file, or a file named differently from its class.
- [ ] A namespace that doesn't match its folder.
- [ ] `Console.WriteLine` inside `Engine`.
- [ ] Static used for something you'd ever want two of (gold, rest, inventory, the guild itself).
- [ ] `static readonly` on a collection, believed to be immutable.
- [ ] A method long enough to need comments marking out its steps.
- [ ] Widening something to `public` to make an error go away, rather than asking why the caller wanted it.

## Mastery check — no checkpoint

This module has no gate. The proof is Milestone 0 existing and running, and being able to open any file in it and explain every keyword on every line without hedging. If you can't, re-read the section that keyword came from before starting m01 — nothing later gets easier by leaving it.

## Interview relevance

Low on its own, foundational underneath everything else. No one asks "what is a namespace", but "walk me through how you'd structure this project" is a standard senior screening question, and the Engine/front-end split with a one-way dependency is the answer to it. `static` shows up directly: "when would you use a static class, and what's the risk?" is common, and the shared-state answer is the one interviewers are listening for.

## Integration notes

Every later module builds in the repository created here. m01 fills in `Engine/Models` with real types; m02 turns `Dragon` into a base class with real subclasses and moves the catalogue behind interfaces; m03's collections become the roster and the warehouse; m04's LINQ queries the contract board. The Engine/front-end split made on Day 2 is what lets the console app be joined later by Terminal.Gui and Avalonia front-ends without the game logic being touched.
