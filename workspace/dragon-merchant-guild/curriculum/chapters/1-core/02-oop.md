# Object-Oriented Programming

*Programs, Classes & Files* taught you what a class and an object are, and how to keep data
private. This chapter is about what you do with that: how an object defends its own rules, how
one variable can run four different behaviours, how to write code that doesn't know what it's
talking to, and when a `record` beats a `class`.

By the end you can model a piece of the guild — dragons, contracts, storage — as a set of types
that enforce their own rules and can be extended without editing anything that already works.
That skill is the backbone of everything later: ASP.NET Core, EF Core and dependency injection
are all built on it.

One reminder from the previous chapter, because all four sections lean on it: a **class** is the
blueprint, an **object** is one thing built from it, and `new` is how you get one. Inside a
class's methods, `this` means "the object this method was called on" — it's usually implicit and
you rarely write it.

> **Worked solution:** [[02-oop-worked]] — the dragon hierarchy, IGuildLog and Cargo as
> finished source.
> Section numbers match this page, so the two read side by side in a split pane.

---

## 1. Encapsulation & properties

**The idea**

Here's a class that looks fine and isn't:

```csharp
class Dragon
{
    public int Rest;
}
```

Anywhere in the program, anyone can write `dragon.Rest = -400;` and nothing stops them. Today
that's not a problem, because you wrote the only three places that touch it and all three are
sensible. In six months there are forty places, one of them subtracts before checking, and you
have a dragon with negative rest wandering through the guild's reports.

The question "who is allowed to change this, and what values are legal?" is the one that decides
whether a growing program stays correct. **Encapsulation** is the answer: the object keeps its
data private and offers *operations* instead, so every write goes through code that can enforce
the object's **invariants** — the rules that must always hold. A dragon's rest is between 0 and
100. A warehouse never holds more than its capacity. Gold is never negative.

The leverage is simple arithmetic. If the only code that can write the field lives inside the
class, you have to get *one* piece of code right, once — instead of auditing every caller in the
program, forever, including the ones that don't exist yet.

You already have the tool for hiding it: the access modifiers from the previous chapter. What's
new here is what you offer instead.

**Properties: the part C doesn't have**

Hiding the field raises an obvious problem. If `_rest` is private, how does anything read it?

You could write `GetRest()` and `SetRest(int)`. That works and it's what you'd do in C or in
older Java, and it's why so much Java looks like ceremony. C# has a better answer: **properties**
— members that are *used* like fields but *run code* when read or written.

```csharp
dragon.Rest              // looks like a field access, runs your getter
dragon.Rest = 40         // looks like an assignment, runs your setter
```

That is the whole point, and it's worth being explicit about why it matters: **you can start with
a trivial property and add validation later without changing a single caller.** The call site
never changes. That's the reason the C# convention is absolute — *never expose public fields;
expose properties* — where in C the equivalent rule requires discipline from everyone forever.

**The flavours, and what each is for**

| Form | Meaning |
|---|---|
| `public int X { get; set; }` | auto-property, read and write from anywhere |
| `public int X { get; private set; }` | read anywhere, write only inside this class |
| `public int X { get; init; }` | set once during construction, frozen after |
| `public int X { get; }` | set only in a constructor, frozen after |
| `public int X => _a + _b;` | computed on every read, stores nothing |

An **auto-property** (`{ get; set; }`) makes the compiler generate the hidden private field for
you — you get the property syntax with none of the typing. When you need real logic, write the
body out and use an explicit backing field.

**In practice**

```csharp
var mossback = new Dragon { Name = "Mossback" };
mossback.WorkShift(6);
Console.WriteLine($"{mossback.Name}: rest {mossback.Rest}, fit: {mossback.IsFitToWork}");

mossback.WorkShift(40);                    // a brutal, and frankly illegal, double shift
Console.WriteLine($"{mossback.Name}: rest {mossback.Rest}, fit: {mossback.IsFitToWork}");

mossback.Feed(30);
Console.WriteLine($"{mossback.Name}: rest {mossback.Rest}, fit: {mossback.IsFitToWork}");

// mossback.Rest = 100;        // compile error: the setter is private
// mossback.Name = "Ember";    // compile error: init-only, and construction is over

var store = new Warehouse(capacity: 50);
Console.WriteLine(store.TryStore("Stone", 40));
Console.WriteLine(store.TryStore("Timber", 20));
Console.WriteLine($"used {store.Used} of {store.Capacity}");

class Dragon
{
    // init-only: assignable in an object initializer, frozen afterwards.
    public string Name { get; init; } = "";

    // Read anywhere, written only by the two methods below.
    public int Rest { get; private set; } = 100;

    // Computed on every read — no storage, and one home for the rule.
    public bool IsFitToWork => Rest >= 30;

    public void WorkShift(int hours)
    {
        if (hours <= 0) throw new ArgumentOutOfRangeException(nameof(hours));
        Rest = Math.Max(0, Rest - hours * 5);
    }

    public void Feed(int nourishment) => Rest = Math.Min(100, Rest + nourishment);
}

class Warehouse
{
    private int _used;

    public int Capacity { get; }
    public int Used => _used;

    public Warehouse(int capacity) => Capacity = capacity;

    public bool TryStore(string resource, int crates)
    {
        if (_used + crates > Capacity) return false;
        _used += crates;
        return true;
    }
}
```

```text
Mossback: rest 70, fit: True
Mossback: rest 0, fit: False
Mossback: rest 30, fit: True
True
False
used 40 of 50
```

The walkthrough:

**`Rest { get; private set; }`** is the shape you'll reach for most. The outside world can read a
dragon's rest freely — that's not dangerous — but only `WorkShift` and `Feed` can change it. Note
what that means for the second line of output: a forty-hour shift would take rest to −130, and
`Math.Max(0, ...)` pins it at 0 instead. **No caller had to know that rule.** They asked for a
shift; the dragon looked after itself.

**`Feed`** clamps the other end with `Math.Min(100, ...)`. Two methods, two clamps, and the
invariant "rest is between 0 and 100" is now true by construction rather than by everyone
remembering.

**`IsFitToWork`** computes on each read and stores nothing. This is the property that stops
`Rest >= 30` from being copy-pasted into eleven places — change the threshold here and every
caller in the program changes with it.

**`Name { get; init; }`** can be set in the object initializer on line 1 and never again. A
dragon's name is fixed once it has one.

**`Warehouse.TryStore`** is section 3 of the *Fundamentals* chapter turning up in a class: storing
more than fits is an *expected* failure, so it returns `false` rather than throwing. `WorkShift`
with a negative number of hours is a *broken rule* — no sane caller does that — so it throws.
Same class, both tools, chosen by which kind of failure it is.

**`Warehouse(int capacity)`** sets `Capacity`, which is `{ get; }` — settable only from a
constructor. After that, a warehouse's capacity is a fact about it.

> **C corner:** a property is what you'd build in C with `get_rest()` / `set_rest()` plus the
> discipline to make everyone use them — except here the *call syntax stays field syntax*, so
> upgrading a plain field into a validated property breaks no callers and requires no discipline
> from them at all. The auto-property's hidden backing field is the same struct member you'd have
> written; the compiler just owns its name.

**Try it — Lab:** In the Study tab, write a `class Guild` with a private `_gold` field and a
`Gold` property that is publicly readable and privately settable. Add `Earn(decimal amount)` and
`Spend(decimal amount)`, where `Spend` returns `false` if there isn't enough rather than letting
gold go negative, and both throw `ArgumentOutOfRangeException` for a non-positive amount. Then try
to drive gold negative from the outside by any means you can think of — and confirm you can't.

**Traps**

- **`public int X;` and `public int X { get; set; }` look interchangeable.** They aren't: only
  the property can grow validation later without breaking callers, and a good deal of the .NET
  ecosystem (serialisation, data binding, ORMs) simply refuses to work with fields. Never expose
  a public field.
- **A `public set` that validates nothing is encapsulation theatre.** You've added syntax, not
  safety. If a value has rules, the setter or a method must enforce them.
- **Getters that do real work.** A getter runs on *every* read. Hiding an expensive computation
  behind `public int Score => RecomputeEverything();` makes an innocent `if (g.Score > 10)` cost
  real time. If it does work, make it a method — `GetScore()` — so the cost is visible.
- **Thinking `init` gives you deep immutability.** It freezes the property after construction, but
  if the property holds a mutable object — a `List<string>` — the *reference* is frozen and the
  contents are wide open.

*(Atlas: **Properties**, **Classes**, **Access modifiers**.)*

---

## 2. Inheritance & polymorphism

**The idea**

The guild's roster has mining dragons, forest dragons and transport dragons. Every dragon has a
name, needs rest, and produces something in a day — but *what* it produces, and how much, depends
entirely on what kind of dragon it is.

You could write this with a type tag:

```csharp
if (dragon.Kind == "mining")         output = 12;
else if (dragon.Kind == "forest")    output = 9;
else if (dragon.Kind == "transport") output = 0;
```

It works. Now count what happens when the guild acquires its first water dragon: you must find
*every* `switch` on kind — the output calculation, the feeding schedule, the stable assignment,
the daily report — and add an arm to each. Miss one and you get a silent wrong answer rather than
an error. That's the cost, and it recurs for every new kind, forever.

**Inheritance** lets you write the shared part once in a **base class** and the varying part in
each **derived class**. `class MiningDragon : Dragon` reads "MiningDragon *is a* Dragon". The
derived class gets everything the base declared, and can add to it or replace parts of it.

The payoff is **polymorphism** — "many forms". A variable typed as the *base* can hold any
*derived* object, and when you call a method through it, **the object's own version runs**. The
decision happens at runtime, based on what the object actually is, not what the variable claims.

That single mechanism replaces every one of those `switch (kind)` ladders. Adding a water dragon
touches **zero existing lines**: you write one new class, and everything that consumes `Dragon`
picks it up.

**The three keywords, and why C# makes you say them**

- `virtual` on a base method: "derived classes *may* replace this; here's my default."
- `abstract` on a base method: "derived classes *must* supply this; I provide nothing." A class
  with any abstract member must itself be `abstract`, and an abstract class can't be `new`ed — it
  exists only to be derived from.
- `override` on the derived method: "this replaces the base version." **Required.** A
  same-named method *without* `override` doesn't participate in polymorphism at all — see Traps,
  because this one catches everybody once.

Two more worth knowing: `base.Method()` calls the base implementation from inside an override, for
"do the standard thing, and then something extra"; and `sealed` on a class forbids deriving from
it — a sensible default for classes you didn't design as extension points.

**In practice**

```csharp
Dragon[] roster =
[
    new MiningDragon { Name = "Ironjaw" },
    new ForestDragon { Name = "Mossback" },
    new TransportDragon { Name = "Longtail" },
];

foreach (Dragon dragon in roster)             // the variable's type is Dragon...
    Console.WriteLine(dragon.Describe());     // ...but each object's OWN DayOutput runs

abstract class Dragon
{
    public string Name { get; init; } = "";

    public abstract int DayOutput();          // no body — every dragon MUST answer this

    public virtual string Describe()          // a default — a dragon MAY replace it
        => $"{Name} produces {DayOutput()} crates a day";
}

class MiningDragon : Dragon
{
    public override int DayOutput() => 12;
}

class ForestDragon : Dragon
{
    public override int DayOutput() => 9;
}

sealed class TransportDragon : Dragon         // sealed: nothing derives further
{
    public override int DayOutput() => 0;

    public override string Describe()
        => base.Describe() + ", but hauls 60 between facilities";
}
```

```text
Ironjaw produces 12 crates a day
Mossback produces 9 crates a day
Longtail produces 0 crates a day, but hauls 60 between facilities
```

The key line is the loop, and it's worth staring at. It was compiled knowing only that these are
`Dragon`s. It has never heard of `MiningDragon`. Yet at runtime, `DayOutput()` dispatches to the
right one per object — and `TransportDragon` even replaces `Describe` itself, calling
`base.Describe()` first to get the standard sentence and then adding to it.

Add a `WaterDragon : Dragon` tomorrow and this loop is untouched. So is everything else that
consumes `Dragon`. That property has a name — the **open/closed principle**: open to extension,
closed to modification.

`[ ... ]` is a **collection expression**, the modern short form for an array literal.

**When *not* to inherit**

Inheritance is the strongest coupling the language offers. A change in the base class ripples
into every derived class, and derived classes can see `protected` internals. Reserve it for
genuine *is-a* relationships where callers will actually hold the base type.

For *has-a*, use **composition**: hold the other object in a field and delegate to it.

```csharp
var stable = new Stable();
stable.OpenForTheDay();

class Hearth
{
    public void Light() => Console.WriteLine("the hearth is lit");
}

class Stable                          // a Stable HAS a Hearth — it is not a kind of Hearth
{
    private readonly Hearth _hearth = new();   // readonly: assignable only at construction
    public void OpenForTheDay() => _hearth.Light();
}
```

```text
the hearth is lit
```

"Favour composition over inheritance" is the most-repeated maxim in OOP because it's right. A
shallow hierarchy — one abstract base, one level of derived classes — plus composition ages far
better than a tower of `A : B : C : D`. If you're inheriting purely to reuse a method, compose
instead. And section 3 covers most of what's left with even less coupling.

> **C corner:** virtual dispatch is the struct-of-function-pointers pattern, industrialised. A
> base with virtual methods gets a hidden vtable pointer, and `dragon.DayOutput()` compiles to
> "load the object's vtable, call slot n" — the same trick as a driver ops table in C, except the
> compiler builds the tables, fills the slots, and type-checks every signature for you.

**Try it — Lab:** Build the `Dragon` hierarchy above in the Study tab, then total the roster's
output with `int total = 0; foreach (var d in roster) total += d.DayOutput();` and print it. Now
add a `WaterDragon` (`DayOutput() => 7`), put one in the array, and rerun. **Count the lines you
changed outside the new class.** It should be exactly one — the array element you added. That's
the open/closed principle in your own hands, and it's the difference between this and the
`if/else` ladder at the top of the section.

**Traps**

- **C# methods are not virtual by default.** A base method without `virtual` or `abstract` can't
  be overridden — and writing a same-signature method in the derived class without `override`
  *hides* the base method instead. Calls through a base-typed variable still run the base version,
  so your polymorphism silently isn't. The compiler warns (CS0108); never wave that one through.
- **Forgetting `override`** is the same trap from the other side. The rule is that polymorphism
  needs the *pair*: `virtual` or `abstract` on the base, `override` on the derived. One without
  the other is not polymorphism.
- **Deriving to reuse code when there's no is-a.** `class Roster : List<Dragon>` welds you to a
  base you don't control and exposes its entire surface, including the parts that make no sense
  for a roster. Compose: hold a `private List<Dragon>` and expose only what you mean.
- **Calling a virtual method from a base constructor.** The derived override runs *before* the
  derived class's fields are initialised — a classic source of surprise nulls. Keep constructors
  boring.

*(Atlas: **Inheritance**, **Polymorphism**.)*

---

## 3. Interfaces & abstraction

**The idea**

The guild's Engine needs to tell somebody what happened: which dragon was assigned, which contract
completed, which inspector arrived. In the previous chapter you saw why it must not call
`Console.WriteLine` to do that — the Engine has to work under a console front-end, a Terminal.Gui
one and an Avalonia one, and the moment it prints, it's welded to a screen.

So what does it call instead? It calls something that can write a line — without knowing, or
caring, what that something does with it.

An **interface** is a contract with no data: a named list of members that a type promises to
provide. `interface IGuildLog { void Write(string message); }` says "anything claiming to be an
`IGuildLog` can `Write`" — and says nothing whatsoever about how. A class implements it with the
same `:` syntax as inheritance, and unlike base classes, a class can implement **many** interfaces
while having at most one base class.

Why does this deserve its own concept when abstract classes exist? Because it enables
**abstraction** as a discipline: *code against the contract, not the implementation*. A method
that takes `IGuildLog` works with every implementation ever written — including ones that don't
exist yet, and including the fake you write for a test. An abstract class ties implementers to
shared code and a place in a hierarchy; an interface asks only "can you do these operations?", and
completely unrelated types can all say yes.

**Constructor injection: the pattern that makes it real**

A class that *needs* a capability should not create its own dependency. `new ConsoleLog()` inside
`WorkDay` hard-wires the choice forever, and no test can get in front of it.

Instead, declare the interface as a constructor parameter and let the *caller* decide which
implementation to pass. The class stays ignorant of concrete types, so you can hand it a fake in a
test or a different implementation in production without touching it.

This is the entire idea behind the "dependency injection" you'll meet in ASP.NET Core. The
framework part is just automating *"the caller decides"*.

**Choosing between the two contract forms**

| Prefer an **interface** when… | Prefer an **abstract class** when… |
|---|---|
| unrelated types share a *capability* | a family shares *code and state* |
| implementers may need several contracts | one hierarchy home is natural |
| you want swap-in test fakes | you're providing a partial implementation |

When in doubt: interface. You can always add an abstract base that *implements* the interface
later. You can't retrofit a second base class.

**In practice**

```csharp
// Production wiring: the caller picks the real implementation.
var day = new WorkDay(new ConsoleLog());
day.Run();

// Test wiring: the same class, a fake that records instead of printing.
var fake = new FakeLog();
new WorkDay(fake).Run();
Console.WriteLine($"lines recorded: {fake.Lines.Count}");
Console.WriteLine(fake.Lines[0]);

interface IGuildLog
{
    void Write(string message);        // no body, no access modifier: public by definition

    // A default interface member: an implementation ON the interface. Implementers get it
    // free and may still supply their own. Useful for growing an interface people already use.
    void WriteAll(IEnumerable<string> messages)
    {
        foreach (var message in messages) Write(message);
    }
}

class ConsoleLog : IGuildLog
{
    public void Write(string message) => Console.WriteLine($"[guild] {message}");
}

class FakeLog : IGuildLog              // a test double: records instead of acting
{
    public List<string> Lines { get; } = [];
    public void Write(string message) => Lines.Add(message);
}

class WorkDay
{
    private readonly IGuildLog _log;

    public WorkDay(IGuildLog log)      // constructor injection: the CALLER decides
        => _log = log;

    public void Run()
    {
        // ...the day's work happens here...
        _log.Write("Ironjaw assigned to the Stone contract");
    }
}
```

```text
[guild] Ironjaw assigned to the Stone contract
lines recorded: 1
Ironjaw assigned to the Stone contract
```

Read `WorkDay` closely, because the important thing about it is what it *doesn't* say. It never
names `ConsoleLog`. It never names `FakeLog`. It knows there is something it can `Write` to, and
that is the whole of its knowledge. That's why the same class appears twice at the top of the
program with completely different behaviour, and why neither use required editing it.

Look at the output too: the first run printed, the second didn't — it recorded. A test can now
assert on exactly what the Engine said, with no console involved and nothing to clean up.

Details worth naming. Interface names start with `I` by universal C# convention.
`IEnumerable<string>` means "any sequence of strings" — the standard-library interface that every
collection implements. And one caution on **default interface members**: they exist for evolving
an interface without breaking its implementers, not as a substitute for a base class. An interface
still can't hold state — no fields — so a default body can only call other interface members.

> **C corner:** an interface is a capability-scoped ops table — like a `file_operations` struct,
> but per-capability rather than per-subsystem, and wired up by the type system instead of by
> hand-filling function pointers. "Take `IGuildLog`, not `ConsoleLog`" is the same instinct as
> taking a callback parameter instead of hard-coding the call.

**Try it — Lab:** In the Study tab, define `interface IHauler { decimal Quote(int crates); }` with
two implementations — `FlatRate` (always `5m`) and `PerCrate` (`0.5m * crates`). Write a
`class Shipment` that takes an `IHauler` in its constructor and has
`decimal Total(decimal goodsValue, int crates)` returning the goods plus the quote. Build one
`Shipment` with each hauler and print both totals for the same order: one class, two behaviours,
chosen entirely by the caller. Then write a third implementation that records what it was asked
without returning a real price, and notice you've just written a test double.

**Traps**

- **Taking a concrete class as a parameter when an interface exists.**
  `void Run(ConsoleLog log)` quietly forfeits every bit of swappability. If you own the signature,
  ask for the contract.
- **An interface with exactly one implementation forever is speculative ceremony** — but note that
  the test fake usually *is* the second implementation. "The real one plus a fake one" already
  justifies an interface for anything with side effects: I/O, network, the clock, randomness.
- **Implementing a member with the wrong signature doesn't override anything** — the class simply
  fails to compile as an implementer. Read the error; it names the missing member exactly.
- **Default interface members are invisible through the class type.**
  `new ConsoleLog().WriteAll(...)` doesn't compile unless `ConsoleLog` declares it. You have to
  call through the interface: `IGuildLog log = new ConsoleLog();`.

*(Atlas: **Interfaces**, **Generics** for the `<T>` forms on standard interfaces.)*

---

## 4. Records & value equality

**The idea**

Two crates of forty Stone are the same thing. Two dragons named Ironjaw are two dragons.

That difference is the whole section. Classes carry an assumption you met in the *Fundamentals*
chapter: for a class, `a == b` asks "are these the same object in memory?" — so two separately
created objects with identical contents are not equal.

That's exactly right for things with **identity**. Two dragons both named Ironjaw, both fully
rested, are still two different dragons; feeding one doesn't feed the other, and `==` saying
`False` is the truth.

It's exactly wrong for pure **values**. A quantity of cargo, an amount of gold, a coordinate, a
date range — these are defined entirely by what they contain. Asking "are they the same object?"
of two identical cargo amounts is a category error, like asking whether two 5s are the same 5.

You *could* fix a class by hand-writing `Equals`, `GetHashCode` and `ToString`. It's tedious, easy
to get subtly wrong, and it breaks silently the day someone adds a property and updates only two
of the three.

A **record** is a class where the compiler writes all of that from the properties, plus two more
gifts: a readable `ToString()`, and the **`with` expression** for non-destructive mutation — "a
copy of this, with these properties changed". That second one is what makes an immutable style
practical: instead of mutating a value and surprising everyone else holding it, you produce a new
value and leave the old one alone.

**The decision rule: record for data, class for actors.** If the thing is defined by what it
contains and shouldn't change after creation — cargo, money, coordinates, measurements, events,
configuration, anything crossing a wire — make it a record. If it's defined by identity and
behaviour over time — a dragon, a warehouse, a guild, anything from sections 1 to 3 — keep it a
class. Real programs are full of both.

**In practice**

```csharp
var a = new Cargo("Stone", 40);
var b = new Cargo("Stone", 40);
var bigger = a with { Crates = 65 };       // copy-and-change; a is untouched

Console.WriteLine(a == b);                 // VALUE equality: same contents, so True
Console.WriteLine(a == bigger);
Console.WriteLine(a);                      // generated ToString
Console.WriteLine(bigger);

var (resource, crates) = bigger;           // deconstruction — free with positional records
Console.WriteLine($"{crates} of {resource}");

// Contrast: two dragons with identical data are still two dragons.
var d1 = new Dragon { Name = "Ironjaw" };
var d2 = new Dragon { Name = "Ironjaw" };
Console.WriteLine(d1 == d2);

record Cargo(string Resource, int Crates)
{
    // Records can have bodies. Note what Add does NOT do: mutate.
    public Cargo Add(Cargo other)
    {
        if (Resource != other.Resource)
            throw new InvalidOperationException("cannot add different resources");

        return this with { Crates = Crates + other.Crates };
    }
}

class Dragon
{
    public string Name { get; init; } = "";
}
```

```text
True
False
Cargo { Resource = Stone, Crates = 40 }
Cargo { Resource = Stone, Crates = 65 }
65 of Stone
False
```

The walkthrough:

**`record Cargo(string Resource, int Crates)`** — the parameter list after the name is what makes
it **positional**. That one line generates: a constructor taking both values, two
`public { get; init; }` properties, value-based `Equals` and `GetHashCode`, a `ToString` that
prints the contents, and a deconstructor. Writing that by hand is about forty lines, and you'd get
`GetHashCode` wrong.

**`a == b` is `True`.** Two separate objects, and the record says they're equal because their
contents match. Compare that against the last line of output — `d1 == d2` is `False` for the
class. Same program, two kinds of type, two answers, both correct for what they model.

**`a with { Crates = 65 }`** constructs a *new* `Cargo` copying everything and changing what you
named. `a` is untouched, which the third line of output confirms. Because every property on a
positional record is `init`-only, `with` isn't a convenience — it's the only way to "change" one.

**`var (resource, crates) = bigger;`** takes it apart into two ordinary variables. You get that
for free from the positional form.

**`Add` returns `this with { ... }`** rather than modifying anything. That's the record style in
one method: operations produce new values. Nobody else holding a `Cargo` is affected by your
arithmetic, which removes an entire category of bug.

**Two variants to know exist**

- `record struct Spot(int X, int Y);` — the same generated machinery on a value type, with no heap
  allocation. Good for small, hot values like coordinates. Unlike `record`, a plain `record struct`
  is mutable — write `readonly record struct` to lock it down.
- Records can inherit: `record Delivery(string Resource, int Crates, string To) : Cargo(Resource,
  Crates);`. Records may only derive from records, and equality stays honest across the hierarchy —
  two records must be the same runtime type *and* have equal contents to be `==`.

> **C corner:** a record is the struct you'd want to `memcmp` — except correct, because `memcmp`
> compares padding bytes and pointer values and will happily tell you two identical strings are
> different. `with` is "copy the struct, patch two members" as a single expression, with no
> field-by-field copy code to keep in sync.

**Try it — Lab:** In the Study tab, declare
`record Delivery(string Resource, int Crates, decimal PricePerCrate)` and give it a computed
property `Total => Crates * PricePerCrate`. Create one, then enlarge it with
`delivery with { Crates = delivery.Crates + 20 }`. Print both deliveries and both totals, then
print `original == enlarged` — confirm the original is untouched and the two compare `False`,
while a freshly built record with identical arguments compares `True`. Then change `Delivery` to a
`class` and watch the equality answers change without another line moving.

**Traps**

- **A record containing a mutable collection isn't really a value.**
  `record Manifest(List<string> Items)` compares its list **by reference** — two manifests with
  equal contents in different lists are not `==`, and `with` copies the reference, so the "copy"
  shares the list. Keep record members immutable (`IReadOnlyList<T>`, or other records). Records
  compose cleanly out of records.
- **`with` is a shallow copy.** Same root cause as above, different symptom.
- **Mutating something used as a dictionary key.** Possible on a plain `record struct`, or through
  a sneaky mutable member. It changes the hash code and the entry is lost. Immutable keys only.
- **Reaching for `record` to save typing on something with identity.** You'd be handing out value
  equality that is semantically wrong. `==` reporting that two different dragons are "equal"
  because their stats match is a bug generator, not a convenience.

*(Atlas: **Records**, **Equality**, **Structs**.)*

---

## Check yourself

One honest question per topic. If yes without peeking, tick the node — here or on the Map, same
data.

1. Can you explain why a property with a validating setter protects an invariant in a way a public
   field never can, and write the `{ get; private set; }` and `{ get; init; }` forms from memory?
   If yes, tick *Encapsulation & properties* above.
2. Given an abstract base with one `abstract` and one `virtual` method, can you predict exactly
   which body runs for a derived object held in a base-typed variable — and say what happens if
   someone forgets `override`? If yes, tick *Inheritance & polymorphism* above.
3. Can you write a class that receives an interface through its constructor, and explain what that
   buys you the day you need to test it without real side effects? If yes, tick *Interfaces &
   abstraction* above.
4. Can you state what `==` means for a class versus a record, say which of the guild's types
   should be which, and use `with` to change one field of an immutable value without touching the
   original? If yes, tick *Records & value equality* above.

All four ticked? Tick the chapter, then take checkpoint **cp2** — the exam-style gate for this
material. See the *Checkpoints & Defenses* page for how checkpoints work.
