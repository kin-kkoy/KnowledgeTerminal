# Checkpoints & Defenses

Between the chapters, the Map has two kinds of **gates** — hexagon **checkpoints** and
**project defenses**. They're not more content to read; they're where you *prove* the content stuck.
This page explains how they work and how to prepare, so when you hit one on the Map you know exactly
what you're walking into. (The gates themselves live on the **Map** tab, not in this book — each
has a button that generates a prompt for your Claude Code session.)

**Where ticking happens:** each chapter page shows chips at the top for the Map node(s) it covers.
As you finish a section honestly, tick its topic chip; when all of a chapter's topics are ticked,
tick the chapter itself — right there on the page, or on the Map (same data). Checkpoints and
project defenses (the hexagons) are the exception: those you tick on the **Map**, and only after
passing the exam or defense described below.

---

## Why gates exist

Following a tutorial and *understanding a concept from scratch* feel identical while you're reading and
feel nothing alike under pressure. Gates exist to catch that gap early — the "I get it" that evaporates
the moment the examples are gone. Passing a gate is the only honest signal that a skill is yours, not
the tutorial's. If a gate is hard, that's the system working: it found a soft spot *now*, cheaply,
instead of in an interview.

---

## Checkpoints (the hexagons)

A **checkpoint** is a **closed-book, timed, no-AI** exam that you can only write idiomatic code from
memory. On the map, a checkpoint node gives you a **"copy Claude Code exam prompt"** button; you paste
it into your own Claude Code session and it acts as a strict examiner — it sets the task, and crucially
**it will not hint, autocomplete, or explain** while you work. You solve it cold, then tick the node.

**The rules that make it meaningful:**

- **Closed-book** — no docs, no Atlas, no Map (book), no AI help *during* the exam.
- **Timed** — a real constraint; fluency, not just eventual correctness.
- **From scratch** — you write the thing, not fill in a blank.
- **Honest** — if you'd fail without help, you haven't passed. The point is the signal, so don't cheat
  the one person it's for (you).

**How to prepare for a checkpoint:** do the chapter's **"Build it"** project and coding drills *without
looking* — close this book and the Atlas, and reproduce the core idea from memory. When you can write
the chapter's central skill (a small type hierarchy, a non-trivial LINQ query, correct async) cold,
you're ready. If you can't yet, that's not failure — it's the checkpoint doing its job before it
counts. Re-drill the weak spot and come back.

The checkpoints, roughly: one per core chapter (`cp1`–`cp5`: fundamentals → async), the backend
chapters (`cp6`–`cp10`), and cloud/game checkpoints (`cpc*`, `cpg*`). Each gates the *next* chapter — you
don't move on until the current skill is genuinely yours.

---

## Project defenses

A **project** (Console Analyzer, the Data-backed API, the Capstone, the game builds) is the opposite of
a closed-book exam: you build something **real, over days, with every resource available** — including
AI. Then comes the **defense**: an oral exam where you hand the finished repo to Claude Code and it runs
a **"defend your code"** interrogation.

**What the defense actually asks:**

- *"Explain the whole thing like I'm five"* — the flow, end to end, in plain language. If you can't
  narrate how your own code works, you don't understand it yet.
- *"Why this and not the alternative?"* — for **every** significant choice: why a `record` here, why
  this index, why JWT over sessions, why these service lifetimes, where you killed the N+1. "It's what
  the tutorial did" is a failing answer.
- It **catches hand-waving** — vague answers get followed up until they're concrete or exposed.

The insight: **using AI to build is fine and encouraged; not understanding what you built is the
failure.** The defense is what keeps "I shipped it" honest — you can lean on AI all you like *if* you
can defend every line afterward.

**How to prepare for a defense:** build it yourself and *understand each decision as you make it*. When
you reach for a pattern, be able to say why *and* why-not the alternatives. If you can walk a skeptical
senior through your repo — the architecture, the trade-offs, the bug you fixed and how — the defense is
a conversation, not an interrogation.

---

## How to use the gates well

- **Don't skip them.** A green chapter with a failed (or skipped) checkpoint is a lie you're telling
  future-you.
- **Treat a fail as information, not a verdict.** It names the exact thing to re-drill. Re-drill, retry.
- **Space them.** Do the checkpoint a day or two *after* the chapter, not immediately — recalling it
  cold after a gap is the whole test.
- **Be your own strict examiner.** The AI won't help during a checkpoint by design; don't help yourself
  either. The signal is only worth something if it's honest.

The chapters teach, the exercises rehearse, and these gates certify. When you've passed the checkpoints
and defended the projects, you don't *think* you can do this — you have the receipts.
