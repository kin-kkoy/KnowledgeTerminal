# Collections & Generics — Worked Solution

Section numbers match *Collections & Generics*. This is where the Engine gets the containers it
will spend the rest of the book filling.

Continues the solution from [[02-oop-worked]].

---

## 1. The core collections

**What this section produces:** one container per question the guild actually asks.

##### Engine/Services/Roster.cs

```csharp
using Engine.Models;

namespace Engine.Services;

/// <summary>
/// The guild's dragons. Three containers, three different questions:
/// an ordered list to walk, a name index to look up, a set to test membership.
/// </summary>
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

    /// <summary>Absence is normal here, so this is a TryGet, not an indexer.</summary>
    public bool TryFind(string name, out Dragon? dragon) => _byName.TryGetValue(name, out dragon);

    /// <summary>True if newly sent out; false if already working. Never an error.</summary>
    public bool SendOnShift(string name) => _byName.ContainsKey(name) && _onShift.Add(name);

    public bool IsOnShift(string name) => _onShift.Contains(name);

    public void EndOfDay() => _onShift.Clear();
}
```

##### Engine/Models/Warehouse.cs

```csharp
namespace Engine.Models;

public class Warehouse
{
    private readonly Dictionary<string, int> _crates = [];

    public int Capacity { get; }

    public Warehouse(int capacity)
    {
        if (capacity <= 0)
            throw new ArgumentOutOfRangeException(nameof(capacity));

        Capacity = capacity;
    }

    public int Used
    {
        get
        {
            int total = 0;
            foreach (var crates in _crates.Values)
                total += crates;
            return total;
        }
    }

    public int Free => Capacity - Used;

    /// <summary>0 for a resource we hold none of — absence is not an error here.</summary>
    public int CratesOf(string resource) => _crates.TryGetValue(resource, out int n) ? n : 0;

    public IReadOnlyDictionary<string, int> Contents => _crates;

    /// <summary>Expected failure: it might simply not fit.</summary>
    public bool TryStore(string resource, int crates)
    {
        if (crates <= 0)
            throw new ArgumentOutOfRangeException(nameof(crates));

        if (Used + crates > Capacity)
            return false;

        _crates[resource] = CratesOf(resource) + crates;
        return true;
    }

    /// <summary>Broken rule: you cannot ship what is not there.</summary>
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

##### Engine/Services/ContractBoard.cs

```csharp
using Engine.Models;

namespace Engine.Services;

/// <summary>Contracts are worked in the order the Merchant Council posts them.</summary>
public class ContractBoard
{
    private readonly Queue<Contract> _pending = new();
    private readonly List<Contract> _accepted = [];

    public int PendingCount => _pending.Count;

    public IReadOnlyList<Contract> Accepted => _accepted;

    public void Post(Contract contract) => _pending.Enqueue(contract);

    /// <summary>Null when the board is empty — which is a normal Tuesday.</summary>
    public Contract? TakeNext()
    {
        if (_pending.Count == 0)
            return null;

        var contract = _pending.Dequeue();
        _accepted.Add(contract);
        return contract;
    }
}
```

**Since [[02-oop-worked]]:** `Warehouse` stopped holding a single `int` and started holding a
`Dictionary<string, int>`, because "how many crates of Stone?" is the question it is actually
asked. `Roster` holds the same dragons three ways on purpose — the list for walking in order, the
dictionary for O(1) lookup by name, the set for "is this one already out?".

That looks like duplication and isn't: each container answers a different question cheaply, and
`Add` is the single place that keeps them in step. The alternative — one list plus a `Contains`
scan on every lookup — is the O(n²) trap from the chapter's Traps list.

Note `IReadOnlyList<Dragon> All` and `IReadOnlyDictionary<string, int> Contents`. Handing out the
real `List` would let any caller add a dragon behind the roster's back, defeating the check in
`Add`. The read-only interface hands out the data without the ability to reshape it.

---

## 2. Generics & constraints

**What this section produces:** the write-once container the guild's catalogues share.

##### Engine/Models/INamed.cs

```csharp
namespace Engine.Models;

/// <summary>Anything the guild files by name.</summary>
public interface INamed
{
    string Name { get; }
}
```

##### Engine/Services/Repository.cs

```csharp
using Engine.Models;

namespace Engine.Services;

/// <summary>
/// A name-indexed store for any INamed type. Written once; the compiler stamps
/// out a fully typed version per T, with no casts and no boxing.
/// </summary>
public class Repository<T> where T : INamed
{
    private readonly Dictionary<string, T> _items = [];

    public int Count => _items.Count;

    public void Add(T item)
    {
        if (_items.ContainsKey(item.Name))
            throw new InvalidOperationException($"'{item.Name}' is already stored");

        _items[item.Name] = item;
    }

    public bool TryGet(string name, out T? item) => _items.TryGetValue(name, out item);

    public IEnumerable<T> All()
    {
        foreach (var item in _items.Values)
            yield return item;
    }

    /// <summary>Lazily yields only what matches — nothing is built until you iterate.</summary>
    public IEnumerable<T> Where(Func<T, bool> keep)
    {
        foreach (var item in _items.Values)
        {
            if (keep(item))
                yield return item;
        }
    }
}
```

The constraint earns its place: without `where T : INamed`, `item.Name` on line 18 would not
compile, because the compiler has no reason to believe an arbitrary `T` has a name. Adding the
constraint is what unlocks the member — and it is exactly as much as this class needs. It does not
demand `class`, or `new()`, or `IComparable<T>`, because it never uses them.

`ResourceDefinition` and `Dragon` both gain `INamed` so they can be stored in one:

##### Engine/Models/ResourceDefinition.cs

```csharp
namespace Engine.Models;

public class ResourceDefinition : INamed
{
    public string Name { get; }
    public string Category { get; }

    public ResourceDefinition(string name, string category)
    {
        Name = name;
        Category = category;
    }
}
```

Neither type had to change in any other way, and neither knows the other exists. That is what a
capability interface buys.

---

## 3. Iterators & equality

**What this section produces:** a lazily computed view of the roster, and a value type that
behaves correctly as a dictionary key.

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

    /// <summary>
    /// An iterator: computes nothing until you iterate, and stops as soon as you do.
    /// `roster.Available().First()` inspects one dragon, not all of them.
    /// </summary>
    public IEnumerable<Dragon> Available()
    {
        foreach (var dragon in _dragons)
        {
            if (dragon.IsFitToWork && !_onShift.Contains(dragon.Name))
                yield return dragon;
        }
    }

    public IEnumerable<Dragon> OfRole(string role)
    {
        foreach (var dragon in _dragons)
        {
            if (dragon.Role == role)
                yield return dragon;
        }
    }
}
```

##### Engine/Models/Spot.cs

```csharp
namespace Engine.Models;

/// <summary>
/// A position on the guild map. Used as a dictionary key, so equality and hashing
/// must agree — equal spots must land in the same bucket, always.
/// </summary>
public readonly struct Spot : IEquatable<Spot>
{
    public int X { get; }
    public int Y { get; }

    public Spot(int x, int y)
    {
        X = x;
        Y = y;
    }

    public bool Equals(Spot other) => other.X == X && other.Y == Y;

    public override bool Equals(object? obj) => obj is Spot spot && Equals(spot);

    public override int GetHashCode() => HashCode.Combine(X, Y);

    public static bool operator ==(Spot left, Spot right) => left.Equals(right);

    public static bool operator !=(Spot left, Spot right) => !left.Equals(right);

    public override string ToString() => $"({X}, {Y})";
}
```

##### Engine/Models/GuildMap.cs

```csharp
namespace Engine.Models;

/// <summary>Which facility stands where. Spot is the key, so its equality had to be right.</summary>
public class GuildMap
{
    private readonly Dictionary<Spot, string> _facilities = [];

    public int Count => _facilities.Count;

    public void Place(Spot spot, string facility)
    {
        if (_facilities.ContainsKey(spot))
            throw new InvalidOperationException($"{spot} is already occupied");

        _facilities[spot] = facility;
    }

    public string? FacilityAt(Spot spot) => _facilities.TryGetValue(spot, out var name) ? name : null;
}
```

**Since section 1:** `Roster` gained two iterators. `Available()` is the one worth studying —
it is a *recipe*, not a result. Nothing runs when you call it; each `MoveNext` resumes the loop
and produces the next fit, off-shift dragon. Ask for one dragon and it inspects one dragon.

`Spot` grew `IEquatable<Spot>`, an `Equals`/`GetHashCode` pair, and the `==` operators. That is
the full contract, and it is not optional once a type becomes a dictionary key: a struct gets
default value equality via reflection, which is both slow and easy to get subtly wrong. Writing it
out makes it fast and explicit.

Note that `Spot` is `readonly`, which is what makes it a *safe* key. The chapter's trap —
mutating a key after filing it, so its hash no longer matches its bucket — is impossible here
because there is nothing to mutate.

The honest shortcut, worth knowing you're declining: `public readonly record struct Spot(int X,
int Y);` generates all of the above correctly in one line. It is written out here so you have seen
the contract you are relying on.
