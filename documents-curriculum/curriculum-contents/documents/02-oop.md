# Object-Oriented Programming

This chapter teaches object-oriented programming from scratch: what a class actually is, why
objects guard their own data, how one variable can run four different behaviours, and when a
`record` beats a `class`. By the end you can model a small domain — accounts, shapes, payment
methods — as a set of types that enforce their own rules and can be extended without editing
existing code. That skill is the backbone of everything later: ASP.NET Core, EF Core, and
dependency injection are all built on it.

First, the vocabulary the whole chapter rests on:

- A **class** is a blueprint: it declares *data* (fields, properties) and *behaviour* (methods)
  together as one unit.
- An **object** (or *instance*) is one concrete thing built from that blueprint, created with
  `new`. Two `new BankAccount()` calls give you two independent objects with their own data.
- Inside a class's methods, `this` refers to "the object this method was called on" — it is
  usually implicit and you rarely write it.

```csharp
var a = new Counter();   // one object
var b = new Counter();   // a second, independent object
a.Increment();
a.Increment();
b.Increment();
Console.WriteLine(a.Count);   // prints: 2
Console.WriteLine(b.Count);   // prints: 1

class Counter
{
    public int Count;                       // data — each object gets its own copy
    public void Increment() => Count++;     // behaviour — operates on THIS object's data
}
```

The `=>` after `Increment()` is an **expression-bodied member**: shorthand for a method whose
whole body is one expression (`public void Increment() { Count++; }` means the same thing).
You'll see it constantly in this chapter. Note the class is declared *after* the statements —
that's the top-level-statements layout the Study tab uses: statements first, type declarations
below them, same file.

> **C corner:** a class is roughly a `struct` plus the functions that operate on it, bundled so
> the "first argument is a pointer to the struct" convention (`account_deposit(&acct, 10)`)
> becomes `acct.Deposit(10)`. Class objects live on the heap and variables hold references to
> them — like a `T*` you never free; the garbage collector reclaims unreachable objects.

---

## 1. Encapsulation & properties

**The idea.** The `Counter` above has a flaw: `Count` is a public field, so any code anywhere
can write `a.Count = -5;` and no one stops it. As a program grows, "who is allowed to touch
this data, and what values are legal?" becomes the question that decides whether the code stays
correct. **Encapsulation** is the answer: an object keeps its data private and exposes
*operations* instead, so every write goes through code that can enforce the object's
**invariants** — the rules that must always hold (a balance is never negative, a percentage is
0–100). If the only code that can write the field lives inside the class, you only have to get
that code right *once*, instead of auditing every caller in the program.

The tools for this are **access modifiers**, written on each member:

- `public` — visible to all code.
- `private` — visible only inside this class. This is the **default** for members if you write
  no modifier at all.
- `protected` — visible in this class and its subclasses (section 2).
- `internal` — visible anywhere in the same compiled project; in the single-file Study lab it
  behaves like `public`.

Hiding fields raises an obvious problem: how do callers *read* the data? Writing a
`GetBalance()` method works but is ceremony. C# solves it with **properties**: members that are
*used* like fields (`acct.Balance`) but *run code* when read or written. That means you can
start with a trivial property and later add validation without changing a single caller — which
is exactly why the C# convention is *never expose public fields; expose properties*.

**In practice.** The whole property toolkit in one runnable program:

```csharp
var acct = new BankAccount { Owner = "Ada" };
acct.Deposit(100m);
acct.Deposit(50m);
Console.WriteLine($"{acct.Owner}: {acct.Balance}");     // prints: Ada: 150
Console.WriteLine(acct.IsRich);                          // prints: False

// acct.Balance = 9999m;      // compile error: setter is private
// acct.Owner = "Eve";        // compile error: init-only after construction

var t = new Thermostat();
t.Target = 100;                                          // setter clamps it
Console.WriteLine(t.Target);                             // prints: 30

class BankAccount
{
    // Auto-property: the compiler generates a hidden private field for you.
    // "get" is public, "set" is private — readable anywhere, writable only in this class.
    public decimal Balance { get; private set; }

    // init-only: assignable at construction time (in an object initializer or constructor),
    // frozen afterwards. "= \"\"" is its default value.
    public string Owner { get; init; } = "";

    // Expression-bodied, get-only computed property: no storage, evaluated on each read.
    public bool IsRich => Balance > 1_000_000m;

    public void Deposit(decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentOutOfRangeException(nameof(amount));
        Balance += amount;      // the ONLY line in the program that changes Balance
    }
}

class Thermostat
{
    private int _target = 20;                    // explicit backing field
    public int Target
    {
        get => _target;
        set => _target = Math.Clamp(value, 10, 30);   // every write funnels through this
    }
}
```

New pieces, in order of appearance: `new BankAccount { Owner = "Ada" }` is an **object
initializer** — it runs the constructor, then assigns the listed properties (this is the moment
`init` properties are still writable). `nameof(amount)` yields the string `"amount"` checked by
the compiler, so the exception names the offending parameter without a fragile string literal.
Inside a **setter**, `value` is the keyword for "what the caller is assigning".
`ArgumentOutOfRangeException` and `Math.Clamp` are standard library items — see Atlas:
**Exceptions** and Atlas: **Math**. The `m` suffix makes a literal `decimal`, the exact base-10
type you use for money (Fundamentals chapter, *Types & variables*).

The flavours to memorize:

| Form | Meaning |
|---|---|
| `public int X { get; set; }` | auto-property, read/write anywhere |
| `public int X { get; private set; }` | read anywhere, write only inside the class |
| `public int X { get; init; }` | set once during construction, immutable after |
| `public int X { get; }` | set only in a constructor, immutable after |
| `public int X => _a + _b;` | computed on every read, no storage |

> **C corner:** a property is what you'd build in C with `get_x()` / `set_x()` functions and
> discipline — except here the *call syntax stays field syntax*, so upgrading a dumb field to a
> validated property breaks no callers. The auto-property's hidden backing field is the same
> struct member you'd have written; the compiler just owns its name.

**Try it — Lab:** in the Study tab, write a `class Player` with a private `int _hp = 100` and a
property `Hp` whose setter clamps to 0–100, plus a get-only computed property
`IsAlive => Hp > 0`. From top-level statements, try `p.Hp -= 250;` and print `Hp` and `IsAlive`
— confirm the object defended itself (`0`, `False`) without the calling code doing anything.

**Traps**

- `public int X;` (field) and `public int X { get; set; }` (property) look interchangeable but
  aren't: only the property can later grow validation without breaking callers, and many
  library features refuse to work with fields. Just never expose public fields.
- A `public set` that skips validation is encapsulation theatre — the invariant isn't enforced,
  you've only added syntax. If a value has rules, the setter (or a method) must enforce them.
- A getter runs on *every* read. Hiding an expensive computation behind
  `public int Score => RecomputeEverything();` makes an innocent-looking `if (p.Score > 10)`
  costly. If it does real work, make it a method — `GetScore()` — so callers can see the cost.
- `init` freezes the property after the object initializer completes — but if the property
  holds a *mutable object* (say a `List<int>`), the reference is frozen, not the contents.
  `init` alone is not deep immutability.

*(Atlas: **Properties**, **Classes**, **Access modifiers**.)*

---

## 2. Inheritance & polymorphism

**The idea.** Sometimes several classes are variations on one concept: `Circle` and `Square`
are both shapes; every shape has a name and an area, but each computes area its own way.
**Inheritance** lets you write the shared part once in a **base class** and the varying part in
each **derived class** (`class Circle : Shape` reads "Circle *is a* Shape"). The derived class
gets everything the base declared, and can add or replace behaviour.

The payoff is **polymorphism** ("many forms"): a variable typed as the *base* can hold any
*derived* object, and when you call a method through it, the *object's own* version runs — the
decision happens at runtime, based on what the object actually is, not what the variable says.
That single mechanism replaces every `switch (kind)` you'd otherwise scatter through the code,
and it means adding a new kind touches **zero** existing lines: you just write one new class.
The alternative — a type tag plus a `switch` in every function that cares — must be found and
edited in N places every time a kind is added.

Three keywords control it, and C# makes every step explicit:

- `virtual` on a base method: "derived classes *may* replace this; I provide a default."
- `abstract` on a base method: "derived classes *must* supply this; I provide nothing." A class
  with any abstract member must itself be marked `abstract`, and an abstract class cannot be
  `new`ed — it exists only to be derived from.
- `override` on the derived method: "this replaces the base version." Required — a same-named
  method *without* `override` does **not** participate in polymorphism (see Traps).

Two more: `base.Method()` calls the base implementation from inside an override (for "do the
standard thing, plus extra"), and `sealed` on a class forbids deriving from it at all — the
right default for classes you didn't design as extension points.

**In practice.**

```csharp
Shape[] shapes =
[
    new Circle { Name = "c1", Radius = 2 },
    new Square { Name = "s1", Side = 3 },
    new Circle { Name = "c2", Radius = 1 },
];

foreach (Shape s in shapes)                 // the variable's type is Shape...
    Console.WriteLine(s.Describe());        // ...but each object's OWN Area runs

// prints:
// c1 has area 12.57
// s1 has area 9.00
// c2 has area 3.14

abstract class Shape
{
    public string Name { get; init; } = "";
    public abstract double Area();                       // no body — derived MUST supply
    public virtual string Describe()                     // default — derived MAY replace
        => $"{Name} has area {Area():F2}";               // :F2 = format to 2 decimals
}

class Circle : Shape
{
    public double Radius { get; init; }
    public override double Area() => Math.PI * Radius * Radius;
}

sealed class Square : Shape                              // sealed: no one derives further
{
    public double Side { get; init; }
    public override double Area() => Side * Side;
    public override string Describe()
        => base.Describe() + "";                         // base call, then (here) nothing extra
}
```

The `[ ... ]` array literal is a collection expression (Fundamentals chapter, *Collections*).
The key line is the loop: it compiles knowing only `Shape`, yet at runtime `Area()` dispatches
to `Circle.Area` or `Square.Area` per object. Add a `Triangle : Shape` tomorrow and the loop —
and everything else that consumes `Shape` — is untouched. That property has a name, the
**open/closed principle**: open to extension (new classes), closed to modification (existing
code doesn't change).

**When *not* to inherit.** Inheritance is the strongest coupling in the language — a base-class
change ripples into every derived class, and derived classes can see `protected` internals.
Reserve it for genuine *is-a* relationships where callers will actually hold the base type. For
*has-a* / *uses-a*, prefer **composition**: store the other object in a field and delegate:

```csharp
var car = new Car();
car.Drive();                     // prints: engine started

class Engine
{
    public void Start() => Console.WriteLine("engine started");
}

class Car                        // a Car HAS an Engine — it is not a kind of Engine
{
    private readonly Engine _engine = new();   // readonly: field assignable only at construction
    public void Drive() => _engine.Start();
}
```

"Favour composition over inheritance" is the most-repeated OOP maxim because it's right: a
shallow hierarchy (one abstract base, one level of derived classes) plus composition ages far
better than a deep tower `A : B : C : D`. If you're inheriting just to reuse a method, compose
instead. And in section 3 you'll see interfaces cover most remaining cases with less coupling.

> **C corner:** virtual dispatch is the struct-of-function-pointers pattern, industrialized.
> A base with virtual methods gets a hidden vtable pointer; `s.Area()` compiles to "load
> object's vtable, call slot n" — same trick as a driver ops table in C, but the compiler
> builds the tables, fills the slots, and type-checks every signature for you.

**Try it — Lab:** build the `Shape` hierarchy above in the Study tab, then total the areas with
a plain `double total = 0; foreach (var s in shapes) total += s.Area();` and print it. Now add
a `Triangle` class (`Area() => Base * Height / 2`, two `init` properties), add one to the
array, and rerun. Count the lines you changed outside the new class: it should be exactly the
one array element you added. That's the open/closed principle in your hands.

**Traps**

- C# methods are **not** virtual by default. A base method without `virtual`/`abstract` cannot
  be overridden — and writing a same-signature method in the derived class without `override`
  *hides* the base method instead: calls through a base-typed variable still run the base
  version. The compiler warns (CS0108) — never ignore that warning.
- Forgetting `override` on the derived method is the same hiding trap from the other side.
  Rule: polymorphism requires the pair — `virtual`/`abstract` on the base, `override` on the
  derived. One without the other silently isn't polymorphism.
- Deriving to reuse code when there's no is-a relationship (`class UserList : List<User>`)
  couples you to a base you don't control and exposes its entire surface. Compose: hold a
  `private List<User>` and expose only what you mean to.
- Calling a virtual method from a base **constructor** runs the derived override *before* the
  derived class's fields are initialized — a classic source of null surprises. Keep
  constructors non-virtual and boring.

*(Atlas: **Inheritance**, **Polymorphism**.)*

---

## 3. Interfaces & abstraction

**The idea.** An **interface** is a contract with no data: a named list of members a type
promises to provide. `interface INotifier { void Send(string msg); }` says "anything claiming
to be an `INotifier` can `Send`" — nothing about how. A class *implements* it with the same `:`
syntax as inheritance, and unlike base classes, a class can implement **many** interfaces
(it has exactly one base class, at most).

Why does this deserve its own concept when abstract classes exist? Because it enables
**abstraction** as a design discipline: *code against the contract, not the implementation*.
A method that takes `INotifier` works with every implementation ever written — including ones
that don't exist yet, and including fakes you write for tests. The abstract class couples
implementers to shared code and a place in a hierarchy; the interface asks only "can you do
these operations?" — unrelated types can all say yes.

The pattern that makes this concrete is **constructor injection**: a class that *needs* a
capability doesn't create its dependency (`new SmtpEmailSender()` hard-wires the choice
forever); it declares the interface as a constructor parameter and lets the *caller* decide
which implementation to pass. The class stays ignorant of concrete types — so you can swap the
real sender for a fake in a test, or for a different provider in production, without touching
the class. This is the entire idea behind the "dependency injection" you'll meet in ASP.NET
Core; the framework part is just automating "the caller decides".

Choosing between the two contract forms:

| Prefer an **interface** when… | Prefer an **abstract class** when… |
|---|---|
| unrelated types share a *capability* | a family shares *code and state* |
| implementers may need several contracts | one hierarchy home is natural |
| you want swap-in test fakes | you're providing a partial implementation |

When in doubt: interface. You can always add an abstract base *implementing* the interface
later; you can't retrofit a second base class.

**In practice.**

```csharp
// Production wiring: caller picks the real implementation.
var report = new ReportJob(new ConsoleNotifier());
report.Run();
// prints:
// [notify] report finished: 3 items

// Test wiring: same class, fake dependency — nothing printed, everything recorded.
var fake = new FakeNotifier();
new ReportJob(fake).Run();
Console.WriteLine(fake.Sent.Count);         // prints: 1
Console.WriteLine(fake.Sent[0]);            // prints: report finished: 3 items

interface INotifier
{
    void Send(string message);              // no body, no access modifier: public by definition

    // Default interface member: an implementation ON the interface. Implementers get it
    // for free and may still provide their own. Handy for growing a published interface.
    void SendMany(IEnumerable<string> messages)
    {
        foreach (var m in messages) Send(m);
    }
}

class ConsoleNotifier : INotifier
{
    public void Send(string message) => Console.WriteLine($"[notify] {message}");
}

class FakeNotifier : INotifier               // a test double: records instead of acting
{
    public List<string> Sent { get; } = [];
    public void Send(string message) => Sent.Add(message);
}

class ReportJob
{
    private readonly INotifier _notifier;
    public ReportJob(INotifier notifier)     // constructor injection: the CALLER decides
        => _notifier = notifier;

    public void Run()
    {
        // ...pretend work happens here...
        _notifier.Send("report finished: 3 items");
    }
}
```

Read `ReportJob` closely: it mentions no concrete notifier anywhere. `public ReportJob(...)` is
a **constructor** — a method named after the class, run by `new`; here it stashes the
dependency in a `readonly` field. Interface names start with `I` by universal C# convention.
`IEnumerable<string>` is "any sequence of strings" — the standard-library interface every
collection implements (Fundamentals chapter, *Collections*; Atlas: **IEnumerable**). One
caution on default interface members: they're for *evolving* an interface without breaking its
implementers, not a substitute for a base class — an interface still cannot hold state (no
fields), so any default body can only call other interface members.

> **C corner:** an interface is a capability-scoped ops table — like a `file_operations`
> struct, but per-capability instead of per-subsystem, and attached by the type system rather
> than by hand-filling pointers. "Take `INotifier`, not `ConsoleNotifier`" is the same instinct
> as taking a callback parameter instead of hard-coding the call.

**Try it — Lab:** in the Study tab, define `interface IShipper { decimal Quote(double kg); }`
with two implementations — `FlatRate` (always `5m`) and `PerKilo` (`2m * (decimal)kg`). Write a
`class Checkout` that takes an `IShipper` in its constructor and has a
`decimal Total(decimal goods, double kg)` returning goods plus the quote. From top-level
statements, build one `Checkout` with each shipper and print both totals for the same order —
one class, two behaviours, chosen entirely by the caller.

**Traps**

- Taking a concrete class as a parameter when an interface exists
  (`void Run(ConsoleNotifier n)`) silently forfeits swappability — every caller is now welded
  to that one implementation. If you own the signature, ask for the contract.
- An interface with one implementation *forever* is speculative ceremony — but note the test
  fake usually *is* the second implementation. "Real one + fake one" already justifies the
  interface for anything with side effects (I/O, network, clock).
- Implementing an interface member with the wrong signature doesn't override anything — the
  class simply fails to compile as an implementer. Read the error; it names the missing member
  exactly.
- Default interface members are invisible when the variable's type is the *class*:
  `new ConsoleNotifier().SendMany(...)` doesn't compile unless the class declares it —
  you must call through the interface type (`INotifier n = new ConsoleNotifier();`).

*(Atlas: **Interfaces**, **Generics** for the `<T>` forms you'll meet on standard interfaces.)*

---

## 4. Records & value equality

**The idea.** Classes carry an assumption you haven't been shown yet: **reference equality**.
For classes, `a == b` asks "are these the *same object in memory*?" — two separately created
objects with identical contents are *not* equal. That's right for things with identity (two
accounts both holding $100 are different accounts) but wrong for pure *values*: a `Point`, a
`Money`, a date range, an API payload. Two `(10, USD)` amounts *are* the same money; asking
"same object?" is a category error.

You could fix a class by hand-writing `Equals`, `GetHashCode`, and `ToString` — tedious,
error-prone, and it silently breaks when someone adds a property and forgets to update all
three. A **record** is a class where the compiler writes all of that from the properties, plus
two more gifts: a readable `ToString`, and the **`with` expression** for non-destructive
mutation — "a copy of this, with these properties changed" — which is what makes the immutable
style *practical*. Instead of mutating a value (and surprising every other holder of the
reference), you produce a new value and leave the old one untouched.

The decision rule: **record for data, class for actors.** If the thing is defined by *what it
contains* and shouldn't change after creation — measurements, money, coordinates, events,
configuration, DTOs — make it a record. If it's defined by *identity and behaviour over time* —
a bank account, a notifier, anything from sections 1–3 — keep it a class. Both kinds appear in
every real program.

**In practice.**

```csharp
// Positional record: one line declares the type, a constructor, two init-only
// properties (Amount, Currency), equality, hash code, ToString, and deconstruction.
var a = new Money(10m, "USD");
var b = new Money(10m, "USD");
var c = a with { Amount = 25m };            // copy-and-change; a is untouched

Console.WriteLine(a == b);                  // prints: True    (VALUE equality)
Console.WriteLine(a == c);                  // prints: False
Console.WriteLine(a);                       // prints: Money { Amount = 10, Currency = USD }
Console.WriteLine(c);                       // prints: Money { Amount = 25, Currency = USD }

var (amt, cur) = c;                         // deconstruction — free with positional records
Console.WriteLine($"{amt} {cur}");          // prints: 25 USD

// Contrast: identical classes are NOT ==, because class == means "same object".
var p1 = new PointClass { X = 1, Y = 2 };
var p2 = new PointClass { X = 1, Y = 2 };
Console.WriteLine(p1 == p2);                // prints: False   (different objects)

record Money(decimal Amount, string Currency)
{
    // Records can still have bodies: extra members welcome.
    public Money Add(Money other)
    {
        if (Currency != other.Currency)
            throw new InvalidOperationException("currency mismatch");
        return this with { Amount = Amount + other.Amount };
    }
}

class PointClass { public int X { get; init; } public int Y { get; init; } }
```

The parameter list after `Money` is what makes it **positional**: each parameter becomes a
`public ... { get; init; }` property, and the constructor and deconstructor are generated to
match. (`record Money { ... }` with hand-written properties is also legal — positional is just
the dense form.) Because every property is `init`-only, records are **immutable by default** —
`with` is how you "change" one, and it changes nothing: it constructs a sibling. Notice
`Add` returns `this with { ... }` — record methods produce new values rather than mutating,
which is the whole style. `InvalidOperationException` is the standard "this operation isn't
valid in the current state" exception (Atlas: **Exceptions**).

Two variants to know exist:

- `record struct Point(int X, int Y);` — the same generated machinery on a **value type**
  (stack/inline storage, no heap allocation; Fundamentals chapter, *Value vs reference types*).
  Reach for it for small, hot-path values like coordinates. Unlike `record`, a plain
  `record struct` is mutable — write `readonly record struct` to lock it down.
- Records support inheritance (`record Employee(string Name, string Dept) : Person(Name);`) —
  records may only derive from records, and equality stays honest across the hierarchy: two
  records must be the same runtime type *and* have equal contents to be `==`.

> **C corner:** a record is the struct you'd `memcmp` — except correct even with strings and
> references inside, where `memcmp` compares pointers and padding and lies to you. `with` is
> "copy the struct, patch two members" as an expression, no field-by-field copy code.

**Try it — Lab:** in the Study tab, declare
`record Booking(string Guest, int Nights, decimal PricePerNight)` and give it a computed
property `Total => Nights * PricePerNight`. Create one booking, then extend the stay with
`booking with { Nights = booking.Nights + 2 }`. Print both bookings and both totals, and print
`original == extended` — confirm the original is untouched (immutability) and the two compare
`False` (different values), while a fresh record with identical arguments compares `True`.

**Traps**

- `record` gives value equality, but a record containing a *mutable collection*
  (`record Basket(List<string> Items)`) compares the list **by reference** — two baskets with
  equal contents in different lists are not `==`, and mutating the shared list mutates "both"
  copies made by `with` (the copy is shallow). Keep record members immutable
  (`IReadOnlyList<string>`, or other records) — see Atlas: **Collections**.
- `with` on a record holding a reference copies the *reference*. Same root cause as above,
  different symptom: the "copy" shares the inner object. Records compose cleanly out of records.
- Because records are value-like, using one as a dictionary key and then mutating it (possible
  on plain `record struct`, or via a sneaky mutable member) changes its hash code and loses the
  entry. Immutable keys only.
- Don't reach for `record` just to save typing on a class that has identity and mutating
  methods — you'd be handing out value equality that's semantically wrong (`==` saying two
  different accounts are "equal" because balances match is a bug generator).

*(Atlas: **Records**, **Equality**, **Structs**.)*

---

## Check yourself

One honest question per topic. If yes without peeking, tick the node — here or on the Map,
same data.

1. Can you explain why a property with a validating setter protects an invariant in a way a
   public field never can — and write the `{ get; private set; }` and `init` forms from
   memory? If yes, tick *Encapsulation & properties* above.
2. Given an abstract base with one `abstract` and one `virtual` method, can you predict exactly
   which method body runs for a derived object held in a base-typed variable — and say when
   you'd reject inheritance in favour of composition? If yes, tick
   *Inheritance & polymorphism* above.
3. Can you write a class that receives an interface through its constructor, and explain what
   that buys you the day you need to test it without real side effects? If yes, tick
   *Interfaces & abstraction* above.
4. Can you state what `==` means for a class versus a record, and use `with` to change one
   field of an immutable value without touching the original? If yes, tick
   *Records & value equality* above.

All four ticked? Tick the chapter, then take **checkpoint cp2** — the exam-style gate for this
chapter's material. See the *Checkpoints & Defenses* page for how checkpoints work.
