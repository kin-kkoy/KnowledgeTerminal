# Module 05 — Async/Await

**Days:** 4 · **Checkpoint:** `checkpoints/cp5.md` · **Prefix:** `02-practice/m05-…`

## Mission brief

Every ASP.NET controller action you ever write will be `async Task<...>` — this module is a hard prerequisite for module 06. The syntax is JS's, the semantics are not: a JS Promise runs on one event loop; a .NET `Task` may hop real threads from a pool. The classic interview question pair — "what happens at an await?" and "why does `.Result` deadlock?" — both come from that difference. Professionally, async correctness is what keeps a web server alive under load: blocked threads = dead server.

**Bridges:** `Task`≈Promise, `await`≈`await`, `Task.WhenAll`≈`Promise.all`, `TaskCompletionSource`≈`new Promise(resolve…)` · from C: a thread is expensive (≈1MB stack) — async exists so 100 concurrent requests don't need 100 threads.

---

## Day blocks

### Day 1 — Mechanics
- [ ] **Build** `m05-d1-mechanics/`: an async console app — `await Task.Delay`, an async method chain 3 deep, print `Environment.CurrentManagedThreadId` before/after each await and observe thread hops. Then call a real API (`HttpClient.GetStringAsync` against e.g. `https://api.github.com/zen` with a User-Agent header).
  - **Done-when:** you can narrate, aloud, what the thread does during the `Delay` (answer: nothing — it's returned to the pool; *no thread waits*).
- [ ] **Build:** `Task<T>` vs `Task` vs `async void` — write all three; trigger an exception in the `async void` one and observe why it's unhandleable. State the one legitimate `async void` use (event handlers).
- [ ] ⭐ Stretch: `ValueTask` — read its docs *after* building; one sentence on when it matters (and that the answer at your level is "rarely — measure first").

### Day 2 — Composition + failure
- [ ] **Build** `m05-d2-compose/`: fetch 10 URLs (a) sequentially in an awaited loop, (b) with `Task.WhenAll` — print both wall-clock times.
  - **Done-when:** WhenAll is ~Nx faster and you can explain where the concurrency comes from with no extra threads.
- [ ] **Build:** failure semantics — one of the 10 tasks throws: what does WhenAll throw? How do you get *all* exceptions (`task.Exception` / iterating tasks after)? How do you get partial results? Implement all three patterns.
- [ ] ⭐ Stretch: `Task.WhenAny` — first-response-wins with the rest cancelled.

### Day 3 — Cancellation + the deadlock
- [ ] **Build** `m05-d3-cancel/`: a long-running async pipeline taking a `CancellationToken`; cancel from a key-press; token flows through every level; cleanup runs (`finally`).
  - **Done-when:** cancel actually stops the work (proven by output), `OperationCanceledException` handled at the top only.
- [ ] **Build the deadlock:** a method that calls `.Result` on an async method — in a console app it sneaks through (no sync context); write the explanation of where it kills you (classic ASP.NET, UI threads) and the two fixes (async all the way; `ConfigureAwait(false)` in libraries). This exact narrative is cp5 material and an interview staple.
- [ ] **Build:** make module 03's repository interface async (`Task<T?> GetByIdAsync(int id, CancellationToken ct)`) — the exact signature p2 will use.

### Day 4 — Mini-project + drills cold
- [ ] Build mini-project; drills cold; add "await internals" + "deadlock" to REVIEW-QUEUE as explain-alouds.

---

## Coding drills

1. **whenall-timer**: sequential vs WhenAll over fake `Task.Delay` work, printing timings, <10 min.
2. **cancel-flow**: cancellable loop honoring a token with cleanup, <10 min.
3. **error-harvest**: WhenAll with mixed success/failure, collect all results AND all errors, <12 min.
4. **async-signature**: convert a sync interface to async correctly (Task-returning, token parameter, `Async` suffix), <5 min.
5. **explain-await**: not code — 90-second spoken answer to "what happens at an await", recorded.

## Mini-project — "Concurrent site checker"

CLI: `sitecheck urls.txt --concurrency 5 --timeout 3s`. Checks N URLs: status, latency, title extraction. Bounded concurrency (`SemaphoreSlim` — not unbounded WhenAll over 10k URLs), per-request timeout via linked `CancellationTokenSource`, Ctrl+C graceful cancel, summary table sorted by latency, failures reported per-URL without aborting the run.

**Acceptance criteria:**
- [ ] Bounded concurrency proven (log shows ≤5 in flight).
- [ ] One slow/dead URL can't hang the run (timeout fires) and can't kill it (error isolated).
- [ ] Ctrl+C: in-flight requests cancel, summary still prints for completed work.
- [ ] Single shared `HttpClient` (know why — socket exhaustion).
- [ ] Core logic unit-tested by faking the fetch behind an interface (modules 02+05 composing).

## Common mistakes checklist

- [ ] `.Result`/`.Wait()`/`GetAwaiter().GetResult()` anywhere in app code.
- [ ] `async void` outside event handlers.
- [ ] Sequential awaits in a loop where work is independent (the silent N× slowdown).
- [ ] Fire-and-forget tasks (unobserved exceptions) — un-awaited task with no continuation.
- [ ] `new HttpClient()` per request.
- [ ] CancellationToken accepted but never passed down (decorative cancellation).
- [ ] Wrapping sync CPU work in `Task.Run` and calling it "async" (know the IO-bound vs CPU-bound distinction).

## Mastery checkpoint — cp5

**Timed: 2 hours, from scratch, docs allowed, AI not. Two parts.**
**Part A (fix):** you'll write (from the cp file's spec) a deliberately broken program containing: `.Result` deadlock-prone call, sequential independent awaits, `async void`, ignored token. Fix all four, with a one-line comment per fix naming the bug.
**Part B (build):** fan-out worker — given 20 fake "jobs" (random delays, ~20% throw), run with bounded concurrency 4, timeout 2s/job, return a report: succeeded/failed/timed-out/cancelled, total wall-clock proving parallelism.
**Pass criteria:** all 4 Part-A bugs found and correctly fixed · Part B categories all correct under test · wall-clock ≈ longest chain not sum · token plumbed end to end · spoken "what happens at an await" answer, 90s, fluent.

## Interview relevance

The deadlock question, await internals, WhenAll vs loop, async void — this module is 4 of the top-10 C# interview questions. Senior interviewers probe async *because* juniors fake it; being genuinely solid here reads as a level above. Recruiter keyword coverage: "async/await", "multithreading basics", "HttpClient".

## Integration notes

Module 06 onward, *everything* is async: controllers, EF queries (`ToListAsync`), the request pipeline. The `CancellationToken` you plumbed becomes ASP.NET's per-request token (client disconnects → your query cancels). `SemaphoreSlim` bounding returns in the capstone's booking-concurrency work. The async repository signature from Day 3 is literally p2's interface.
