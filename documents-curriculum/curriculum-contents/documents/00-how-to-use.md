# How to Use This Book

This is a **tutorial**, not a companion. Each chapter *teaches* its subject from the ground
up — read it, run the code in **Study**, and you should come out the other side able to use
the thing without googling or asking an AI to fill gaps. The **Atlas** tab is the matching
syntax reference for when you need exact forms later; the **Map** tab tracks your progress.

## Who this is written for

Someone who **already programs** — you've written C, you know what variables, loops, functions,
structs and the stack are — but who is learning C# properly for the first time. So:

- **Everything is taught in C# terms, from scratch.** No chapter assumes you remember how
  another language did it. If a concept is new (properties, generics, LINQ, `async`), it gets a
  real explanation, not a "you know this from X" hand-wave.
- **C shows up only in optional asides**, marked like this:

  > **C corner:** where a C intuition genuinely helps (pointers → references, `struct` → value
  > types), it appears in a block like this one. If your C memory is fuzzy, skip these freely —
  > nothing later depends on them.

- The pace is *experienced programmer*, not *first programmer*: we don't explain what an `if`
  is, but we do explain every piece of C# the moment it first appears.

## The deal this book makes with you

- **No dangling references.** Every type, method or term used in a snippet is explained on the
  page (or explicitly pointed at the Atlas or an earlier chapter by name). You should never
  need to leave the app to understand a page.
- **Complete snippets.** Code is runnable as-is in the Study tab and shows its expected
  output, so you can verify understanding without external checks.
- **Why, not just how.** Each concept answers "why does it work this way / when do I reach for
  it / what's the alternative" — the questions that would otherwise send you to a search bar.
- The **AI Tutor** is for clarifying what's on the page (it can see the page you're reading),
  not for filling holes the page left. If you find a hole, that's a bug in the book.
- The one deliberate exception: sections marked **⚠ Fast-moving area** (backend and cloud
  chapters). Tooling and service names there churn; the concepts are taught fully, but verify
  names/versions against current docs before relying on them.

## How to read a chapter

Chapters mirror the Map exactly: **one numbered section per Map topic node**, same titles.
At the top of each page you'll see chips for the node(s) it covers — as you finish a section
honestly, tick its topic; when all topics are ticked, tick the chapter. That's the whole
workflow: read here, tick here (or on the Map — same data).

Inside each section:

1. **The idea** — the concept, taught from zero, with the mental model.
2. **In practice** — complete, runnable C# with its expected output.
3. **Try it — Lab** — a small exercise to do in the Study tab right now.
4. **Traps** — the mistakes that actually happen, so you recognize them later.

Each chapter ends with **Check yourself** — one honest question per topic. If you can answer
it without looking, tick the node. Checkpoints and project defenses (the hexagons on the Map)
are separate, exam-style gates — see *Checkpoints & Defenses*.

## Toolchain

Everything targets **.NET 10 (LTS)** and **C# 14**. Modern defaults apply throughout: nullable
reference types are on, implicit `using`s are on, and top-level statements mean a program can
be just statements in a file — no `class Program { static void Main }` ceremony. The Study tab
runs code the same way: type statements, press Compile & Run, read the output.
