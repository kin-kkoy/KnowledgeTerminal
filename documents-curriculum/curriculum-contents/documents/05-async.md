# Async / Await

Everything you've written so far does one thing at a time: each line finishes before the next
starts. This chapter teaches you to write programs that *wait on many slow things at once* —
three web requests, a timer and a download, a hundred file reads — without freezing and without
you managing threads by hand. After it, phrases like "fire off both requests and await them
together" will be things you can actually type.

---

## 1. Tasks & await

**The idea**

First, two words people mix up:

- **Concurrency** — dealing with several things *in progress* at the same time. One cook, six
  pots: stir one while the others simmer. Nothing requires more than one pair of hands; the
  trick is *not standing still* while a pot is busy doing its own thing.
- **Parallelism** — literally doing several things *at the same instant*, which requires
  several workers (CPU cores). Six cooks, six pots.

Most slow operations in real programs are **I/O**: waiting for a network reply, a disk, a
database. During that wait your CPU does *nothing* — the network card and the operating system
do the work, and your program just needs to be told when the answer arrives. So for I/O you
want concurrency (don't stand still), not parallelism (more cooks won't make the network
faster). Parallelism matters for **CPU-bound** work — heavy computation — and we'll meet it in
section 2.

The classic way to not stand still is a **thread**: an independent flow of execution inside
your process, scheduled by the OS. .NET exposes them (`System.Threading.Thread`), and they're
real: each has its own stack (~1 MB), and the OS switches between them. But threads are a
clumsy tool for I/O waiting — a thread that's blocked waiting on the network still *exists*,
still owns its megabyte of stack, still costs a context switch. Ten thousand pending web
requests as ten thousand blocked threads is how servers used to fall over.

C#'s answer is the **`Task`** — and it is *not* a thread. A `Task` is an object that
represents **an operation that will complete in the future**. Think of it as a receipt:

- `Task` — a receipt for work that will *finish* (no value, like a `void` operation).
- `Task<T>` — a receipt for work that will *produce a `T`*. (`Task<T>` is a generic type —
  same machinery as `List<T>` from the *Collections & LINQ* chapter.)

A task is in one of a few states: still running, completed with a result, **faulted** (it threw
an exception — the exception is stored inside the task), or cancelled. Crucially, a task
waiting on I/O consumes **no thread at all** — it's just a small object plus a note to the OS
saying "wake me when the bytes arrive."

The receipt is only useful if you can redeem it. That's **`await`**:

```csharp
string body = await client.GetStringAsync(url);
```

Here is what `await` actually does, precisely, because this is the one mechanic worth
over-learning:

1. If the task is **already complete**, execution just continues with the result. No magic.
2. If it's **not complete**, the method **suspends at that point and returns to its caller**.
   Not "blocks" — *returns*. The caller gets a `Task` representing the rest of this method and
   can go do other things. No thread sits there waiting.
3. The rest of the method — everything after the `await` — is registered as a
   **continuation**: a callback the runtime invokes when the task completes. When the result
   arrives, execution resumes right where it left off, locals intact, and `await` hands you
   the unwrapped value (the `string`, not the `Task<string>`).

So `await` reads like "pause here", but under the hood it's "return now, resume later". The
compiler rewrites your method into a state machine to make that possible — which is why a
method that uses `await` must be marked **`async`**:

```csharp
async Task<string> FetchAsync() { ... }
```

`async` is a permission slip for `await`, and it changes the return type: an `async` method
returns `Task` or `Task<T>`, never the bare value — because from the caller's point of view,
calling it *starts* the work and hands back the receipt. Which leads to the one structural rule
of the whole topic, **async all the way up**: if a method awaits, it returns a `Task`, so its
caller must await *it*, so the caller is `async` too… all the way to the program's entry
point. In our toolchain that's painless: top-level statements may `await` directly, so your
Study-tab code just uses `await` at file level.

Two more players you'll use constantly:

- **`Task.Delay(ms)`** — a task that completes after a delay. It's the async stand-in for any
  slow operation, perfect for demos. Its evil twin **`Thread.Sleep(ms)`** *blocks the current
  thread* for the duration — the thread stands still, exactly what we're trying to avoid. Rule:
  `await Task.Delay(...)` in async code; `Thread.Sleep` almost never.
- **`HttpClient`** — the standard .NET type for making HTTP requests (the protocol browsers
  and web APIs speak: you send a request to a URL, a server sends back text/JSON/bytes). It's
  the canonical *real* async API: `GetStringAsync(url)` returns a `Task<string>` that
  completes when the reply arrives. You create one and reuse it (`new HttpClient()` — it's a
  class, reference semantics, per the *Types & Memory* chapter).

**In practice**

A timing demo you can run in the Study tab as-is. `Stopwatch` (from
`System.Diagnostics`, covered by implicit usings' close cousin — we add the `using` to be
explicit) measures elapsed time:

```csharp
using System.Diagnostics;

var clock = Stopwatch.StartNew();
void Log(string msg) => Console.WriteLine($"[{clock.ElapsedMilliseconds,4} ms] {msg}");

async Task<string> BrewAsync(string what, int ms)
{
    Log($"start {what}");
    await Task.Delay(ms);              // suspend; no thread is held during this
    Log($"done  {what}");
    return $"{what} ready";
}

Log("before call");
Task<string> receipt = BrewAsync("coffee", 500);   // starts it — runs until its first await
Log("after call — got a Task, method is suspended, we kept going");

string result = await receipt;                     // redeem the receipt
Log(result);
```

```text
[   0 ms] before call
[   1 ms] start coffee
[   2 ms] after call — got a Task, method is suspended, we kept going
[ 503 ms] done  coffee
[ 504 ms] coffee ready
```

Read that output slowly — it *is* the mental model. `start coffee` prints before
`after call` because calling an async method runs it synchronously up to its first
incomplete `await`; then it returns the `Task` and *we* keep going; then ~500 ms later the
continuation fires and `done coffee` prints.

And the real thing, with `HttpClient` (needs network; if the Study sandbox is offline, the
`Task.Delay` version above teaches the same mechanics):

```csharp
using var client = new HttpClient();
string body = await client.GetStringAsync("https://example.com");
Console.WriteLine($"got {body.Length} chars");
```

```text
got 1256 chars
```

(`using var` disposes the client at end of scope — see *Types & Memory*; exact char count
varies.)

> **C corner:** if you've seen `select()`/`poll()` or nonblocking sockets in C, `await` is
> that pattern with the bookkeeping inverted: instead of one hand-written event loop that
> remembers "when fd 7 is readable, jump back into the middle of handle_client()", the
> compiler slices your function at each `await` and stores the "middle of the function" state
> for you. Same OS machinery underneath (epoll and friends), none of the manual state structs.

**Try it — Lab:** write `async Task<int> SlowDoubleAsync(int n)` that awaits
`Task.Delay(300)` and returns `n * 2`. At top level: print `"A"`, call it *without* awaiting
(store the `Task<int>`), print `"B"`, then `await` the task and print the result. Predict the
output order before running — you should see `A`, `B`, then the number, and understand why
`B` didn't wait.

**Traps**

- **Forgetting `await`.** `SlowDoubleAsync(5);` on its own *starts* the work and throws away
  the receipt — the result and any exception vanish. The compiler warns (CS4014); treat that
  warning as an error.
- **`async` doesn't mean "runs on another thread".** The method body runs on *your* call path
  until the first incomplete `await`. Marking a CPU-heavy loop `async` makes nothing
  concurrent — it just adds overhead. Async buys you unblocked *waiting*, not extra compute.
- **`Thread.Sleep` inside async code** blocks the thread and defeats the entire point. If you
  ever "async-ified" a method but it still freezes the app, hunt for a `Sleep`.
- **`new Task(...)` / `task.Start()`** — you'll see these in old code; don't use them. Tasks
  come from async methods, `Task.Delay`, `Task.Run` (section 2), or library calls. Manually
  constructed tasks are a legacy trap.

---

## 2. Cancellation & parallelism

**The idea**

Two upgrades to the basic model: *stopping* work you no longer want, and *overlapping* many
pieces of work deliberately.

**Cancellation** in .NET is **cooperative** — there is deliberately no "kill this task" button.
(A forcibly killed operation could die halfway through writing a file or holding a lock; the OS
can kill *processes* safely because it reclaims everything, but inside one process, only the
code itself knows where it's safe to stop.) So instead, the *requester* signals, and the *work*
checks. Two types, always used as a pair:

- **`CancellationTokenSource`** (the requester's end): create one, call `.Cancel()` on it —
  or construct it with a timeout, `new CancellationTokenSource(TimeSpan.FromSeconds(2))`, to
  auto-cancel.
- **`CancellationToken`** (the worker's end): a small struct you get from the source's
  `.Token` property and pass down through every async call. Well-behaved async APIs accept
  one as their last parameter (`Task.Delay(ms, token)`, `client.GetStringAsync(url, token)`),
  and long loops of your own call `token.ThrowIfCancellationRequested()` at safe points.

When cancellation is requested, awaited operations throw **`OperationCanceledException`** — a
normal exception you catch to say "we stopped on purpose", distinct from "we crashed".

**Running many tasks at once.** You already know the receipt trick from section 1: calling an
async method *starts* it. So concurrency is just: start several, then await them together.

- **`Task.WhenAll(t1, t2, ...)`** — a task that completes when *all* of them do. For
  `Task<T>`s it yields all the results as a `T[]`. Total time ≈ the *slowest* task, not the
  sum. This is the everyday workhorse: "fetch the user, their orders, and their
  recommendations at the same time."
- **`Task.WhenAny(t1, t2, ...)`** — completes when the *first* one does, and gives you that
  task. Classic uses: "fastest mirror wins", or racing real work against a timeout delay.

Note what's *not* involved: extra threads. Ten `Task.Delay`s (or ten HTTP requests) in flight
are ten pending I/O operations and zero busy threads. That's I/O concurrency.

**CPU-bound work is different.** If the job is genuinely compute-heavy — parsing a huge file,
crunching numbers — no amount of awaiting helps: some thread must burn CPU. For that .NET gives
you real parallelism over the machine's cores:

- **`Task.Run(() => Heavy())`** — run one chunk of CPU work on the **thread pool** (a set of
  worker threads the runtime maintains and reuses, so you never create threads by hand). It
  returns a `Task`, so it plugs straight into `await`/`WhenAll`.
- **`Parallel.ForEach(items, item => Heavy(item))`** — split a loop's iterations across cores.
  Blocks until done; for use inside async code there's `Parallel.ForEachAsync`.
- **PLINQ** — Parallel LINQ: `items.AsParallel().Select(Heavy).ToList()` runs a LINQ pipeline
  (see *Collections & LINQ*) across cores.

Rule of thumb: *waiting* on many things → tasks + `WhenAll`. *Computing* many things →
`Parallel`/PLINQ/`Task.Run`. Mixed jobs use both.

**Throttling.** "Start everything at once" doesn't scale to 10,000 URLs — you'd swamp the
network or the server. **`SemaphoreSlim`** is the standard valve: a counter of available
permits. `await sem.WaitAsync()` takes a permit (suspending, not blocking, if none are free);
`sem.Release()` returns it. Create it with the number of concurrent operations you'll allow,
and wrap each piece of work in wait/release. The name is historical (semaphores are a classic
concurrency primitive; the "slim" one is the modern lightweight version) — think of it as a
bouncer that lets N in at a time.

**In practice**

Concurrency plus a timeout-driven cancellation, in one runnable demo:

```csharp
using System.Diagnostics;

var clock = Stopwatch.StartNew();
void Log(string msg) => Console.WriteLine($"[{clock.ElapsedMilliseconds,4} ms] {msg}");

async Task<string> FetchAsync(string name, int ms, CancellationToken ct)
{
    await Task.Delay(ms, ct);          // pretend I/O; honors cancellation
    Log($"{name} finished");
    return name;
}

// --- concurrent: total ≈ slowest, not the sum -------------------------
using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));

Task<string> a = FetchAsync("alpha", 500, cts.Token);   // all three in
Task<string> b = FetchAsync("beta",  800, cts.Token);   // flight at once
Task<string> c = FetchAsync("gamma", 300, cts.Token);

string[] all = await Task.WhenAll(a, b, c);
Log($"WhenAll -> {string.Join(", ", all)}");

// --- WhenAny: first past the post --------------------------------------
Task<string> fast = FetchAsync("mirror-1", 400, cts.Token);
Task<string> slow = FetchAsync("mirror-2", 900, cts.Token);
Task<string> winner = await Task.WhenAny(fast, slow);
Log($"WhenAny -> {await winner}");        // winner is complete; this await is instant

// --- cancellation actually stopping something ---------------------------
using var shortCts = new CancellationTokenSource(TimeSpan.FromMilliseconds(250));
try
{
    await FetchAsync("doomed", 5000, shortCts.Token);
}
catch (OperationCanceledException)
{
    Log("doomed was cancelled — 5s of pointless work skipped");
}
```

```text
[ 305 ms] gamma finished
[ 505 ms] alpha finished
[ 806 ms] beta finished
[ 807 ms] WhenAll -> alpha, beta, gamma
[1210 ms] mirror-1 finished
[1211 ms] WhenAny -> mirror-1
[1464 ms] doomed was cancelled — 5s of pointless work skipped
```

Things to notice: the three fetches finish in *duration* order, not call order; `WhenAll`
lands at ~800 ms (the slowest), not 1600 (the sum); `WhenAll` returns results in the order you
*passed* the tasks, regardless of finish order; and "doomed" dies at ~250 ms, not 5000.
(`mirror-2` is still running when `WhenAny` returns — the loser isn't cancelled unless you
cancel it; we just exit before it finishes.)

And throttling — at most 2 in flight out of 6:

```csharp
using System.Diagnostics;

var clock = Stopwatch.StartNew();
using var gate = new SemaphoreSlim(2);      // 2 permits

async Task WorkAsync(int id)
{
    await gate.WaitAsync();                 // suspend until a permit frees up
    try
    {
        Console.WriteLine($"[{clock.ElapsedMilliseconds,4} ms] job {id} running");
        await Task.Delay(300);
    }
    finally { gate.Release(); }             // always give the permit back
}

await Task.WhenAll(Enumerable.Range(1, 6).Select(WorkAsync));
Console.WriteLine($"[{clock.ElapsedMilliseconds,4} ms] all done");
```

```text
[   1 ms] job 1 running
[   2 ms] job 2 running
[ 304 ms] job 3 running
[ 305 ms] job 4 running
[ 607 ms] job 5 running
[ 607 ms] job 6 running
[ 909 ms] all done
```

Three waves of two — ~900 ms total instead of ~300 unthrottled or ~1800 sequential.
(`Enumerable.Range` and `Select` are LINQ, from *Collections & LINQ*: this builds six calls to
`WorkAsync`, i.e. six started tasks, and `WhenAll` awaits the lot.)

> **C corner:** `SemaphoreSlim` is the same concept as POSIX `sem_wait`/`sem_post`, except
> `WaitAsync` *suspends the method* instead of blocking the thread — a parked async waiter
> costs a few objects, not a sleeping pthread. And `Parallel.ForEach` is roughly what you'd
> hand-build with a pthread pool plus a work queue, minus the hundred lines of pthreads.

**Try it — Lab:** write `async Task<int> SlowSquareAsync(int n, CancellationToken ct)` that
awaits `Task.Delay(400, ct)` and returns `n * n`. (1) Await it for 1..3 sequentially and print
the elapsed time (~1200 ms). (2) Start all three, `Task.WhenAll`, time it again (~400 ms).
(3) Rerun version 2 with a `CancellationTokenSource(200)` and catch the
`OperationCanceledException`. One number to feel, one exception to see.

**Traps**

- **Awaiting in a `foreach` when the iterations are independent.** `foreach (var u in urls)
  { await Fetch(u); }` is sequential — the most common async performance bug. Build the list
  of tasks first, then `WhenAll`.
- **Forgetting to pass the token down.** A `CancellationToken` parameter you accept but don't
  forward to inner calls means cancellation "works" but the inner operation runs to completion
  anyway. Thread it through *every* call that accepts one.
- **`Parallel.ForEach` with an `async` lambda** — it doesn't await the lambdas (they become
  `async void`, see section 3), so the loop "finishes" while work is still running. For async
  work over a collection use `Task.WhenAll` or `Parallel.ForEachAsync`.
- **Parallelizing I/O.** `Parallel.ForEach(urls, u => Download(u))` burns threads to do
  waiting. Cores for CPU, tasks for I/O — mixing them up costs you in both directions.

---

## 3. Async gotchas

**The idea**

Async's failure modes are famous enough to have names. Here's the field guide — each one is a
real bug class you will meet.

**The `.Result` deadlock.** Every `Task` has `.Result` (block this thread until the task
finishes, then give me the value) and `.Wait()` (same, no value). They look like innocent
escape hatches from "async all the way" — and in some environments they're a *guaranteed
deadlock*. Why: UI frameworks (and old ASP.NET) have a **synchronization context** — a rule
that says "continuations must run back on the main thread" (so code after `await` can touch UI
safely). Now trace it: the main thread calls `.Result` and blocks, waiting for the task. The
task finishes its I/O and its continuation asks to run… on the main thread. Which is blocked,
waiting for the continuation to finish. Each side waits for the other, forever. In a plain
console app there's no such context, so `.Result` merely blocks a thread instead of
deadlocking — which makes the habit *look* safe right up until you paste it into an app that
has one. The fix is never clever: just `await`.

**`async void`.** Return types recap: `async Task<T>` for a value, `async Task` for no value.
There is a third, `async void` — and it's a landmine, because *no receipt exists*. The caller
gets nothing to await, nothing to observe: if an `async void` method throws after its first
`await`, the exception has no task to live in and escapes onto whatever thread resumed the
method, usually crashing the process. It exists for exactly one reason: **event handlers**.
GUI frameworks define event signatures like "clicked handlers return `void`" (events are the
delegate-based callback mechanism from the *Delegates & Events* chapter), and those signatures
predate async — so an async click handler *must* be `async void` to match. That's the one
sanctioned use, and even there you wrap the body in `try/catch`, because nobody upstream can.
Everywhere else: `async Task`, even if nothing awaits it, because at least the exception is
*catchable*.

**`ConfigureAwait(false)`.** By default, `await` captures the current synchronization context
and resumes on it — that's the "back on the main thread" behavior above, and in an app it's
exactly what you want (touch the UI after awaiting, no ceremony). Writing
`await something.ConfigureAwait(false)` says "I don't care where I resume — any pool thread
will do." **Library** authors sprinkle it on every await for two reasons: their code doesn't
touch UI, so resuming on the caller's precious context is pure overhead; and it makes their
code immune to the `.Result` deadlock even if a caller commits that sin (the continuation no
longer needs the blocked thread). **Application** code mostly shouldn't bother: console apps
have no context to escape, and UI code usually *wants* the context. Know what it means when
you read it; reach for it when you write a reusable library.

**Where exceptions go.** When code inside a task throws, the task transitions to *faulted* and
stores the exception. Nothing surfaces until someone *observes* the task:

- **`await` rethrows the original exception**, at the await site, with its stack trace
  preserved. So `try { await t; } catch (HttpRequestException e) { ... }` works exactly like
  synchronous exception handling (see the *Errors & Exceptions* chapter). This is the
  behavior you use 99% of the time.
- The blocking accessors — `.Result`, `.Wait()` — instead throw **`AggregateException`**, a
  wrapper that holds a list of inner exceptions (`.InnerExceptions`), because a task tree can
  fault in several places at once. If you see `AggregateException` in a stack trace, it's a
  smell: someone blocked on a task instead of awaiting it.
- One subtlety with `Task.WhenAll`: if several tasks fault, awaiting it rethrows only the
  *first* exception. The combined task still holds them all — after a catch you can inspect
  `whenAllTask.Exception` (an `AggregateException`) if you truly need every failure. Usually
  the first is enough.

**Fire-and-forget.** Starting a task and never awaiting it. Sometimes it's an accident (the
missing-`await` warning from section 1); sometimes it's on purpose ("log this in the
background, don't slow the request down"). Deliberate or not, the dangers are the same: the
exception is never observed, so failures are silent; nothing waits for it, so the program (or
the request, or the test) can finish while it's mid-write; and it can outlive the objects it
uses. If you truly need background work, the honest minimum is to hold the `Task` somewhere
and observe it eventually, or wrap the body in its own `try/catch` that logs. "I assigned it
to `_` to silence the warning" is a confession, not a pattern.

**In practice**

Exception flow, demonstrated end to end — including the `AggregateException` difference:

```csharp
async Task<string> FlakyAsync(string name, bool explode)
{
    await Task.Delay(100);
    if (explode) throw new InvalidOperationException($"{name} blew up");
    return $"{name} ok";
}

// 1) await rethrows the real exception — catch it like sync code
try
{
    string r = await FlakyAsync("first", explode: true);
}
catch (InvalidOperationException e)
{
    Console.WriteLine($"caught via await: {e.Message}");
}

// 2) exceptions live in the task until observed — nothing prints early
Task<string> pending = FlakyAsync("second", explode: true);
Console.WriteLine("task started; no exception yet — it's stored in the task");
try { await pending; }
catch (InvalidOperationException e) { Console.WriteLine($"surfaced at the await: {e.Message}"); }

// 3) WhenAll with multiple failures: await rethrows the FIRST
Task<string>[] batch =
{
    FlakyAsync("a", explode: true),
    FlakyAsync("b", explode: false),
    FlakyAsync("c", explode: true),
};
Task<string[]> combined = Task.WhenAll(batch);
try { await combined; }
catch (InvalidOperationException e)
{
    Console.WriteLine($"WhenAll rethrew first: {e.Message}");
    Console.WriteLine($"but all are stored:   {combined.Exception!.InnerExceptions.Count} exceptions");
}
```

```text
caught via await: first blew up
task started; no exception yet — it's stored in the task
surfaced at the await: second blew up
WhenAll rethrew first: a blew up
but all are stored:   2 exceptions
```

(The `!` after `combined.Exception` is the null-forgiving operator from the *Nullability*
chapter — `Exception` is nullable because a non-faulted task has none; here we know it
faulted.)

And the shape of the deadlock, so you recognize it in the wild — **read, don't run** (in the
Study tab's console host it "merely" blocks rather than deadlocking, which is the trap's whole
disguise):

```csharp
// UI thread, in an app with a synchronization context:
string data = LoadAsync().Result;   // blocks the UI thread...
// ...while LoadAsync's continuation is queued to run ON the UI thread.
// Each waits for the other. The app freezes forever. The fix:
string data2 = await LoadAsync();
```

> **C corner:** a faulted `Task` is error handling by *value*, like C's "return a struct with
> an error field" — the failure is data sitting in an object until someone looks. `await` is
> the missing half C never had: the look is mandatory-by-convention and re-raises with the
> original context, so errors can't be silently ignored the way an unchecked return code can.

**Try it — Lab:** write `async Task<int> RollAsync(int id)` that awaits `Task.Delay(200)`,
throws `InvalidOperationException($"die {id} cracked")` when `id` is even, else returns
`id * 10`. Start rolls for ids 1..4, `Task.WhenAll` them inside a `try/catch`. Print which
exception the `catch` saw, then print how many exceptions the combined task's `.Exception`
actually holds (expect: first = "die 2 cracked", stored = 2). Bonus: change one roll to be
started-but-never-awaited and confirm its exception never prints at all.

**Traps**

- **"It works in my console app."** `.Result` doesn't deadlock without a synchronization
  context, so the habit forms in console code and detonates later in UI or legacy web code.
  Don't form the habit; the console's forgiveness is the trap.
- **`async void` beyond event handlers** — including lambdas: passing an async lambda where a
  `void`-returning delegate is expected (e.g. `List<T>.ForEach`, timers, the
  `Parallel.ForEach` trap from section 2) silently creates `async void`. If a lambda awaits,
  make sure whatever receives it accepts a `Task`-returning delegate.
- **Catching `AggregateException` around an `await`.** It won't match — `await` rethrows the
  *inner* exception. Catch the real type; if you find yourself needing `AggregateException`,
  you're probably blocking somewhere you shouldn't.
- **`try/catch` around starting the task instead of awaiting it.** The exception surfaces at
  the `await`, so that's what the `try` must enclose. Wrapping just the call that *creates*
  the task catches nothing.

---

## Check yourself

- Can you explain what `await` does to a method that hits an incomplete task — who gets
  control, what a continuation is, and why no thread is blocked meanwhile? If yes, tick
  *Tasks & await* above.
- Could you fetch five things concurrently with `WhenAll`, cap it at two-at-a-time with a
  `SemaphoreSlim`, and make the whole thing give up after 2 seconds via a
  `CancellationTokenSource` — and say when you'd reach for `Parallel.ForEach` instead? If
  yes, tick *Cancellation & parallelism* above.
- Can you explain why `.Result` deadlocks under a synchronization context, why `async void`
  exceptions are uncatchable (and why event handlers get a pass), and where a faulted task's
  exception lives until you await it? If yes, tick *Async gotchas* above.

All three ticked? Tick the chapter. On the Map, the road now forks at the **SPECIALIZE**
crossroad — desktop, web/API, or deeper into the runtime — and everything down every branch
assumes the async model you just built. Before you choose, checkpoint **cp5** is waiting to
test this chapter under exam conditions — see the *Checkpoints & Defenses* page.
