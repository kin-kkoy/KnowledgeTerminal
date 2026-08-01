# Daily Protocol

Two session shapes. Pick one *before* starting; never improvise a third.

## Standard session (90–120 min) — the default

| Step | Time | Action |
|---|---|---|
| 1. OPEN | 2 min | Open `PROGRESS.md` → TODAY pointer → open that day block. Do not browse other modules. |
| 2. WARM-UP | 10 min | `05-review/REVIEW-QUEUE.md`: do every item due today. Retrieval only — redo the drill cold in `02-practice/katas/`, or explain the topic aloud as if to an interviewer. No rereading. |
| 3. MAIN | 60–90 min | Execute the day block's tasks **in order**. Every task ends in code that compiles. Reading/watching listed in a task is *input* to the build step that follows it, never the task itself. |
| 4. STUCK | — | Blocked >30 min → `stuck-protocol.md`. Blocked ≠ stopped. |
| 5. CLOSE | 5 min | Per the checklist at the bottom of `PROGRESS.md`. Non-negotiable — an unclosed session doesn't count for the streak. |

## Minimum session (30 min) — bad days only

Warm-up (10 min) + the single next unchecked sub-task (20 min) + close-out. Counts for the streak. Two consecutive Minimum days → the third must be Standard or the week becomes a catch-up week.

## Rules

- One day block per day, max. Finished early? Do a kata cold or polish the active project. Do not start tomorrow's block — spacing is the point.
- 6 sessions/week target. The 7th day is buffer; it is never scheduled.
- Code goes in `02-practice/week-folders` named `mNN-dN-taskname/` (e.g. `m01-d2-typeport/`), one `dotnet new` project per exercise, so everything compiles independently.
- A task is ✅ only when its **done-when** criterion holds. "I understood it" is not a criterion.
