---
title: Progress
kind: dashboard
pinned: true
summary: >-
  The honest state of the project, updated at CLOSE each day. Where you are
  right now is computed live in the Lobby, not written down here.
---

# Progress

> **Where am I today?** The Lobby answers that — it reads the curriculum and
> your progress and cannot go stale. This file is the other half: what is
> actually true, written by you, at CLOSE each day.

## Where things actually stand

This is the honest state, not an aspiration. Update it at CLOSE each day.

| Track | Status |
|---|---|
| Curriculum | Not started — Module 01, Day 1 is next |
| Checkpoints passed | None yet |
| Dragon Merchant Guild code | Not started — Milestone 0 tasks are all open |
| Documentation | Complete — 14 documents converted and readable |

The milestone you are on is not written here any more. It lives in
[[implementation-roadmap]] and is shown live in the Lobby, under **What to
build** — tick a task there and it goes straight into the roadmap; tick a
milestone's **done-when** and the Lobby moves to the next one on its own.

A copy of that list used to sit here, and a copy is exactly what goes stale.

---

## The day loop

From [[daily-protocol]]. Follow it exactly; the point is that it removes choices.

1. **OPEN** (2 min) — this file → the TODAY pointer → open that day block.
2. **WARM-UP** (10 min) — retrieval, not rereading. Redo a drill cold, or
   explain a topic aloud.
3. **MAIN** (60–90 min) — execute the day block's tasks *in order*. You always
   code; you never just read.
4. **STUCK** — blocked more than 30 minutes? [[stuck-protocol]]: write the
   question down, mark it ⚠, move on.
5. **CLOSE** (5 min) — tick the boxes, add hard topics to the review queue, and
   advance the TODAY pointer above.

Bad day? Do a **minimum session** (30 min): warm-up plus one sub-task. The
streak survives and the plan does not get renegotiated.

---

## Module ladder

The core spine is mandatory and in order. Specialisations branch after it.

| # | Module | Days | Checkpoint |
|---|---|---|---|
| 01 | [[module-01-csharp-fundamentals]] — C# Fundamentals | 5 | [[cp1]] |
| 02 | [[module-02-oop]] — OOP | 5 | [[cp2]] |
| 03 | [[module-03-collections-generics]] — Collections & Generics | 4 | [[cp3]] |
| 04 | [[module-04-linq]] — LINQ | 5 | [[cp4]] |
| 05 | [[module-05-async]] — Async / Await | 4 | [[cp5]] |
| 06 | [[module-06-aspnet-core]] — ASP.NET Core | 8 | [[cp6]] |
| 07 | [[module-07-sql-efcore]] — SQL + EF Core | 8 | [[cp7]] |
| 08 | [[module-08-auth]] — Auth (N + Z) | 5 | [[cp8]] |
| 09 | [[module-09-deployment]] — Deployment | 5 | [[cp9]] |
| 10 | [[module-10-capstone-final-project]] — Capstone | 4 wks | [[cp10]] |

Full map including the Cloud and Game Dev branches: [[curriculum-outline]] and
[[learning-roadmap]].

---

## Non-negotiables

- A task is ✅ only when its **done-when** criterion is met, not when time was
  spent on it.
- Checkpoints are timed, closed-book, and AI is not allowed. You do not advance
  without passing. Failing is a scheduled event, not a crisis —
  see [[checkpoint-protocol]].
- Reviews are **retrieval**. Redo code cold or explain it aloud. Rereading is
  not reviewing.
