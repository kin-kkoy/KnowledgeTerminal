# Async / Await — Worked Solution

Section numbers match *Async / Await*. This is the last worked chapter of the core branch, and the
point at which the Engine can run a whole day.

Continues the solution from [[04-linq-worked]].

A note on the examples: the chapter uses `HttpClient` because network I/O is the honest motivation
for async. The Engine has no network, so the hauls here are simulated with `Task.Delay`. The
mechanics — suspension, `WhenAll`, cancellation, bounded concurrency — are identical, and when the
guild later talks to a database in *SQL + EF Core*, this is the shape it will already have.

---

## 1. Tasks & await

**What this section produces:** the haul as an operation that takes time, behind an interface so
it can be faked.

##### Engine/Services/IHaulService.cs

```csharp
using Engine.Models;

namespace Engine.Services;

/// <summary>
/// A dragon working a contract. Returns a Task because it takes real time —
/// and takes a CancellationToken because the caller may stop wanting it.
/// </summary>
public interface IHaulService
{
    Task<Delivery> HaulAsync(Dragon dragon, Contract contract, CancellationToken ct = default);
}
```

##### Engine/Services/SimulatedHaulService.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public sealed class SimulatedHaulService : IHaulService
{
    private readonly int _millisecondsPerCrate;

    public SimulatedHaulService(int millisecondsPerCrate = 4)
        => _millisecondsPerCrate = millisecondsPerCrate;

    public async Task<Delivery> HaulAsync(
        Dragon dragon, Contract contract, CancellationToken ct = default)
    {
        // The token goes INTO the wait. A token you accept and never pass on is
        // decorative cancellation — it accepts the request and ignores it.
        await Task.Delay(contract.Quantity * _millisecondsPerCrate, ct);

        return new Delivery(
            dragon.Name,
            contract.Resource,
            contract.Quantity,
            contract.Quantity * 10m);
    }
}
```

Two things to copy from this file. The method is `async Task<Delivery>`, not `async void` — the
only place `async void` belongs is an event handler, because nothing can await it and an exception
inside one cannot be caught. And the `CancellationToken` is passed *down* to `Task.Delay` rather
than merely accepted; a token that isn't plumbed through does nothing at all.

While `Task.Delay` is waiting, no thread is waiting with it. That is the entire point: the thread
went back to the pool and will be handed the continuation when the delay elapses.

---

## 2. Cancellation & parallelism

**What this section produces:** the day's hauls, overlapped deliberately, bounded so the guild
never has more dragons out than it has, and stoppable.

##### Engine/Services/DayRunner.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public sealed record DayResult(
    IReadOnlyList<Delivery> Delivered,
    IReadOnlyList<string> Failed,
    bool Cancelled);

public sealed class DayRunner
{
    private readonly IHaulService _hauls;
    private readonly IGuildLog _log;
    private readonly int _maxConcurrent;

    public DayRunner(IHaulService hauls, IGuildLog log, int maxConcurrent = 3)
    {
        if (maxConcurrent <= 0)
            throw new ArgumentOutOfRangeException(nameof(maxConcurrent));

        _hauls = hauls;
        _log = log;
        _maxConcurrent = maxConcurrent;
    }

    public async Task<DayResult> RunAsync(
        IEnumerable<(Contract Contract, Dragon Dragon)> plan,
        CancellationToken ct = default)
    {
        // Bounded concurrency: never more than _maxConcurrent hauls in flight.
        // Unbounded WhenAll over a large plan is how you exhaust a resource.
        using var slots = new SemaphoreSlim(_maxConcurrent);
        var delivered = new List<Delivery>();
        var failed = new List<string>();
        var cancelled = false;

        var tasks = plan.Select(async assignment =>
        {
            await slots.WaitAsync(ct);
            try
            {
                return await _hauls.HaulAsync(assignment.Dragon, assignment.Contract, ct);
            }
            finally
            {
                slots.Release();       // released even if the haul threw or was cancelled
            }
        }).ToList();                   // ToList STARTS them — Select alone is lazy

        try
        {
            // WhenAll, not a loop of awaits: the hauls overlap instead of queueing.
            var results = await Task.WhenAll(tasks);
            delivered.AddRange(results);
        }
        catch (OperationCanceledException)
        {
            cancelled = true;
            _log.Write("the day was cut short");
        }
        catch (Exception)
        {
            // WhenAll rethrows only the FIRST exception. To report them all,
            // inspect the tasks themselves after the fact.
            foreach (var task in tasks)
            {
                if (task.IsCompletedSuccessfully)
                    delivered.Add(task.Result);
                else if (task.Exception?.InnerException is { } inner)
                    failed.Add(inner.Message);
            }
        }

        return new DayResult(delivered, failed, cancelled);
    }
}
```

The `.ToList()` on the `Select` is not cosmetic, and it is the same lesson as
[[04-linq-worked]] section 2 wearing different clothes. `Select` is lazy: without materialising,
the async lambdas would not start until `Task.WhenAll` enumerated them, and you would have written
something that *looks* concurrent and runs one at a time.

The `finally` around `slots.Release()` is the other load-bearing line. If a haul throws or is
cancelled while holding a slot and never releases it, the semaphore leaks permits until nothing
can run at all — a deadlock you will spend an evening on.

`Task.WhenAll` rethrows only the first exception it saw. The `catch (Exception)` block above is the
standard way to recover *all* of them: walk the tasks afterwards and read their state.

---

## 3. Async gotchas

**What this section produces:** the whole guild, run for one day, from a front-end that awaits
properly all the way down.

##### GuildConsole/Program.cs

```csharp
using Engine.Models;
using Engine.Services;
using GuildConsole;

IGuildLog log = new ConsoleLog();

var roster = new Roster();
roster.Add(new MiningDragon("Ironjaw"));
roster.Add(new ForestDragon("Mossback"));
roster.Add(new TransportDragon("Longtail"));

var warehouse = new Warehouse(capacity: 100);
warehouse.Overflowed += (resource, crates) =>
    log.Write($"WAREHOUSE FULL: {crates} crates of {resource} turned away");

var board = new ContractBoard();
board.Post(new Contract("Stone", 40, "Mining", daysRemaining: 2));
board.Post(new Contract("Timber", 20, "Forest", daysRemaining: 9));
board.Post(new Contract("Ember Crystals", 5, "Fire", daysRemaining: 4));

var contracts = new List<Contract>();
while (board.TakeNext() is { } contract)
    contracts.Add(contract);

var plan = new ShiftPlanner(roster, log).PlanDay(contracts);

// Ctrl+C cancels the day instead of killing the process mid-haul.
using var cts = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) =>
{
    e.Cancel = true;      // we handle it; don't tear the process down
    cts.Cancel();
};

var runner = new DayRunner(new SimulatedHaulService(), log, maxConcurrent: 2);

// await, all the way down. No .Result, no .Wait() anywhere in this program.
DayResult day = await runner.RunAsync(plan, cts.Token);

foreach (var delivery in day.Delivered.OrderBy(d => d.DragonName))
{
    warehouse.TryStore(delivery.Resource, delivery.Crates);
    log.Write($"{delivery.DragonName} delivered {delivery.Crates} {delivery.Resource}");
}

Console.WriteLine();
Console.WriteLine("-- earnings per dragon --");
foreach (var row in DeliveryReport.PerDragon(roster, day.Delivered))
    Console.WriteLine($"{row.Name,-10} {row.Deliveries} deliveries  {row.Gold,8:F2} gold");

Console.WriteLine($"warehouse: {warehouse.Used} of {warehouse.Capacity} crates used");
```

```text
[guild] Ironjaw assigned to Stone (2 days left)
[guild] nothing available for the Ember Crystals contract
[guild] Mossback assigned to Timber (9 days left)
[guild] Ironjaw delivered 40 Stone
[guild] Mossback delivered 20 Timber

-- earnings per dragon --
Ironjaw    1 deliveries    400.00 gold
Mossback   1 deliveries    200.00 gold
Longtail   0 deliveries      0.00 gold
warehouse: 60 of 100 crates used
```

That output is stable run to run even though the hauls overlap, and it is worth knowing why:
`Task.WhenAll` returns results in the order the tasks were *created*, not the order they finished,
and the report sorts explicitly on top of that. Concurrency changed how long the day took, not what
the ledger says. If your async code's output order drifts between runs, you are relying on
completion order somewhere and should sort instead.

The four gotchas from the chapter, and where this program avoids each:

**No `.Result` or `.Wait()` anywhere.** The program awaits from the top. Top-level statements
support `await` directly, which is why there is no `Main` to make `async` — and no place for the
deadlock to hide. In a console app `.Result` merely blocks a thread rather than deadlocking, which
is exactly what makes the habit look safe until it moves into an app that has a synchronization
context.

**No `async void`.** Every async method here returns `Task` or `Task<T>`. The one lambda that
isn't awaited is the `CancelKeyPress` handler, which is synchronous — it sets a flag and returns.

**No sequential awaits over independent work.** The hauls go through `Task.WhenAll` inside
`DayRunner`, not a `foreach` with an `await` in it. A loop of awaits would make three 160-ms hauls
take 480 ms for no reason.

**No fire-and-forget.** Every task created is awaited, so no exception goes unobserved.

**Cancellation is plumbed, not decorative.** `cts.Token` goes into `RunAsync`, which passes it to
`WaitAsync` and to `HaulAsync`, which passes it to `Task.Delay`. A token that stops at the first
method that accepts it cancels nothing.

##### Engine.Tests/DayRunnerTests.cs

```csharp
using Engine.Models;
using Engine.Services;
using Xunit;

namespace Engine.Tests;

public class DayRunnerTests
{
    private sealed class InstantHaulService : IHaulService
    {
        public Task<Delivery> HaulAsync(
            Dragon dragon, Contract contract, CancellationToken ct = default)
            => Task.FromResult(new Delivery(dragon.Name, contract.Resource, contract.Quantity, 10m));
    }

    [Fact]
    public async Task Delivers_every_planned_haul()
    {
        var runner = new DayRunner(new InstantHaulService(), new FakeLog());
        var ironjaw = new MiningDragon("Ironjaw");
        var stone = new Contract("Stone", 40, "Mining", daysRemaining: 2);

        var result = await runner.RunAsync([(stone, ironjaw)]);

        Assert.Single(result.Delivered);
        Assert.False(result.Cancelled);
        Assert.Equal("Ironjaw", result.Delivered[0].DragonName);
    }

    [Fact]
    public async Task Reports_cancellation_rather_than_throwing()
    {
        var runner = new DayRunner(new SimulatedHaulService(millisecondsPerCrate: 50),
                                   new FakeLog());
        var ironjaw = new MiningDragon("Ironjaw");
        var stone = new Contract("Stone", 40, "Mining", daysRemaining: 2);

        using var cts = new CancellationTokenSource();
        var running = runner.RunAsync([(stone, ironjaw)], cts.Token);
        await cts.CancelAsync();

        var result = await running;

        Assert.True(result.Cancelled);
        Assert.Empty(result.Delivered);
    }
}
```

The first test is the reason `IHaulService` is an interface. `InstantHaulService` returns a
completed task with no delay at all, so the test is instant and deterministic — no
`Task.Delay`, no sleeping, no flaky timing. That is what "program to the contract" buys you when
the contract is over something slow.

---

## Where this leaves the guild

The core branch is done, and the Engine now holds:

```
Engine/
├── Models/       Dragon (+3 kinds), Contract, Cargo, Delivery, Payment,
│                 LedgerReport, Warehouse, Spot, GuildMap, ResourceDefinition, INamed
├── Factories/    GuildCatalogue
└── Services/     IGuildLog, AssignmentService, ShiftPlanner, Roster, ContractBoard,
                  Repository<T>, DeliveryReport, PriorityService, CommandParser,
                  CargoExtensions, LedgerReader, IHaulService, SimulatedHaulService, DayRunner
GuildConsole/     Program.cs, ConsoleLog
Engine.Tests/     LedgerReaderTests, AssignmentServiceTests, DayRunnerTests, FakeLog
```

Every rule lives in `Engine`, which contains no `Console.` anywhere — check it with
`grep -rn "Console\." Engine/` and expect nothing. Everything the player sees lives in
`GuildConsole`.

That is what makes the next front-ends cheap. A Terminal.Gui app and an Avalonia app are new
projects that reference this same untouched Engine and supply their own `IGuildLog` — one writes
to a scrolling pane, one to a bound observable collection. The game does not find out.
