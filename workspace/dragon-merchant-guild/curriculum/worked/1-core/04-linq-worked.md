# LINQ — Worked Solution

Section numbers match *LINQ*. This is where the loops the Engine has been writing by hand turn
into pipelines that read like the question being asked.

Continues the solution from [[03-collections-generics-worked]].

---

## 1. The core five + pipelines

**What this section produces:** the roster queries, rewritten as pipelines.

##### Engine/Services/Roster.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public class Roster
{
    private readonly List<Dragon> _dragons = [];
    private readonly Dictionary<string, Dragon> _byName = [];
    private readonly HashSet<string> _onShift = [];

    public int Count => _dragons.Count;

    public IReadOnlyList<Dragon> All => _dragons;

    public void Add(Dragon dragon)
    {
        if (_byName.ContainsKey(dragon.Name))
            throw new InvalidOperationException($"{dragon.Name} is already on the roster");

        _dragons.Add(dragon);
        _byName[dragon.Name] = dragon;
    }

    public bool TryFind(string name, out Dragon? dragon) => _byName.TryGetValue(name, out dragon);

    public bool SendOnShift(string name) => _byName.ContainsKey(name) && _onShift.Add(name);

    public bool IsOnShift(string name) => _onShift.Contains(name);

    public void EndOfDay() => _onShift.Clear();

    public IEnumerable<Dragon> Available() =>
        _dragons.Where(d => d.IsFitToWork && !_onShift.Contains(d.Name));

    public IEnumerable<Dragon> OfRole(string role) =>
        _dragons.Where(d => d.Role == role);

    /// <summary>The most productive dragons that can actually work today.</summary>
    public IEnumerable<Dragon> BestAvailable(int take) =>
        Available()
            .OrderByDescending(d => d.DayOutput())
            .ThenBy(d => d.Name)
            .Take(take);

    /// <summary>Null when nothing suitable is free — absence is normal, so no throw.</summary>
    public Dragon? BestFor(Contract contract) =>
        Available()
            .Where(d => d.CanTake(contract))
            .OrderByDescending(d => d.DayOutput())
            .FirstOrDefault();

    public int TotalDailyOutput() => _dragons.Sum(d => d.DayOutput());
}
```

**Since [[03-collections-generics-worked]]:** the two hand-written iterators became one-line
`Where` calls. They behave identically — `Where` is itself lazy, so `Available()` still computes
nothing until iterated — but the intent is now on the surface instead of buried in a loop.

Three deliberate choices in the new methods:

`ThenBy(d => d.Name)` after `OrderByDescending`, not a second `OrderBy` — a second `OrderBy` would
discard the output ranking entirely. It's there to make ties deterministic, so the same roster
always produces the same answer.

`FirstOrDefault`, not `First`, in `BestFor` — having no suitable dragon free is an ordinary
Tuesday, not a bug, and the `Dragon?` return type says so out loud.

`Sum` in `TotalDailyOutput` — where a loop with an accumulator was three lines of bookkeeping and
one line of meaning.

---

## 2. Deferred execution

**What this section produces:** the one place in the Engine where laziness must be stopped
deliberately.

##### Engine/Services/ShiftPlanner.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public class ShiftPlanner
{
    private readonly Roster _roster;
    private readonly IGuildLog _log;

    public ShiftPlanner(Roster roster, IGuildLog log)
    {
        _roster = roster;
        _log = log;
    }

    /// <summary>
    /// Assigns the best available dragon to each contract it can staff.
    ///
    /// The ToList() is load-bearing. Available() is a live query over the roster,
    /// and SendOnShift mutates what it reads — iterating it while assigning would
    /// change the sequence mid-walk. Materialise the plan first, then act on it.
    /// </summary>
    public List<(Contract Contract, Dragon Dragon)> PlanDay(IEnumerable<Contract> contracts)
    {
        var plan = new List<(Contract, Dragon)>();

        foreach (var contract in contracts.Where(c => c.AssignedDragon is null)
                                          .OrderBy(c => c.DaysRemaining)
                                          .ToList())          // snapshot, then act
        {
            var dragon = _roster.BestFor(contract);
            if (dragon is null)
            {
                _log.Write($"nothing available for the {contract.Resource} contract");
                continue;
            }

            contract.AssignTo(dragon);
            _roster.SendOnShift(dragon.Name);
            plan.Add((contract, dragon));
            _log.Write($"{dragon.Name} assigned to {contract.Resource} "
                       + $"({contract.DaysRemaining} days left)");
        }

        return plan;
    }
}
```

This is the chapter's central warning, made concrete. `contracts.Where(...).OrderBy(...)` is a
recipe; the `foreach` is what runs it. Inside the loop, `AssignTo` changes the very property the
`Where` filters on, and `SendOnShift` changes what `BestFor` will see next time. Without
`.ToList()`, you are re-running a query over data you are actively changing.

The rule to take away: **materialise before you mutate.** If the loop body changes what the query
reads, snapshot the query first.

---

## 3. GroupBy, Join, SelectMany

**What this section produces:** the day's report — and the guard against the report quietly
losing a dragon.

##### Engine/Models/Delivery.cs

```csharp
namespace Engine.Models;

/// <summary>One completed haul. A value: what it contains is all it is.</summary>
public record Delivery(string DragonName, string Resource, int Crates, decimal Gold);
```

##### Engine/Services/DeliveryReport.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public record DragonEarnings(string Name, int Deliveries, decimal Gold);

public static class DeliveryReport
{
    /// <summary>
    /// Earnings per dragon. Driven from the ROSTER, not from the deliveries, so a
    /// dragon that hauled nothing today appears with a zero instead of vanishing.
    /// </summary>
    public static IEnumerable<DragonEarnings> PerDragon(
        Roster roster, IEnumerable<Delivery> deliveries)
    {
        var byDragon = deliveries.ToLookup(d => d.DragonName);

        return roster.All
            .Select(dragon => new DragonEarnings(
                dragon.Name,
                byDragon[dragon.Name].Count(),
                byDragon[dragon.Name].Sum(d => d.Gold)))
            .OrderByDescending(e => e.Gold)
            .ThenBy(e => e.Name);
    }

    /// <summary>Totals per resource. Here GroupBy is right: no resource is "missing".</summary>
    public static IEnumerable<(string Resource, int Crates, decimal Gold)> PerResource(
        IEnumerable<Delivery> deliveries) =>
        deliveries
            .GroupBy(d => d.Resource)
            .Select(g => (Resource: g.Key,
                          Crates: g.Sum(d => d.Crates),
                          Gold: g.Sum(d => d.Gold)))
            .OrderByDescending(r => r.Gold);

    /// <summary>Every resource any dragon touched today, flattened and deduplicated.</summary>
    public static IEnumerable<string> ResourcesTouched(IEnumerable<Delivery> deliveries) =>
        deliveries
            .SelectMany(d => new[] { d.Resource })
            .Distinct()
            .OrderBy(r => r);
}
```

`PerDragon` is the chapter's missing-Longtail bug, prevented by construction. Grouping the
deliveries would produce buckets only for dragons that delivered something; a transport dragon
hauls between facilities and delivers nothing to the ledger, so it would silently drop off the
report and a manager would conclude the guild had fewer dragons than it does.

Driving from `roster.All` guarantees one row per dragon. `ToLookup` does the indexing once
up front — and unlike `Dictionary`, a lookup returns an **empty sequence** for a missing key
rather than throwing, so `.Count()` is `0` and `.Sum(...)` is `0m` with no special case.

`PerResource` uses `GroupBy` and is right to: a resource nobody delivered has no row to be missing
from. The rule is not "never use GroupBy" — it is **drive the query from whichever side must be
complete.**

---

## 4. Delegates & events

**What this section produces:** the warehouse announcing trouble without knowing who is listening.

##### Engine/Models/Warehouse.cs

```csharp
namespace Engine.Models;

public class Warehouse
{
    private readonly Dictionary<string, int> _crates = [];

    public int Capacity { get; }

    /// <summary>
    /// Raised when a delivery would not fit, carrying the crates turned away.
    /// Nullable, because an event with no subscribers is null.
    /// </summary>
    public event Action<string, int>? Overflowed;

    public Warehouse(int capacity)
    {
        if (capacity <= 0)
            throw new ArgumentOutOfRangeException(nameof(capacity));

        Capacity = capacity;
    }

    public int Used => _crates.Values.Sum();

    public int Free => Capacity - Used;

    public int CratesOf(string resource) => _crates.TryGetValue(resource, out int n) ? n : 0;

    public IReadOnlyDictionary<string, int> Contents => _crates;

    public bool TryStore(string resource, int crates)
    {
        if (crates <= 0)
            throw new ArgumentOutOfRangeException(nameof(crates));

        int overflow = Used + crates - Capacity;
        if (overflow > 0)
        {
            Overflowed?.Invoke(resource, overflow);   // fire only if someone subscribed
            return false;
        }

        _crates[resource] = CratesOf(resource) + crates;
        return true;
    }

    public int Ship(string resource, int crates)
    {
        if (crates <= 0)
            throw new ArgumentOutOfRangeException(nameof(crates));

        int held = CratesOf(resource);
        if (crates > held)
            throw new InvalidOperationException($"only {held} crates of {resource} in storage");

        _crates[resource] = held - crates;
        return _crates[resource];
    }
}
```

**Since [[03-collections-generics-worked]]:** `Used` collapsed from a seven-line loop to
`_crates.Values.Sum()`, and the class gained an event.

The event is the point. `Warehouse` announces that a delivery overflowed; it does not decide what
that means. The console front-end prints a warning; a future GUI might flash a panel; a test can
subscribe and assert. None of them require `Warehouse` to change, and `Warehouse` knows about none
of them — which is the same decoupling `IGuildLog` gave the Engine, arriving from the other
direction: an interface is *who to tell*, an event is *announce and let whoever cares listen*.

`Overflowed?.Invoke(...)` with the null-conditional is not optional. Invoking a subscriber-less
event bare is a `NullReferenceException`.

##### GuildConsole/Program.cs

```csharp
using Engine.Factories;
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

var planner = new ShiftPlanner(roster, log);
planner.PlanDay(contracts);

warehouse.TryStore("Stone", 80);
warehouse.TryStore("Timber", 40);           // 120 > 100 — fires Overflowed

Delivery[] today =
[
    new("Ironjaw", "Stone", 40, 429m),
    new("Mossback", "Timber", 20, 235m),
    new("Ironjaw", "Iron Ore", 12, 300m),
];

Console.WriteLine();
Console.WriteLine("-- earnings per dragon --");
foreach (var row in DeliveryReport.PerDragon(roster, today))
    Console.WriteLine($"{row.Name,-10} {row.Deliveries} deliveries  {row.Gold,8:F2} gold");

Console.WriteLine("-- resources touched --");
Console.WriteLine(string.Join(", ", DeliveryReport.ResourcesTouched(today)));
```

```text
[guild] Ironjaw assigned to Stone (2 days left)
[guild] nothing available for the Ember Crystals contract
[guild] Mossback assigned to Timber (9 days left)
[guild] WAREHOUSE FULL: 20 crates of Timber turned away

-- earnings per dragon --
Ironjaw    2 deliveries    729.00 gold
Mossback   1 deliveries    235.00 gold
Longtail   0 deliveries      0.00 gold
-- resources touched --
Iron Ore, Stone, Timber
```

Read the last three report lines against the chapter's warning. **Longtail is on the report**, with
a zero, because `PerDragon` walks the roster. Had it grouped the deliveries, those three lines
would have been two, and nothing would have told you.

(`{row.Name,-10}` and `{row.Gold,8:F2}` are alignment specifiers — pad to 10 left-aligned, 8
right-aligned. Fixed-point, not `:C`: the currency symbol would depend on the machine's culture.)
