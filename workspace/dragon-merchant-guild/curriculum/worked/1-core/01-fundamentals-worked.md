# C# Fundamentals — Worked Solution

The chapter's examples, as they land in the Engine. Section numbers match
*C# Fundamentals*, so you can read the two side by side.

Everything here continues the solution from [[00-program-structure-worked]]. Files that already
exist are shown in full again when they change, so you never have to reconstruct a file from a
diff.

---

## 1. Value vs reference

**What this section produces:** the guild's one genuine value type, next to its reference types.

##### Engine/Models/Spot.cs

```csharp
namespace Engine.Models;

/// <summary>A position on the guild map. Small, immutable, copied on assignment.</summary>
public readonly struct Spot
{
    public int X { get; }
    public int Y { get; }

    public Spot(int x, int y)
    {
        X = x;
        Y = y;
    }

    public override string ToString() => $"({X}, {Y})";
}
```

`readonly struct` is the shape to reach for when you write one: small, a handful of fields, and
frozen after construction. That combination avoids every trap in the chapter's Traps list at once
— you cannot mutate a copy and be surprised, because you cannot mutate it at all.

Everything else in the Engine is a `class`, and deliberately: `Dragon`, `Contract`, `Warehouse`
and `Guild` all have identity and a lifetime. There is one Mossback.

---

## 2. Nullability & patterns

**What this section produces:** "not assigned yet" as a real state the type system knows about,
and the priority rule as a table instead of a ladder.

##### Engine/Models/Contract.cs

```csharp
namespace Engine.Models;

public class Contract
{
    public string Resource { get; }
    public int Quantity { get; }
    public string RequiredRole { get; }
    public int DaysRemaining { get; private set; }

    /// <summary>Null until a dragon is assigned. That is a normal state, not an error.</summary>
    public Dragon? AssignedDragon { get; private set; }

    public Contract(string resource, int quantity, string requiredRole, int daysRemaining)
    {
        Resource = resource;
        Quantity = quantity;
        RequiredRole = requiredRole;
        DaysRemaining = daysRemaining;
    }

    public void AssignTo(Dragon dragon) => AssignedDragon = dragon;

    public void PassDay() => DaysRemaining = Math.Max(0, DaysRemaining - 1);

    public bool IsOverdue => DaysRemaining == 0;

    /// <summary>Who is on this contract, or a readable stand-in. Never throws.</summary>
    public string AssignedName => AssignedDragon?.Name ?? "unassigned";
}
```

##### Engine/Services/PriorityService.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public static class PriorityService
{
    public static string Priority(Contract contract) => contract switch
    {
        { DaysRemaining: 0 }    => "overdue",
        { DaysRemaining: < 3 }  => "urgent",
        { DaysRemaining: < 14 } => "normal",
        _                       => "plenty of time",
    };

    public static string DescribeLoad(int? crates) => crates switch
    {
        null         => "not counted yet",
        < 0          => "impossible",
        0            => "empty",
        > 0 and < 10 => "a small load",
        _            => "a full wagon",
    };
}
```

**Since the last section:** `Contract` gained `DaysRemaining` and the nullable
`AssignedDragon`. Note `AssignedName` — the null-handling happens *once*, inside the class, so no
caller anywhere has to remember the `?? "unassigned"`. That is the pattern: push the null question
to the place that owns the data, and hand out something that can't be null.

The arm order in `Priority` is load-bearing. `{ DaysRemaining: < 3 }` would also match 0, so
`{ DaysRemaining: 0 }` must come first or nothing is ever overdue.

---

## 3. Methods & the C-corner

**What this section produces:** the Try-pattern at the Engine's input boundary, and an extension
method for labelling cargo.

##### Engine/Services/CommandParser.cs

```csharp
namespace Engine.Services;

/// <summary>
/// Turns whatever the player typed into something the Engine can act on.
/// Bad input is expected here, so nothing in this file throws.
/// </summary>
public static class CommandParser
{
    public static bool TryParseQuantity(string? input, out int crates)
    {
        crates = 0;

        if (string.IsNullOrWhiteSpace(input))
            return false;

        return int.TryParse(input.Trim(), out crates) && crates > 0;
    }

    public static (int Lightest, int Heaviest) LoadRange(int[] loads)
    {
        if (loads.Length == 0)
            throw new ArgumentException("no loads recorded", nameof(loads));

        int min = loads[0], max = loads[0];
        foreach (var load in loads)
        {
            if (load < min) min = load;
            if (load > max) max = load;
        }

        return (min, max);
    }
}
```

##### Engine/Services/CargoExtensions.cs

```csharp
namespace Engine.Services;

public static class CargoExtensions
{
    public static string ToCargoLabel(this string resource, int units) => $"{units} x {resource}";
}
```

**Since the last section:** the split from the chapter, made structural. `TryParseQuantity`
returns `false` for garbage because a player typing `lots` is Tuesday. `LoadRange` *throws* for an
empty array because no sane caller asks for the range of nothing — that's a bug in the caller, not
a typo by a person.

---

## 4. Errors & IO

**What this section produces:** the storage rules, enforced with exceptions, and the guild's
first file.

##### Engine/Models/Warehouse.cs

```csharp
namespace Engine.Models;

public class Warehouse
{
    private int _used;

    public int Capacity { get; }
    public int Used => _used;
    public int Free => Capacity - _used;

    public Warehouse(int capacity)
    {
        if (capacity <= 0)
            throw new ArgumentOutOfRangeException(nameof(capacity));

        Capacity = capacity;
    }

    /// <summary>Expected failure: it simply might not fit. Returns false, does not throw.</summary>
    public bool TryStore(int crates)
    {
        if (crates <= 0)
            throw new ArgumentOutOfRangeException(nameof(crates));

        if (_used + crates > Capacity)
            return false;

        _used += crates;
        return true;
    }

    /// <summary>Broken rule: you cannot ship what is not there.</summary>
    public int Ship(int crates)
    {
        if (crates <= 0)
            throw new ArgumentOutOfRangeException(nameof(crates));

        if (crates > _used)
            throw new InvalidOperationException("not enough in storage");

        _used -= crates;
        return _used;
    }
}
```

Both kinds of failure live in one class, and the difference is the whole of section 4. Storing
more than fits is a fact about the world, so `TryStore` reports it. Shipping crates that don't
exist means some caller's arithmetic is wrong, so `Ship` throws and refuses to continue.

Note that gold and quantities are `decimal` wherever money is involved — never `double`. See the
ledger below.

---

## 5. Mini-project: C→C# port

**What this section produces:** the ledger reader, and the first tests in the solution.

##### Engine/Models/Payment.cs

```csharp
namespace Engine.Models;

/// <summary>One line of the guild ledger. A value: defined entirely by its contents.</summary>
public record Payment(string Resource, decimal Gold);
```

##### Engine/Models/LedgerReport.cs

```csharp
namespace Engine.Models;

public record LedgerReport(decimal Total, Payment? Largest, int SkippedLines);
```

##### Engine/Services/LedgerReader.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public static class LedgerReader
{
    public static LedgerReport Load(string path)
    {
        if (!File.Exists(path))
            throw new FileNotFoundException("ledger missing", path);

        decimal total = 0;
        Payment? largest = null;
        int skipped = 0;

        foreach (var line in File.ReadLines(path))      // lazy, and closes the file for us
        {
            if (TryParseLine(line, out Payment? payment) && payment is not null)
            {
                total += payment.Gold;
                if (largest is null || payment.Gold > largest.Gold)
                    largest = payment;
            }
            else
            {
                skipped++;
            }
        }

        return new LedgerReport(total, largest, skipped);
    }

    /// <summary>
    /// Pure: a string in, a value out. No files, no console — which is exactly
    /// what makes the tests below two lines each.
    /// </summary>
    public static bool TryParseLine(string line, out Payment? payment)
    {
        payment = null;

        var parts = line.Split(';');
        if (parts.Length != 2)
            return false;

        if (!long.TryParse(parts[1], out long copper))
            return false;

        payment = new Payment(parts[0], copper / 100m);
        return true;
    }
}
```

### The tests

These need their own project. From the solution root:

```bash
dotnet new xunit -o Engine.Tests
dotnet sln add Engine.Tests
dotnet add Engine.Tests reference Engine
dotnet test
```

##### Engine.Tests/LedgerReaderTests.cs

```csharp
using Engine.Models;
using Engine.Services;
using Xunit;

namespace Engine.Tests;

public class LedgerReaderTests
{
    [Fact]
    public void Parses_a_valid_line()
    {
        Assert.True(LedgerReader.TryParseLine("Stone;45000", out var payment));
        Assert.Equal(new Payment("Stone", 450m), payment);   // record equality: contents match
    }

    [Theory]
    [InlineData("no-semicolon")]
    [InlineData("too;many;parts")]
    [InlineData("Stone;abc")]
    [InlineData("")]
    public void Rejects_malformed_lines(string line) =>
        Assert.False(LedgerReader.TryParseLine(line, out _));

    [Fact]
    public void Missing_file_throws_rather_than_returning_an_empty_report() =>
        Assert.Throws<FileNotFoundException>(() => LedgerReader.Load("no-such-ledger.txt"));
}
```

**Since the last section:** three assertions, no setup, no temp files — because `TryParseLine`
takes a string and returns a value. That shape isn't an accident, and it's the thing to copy: keep
the decision-making pure, keep the file and console work at the edges, and testing stops being a
chore you skip.

`Assert.Equal(new Payment("Stone", 450m), payment)` works *only* because `Payment` is a `record`.
Make it a `class` and that test fails, comparing two different objects. See
[[02-oop-worked]] section 4.
