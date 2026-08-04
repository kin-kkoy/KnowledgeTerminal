# Programs, Classes & Files — Worked Solution

The chapter teaches. This file shows you exactly what the code looks like when it lands in a real
project: full ceremony, real folders, real namespaces — not the top-level statements the Study tab
uses.

Read it beside the chapter, not instead of it. Section numbers match, so you can open
*Programs, Classes & Files* on the left and this on the right and follow both down the page.

This is Milestone 0 of the guild, and every worked file after this one adds to the same solution.
Nothing here is throwaway.

---

## 0. The solution

Before any of the files below exist, the projects have to. From the CLI, no IDE wizard:

```bash
mkdir -p ~/Projects/DragonMerchantGuild && cd ~/Projects/DragonMerchantGuild
dotnet new sln -n DragonMerchantGuild
dotnet new classlib -o Engine
dotnet new console  -o GuildConsole
dotnet sln add Engine GuildConsole
dotnet add GuildConsole reference Engine
rm Engine/Class1.cs
```

The layout that produces, and that the rest of this book fills in:

```
DragonMerchantGuild/
├── DragonMerchantGuild.sln
├── Engine/                      class library — the game. No screens, no Console.
│   ├── Engine.csproj
│   ├── Models/
│   ├── Factories/
│   └── Services/
└── GuildConsole/                executable — reads input, prints output, calls Engine.
    ├── GuildConsole.csproj
    └── Program.cs
```

The dependency points **from** `GuildConsole` **to** `Engine`, and never back. That one arrow is
what lets a Terminal.Gui or Avalonia front-end arrive later without the game being touched.

---

## 1. Classes and objects

**What this section produces:** the first real class, in the first real folder.

##### Engine/Models/Dragon.cs

```csharp
namespace Engine.Models;

public class Dragon
{
    public string Name = "";
    public int Rest;
}
```

That's the whole file at this point — deliberately. It matches the chapter's first example, and
sections 2 and 3 grow it into something defensible.

Note `namespace Engine.Models;` with a semicolon rather than braces. That's a **file-scoped
namespace**: the modern form, one line, no extra indentation for the whole file. It means exactly
the same thing as wrapping everything in `namespace Engine.Models { ... }`.

---

## 2. Reading a C# file

**What this section produces:** the same class with real structure — private field, constructor,
properties, methods, in the conventional order.

##### Engine/Models/Dragon.cs

```csharp
using System;
using System.Collections.Generic;

namespace Engine.Models
{
    public class Dragon
    {
        private int _rest;

        public string Name { get; }
        public string Role { get; }

        public int Rest
        {
            get => _rest;
            set => _rest = Math.Clamp(value, 0, 100);
        }

        public List<string> PreferredFoods { get; } = new List<string>();

        public Dragon(string name, string role)
        {
            Name = name;
            Role = role;
            _rest = 100;
        }

        public bool IsFitToWork => Rest >= 30;

        public void WorkShift(int hours)
        {
            Rest -= hours * 5;
        }
    }
}
```

This is the version written out longhand — braced namespace, explicit `using`s — because that is
what you will see in most existing C# code and you need to be able to read it. In your own new
files, prefer the file-scoped form from section 1 and let implicit usings handle `System`.

**Since the last section:** the public fields became a private field plus properties; a
constructor arrived to establish a valid starting state; and `Rest` gained a clamp, so no caller
anywhere can put a dragon outside 0–100.

##### GuildConsole/Program.cs

```csharp
using Engine.Models;

var mossback = new Dragon("Mossback", "Forest");
mossback.WorkShift(6);

Console.WriteLine($"{mossback.Name} ({mossback.Role}) rest {mossback.Rest}");
Console.WriteLine($"fit to work: {mossback.IsFitToWork}");
```

Run it with `dotnet run --project GuildConsole`.

Note the shape of the split, because it is the whole architecture in six lines: the Engine holds
the rule (rest is clamped, fitness is `>= 30`), and the console holds the printing. Neither knows
how the other works.

---

## 3. Who can see what

**What this section produces:** the visibility decisions made deliberately, plus the first
subclass.

##### Engine/Models/Dragon.cs

```csharp
namespace Engine.Models;

public class Dragon
{
    private int _rest = 100;
    private int _shiftsWorked;

    public string Name { get; }

    protected int Rest
    {
        get => _rest;
        set => _rest = Math.Clamp(value, 0, 100);
    }

    public bool IsFitToWork => _rest >= 30;

    public string Condition => $"rest {_rest}, fit to work: {IsFitToWork}";

    public Dragon(string name) => Name = name;

    public void WorkShift(int hours)
    {
        Rest -= hours * 5;
        LogShift(hours);
    }

    private void LogShift(int hours) => _shiftsWorked++;
}
```

##### Engine/Models/MiningDragon.cs

```csharp
namespace Engine.Models;

public class MiningDragon : Dragon
{
    public MiningDragon(string name) : base(name) { }

    public void DigShaft()
    {
        Rest -= 25;        // allowed: Rest is protected, and we are a subclass
        // _rest -= 25;    // would not compile: private stays private, even to children
    }
}
```

**Since the last section:** `Rest` narrowed from `public` to `protected` — subclasses need it,
nobody else does. `_shiftsWorked` and `LogShift` are private, because they are steps in the
guild's bookkeeping and not services anyone calls. And `Condition` appeared: a *public view* of
private state, which is how a class lets the outside world see something without handing over the
ability to change it.

Every one of those is a decision, not a default. The test for each was: *does anything outside
genuinely need this?*

---

## 4. Static — the one shared copy

**What this section produces:** the catalogue — facts about the world, loaded once, read
everywhere.

##### Engine/Models/ResourceDefinition.cs

```csharp
namespace Engine.Models;

public class ResourceDefinition
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

##### Engine/Factories/GuildCatalogue.cs

```csharp
using Engine.Models;

namespace Engine.Factories;

public static class GuildCatalogue
{
    public static readonly List<ResourceDefinition> Resources = new();

    public const string CATEGORY_RAW = "Raw";
    public const string CATEGORY_PROCESSED = "Processed";
    public const string CATEGORY_FOOD = "Food";
    public const string CATEGORY_LUXURY = "Luxury";
    public const string CATEGORY_SPECIAL = "Special";

    static GuildCatalogue()
    {
        PopulateResources();
    }

    private static void PopulateResources()
    {
        Resources.Add(new ResourceDefinition("Stone", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Iron Ore", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Timber", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Herbs", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Coal", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Iron Ingots", CATEGORY_PROCESSED));
        Resources.Add(new ResourceDefinition("Lumber", CATEGORY_PROCESSED));
        Resources.Add(new ResourceDefinition("Dragon Feed", CATEGORY_FOOD));
        Resources.Add(new ResourceDefinition("Bread", CATEGORY_FOOD));
        Resources.Add(new ResourceDefinition("Decorative Stonework", CATEGORY_LUXURY));
        Resources.Add(new ResourceDefinition("Ember Crystals", CATEGORY_SPECIAL));
    }

    public static ResourceDefinition? ResourceByName(string name)
    {
        foreach (ResourceDefinition definition in Resources)
        {
            if (definition.Name == name)
            {
                return definition;
            }
        }

        return null;
    }

    public static IEnumerable<ResourceDefinition> ByCategory(string category)
    {
        foreach (ResourceDefinition definition in Resources)
        {
            if (definition.Category == category)
            {
                yield return definition;
            }
        }
    }
}
```

**Since the last section:** a new folder, `Factories/`, holding the first static class. Nothing
instantiates `GuildCatalogue` — nothing can. The first read of `GuildCatalogue.Resources` anywhere
in the program triggers the static constructor, which fills the list once.

Note `ByCategory` uses `yield return`. That's an iterator, covered properly in *Collections &
Generics*; it's here because the alternative — building and returning a new list every call — is
exactly the kind of waste a catalogue read from a dozen places shouldn't be doing.

Note also what is *not* static: there is no `GuildTreasury.Gold` and no `Dragon.Rest` static
anywhere. Those belong to a particular guild and a particular dragon, and the day you run two
guilds side by side — a test, a scenario comparison — a static one would have them sharing a purse.

---

## 5. How many classes, how many files

**What this section produces:** the refactor from the chapter, in its real home, plus the seam
that keeps the Engine front-end-neutral.

##### Engine/Models/Contract.cs

```csharp
namespace Engine.Models;

public class Contract
{
    public string Resource { get; }
    public int Quantity { get; }
    public string RequiredRole { get; }
    public Dragon? AssignedDragon { get; private set; }

    public Contract(string resource, int quantity, string requiredRole)
    {
        Resource = resource;
        Quantity = quantity;
        RequiredRole = requiredRole;
    }

    public void AssignTo(Dragon dragon) => AssignedDragon = dragon;
}
```

##### Engine/Services/AssignmentService.cs

```csharp
using Engine.Models;

namespace Engine.Services;

public class AssignmentService
{
    private readonly Action<string> _report;

    public AssignmentService(Action<string> report) => _report = report;

    public void AssignToContract(Dragon dragon, Contract contract)
    {
        if (!dragon.IsFitToWork)
        {
            _report($"{dragon.Name} is not fit to work.");
            return;
        }

        if (!dragon.CanTake(contract))
        {
            _report($"{dragon.Name} is the wrong sort of dragon for this.");
            return;
        }

        contract.AssignTo(dragon);
        _report($"{dragon.Name} assigned to the {contract.Resource} contract.");
    }
}
```

with the two conditions living on `Dragon`, next to the data they read:

##### Engine/Models/Dragon.cs

```csharp
namespace Engine.Models;

public class Dragon
{
    private int _rest = 100;
    private int _shiftsWorked;

    public string Name { get; }
    public string Role { get; }

    protected int Rest
    {
        get => _rest;
        set => _rest = Math.Clamp(value, 0, 100);
    }

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
        Rest -= hours * 5;
        LogShift(hours);
    }

    private void LogShift(int hours) => _shiftsWorked++;
}
```

##### Engine/Models/MiningDragon.cs

```csharp
namespace Engine.Models;

public class MiningDragon : Dragon
{
    public MiningDragon(string name) : base(name, "Mining") { }

    public void DigShaft() => Rest -= 25;
}
```

##### GuildConsole/Program.cs

```csharp
using Engine.Factories;
using Engine.Models;
using Engine.Services;

// The console decides how to show things. The Engine only says what happened.
var assignments = new AssignmentService(message => Console.WriteLine($"[guild] {message}"));

var ironjaw = new MiningDragon("Ironjaw");
var stoneContract = new Contract("Stone", 40, "Mining");
var timberContract = new Contract("Timber", 20, "Forest");

assignments.AssignToContract(ironjaw, stoneContract);
assignments.AssignToContract(ironjaw, timberContract);   // wrong role — refused

ironjaw.WorkShift(15);
assignments.AssignToContract(ironjaw, stoneContract);    // now too tired — refused

Console.WriteLine($"{ironjaw.Name}: {ironjaw.Condition}");

var ore = GuildCatalogue.ResourceByName("Iron Ore");
Console.WriteLine($"{ore?.Name} is a {ore?.Category} resource");
```

```text
[guild] Ironjaw assigned to the Stone contract.
[guild] Ironjaw is the wrong sort of dragon for this.
[guild] Ironjaw is not fit to work.
Ironjaw: rest 25, fit to work: False
Iron Ore is a Raw resource
```

**Since the last section:** the four commented steps became four named things. The fitness rule
and the role check moved onto `Dragon`, where the data they read lives. And critically,
`AssignmentService` takes an `Action<string>` instead of calling `Console.WriteLine` — so the
Engine reports *what happened* and the console decides how to display it.

That `Action<string>` is a placeholder for something better. In *OOP* it becomes an interface,
`IGuildLog`, which is the form it keeps for the rest of the book.

**Check the boundary holds.** From the solution root:

```bash
grep -rn "Console\." Engine/
```

That must print nothing. The moment it doesn't, the Engine has learned about a screen and the
split has stopped paying for itself.
