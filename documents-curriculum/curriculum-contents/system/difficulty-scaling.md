# Difficulty Scaling Rules

These rules decide, mechanically, when complexity goes up, when you revisit, and when projects start. They remove the "am I ready?" decision.

## When complexity increases

| Signal | Scale-up |
|---|---|
| Drill done cold (no reference, first try) | Stop repeating it daily — it moves to the review queue's normal schedule |
| Exercise's done-when met on the first attempt | Do the day block's **stretch task** (each block has one, marked ⭐) |
| Two day blocks in a row finish >20 min early | Take the module's drills with a timer at half the usual time |
| Mini-project acceptance criteria all met | You're cleared for the mastery checkpoint |

Never scale up by *skipping* — scale up by adding constraints (timer, no reference, harder input, more edge cases).

## When to revisit

| Signal | Action |
|---|---|
| Drill fails cold | REVIEW-QUEUE, stage 1 (due tomorrow) |
| Review item fails | Reset to stage 1 + copy to `weak-spots.md` |
| Checkpoint criterion fails | Remediation day block(s) per `checkpoint-protocol.md` |
| Same topic in `weak-spots.md` twice | Dedicated remediation day before the next checkpoint |
| You can do it but can't *explain* it aloud | It counts as a fail — add to queue. Interviews are explaining. |

## When projects are introduced

- **Mini-projects**: built into the back half of every module — non-optional, they're the proof of the module.
- **p1 (console analyzer)**: unlocked by module 04 (LINQ) — it *is* module 04's mini-project, then gets polished to "Documented" in the pipeline.
- **p2 (auth API)**: starts at module 06 day 3 and is the shared codebase for modules 06→09. It is deliberately *one* project: integration is the lesson.
- **p3 (capstone)**: unlocked only by passing cp9. No early starts — the capstone with missing fundamentals produces a worse portfolio piece than the capstone three weeks later.

## Global ratchets

- Each module's drills carry over: warm-ups sample from *all* previous modules, weighted toward the queue's due items.
- From module 06 onward, every exercise must include at least one test. From module 07 onward, every feature lands with a migration where schema changes. The bar only moves up.
