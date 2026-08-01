# C#/.NET — Learning Operating System

A self-contained training program taking you from C-fluent CS student to job-ready C#/.NET backend developer in ~14–18 weeks.

## The one rule

**Every day, open `PROGRESS.md`.** It points to today's day block in the active module. Do what the block says. Nothing else requires a decision.

## How a day works

Follow `system/daily-protocol.md` exactly:

1. **OPEN** (2 min) — `PROGRESS.md` → TODAY pointer → open that module/day block.
2. **WARM-UP** (10 min) — do the due items in `05-review/REVIEW-QUEUE.md` (redo a drill cold, or explain a topic aloud).
3. **MAIN** (60–90 min) — execute the day block's tasks *in order*. All code goes in `02-practice/` or the active project in `03-projects/`. You always code; you never just read.
4. **STUCK** — blocked >30 min? Follow `system/stuck-protocol.md`: write the question down, mark ⚠, move on.
5. **CLOSE** (5 min) — tick checkboxes, add hard topics to the review queue (due tomorrow), advance the TODAY pointer.

Bad day? Do a **Minimum session** (30 min): warm-up + one sub-task. The streak survives; the plan doesn't get renegotiated.

## Map

This folder holds the **reading material** — the program itself. Your code,
drills and attempt logs live in the C# solution repository, not here.

| Path | What it is |
|---|---|
| `../PROGRESS.md` | Dashboard + TODAY pointer — your only entry point |
| `ROADMAP.md` | The full phase/module map (orientation only) |
| `curriculum-outline.md` | Day-by-day breakdown with the construct unlock index |
| `curriculum.json` | The skill tree — 117 nodes, read by the curriculum plugin |
| `system/` | The protocols (daily, weekly, checkpoint, stuck, scaling rules) |
| `modules/` | The 21 module documents — all training content lives here |
| `documents/` | Per-chapter reference notes, numbered to match the modules |
| `checkpoints/` | The gate exams, `cp1`–`cp10` |

Written where the code goes, not here:

| Path (in the code repo) | What it is |
|---|---|
| `02-practice/` | Daily code output; `katas/` holds repeatable drills |
| `03-projects/` | Portfolio pipeline (p1 console tool, p2 auth API, p3 capstone) |
| `05-review/` | Spaced-repetition queue + weak spots |
| `06-interview/` | Question bank, LeetCode log, story bank |
| `07-career/` | Application tracker + résumé bullets |

## Non-negotiables

- A task is ✅ only when its **done-when** criterion is met, not when time was spent.
- Modules end with a **mastery checkpoint** (timed, closed-book, AI not allowed). You don't advance without passing. Failing is a scheduled event, not a crisis — see `system/checkpoint-protocol.md`.
- Reviews are *retrieval*: redo code cold or explain aloud. Rereading is not reviewing.
