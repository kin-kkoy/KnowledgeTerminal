# Checkpoint Protocol

Checkpoints are the gates between modules. They exist because self-study lies to you — "it felt easy to follow" and "I can build it" are different skills, and only the second one gets hired.

## Rules of the exam

- **Scheduled** — a checkpoint is its own session, taken the day after the module's last day block (never the same day).
- **Timed** — the limit is in the cp file. Set an actual timer. Going over = the criteria you hadn't met by the deadline count as failed.
- **Closed-book where stated** — official docs and web search are allowed unless the cp says otherwise; **AI assistants are never allowed**; your own past code is never allowed.
- **From scratch** — start in an empty folder under `04-checkpoints/attempts/cpN-attempt-K/` with `dotnet new`.
- **Objective** — when time's up, go through the pass-criteria checklist coldly. Each criterion is pass/fail, no partial credit.

## Outcomes

**PASS** (all mandatory criteria met):
1. Log it in the cp file's attempt table and in `PROGRESS.md` (module → ✅, next module → 🔄).
2. Harvest one résumé bullet to `07-career/resume-bullets.md` and 2–3 questions to the question bank.
3. Move TODAY to the next module, Day 1.

**FAIL** (any mandatory criterion missed):
1. In the attempt table, write *exactly which criteria failed and why* — not "ran out of time" but "couldn't write the GroupBy without searching syntax".
2. Each failed criterion becomes a remediation day block: re-drill that topic + rebuild that part in isolation. 1–3 remediation days, then a **fresh retake** (new attempt folder, same or equivalent task) no sooner than 2 days after the fail.
3. A fail is logged, remediated, retaken. It is a normal scheduled event in this system. Two fails on the same cp → the remediation includes redoing that module's drills cold, all of them, before attempt 3.

## What checkpoints are not

Not a grade, not a verdict on you, and not skippable when you're "pretty sure". The pass log doubles as interview evidence: "I can build X from scratch in Y minutes" is a sentence you'll actually say.
