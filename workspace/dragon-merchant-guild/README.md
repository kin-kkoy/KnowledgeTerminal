---
title: Dragon Merchant Guild
kind: orientation
summary: >-
  What lives where in this workspace, and which document to open when.
---

# Dragon Merchant Guild

A long-term project with two halves that only make sense together:

- a **curriculum** that takes you from C-fluent to job-ready C#/.NET, and
- a **game** — a console merchant guild simulation where dragons replace
  machinery — that exists so every concept learned has somewhere to land.

The game is not the end goal. It is the vehicle. When gameplay and learning
conflict, learning wins. See [[project-charter]].

## Start here

**[[PROGRESS]]** — every day, without exception. It holds the TODAY pointer and
nothing else requires a decision.

## What lives where

| Folder | What it holds |
|---|---|
| `curriculum/chapters/` | **The teaching material.** Read this to learn a topic — 22 chapters of prose, the bulk of the writing here |
| `curriculum/plan/` | **What to do today.** Per-module day blocks with build tasks and done-when criteria |

Both are grouped by branch, in the order you take them — `1-core/` is the
mandatory spine, then `2-backend/`, `3-cloud/` and `4-game/` are the three
specialisations. The two files that span every branch, `00-how-to-use` and
`checkpoints-defenses`, stay at the top of `chapters/`.
| `curriculum/checkpoints/` | The ten gates, `cp1`–`cp10` |
| `curriculum/system/` | The protocols: daily, weekly, checkpoint, stuck, difficulty scaling |
| `documentation/` | The project's design canon: charter, game design document, dragon codex, bestiary |
| `roadmap/` | The milestone ladder, each rung gated on a curriculum module |
| `journal/` | The running development log |
| `meeting-minutes/` | Why decisions were made — consult before overturning any |
| `notes/` | Scratch space. Daily notes land in `notes/daily/` |
| `assets/` | Bestiary illustrations |

The two curriculum folders are the pair worth remembering: **`chapters/` is what you
read, `plan/` is what you do.** `curriculum.json` alongside them is the 117-node
skill tree the app reads to track progress.

## The two ladders

They advance together. A milestone does not open until its module is passed.

| Milestone | Gated on |
|---|---|
| 0 — Project Foundation | before Module 01 |
| 1 — Console Prototype | [[module-01-csharp-fundamentals]] |
| 2 — OOP Expansion | [[module-02-oop]] |
| 3 — Collections | [[module-03-collections-generics]] |
| 4 — LINQ | [[module-04-linq]] |

Full ladder: [[implementation-roadmap]]. How the mapping was decided:
[[curriculum-integration-guide]].

## Reading order, if you are returning after a break

1. [[PROGRESS]] — where you actually are
2. [[project-charter]] — why this exists at all
3. [[implementation-roadmap]] — what comes next
4. [[meeting-minutes]] — what was already decided, and why

## Two roadmaps, and they are not the same

Both ladders in the table above have a document, and the names used to collide:

- [[learning-roadmap]] (`curriculum/`) — the **learning** ladder: phases, weeks,
  which modules and checkpoints fall where.
- [[implementation-roadmap]] (`roadmap/`) — the **build** ladder: game milestones,
  each gated on a module.

## A note on the documentation

These documents were converted from the original PDFs, which remain in the source
repository as the record. Each file's frontmatter names the PDF it came from in
its `source:` field.

The AI collaboration guide has two versions, kept together in
`documentation/ai-collaboration/`: [[ai-collaboration-guide]] is current, and
[[ai-collaboration-guide-v1-superseded]] is the original, retained only because
the meeting minutes refer to it.
