# Programs, Classes & Files

Every other chapter in this book assumes you can already read a C# file: that you know what a
class is, why some lines say `public` and others say `private`, what `static` is doing there, and
which of it belongs in this file rather than that one. This chapter is where you learn that, so
the rest of the book has something to stand on.

It is also the chapter where the guild gets built. By the end you'll have derived the game's
classes from a description of the game, written one of them properly, and know where each file
goes in a project you haven't created yet.

There is no checkpoint after this chapter. It's orientation, not a gate — read it, do the labs,
move on to *C# Fundamentals*.

> **Worked solution:** [[00-program-structure-worked]] — every file it describes, in its real
> folder with its real namespace.
> Section numbers match this page, so the two read side by side in a split pane.

---

## 1. Classes and objects

**The idea**

The main thing object-oriented programming asks of you is this: **the program imitates the world
by thinking of things as the objects they represent.** If you're writing software for a bank, the
classes are customers, accounts, deposits, loans. If you're writing a guild simulation, they're
guilds, dragons, contracts, resources.

That sounds too simple to be a technique, but it is one, and here is the technique. Write down
what you want the program to do, in plain sentences. Then underline the nouns.

Here is the guild's core loop, from the design document, written out as sentences:

- The **guild** accepts **contracts** from the **merchant council**.
- A **contract** asks for a quantity of some **resource** by a **deadline**.
- The guild assigns **dragons** and **workers** to produce that resource.
- Each **dragon** has **needs** — hunger, rest, comfort, trust, health — and works badly when
  they aren't met.
- Resources are held in **storage**, which is finite.
- Completing a contract earns **gold** and **reputation**.
- **Facilities** are built to increase what the guild can do.

Underline the nouns and you have your first class list:

    Guild    Contract    Resource    Dragon    Worker    Storage    Facility

You will need others, and some of these will turn out to be wrong. That's fine — the list is a
starting point, not a commitment. But notice you got it without knowing any C#. Nouns first,
syntax second.

**What's the difference between a class and an object?**

A class is a blank form. It says what the thing will be like, but it isn't the thing.

Think of a blank character sheet for a tabletop game. It has spaces for a name, a level, hit
points, an inventory. Until you fill those spaces in, it's an outline — that's the class. Fill it
in and you have a character — that's the object.

Or, in physical terms: a blueprint for a warehouse is a class. It says the warehouse will have
four walls, a door and a capacity. Hand it to builders with timber and stone and you get a
warehouse — the object. One blueprint, as many warehouses as you like, each with its own contents.

The word for making an object from a class is **instantiate**, and the object is an **instance**.
In C# you instantiate with `new`:

```csharp
var mossback = new Dragon();
```

The single most important consequence: **each object has its own copy of the data.** Two dragons
made from the same class have two separate rest levels. Feeding one does not feed the other.

**In practice**

```csharp
// Two objects from one class. They share the blueprint, not the data.
var mossback = new Dragon();
mossback.Name = "Mossback";
mossback.Rest = 100;

var ironjaw = new Dragon();
ironjaw.Name = "Ironjaw";
ironjaw.Rest = 100;

// Send one of them down a mine for the day.
ironjaw.Rest = 40;

Console.WriteLine($"{mossback.Name} rest: {mossback.Rest}");
Console.WriteLine($"{ironjaw.Name} rest: {ironjaw.Rest}");

// A third variable, but NOT a third dragon — this is the same object as ironjaw.
var onShift = ironjaw;
onShift.Rest = 10;
Console.WriteLine($"{ironjaw.Name} rest after the second shift: {ironjaw.Rest}");

class Dragon
{
    public string Name = "";
    public int Rest;
}
```

```text
Mossback rest: 100
Ironjaw rest: 40
Ironjaw rest after the second shift: 10
```

Read the last block again, because it is the one thing here that surprises people. `onShift` did
not copy the dragon. It is a second name for the *same* dragon, and writing through either name
changes the one dragon that exists. That is what it means for `class` to be a **reference type**,
and the next chapter opens on exactly this.

(In a Study-tab file, statements come first and type declarations go underneath them — that's why
`class Dragon` sits at the bottom. Section 2 explains what the layout looks like in a real
project.)

> **C corner:** a class is roughly a `struct` plus the functions that work on it, bundled
> together so that `dragon_rest(&d, 40)` becomes `d.Rest = 40`. `new Dragon()` allocates on the
> heap, and the variable holds something very like a `Dragon*` — except you never `free` it, and
> there is no `->`; the dot does the dereference. Two variables holding the same reference is
> exactly two pointers to one `malloc`.

**Try it — Lab:** In the Study tab, write the noun exercise for a part of the guild this chapter
didn't cover. Take three sentences about inspectors — *"An inspector visits the guild. The
inspector checks dragon welfare and worker conditions. The visit produces a report that changes
reputation."* — underline the nouns, and declare a class for each with two or three fields. Then
create two `Inspector` objects, give them different names, alias one to a second variable, change
a field through the alias, and print both. Predict the output before you run it.

**Traps**

- **Confusing the class with the object.** `Dragon` is not a dragon; `new Dragon()` is. You feed
  objects, not classes. When you catch yourself trying to set a value "on the class", you almost
  always wanted an object — or, occasionally, section 4's `static`.
- **Expecting assignment to copy.** `var b = a;` on a class gives you a second name for one
  object, not a second object. To get a second object you must say `new` again.
- **Nouns that are really verbs.** "Assign", "produce" and "complete" are things the guild *does*
  — they become methods, not classes. If a candidate noun has no data of its own, it probably
  isn't a class.
- **Starting from the syntax.** Deciding you need "a manager class and a helper class" before
  you've written down what the program does is how you end up with classes named `Manager` and
  `Helper` that nobody can explain. Nouns first.

---

## 2. Reading a C# file

**The idea**

Open any `.cs` file in any C# project and it has the same skeleton, in the same order. Once you
can name the parts, every unfamiliar file becomes readable — you are only ever learning what
*this* one does, never how files work.

Top to bottom, the parts are:

1. **`using` directives** — "when I write a short type name, also look in these namespaces."
2. **A `namespace`** — the surname for everything declared in the file. `Engine.Models.Dragon` is
   the full name; the namespace is the `Engine.Models` part.
3. **The type declaration** — usually one `class` per file, named the same as the file.
4. **Fields** — the raw data, usually private.
5. **Constructors** — the code that runs when someone says `new`.
6. **Properties** — the controlled way in and out of the data.
7. **Methods** — the things the object can do.

That order is convention, not a rule the compiler enforces; C# will accept the members in any
order. Follow it anyway, because every C# programmer reading your file expects it, and a file
that reads in the expected order is a file nobody has to hunt through.

**The two layouts, and why this book uses the short one**

Modern C# lets a file be *just statements*, with no class and no `Main` — that's **top-level
statements**, and it's what the Study tab runs and what most examples in this book use. It exists
so a small program can be small.

A real project uses the full form. Both are below, and they compile to the same thing; the short
one is the compiler writing the ceremony for you.

**In practice**

Here is a real file — the shape `Dragon.cs` will actually have in the Engine project:

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

Now the walkthrough, which is the part worth slowing down for.

**Lines 1–2:** the `using` directives. `System` is where `Math` and `Console` live;
`System.Collections.Generic` is where `List<T>` lives. Without the first one, line 19 would have
to say `System.Math.Clamp`. A `using` does not copy anything into your file — it only widens the
set of places the compiler searches for a name. It costs nothing at runtime.

You will often not see these at all in a modern project: **implicit usings** put the common ones
in automatically. That's why the Study tab lets you write `Console.WriteLine` with no `using`
System at the top.

**Line 4:** the namespace. Everything between its braces is named `Engine.Models.something`. Two
different files can both declare a class called `Dragon` as long as they're in different
namespaces, and code that wants one says which. Namespaces have nothing to do with folders as far
as the compiler is concerned — but every C# project keeps them matched anyway, so
`Engine/Models/Dragon.cs` declares `namespace Engine.Models`. Do the same and your files will be
findable.

**Line 6:** the class declaration. `public` is section 3. `class Dragon` in a file named
`Dragon.cs` — again a convention, not a rule, and again one you should follow without exception.

**Line 8:** a **field**. This is raw storage, the closest thing C# has to a struct member. It's
`private`, and the leading underscore is the widespread convention for "private field" — it makes
`_rest` and `Rest` visibly different at a glance, which matters two lines later.

**Lines 10–11:** two **properties** with only a `get`. From the outside they're read like fields
(`dragon.Name`), but nothing outside can assign them, and after the constructor runs nothing
inside can either. A dragon's name and role do not change.

**Lines 13–17:** a property with a body. Reading `dragon.Rest` runs the `get` and hands back
`_rest`. Writing `dragon.Rest = 500` runs the `set`, where `value` is the keyword for whatever the
caller passed, and `Math.Clamp` pins it between 0 and 100. This is the entire point of properties:
**every write goes through code you control.** No caller anywhere can put a dragon's rest at 500,
and you didn't have to trust any of them.

**Line 19:** a property with an initialiser. `PreferredFoods` is get-only, so nobody can swap the
list for a different list — but the list itself is still mutable, so `dragon.PreferredFoods.Add
("Fish")` works fine. Get-only means the *reference* is fixed, not the contents.

**Lines 21–26:** the **constructor**. It is a method with no return type whose name is exactly the
class name, and it runs when someone writes `new Dragon("Mossback", "Forest")`. Its job
is to leave the object in a valid state — here, named, roled, and fully rested. Because `Name` and
`Role` are get-only, the constructor is the only place they can ever be set.

**Line 28:** an **expression-bodied property**. `IsFitToWork` computes on every read and stores
nothing. Note what it buys you: elsewhere in the program you will write `if (dragon.IsFitToWork)`
instead of `if (dragon.Rest >= 30)`, and the rule lives in one place instead of being scattered
across every call site that needs it.

**Lines 30–33:** a **method** — something the dragon can do. It changes the object's own data, and
because it assigns through the `Rest` property rather than the `_rest` field, the clamp applies
here too. A shift long enough to push rest below zero leaves it at zero.

**The same thing without a class**

If that file were a whole program, the full ceremony would look like this:

```csharp
using System;

namespace GuildConsole
{
    public class Program
    {
        public static void Main(string[] args)
        {
            Console.WriteLine("The guild opens for business.");
        }
    }
}
```

and with top-level statements it is this:

```csharp
Console.WriteLine("The guild opens for business.");
```

```text
The guild opens for business.
```

Same program. The compiler generates the namespace, the class and the `Main` for you. `Main` is
where a C# program starts, exactly like `main` in C, and the `string[] args` is your `argv`.
Section 4 will come back to why `Main` has to say `static`.

> **C corner:** `using` is not `#include`. Nothing is pasted in; there is no preprocessor, no
> header files, no forward declarations and no include guards, because the compiler reads whole
> types from whole files and doesn't care what order it meets them in. A namespace is closest to
> the naming prefix you'd put on every function in a C library (`guild_dragon_rest`), except the
> compiler manages it and callers can opt into dropping the prefix.

**Try it — Lab:** In the Study tab, write a `Contract` class following the member order above:
a private field `_daysRemaining`, get-only properties `Resource` and `Quantity`, a `DaysRemaining`
property whose setter refuses to go below zero, a constructor taking all three values, an
expression-bodied `IsOverdue => DaysRemaining == 0`, and a method `PassDay()`. Then create one and
call `PassDay()` more times than the contract has days, printing `IsOverdue` each time. Confirm it
never goes negative — and note that you didn't have to check for that at any call site.

**Traps**

- **Two classes in one file, named nothing like the file.** Legal, and it makes your code
  unfindable. One public class per file, file named after it.
- **Namespaces that don't match folders.** Also legal, also a way to lose files. Keep
  `Engine/Models/Dragon.cs` in `namespace Engine.Models`.
- **Public fields instead of properties.** `public int Rest;` looks identical to callers and can
  never grow the clamp. The C# convention is absolute here: fields are private, properties are the
  public surface. The OOP chapter makes the case in full.
- **Doing real work in a constructor.** Reading files, hitting a database, starting threads — a
  constructor that can fail or block gives you objects that are expensive or dangerous to create.
  Set the fields, validate the arguments, stop.
- **Assuming top-level statements are a beginner's toy.** They're a normal C# program. But they
  also mean the examples in this book don't show you the namespace and class you'll need in a real
  file, which is exactly the gap this section exists to close.

---

## 3. Who can see what

**The idea**

Every declaration in C# carries a visibility — an **access modifier** — that answers "which code
is allowed to touch this?" You already have most of the model:

- **`public`** — any code anywhere can see it.
- **`private`** — only code inside this same class.
- **`protected`** — this class and any class that inherits from it.

Two things to add. First, the one you're missing:

- **`internal`** — any code in the same **project** (technically, the same compiled assembly), and
  nothing outside it.

Second, and more useful than any definition: **the defaults**. Write no modifier on a class member
and you get `private`. Write no modifier on a class itself and you get `internal`. C# defaults to
the *least* visible thing that could be useful, which tells you what it wants from you.

**Why bother**

The reason isn't secrecy — it's the number of places you have to look when something goes wrong.

Suppose a dragon's rest ends up at −40 and you need to find out how. If `_rest` is private, the
only code that could have done it lives inside `Dragon.cs`, and you audit one file. If `Rest` were
a public field, the answer is "anywhere in the program", and you audit everything. Visibility
doesn't stop bugs; it bounds the search.

So the working rule is: **start everything private, and open it up only when something outside
genuinely needs it.** Widening later is a one-word edit. Narrowing later means finding and fixing
every caller who took you up on the offer.

Where each one earns its place in the guild:

- `private` — `_rest`, and every method that's a step in a bigger operation rather than something
  a caller would ask for.
- `public` — `Name`, `WorkShift`, `IsFitToWork`. The things a caller is *meant* to use. This is
  the deliberate, documented surface of the class.
- `protected` — data a base class holds that its subclasses need. `Dragon` will get subclasses
  (`MiningDragon`, `TransportDragon`), and they need `Rest` but nobody else needs the raw field.
  A subclass sees everything in its base class *except* the private members.
- `internal` — types the Engine uses to do its job but that no front-end should ever construct.
  The console app, the Terminal.Gui app and the Avalonia app will all reference the same Engine;
  `internal` is how you say "this is Engine plumbing, not part of the deal."

**In practice**

```csharp
var mossback = new Dragon("Mossback");
mossback.WorkShift(10);
Console.WriteLine($"{mossback.Name}: {mossback.Condition}");

// mossback._rest = 500;              // compile error: '_rest' is inaccessible (private)
// mossback.LogShift(3);              // compile error: 'LogShift' is inaccessible (private)
// Console.WriteLine(mossback.Rest);  // compile error: 'Rest' is inaccessible (protected)

var ironjaw = new MiningDragon("Ironjaw");
ironjaw.DigShaft();
Console.WriteLine($"{ironjaw.Name}: {ironjaw.Condition}");

public class Dragon
{
    private int _rest = 100;                 // no modifier would also mean private
    private int _shiftsWorked;               // nothing outside needs to know

    public string Name { get; }

    protected int Rest                       // subclasses may read and write this
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

    private void LogShift(int hours) => _shiftsWorked++;   // an internal step, not a service
}

public class MiningDragon : Dragon
{
    public MiningDragon(string name) : base(name) { }

    public void DigShaft()
    {
        Rest -= 25;              // allowed: protected, and we are a subclass
        // _rest -= 25;          // compile error: private stays private, even to subclasses
    }
}
```

```text
Mossback: rest 50, fit to work: True
Ironjaw: rest 75, fit to work: True
```

Three things are worth naming. `Rest` is `protected`, so `MiningDragon.DigShaft` can use it and
code outside the family cannot — which is why the statements at the top can't print
`mossback.Rest` at all, and go through `Condition` instead. `_rest` stays `private` even to the
subclass: a base class's private members are invisible to its children, which is precisely the
point of having both keywords. And `Condition` is the pattern you'll use constantly — private
state, a public *view* of it, and the class deciding what outsiders get to see and in what shape.

`public class MiningDragon : Dragon` is inheritance, and the OOP chapter covers it properly. One
rule from it belongs here though: **a base class must be at least as visible as the classes that
derive from it.** A `public` class cannot inherit from an `internal` one, because callers who can
see the child would be able to reach members of a parent they aren't allowed to know about.

> **C corner:** C gives you two levels — `static` at file scope for "this translation unit only",
> and external linkage for "everyone". C# has four, they're per-member rather than per-file, and
> they're checked by the compiler against the *type* rather than the file. The nearest mapping:
> C's file-`static` is roughly `private`; C's "declared in the public header" is `public`;
> `internal` is "in the library but not in the header we ship"; `protected` has no C equivalent
> at all, because C has no inheritance to have it with.

**Try it — Lab:** In the Study tab, write a `Warehouse` class with a private `_used` field, a
public get-only `Capacity`, a public `Store(int units)` method that refuses to exceed capacity and
returns a `bool` for whether it fit, and a private `RecordOverflow()` that `Store` calls when it
refuses. Then, from your top-level statements, try to set `_used` directly and try to call
`RecordOverflow` — read both compiler errors carefully; they're the message you want to be getting
for the rest of your career. Finally change `_used` to `public` and notice that nothing about the
program improves.

**Traps**

- **Making everything public to stop the compiler complaining.** The compiler was doing its job.
  Every `public` is a promise about a thing you now can't change freely.
- **Assuming `private` means "per object".** It's per *class*: one `Dragon` object can freely read
  another `Dragon` object's private fields. Access control is about which code, not which
  instance.
- **Reaching for `protected` by default on a base class.** `protected` is a promise to every
  future subclass, which is a wider audience than it looks. If only the base class uses it, keep
  it `private`.
- **Forgetting the class-level default.** `class Dragon` with no modifier is `internal`, so the
  moment your front-end project tries to use it you get an error that reads like the class doesn't
  exist. It exists; it just isn't yours to see.

---

## 4. Static — the one shared copy

**The idea**

Everything so far has needed an object. To use `Dragon` you write `new Dragon(...)` and work with
what comes back, and each object carries its own data.

A **static** member is the opposite: there is exactly one of it, it belongs to the class itself
rather than to any object, and it is there from the moment the program can reach it. A **static
class** is a class made entirely of static members — you can't create an object from one, and the
compiler won't let you try.

Static is the answer to "several parts of the program need to get at the same thing, and it makes
no sense for each of them to have their own copy."

**Why the guild needs one**

The guild has facts that are simply true about the world rather than true of any one guild: the
full list of resource types and which category each is in; the list of dragon species and what
work each is suited to; the definitions of the contract kinds. This information is loaded once,
never changes, and gets read from a dozen places.

You could pass a `GuildCatalogue` object down through every method that might need it. Or you
could make it static and let anything that needs a resource definition just ask.

**Where else static shows up**

The other classic use is a value the whole program shares. Say every contract needs a unique,
sequential id. A static class with a static counter does it:

```csharp
public static class ContractNumberIssuer
{
    private static int _nextNumber = 0;

    public static int GetNextNumber()
    {
        _nextNumber = _nextNumber + 1;
        return _nextNumber;
    }
}
```

When the program starts, `_nextNumber` is 0. The first caller gets 1, the next gets 2, and every
part of the program is reading and writing the same counter — which here is exactly what you
want.

**And where it will hurt you**

The danger is the same sentence read the other way: *everything shares it*.

Suppose you'd made the guild's gold a static variable, `GuildTreasury.Gold`. Today that's fine —
one guild, one player, one program. Now suppose you later run two guilds side by side: a scenario
comparison, a test that plays out two strategies, or a server hosting several players. Guild A
completes a contract and adds 200 gold. Guild B checks its balance and sees Guild A's money,
because there is only one `Gold` and both of them are using it.

That is the whole risk in one example. **Before you make something static, ask whether you would
ever want two of them.** Facts about the world — resource definitions, species, the rules — no.
State that belongs to somebody — gold, rest, inventory, progress — almost always yes, eventually.

The rules the compiler enforces, which are worth memorising because you will hit all three:

- A static class can contain only static members.
- A normal class **may** contain static members — `Dragon` can have a static helper without
  becoming a static class.
- A static method can only use things it creates itself, its parameters, other static methods, and
  static fields. It cannot touch instance data, because there is no instance for it to touch.

That last rule is why `Main` says `static`. Nothing has been created yet when the program starts,
so the entry point cannot be a method that needs an object.

**In practice**

```csharp
Console.WriteLine(GuildCatalogue.Resources.Count + " resource types known");

var ore = GuildCatalogue.ResourceByName("Iron Ore");
Console.WriteLine($"{ore?.Name} is {ore?.Category}");

Console.WriteLine($"contract #{ContractNumberIssuer.GetNextNumber()}");
Console.WriteLine($"contract #{ContractNumberIssuer.GetNextNumber()}");

// var c = new GuildCatalogue();   // compile error: cannot create an instance of a static class

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

public static class GuildCatalogue
{
    public static readonly List<ResourceDefinition> Resources = new List<ResourceDefinition>();

    public const string CATEGORY_RAW = "Raw";
    public const string CATEGORY_PROCESSED = "Processed";
    public const string CATEGORY_FOOD = "Food";

    static GuildCatalogue()
    {
        PopulateResources();
    }

    private static void PopulateResources()
    {
        Resources.Add(new ResourceDefinition("Stone", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Iron Ore", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Timber", CATEGORY_RAW));
        Resources.Add(new ResourceDefinition("Iron Ingots", CATEGORY_PROCESSED));
        Resources.Add(new ResourceDefinition("Lumber", CATEGORY_PROCESSED));
        Resources.Add(new ResourceDefinition("Dragon Feed", CATEGORY_FOOD));
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
}

public static class ContractNumberIssuer
{
    private static int _nextNumber = 0;

    public static int GetNextNumber()
    {
        _nextNumber = _nextNumber + 1;
        return _nextNumber;
    }
}
```

```text
6 resource types known
Iron Ore is Raw
contract #1
contract #2
```

The walkthrough:

**The `Resources` field** is `static readonly`. `static` means one list for the whole program;
`readonly` means the *variable* can never be pointed at a different list after initialisation. It
does **not** freeze the contents — `Resources.Add(...)` still works, which is exactly how the
constructor fills it. Readonly reference, mutable object: the same distinction as the get-only
`PreferredFoods` property in section 2.

**The `const` lines** are constants. They look like variables and work like variables with one
difference: their value can never change, ever, and the compiler substitutes the literal wherever
you use it. They exist so that the rest of the program can say `CATEGORY_RAW` instead of
remembering the string `"Raw"` — and so that a typo becomes a compile error instead of a resource
that silently belongs to no category.

**`static GuildCatalogue()`** is a **static constructor**. You may reasonably object: we can't
create a `GuildCatalogue`, so what is a constructor doing here? The answer is that a static
constructor doesn't run on `new` — it runs **once, automatically, the first time anything in the
program touches the class.** The very first line of the example reads `GuildCatalogue.Resources`,
and that read is what triggers `PopulateResources()`. You never call it yourself. Note also that
it takes no parameters and has no access modifier; both are compulsory, because you are not the
one calling it.

**`PopulateResources` is a separate method**, and the static constructor just calls it. There's
no need for that — the adds could have gone straight in the constructor. But the real catalogue
will also have species and contract kinds, and a constructor that calls four well-named methods
reads better than one with a hundred lines in it. That's section 5, arriving early.

**`ResourceByName`** is a lookup. It walks the list, compares names, returns the match, and
returns `null` if there isn't one. The `ResourceDefinition?` return type — with the question mark
— is C# saying out loud that this method can hand back nothing, and it forces the caller to deal
with that. That's the *Fundamentals* chapter's territory, which is why the call site uses `ore?.`
rather than `ore.`.

> **C corner:** a static class is very nearly a `.c` file full of functions plus file-scope
> variables — one copy of the data, no instance to pass around, called by qualified name. The
> static constructor is the initialisation you'd otherwise do by hand at the top of `main`, except
> the runtime does it lazily on first use and guarantees it happens exactly once even with several
> threads running. `const` is closer to an `enum` constant than to `#define`: it's typed, and the
> compiler checks it.

**Try it — Lab:** In the Study tab, build a static `SpeciesCatalogue` with a static constructor
that populates a list of three species — Mossback (Forest), Ironjaw (Mining), Longtail Courier
(Transport) — plus a static `SpeciesByRole(string role)` returning the first match or `null`.
Prove the static constructor is lazy: put a `Console.WriteLine("catalogue loading")` as its first
line, and put a `Console.WriteLine("program start")` as the very first statement of your program.
Observe which prints first, and make sure you can explain why. Then try adding a non-static field
to the static class and read the compiler's error.

**Traps**

- **Static as a way to avoid passing things around.** It works, and it quietly welds every user of
  the value to that one global. The test that wants a second guild, or a fresh one, has no way to
  ask for it. Convenience now, immovable later.
- **Static mutable state.** A static *catalogue that is only ever read* is fine. A static counter
  that everything writes is a shared variable with no lock and no owner — fine in a single-threaded
  console game, a source of very confusing bugs the moment anything is concurrent.
- **Expecting a static constructor at a particular moment.** It runs on first *use*, which might
  be much later than program start, or never. Don't hang anything time-sensitive off it.
- **`static readonly` on a collection and thinking it's frozen.** The reference is fixed; the
  contents are wide open. If it must be read-only, expose it as `IReadOnlyList<T>`.
- **Reaching for a static class when you meant one object.** "There's only one guild" is true right
  up until it isn't. A single instance that you create once and pass along gives you the same
  convenience and keeps the door open.

---

## 5. How many classes, how many files

**The idea**

There's an old programmer's line: *you aren't writing a program for the computer to read, you're
writing it for a programmer to read* — and that programmer is you, in six months, with no memory
of why any of it is the way it is. Every question in this section is really that question.

**How many classes per file? One.**

One public class, in a file named after it. `Dragon` lives in `Dragon.cs`. Do this even when the
class is four lines long, and even when two classes feel obviously related — you will look for
`Contract` in `Contract.cs` long before you'd think to look in `Guild.cs`.

**When do you split a class?**

Three signals, in rough order of reliability:

1. **You can't name it without saying "and".** A class that "holds the roster and works out
   contract payouts" is two classes wearing one name.
2. **The fields split into clumps that never touch each other.** If half the fields are only used
   by half the methods, the seam is already there; you're just writing it down.
3. **It's changing for unrelated reasons.** If a change to how payouts work and a change to how
   dragons rest both land in the same file, that file is doing two jobs.

Length alone is a weak signal. A 300-line class that does one thing thoroughly is fine; a 60-line
class doing two things is not.

**When do you split a method?**

Sooner than you think, and the test is simple: **a method should do one thing, and its name should
say what.** When you find yourself about to write a comment explaining what the next ten lines do,
that comment is the name of a method you haven't extracted yet.

Two smaller habits from the same family:

- **Wrap awkward conditions behind a well-named property.** `if (contract.Deadline != null &&
  contract.DaysRemaining <= 0)` doesn't read like anything. Put it behind
  `public bool IsOverdue => ...` and the call site becomes `if (contract.IsOverdue)`. That's what
  "self-documenting code" actually means in practice — not more comments, fewer needed.
- **Inline variables used once.** A variable created and then used on the very next line is
  usually just noise between you and the thing being said.

**When do you split a *project*?**

This is the one that matters most for the guild, and the rule is: **split where the audience
changes.**

The game logic — dragons, contracts, resources, the rules — has one audience: whatever is
displaying the game. The display code has a different audience: the person playing. Put them in
one project and the rules end up tangled in console formatting, and the day you want a second
front-end you find the game can't be separated from the text it prints.

So:

```
DragonMerchantGuild.slnx
├── Engine/                    a class library — the game. Knows nothing about screens.
│   ├── Models/                Dragon.cs, Contract.cs, Resource.cs, Guild.cs
│   ├── Factories/             GuildCatalogue.cs, ContractFactory.cs
│   └── Services/              ContractService.cs, ProductionService.cs
└── GuildConsole/              a console app — reads input, prints output, calls Engine.
    └── Program.cs
```

`Engine` is a **class library**: it compiles to a `.dll`, has no `Main`, and can't be run. It's
referenced by front-ends. `GuildConsole` is an **executable**: it has the `Main`, and it depends
on `Engine`. The dependency points one way and must keep pointing one way — the Engine must never
reference the console, or you've glued the game to a screen and the split has bought you nothing.

The payoff arrives later: Terminal.Gui and Avalonia front-ends are new projects that reference the
same untouched `Engine`. That is the single most valuable structural decision in this whole
program, and it costs you nothing to make now and a rewrite to make later.

**In practice**

The refactor, in miniature. Before — one method doing four things, with comments standing in for
names:

```csharp
public void AssignToContract(Dragon dragon, Contract contract)
{
    // Is the dragon well enough to work?
    if (dragon.Rest < 30 || dragon.Health < 50)
    {
        Console.WriteLine(dragon.Name + " is not fit to work.");
        return;
    }

    // Is the dragon suited to this contract?
    if (dragon.Role != contract.RequiredRole)
    {
        Console.WriteLine(dragon.Name + " is the wrong sort of dragon for this.");
        return;
    }

    // Do the assignment
    contract.AssignedDragon = dragon;
    dragon.CurrentContract = contract;

    // Tell the player
    Console.WriteLine(dragon.Name + " assigned to " + contract.Resource + " contract.");
}
```

After — each comment has become a name, and the top-level method reads as a summary of itself:

```csharp
public void AssignToContract(Dragon dragon, Contract contract)
{
    if (!dragon.IsFitToWork)
    {
        RaiseMessage($"{dragon.Name} is not fit to work.");
        return;
    }

    if (!dragon.CanTake(contract))
    {
        RaiseMessage($"{dragon.Name} is the wrong sort of dragon for this.");
        return;
    }

    Assign(dragon, contract);
    RaiseMessage($"{dragon.Name} assigned to {contract.Resource} contract.");
}

private void Assign(Dragon dragon, Contract contract)
{
    contract.AssignedDragon = dragon;
    dragon.CurrentContract = contract;
}
```

with the two conditions moved onto `Dragon`, where the data they read actually lives:

```csharp
public bool IsFitToWork => Rest >= 30 && Health >= 50;

public bool CanTake(Contract contract) => Role == contract.RequiredRole;
```

Four things happened. The comments are gone because the names say what they said. The fitness rule
now lives on `Dragon` next to `Rest` and `Health`, so a change to it is a one-file change. Every
other part of the program that needs to know whether a dragon can work now asks the same question
the same way. And `RaiseMessage` replaced `Console.WriteLine`, which is the seam that will let the
Engine be used by a GUI later — the Engine says *what happened*, the front-end decides how to show
it.

> **C corner:** with no headers, a C# file boundary is pure organisation — it changes nothing
> about compilation, so you're free to draw the lines wherever they help a reader. The project
> boundary is the one that behaves like C's: a class library is a `.dll` the way a library is a
> `.so`, and the reference graph between projects must stay acyclic exactly as it must in C.

**Try it — Lab:** Take the `Warehouse` class from section 3's lab and grow it: add a
`Deposit(string resource, int units)` that has to check capacity, check that the resource is known
to `GuildCatalogue`, record the deposit, and report what happened. Write it first as one method
with a comment above each step. Then extract each commented step into a named method or property
until no comments are left and the top-level method is four lines. Compare the two versions and
decide honestly which one you'd rather debug at midnight.

**Traps**

- **Splitting by layer instead of by job.** Folders called `Helpers`, `Utils` and `Managers` fill
  up with unrelated code because nothing is excluded by the name. Name things after what they are.
- **Extracting methods that need six parameters.** If pulling ten lines out requires passing half
  the class in, the seam is in the wrong place — usually the data wants to move, not the code.
- **Splitting too early.** Three projects and eleven folders on day one is a structure you invented
  before you knew the shape of the problem. Engine and front-end is the split you can make now
  because you already know the audience differs. The rest can wait until it hurts.
- **A front-end reference sneaking into the Engine.** One `Console.WriteLine` in a model class and
  the Engine is no longer front-end-neutral. Compilers won't catch it; only the discipline will.
- **Treating "one class per file" as a rule about size.** It's a rule about *findability*. A tiny
  class still gets its own file.

---

## Check yourself

One honest question per topic — answer without looking, then tick.

- Can you take three sentences describing part of the guild, derive a class list from them, and
  say precisely what changes and what doesn't when you write `var b = a;` on one of those classes?
  If yes, tick *Classes and objects* above.
- Can you name the seven parts of a C# file in order, explain what a `using` does and doesn't do,
  and write a class with a private field, a clamping property, a get-only property and a
  constructor — without looking any of it up? If yes, tick *Reading a C# file* above.
- Can you state the default visibility of a class member and of a class itself, explain why
  `private` bounds a bug hunt, and say what a subclass can and cannot see in its base class? If
  yes, tick *Who can see what* above.
- Can you explain what a static constructor is, when it runs, and give the one-sentence test for
  whether something should be static at all? If yes, tick *Static — the one shared copy* above.
- Can you give a signal that a class should be split, turn a commented four-step method into four
  named things, and say why the Engine must not reference the front-end? If yes, tick *How many
  classes, how many files* above.

All five ticked? Tick the chapter and go on to *C# Fundamentals* — there's no checkpoint for this
one.
