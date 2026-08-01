# cp5 — Async Gate

**Time:** 2h · **Start:** empty folder `attempts/cp5-attempt-N/` · **Allowed:** docs, search · **Forbidden:** AI, own code · Rules: `system/checkpoint-protocol.md`

## Part A — Fix the broken program (45 min)

First transcribe this program (type it, don't paste), then fix it. It must contain (your transcription recreates these four bugs faithfully):
1. A method calling `.Result` on an async method (deadlock-prone pattern).
2. Ten independent fetches awaited sequentially in a loop.
3. An `async void` method whose exception escapes.
4. A method that accepts a `CancellationToken` and ignores it.

Fix all four. Each fix gets a one-line comment naming the bug and the cost it had.

## Part B — Bounded fan-out worker (75 min)

Given 20 fake jobs (`Task RunJob(int id)`: random 200–2000ms delay; ~20% throw `JobFailedException`), build a runner: bounded concurrency 4 (`SemaphoreSlim`), per-job timeout 2s (linked CTS), global cancel on Ctrl+C. Output report: per job — Succeeded / Failed / TimedOut / Cancelled; plus total wall-clock.

## Pass criteria

- [ ] Part A: 4/4 bugs found, fixes correct, comments name them accurately
- [ ] Part B: all four outcome categories reachable and correct (seed the randomness to prove each)
- [ ] Wall-clock printed and ≈ sum/4, not sum (parallelism real)
- [ ] Token flows through every level; Ctrl+C produces Cancelled entries, not a crash
- [ ] No `.Result`/`.Wait()`/`async void` anywhere
- [ ] Spoken: "what happens at an await" — 90 seconds, recorded, fluent

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
