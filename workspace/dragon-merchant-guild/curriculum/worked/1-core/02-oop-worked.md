# Object-Oriented Programming — Worked Solution

Section numbers match *Object-Oriented Programming*. This is the chapter where the Engine stops
being a handful of classes and starts being a design.

Continues the solution from [[01-fundamentals-worked]].

---

## 1. Encapsulation & properties

**What this section produces:** a dragon that cannot be put into an illegal state by anyone,
including you.

##### Engine/Models/Dragon.cs

```csharp
namespace Engine.Models;

public class Dragon
{
    private int _rest = 100;

    public string Name { get; }
    public string Role { get; }

    /// <summary>Every write funnels through here, so 0..100 is true by construction.</summary>
    protected int Rest
    {
        get => _rest;
        set => _rest = Math.Clamp(value, 0, 100);
    }

    public int RestLevel => _rest;
    public bool IsFitToWork => _rest >= 30;
    public string Condition => $"rest {_rest}, fit to work: {IsFitToWork}";

    public Dragon(string name, string role)
    {
        Name = name;
        Role = role;
    }

    public bool CanTake(Contract contract) => Role == contract.RequiredRole;

    public void WorkShift(int hours)
    {
        if (hours <= 0)
            throw new ArgumentOutOfRangeException(nameof(hours));

        Rest -= hours * 5;
    }

    public void Feed(int nourishment)
    {
        if (nourishment <= 0)
            throw new ArgumentOutOfRangeException(nameof(nourishment));

        Rest += nourishment;
    }
}
```

**Since [[00-program-structure-worked]]:** `Feed` arrived, and both it and `WorkShift` now
validate their arguments. Note the shape: `Rest` is `protected` with a clamping setter,
`RestLevel` is the public read-only view, and the only two things in the program that can move a
dragon's rest are the two methods above. There is no fourth way in.

---

## 2. Inheritance & polymorphism

**What this section produces:** the roster's three kinds of dragon, and a base class that can no
longer be instantiated on its own.

##### Engine/Models/Dragon.cs

```csharp
namespace Engine.Models;

public abstract class Dragon
{
    private int _rest = 100;

    public string Name { get; }
    public string Role { get; }

    protected int Rest
    {
        get => _rest;
        set => _rest = Math.Clamp(value, 0, 100);
    }

    public int RestLevel => _rest;
    public bool IsFitToWork => _rest >= 30;
    public string Condition => $"rest {_rest}, fit to work: {IsFitToWork}";

    protected Dragon(string name, string role)
    {
        Name = name;
        Role = role;
    }

    /// <summary>Every kind of dragon must answer this. The base has no sensible default.</summary>
    public abstract int DayOutput();

    /// <summary>A default every kind MAY replace.</summary>
    public virtual string Describe() => $"{Name} produces {DayOutput()} crates a day";

    public bool CanTake(Contract contract) => Role == contract.RequiredRole;

    public void WorkShift(int hours)
    {
        if (hours <= 0)
            throw new ArgumentOutOfRangeException(nameof(hours));

        Rest -= hours * 5;
    }

    public void Feed(int nourishment)
    {
        if (nourishment <= 0)
            throw new ArgumentOutOfRangeException(nameof(nourishment));

        Rest += nourishment;
    }
}
```

##### Engine/Models/MiningDragon.cs

```csharp
namespace Engine.Models;

public sealed class MiningDragon : Dragon
{
    public MiningDragon(string name) : base(name, "Mining") { }

    public override int DayOutput() => 12;

    public void DigShaft() => Rest -= 25;
}
```

##### Engine/Models/ForestDragon.cs

```csharp
namespace Engine.Models;

public sealed class ForestDragon : Dragon
{
    public ForestDragon(string name) : base(name, "Forest") { }

    public override int DayOutput() => 9;
}
```

##### Engine/Models/TransportDragon.cs

```csharp
namespace Engine.Models;

public sealed class TransportDragon : Dragon
{
    public TransportDragon(string name) : base(name, "Transport") { }

    /// <summary>Hauls between facilities; produces nothing for the ledger.</summary>
    public override int DayOutput() => 0;

    public override string Describe()
        => base.Describe() + ", but hauls 60 between facilities";
}
```

**Since the last section:** three changes worth naming.

`Dragon` became `abstract`, and its constructor became `protected` — you can no longer write
`new Dragon(...)`, because "a dragon of no particular kind" isn't a thing the guild has. The
compiler now enforces that.

`DayOutput` is `abstract`, so every new kind of dragon is *forced* to answer it. Adding a
`WaterDragon` tomorrow cannot silently inherit a wrong default, because there is no default.

All three subclasses are `sealed`. None of them was designed as an extension point, and saying so
costs one word.

---

## 3. Interfaces & abstraction

**What this section produces:** the seam that keeps the Engine front-end-neutral — and the reason
the `Action<string>` from Milestone 0 was only ever a placeholder.

##### Engine/Services/IGuildLog.cs

```csharp
namespace Engine.Services;

/// <summary>
/// How the Engine says what happened. It has no idea whether that ends up on a
/// console, in a GUI panel, or in a list inside a test.
/// </summary>
public interface IGuildLog
{
    void Write(string message);

    /// <summary>A default implementation: implementers get it free.</summary>
    void WriteAll(IEnumerable<string> messages)
    {
        foreach (var message in messages)
            Write(message);
    }
}
```

##### Engine/Services/AssignmentService.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public class AssignmentService
{
    private readonly IGuildLog _log;

    /// <summary>Constructor injection: the caller decides where the words go.</summary>
    public AssignmentService(IGuildLog log) => _log = log;

    public bool AssignToContract(Dragon dragon, Contract contract)
    {
        if (!dragon.IsFitToWork)
        {
            _log.Write($"{dragon.Name} is not fit to work.");
            return false;
        }

        if (!dragon.CanTake(contract))
        {
            _log.Write($"{dragon.Name} is the wrong sort of dragon for this.");
            return false;
        }

        contract.AssignTo(dragon);
        _log.Write($"{dragon.Name} assigned to the {contract.Resource} contract.");
        return true;
    }
}
```

The real implementation lives in the **front-end project**, not the Engine — because it prints,
and printing is a screen's business:

##### GuildConsole/ConsoleLog.cs

```csharp
using Engine.Services;

namespace GuildConsole;

public sealed class ConsoleLog : IGuildLog
{
    public void Write(string message) => Console.WriteLine($"[guild] {message}");
}
```

and the test double lives in the test project:

##### Engine.Tests/FakeLog.cs

```csharp
using Engine.Services;

namespace Engine.Tests;

/// <summary>Records instead of acting, so tests can assert on what the Engine said.</summary>
public sealed class FakeLog : IGuildLog
{
    public List<string> Lines { get; } = [];

    public void Write(string message) => Lines.Add(message);
}
```

##### Engine.Tests/AssignmentServiceTests.cs

```csharp
using Engine.Models;
using Engine.Services;
using Xunit;

namespace Engine.Tests;

public class AssignmentServiceTests
{
    [Fact]
    public void Refuses_a_dragon_of_the_wrong_role()
    {
        var log = new FakeLog();
        var service = new AssignmentService(log);
        var ironjaw = new MiningDragon("Ironjaw");
        var timber = new Contract("Timber", 20, "Forest", daysRemaining: 5);

        Assert.False(service.AssignToContract(ironjaw, timber));
        Assert.Null(timber.AssignedDragon);
        Assert.Contains("wrong sort", log.Lines[0]);
    }

    [Fact]
    public void Refuses_an_exhausted_dragon()
    {
        var log = new FakeLog();
        var service = new AssignmentService(log);
        var ironjaw = new MiningDragon("Ironjaw");
        ironjaw.WorkShift(20);                       // rest floored at 0
        var stone = new Contract("Stone", 40, "Mining", daysRemaining: 5);

        Assert.False(service.AssignToContract(ironjaw, stone));
        Assert.Contains("not fit", log.Lines[0]);
    }
}
```

**Since the last section:** `AssignmentService` stopped taking an `Action<string>` and started
taking an `IGuildLog`. The behaviour is identical; what changed is that the contract now has a
name, can grow a second method without breaking callers, and can be implemented by a class that
records rather than prints.

That last point is the one that pays: those two tests assert on the Engine's own words, with no
console involved and nothing to clean up afterwards. `AssignToContract` also now returns a `bool`
— because a test asserting on log text alone is a test that breaks when you reword a message.

---

## 4. Records & value equality

**What this section produces:** the guild's values, as distinct from its actors.

##### Engine/Models/Cargo.cs

```csharp
namespace Engine.Models;

/// <summary>
/// A quantity of one resource. A VALUE: two lots of 40 Stone are the same thing,
/// so equality compares contents, and "changing" one produces a new one.
/// </summary>
public record Cargo(string Resource, int Crates)
{
    public Cargo Add(Cargo other)
    {
        if (Resource != other.Resource)
            throw new InvalidOperationException(
                $"cannot add {other.Resource} to {Resource}");

        return this with { Crates = Crates + other.Crates };
    }

    public Cargo Take(int crates)
    {
        if (crates <= 0 || crates > Crates)
            throw new ArgumentOutOfRangeException(nameof(crates));

        return this with { Crates = Crates - crates };
    }
}
```

The whole of the guild's type system now divides cleanly, and it's worth reading the list as a
list:

| Records — values | Classes — actors |
|---|---|
| `Cargo`, `Payment`, `LedgerReport` | `Dragon` and its three kinds |
| `Spot` (a `readonly struct`, same reasoning) | `Contract`, `Warehouse` |
| | `AssignmentService`, `GuildCatalogue` |

The test is always the same question: **is this thing defined by what it contains, or by which one
it is?** Two lots of 40 Stone are interchangeable. Two dragons named Ironjaw are not.

Note that `Add` and `Take` return new `Cargo` values rather than mutating. Nobody else holding
that cargo is affected by your arithmetic — which removes a whole category of bug that a mutable
`Cargo` would have handed you for free.

##### GuildConsole/Program.cs

```csharp
using Engine.Factories;
using Engine.Models;
using Engine.Services;
using GuildConsole;

IGuildLog log = new ConsoleLog();
var assignments = new AssignmentService(log);

Dragon[] roster =
[
    new MiningDragon("Ironjaw"),
    new ForestDragon("Mossback"),
    new TransportDragon("Longtail"),
];

foreach (var dragon in roster)
    Console.WriteLine(dragon.Describe());

var stone = new Contract("Stone", 40, "Mining", daysRemaining: 2);
assignments.AssignToContract(roster[0], stone);
assignments.AssignToContract(roster[1], stone);          // wrong role

Console.WriteLine($"{stone.Resource}: {PriorityService.Priority(stone)}, "
                  + $"assigned to {stone.AssignedName}");

var haul = new Cargo("Stone", 40).Add(new Cargo("Stone", 25));
Console.WriteLine(haul);

var ore = GuildCatalogue.ResourceByName("Iron Ore");
Console.WriteLine($"{ore?.Name} is a {ore?.Category} resource");
```

```text
Ironjaw produces 12 crates a day
Mossback produces 9 crates a day
Longtail produces 0 crates a day, but hauls 60 between facilities
[guild] Ironjaw assigned to the Stone contract.
[guild] Mossback is the wrong sort of dragon for this.
Stone: urgent, assigned to Ironjaw
Cargo { Resource = Stone, Crates = 65 }
Iron Ore is a Raw resource
```

Read the first three lines against the `foreach` that produced them: the loop knows only `Dragon`,
and each object answered for itself. Read the last three against the classes involved: `Cargo`
printed its contents because a record generates `ToString`, and `ore?.Name` didn't crash because
`ResourceByName` is honest about returning `null`.
