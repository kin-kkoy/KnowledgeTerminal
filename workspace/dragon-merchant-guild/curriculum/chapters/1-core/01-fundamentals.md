# C# Fundamentals

This chapter is about the twenty per cent of C# that will bite you if you learn it by osmosis:
how values and objects actually live in memory, how the compiler helps with data that might be
missing, how methods hand things back and forth, and how a real program copes with bad input,
broken rules, files and money. By the end you'll have ported a working C program to idiomatic C#
— with tests — and you'll be able to write small, robust console tools without leaving the app.

You've read *Programs, Classes & Files*, so you can read a `.cs` file and you know what `new`
does. Everything here builds on that and nothing else.

> **Worked solution:** [[01-fundamentals-worked]] — these examples as they land in the Engine,
> with the ledger reader and its tests.
> Section numbers match this page, so the two read side by side in a split pane.

---

## 1. Value vs reference

**The idea**

Start with a bug, because this one is a rite of passage.

You're writing the guild's roster screen. You want to show what a dragon's day would look like if
you sent it down the mine, without actually committing to it — a preview. So you take the dragon,
make a copy, and knock its rest down on the copy:

```csharp
var preview = mossback;
preview.Rest -= 50;
```

You print the preview. It's right. You print the real roster. **Mossback is tired.** You never
sent it anywhere, and it's tired anyway.

Nothing went wrong with your logic. What went wrong is that `var preview = mossback;` did not
make a copy, and finding out *when it does and when it doesn't* is what this section is for.

**The two camps**

Every type in C# is in one of two camps, and the camp decides what assignment means.

A **value type** variable *is* the data. Assigning it, or passing it to a method, copies the whole
thing, and the copy is independent forever after. You declare one with `struct`, and the built-in
numbers, `bool`, `char` and `enum`s are all value types too.

A **reference type** variable holds a *reference* — a managed pointer — to an object that lives on
the **heap**. Assigning copies only the reference. Two variables end up pointing at **one shared
object**. You declare one with `class`, and arrays, `string`, interfaces and delegates are all
reference types.

Here's the picture that makes it stick. Think about how the guild records things on paper.

A dragon's *rest level* is a number written in a box on a form. If you photocopy the form and
scribble on the copy, the original is untouched — the number was never anywhere but on the paper.
That's a value type.

A *dragon* is a warehouse. What you're holding isn't the warehouse; it's a slip of paper with the
warehouse's address on it. Photocopy the slip and you have two slips — but they say the same
address, and there is still exactly one warehouse. Send a crew to the address on either slip and
they unload into the same building. That's a reference type, and it's why Mossback got tired.

**Why have two camps at all?**

Because things divide honestly into two kinds. Small, self-contained data — a coordinate, a date,
a quantity of gold — is cheapest and safest as a plain copyable value. No allocation, no sharing,
no changing at a distance.

Anything with *identity* must be shared rather than copied. There is one Mossback. If two parts
of the program each held their own private Mossback, feeding one wouldn't feed the other, and the
guild would have as many Mossbacks as it had screens open.

C# bakes the decision into the type itself, once, by whoever defines it. Every `Spot` behaves
like a value everywhere in the program; every `Dragon` behaves like a shared object everywhere.
You never have to remember which call site does what.

**What `==` means, which follows from the same split**

- For the built-in value types, `==` compares the **data**. `3 == 3` is true.
- For classes, `==` compares the **references** — "are these the same object?" Two separately
  created dragons with identical names and identical rest are **not** equal, because they're two
  dragons. Which is correct: two dragons named Ironjaw are still two dragons.
- `string` is the famous exception. It's a class, but `==` compares the characters, because
  that's what anybody ever means by comparing two strings.
- A `struct` you define yourself doesn't get `==` at all until you write it. `record` types
  (OOP chapter) get content-based equality generated for you.

**One more consequence: boxing**

C# has a universal base type called `object`, and every value of every type can be treated as
one. But a reference has to point at the heap. So when you put a value type *into* an `object`,
the runtime copies it onto the heap and hands you a reference to the copy. That copy-to-heap step
is called **boxing**.

It's correct, and it's not free. In a tight loop it's the difference between fast and slow, and
it's a large part of why `List<int>` exists rather than everyone using a list of `object`.

**In practice**

```csharp
// A dragon on the roster, and a second name for the same dragon.
var mossback = new Dragon { Name = "Mossback", Rest = 100 };
var preview = mossback;              // ALIAS — one dragon, two names
preview.Rest -= 50;

// A spot on the map, and a genuine copy of it.
var stable = new Spot { X = 3, Y = 7 };
var target = stable;                 // COPY — two independent spots
target.X = 99;

Console.WriteLine($"mossback.Rest = {mossback.Rest}, preview.Rest = {preview.Rest}");
Console.WriteLine($"stable.X = {stable.X}, target.X = {target.X}");

// Two dragons with identical contents are still two different dragons.
var a = new Dragon { Name = "Ironjaw", Rest = 100 };
var b = new Dragon { Name = "Ironjaw", Rest = 100 };
var sameDragon = a;                  // another slip with a's address on it
Console.WriteLine($"a == b: {a == b}");
Console.WriteLine($"a == sameDragon: {a == sameDragon}");

object boxed = stable;               // BOXING: the Spot is copied onto the heap
Console.WriteLine($"boxed holds a {boxed.GetType().Name}");

class Dragon { public string Name = ""; public int Rest; }
struct Spot { public int X, Y; }
```

```text
mossback.Rest = 50, preview.Rest = 50
stable.X = 3, target.X = 99
a == b: False
a == sameDragon: True
boxed holds a Spot
```

Walking it:

**Lines 2–4.** `preview` is not a second dragon. It's a second slip of paper with the same
address. `preview.Rest -= 50` sends a crew to that address, and the printout on line 9 shows both
names reporting 50, because there is one dragon and it has 50 rest. **This is the bug from the top
of the section**, now with a name.

**Lines 6–8.** `Spot` is a `struct`, so `target` genuinely is a copy. Writing `target.X = 99`
changes nothing about `stable`, and line 10 proves it.

**Lines 13–17.** Two `new Dragon`s means two objects. `==` on a class asks "same object?", and
they aren't, so it prints `False` — even though every field matches. `sameDragon` is another slip
of paper carrying `a`'s address, so `a == sameDragon` is `True`. Put those two lines side by side
and you can read off exactly what `==` was measuring: not the contents, the address.

**Line 18.** `boxed` is an `object`, so the `Spot` had to be copied to the heap to be stored in
it. Nothing looks different from here, but an allocation happened on that line that didn't happen
on line 7.

**Line 21.** `var` declares a variable whose type the compiler works out from the right-hand side.
`var preview = mossback;` makes `preview` a `Dragon`, permanently — this is still fully static
typing, just without saying the name twice. And `$"..."` is an **interpolated string**: inside the
quotes, `{expression}` is evaluated and spliced into the text.

**So when should you write `struct`?**

Default to `class`. Reach for `struct` only when the type is small (a few fields), is logically
one indivisible value, and is ideally immutable — a coordinate, a colour, a range, a quantity.
Anything with identity or a lifetime is a `class`. In the guild: `Spot` is a struct; `Dragon`,
`Contract`, `Guild` and `Warehouse` are all classes.

> **C corner:** a C# `struct` variable is a C struct held by value; a `class` variable is a
> `Dragon *` that you never `malloc` or `free` yourself — `new` allocates, and the garbage
> collector reclaims the object once nothing references it. There is no `*` and no `->`; the dot
> does the dereference. The pointer-to-pointer case, `Dragon **`, exists too — that's `ref` on a
> reference-type parameter, in section 3.

**Try it — Lab:** In the Study tab, define `struct Load { public int Crates; }` and
`class Wagon { public int Crates; }` (type declarations go *after* your statements). Make one of
each, copy each to a second variable, change the copy, and print both originals. Predict both
outputs before you run. Then try `var wagons = new List<Load> { new Load { Crates = 1 } };
wagons[0].Crates = 5;` and read the compiler error carefully — indexing a list of structs hands
back a *copy*, so writing to its field would change nothing, and the compiler refuses to let you
believe otherwise.

**Traps**

- **Mutating a struct copy and expecting the original to change** — or the reverse, mutating a
  shared class object and being surprised that every other variable "changed" too. Every aliasing
  bug you will ever write in C# is one of those two, including the one at the top of this section.
- **`list[0].Field = x` on a `List<struct>` doesn't compile.** You'd be writing to a temporary
  copy. Replace the whole element — `list[0] = new Load { Crates = 5 };` — or make it a class.
- **Comparing two class instances with `==` and expecting content equality.** Different objects,
  same data, `==` says `False`. If you want content equality, use a `record` (OOP chapter) or the
  `Equals` the type defines.
- **Large structs are slow.** A struct is copied on every assignment and every call. Keep them
  small — roughly 16 bytes or less — or make them classes.

---

## 2. Nullability & patterns

**The idea**

Every contract on the guild's board has a dragon assigned to it. Except the ones that don't — the
new ones, the ones whose dragon fell ill this morning, the ones nobody has got to yet.

So `contract.AssignedDragon` sometimes holds a dragon and sometimes holds **nothing**. In C#,
nothing is spelled `null`: a reference that points at no object at all. And the moment you write

```csharp
Console.WriteLine(contract.AssignedDragon.Name);
```

on an unassigned contract, you get a `NullReferenceException` and the program stops. Sending a
crew to an address when the slip of paper is blank.

Historically that was simply a fact of life: *any* reference could be null, and you found out at
runtime, usually in front of someone. Modern C# turns it into a **compile-time** question. With
nullable reference types on — they're on in this book and in the Study tab — the *type* says
whether null is allowed:

- `Dragon assigned` — **never null.** The compiler warns if you try to put null in it.
- `Dragon? assigned` — **may be null.** The compiler warns if you use it without checking first.
  The `?` is part of the type.

That single question mark is the whole feature. It moves "might this be empty?" out of your head
and into a place the compiler can check.

Value types get the same treatment with real teeth. `int?` is genuinely a different type — an
`int` plus a has-value flag — and you *cannot* use it as a plain `int` without unwrapping it.

**The four operators that make null-handling short**

- `x?.M()` — **null-conditional.** If `x` is null, skip the call and produce null. Otherwise call
  `M`. "If the slip has an address on it, send the crew."
- `x ?? fallback` — **null-coalescing.** `x` if it isn't null, otherwise `fallback`.
- `x ??= v` — assign `v` to `x` only if `x` is currently null.
- `x!` — **null-forgiveness.** "Compiler, trust me, this isn't null here." It checks *nothing* at
  runtime; it only silences the warning. Every `!` is you overriding the safety net. Use it almost
  never.

**Patterns: asking about shape**

The second half of this section is **patterns** — C#'s way of asking "does this value have this
shape?" and pulling pieces out of it in one move.

The entry point is `is`. `if (x is Dragon d)` tests the type *and* declares `d` in one step;
`if (x is not null)` is the idiomatic null check.

Patterns come into their own in the **switch expression**. Unlike the `switch` *statement* you
know from C, this is an *expression* — it produces a value. Each arm is `pattern => result`, arms
are tried top to bottom, `_` is the catch-all, and the compiler warns you if the arms don't cover
every possible input.

Think of it as the guild's rate card: a table of conditions and what each one means, read down
the page until one matches. Where you'd write an `if / else if` ladder, a switch expression says
the same thing as a table — and the compiler audits the table for holes, which it will never do
for a ladder.

Patterns compose. `< 3` and `>= 14` are **relational patterns**; `and`, `or` and `not` combine
them; and `{ Prop: pattern }` — a **property pattern** — reaches inside an object.

**In practice**

```csharp
// One contract has a dragon on it. One doesn't. Both are normal.
var quarry = new Contract { Resource = "Stone", DaysRemaining = 0 };
var haul = new Contract { Resource = "Timber", DaysRemaining = 2,
                          AssignedDragon = new Dragon("Mossback") };

// Reach through something that might be missing, safely.
Console.WriteLine(quarry.AssignedDragon?.Name ?? "unassigned");
Console.WriteLine(haul.AssignedDragon?.Name ?? "unassigned");

// int? — a count that might not have been taken yet.
Console.WriteLine(Describe(null));
Console.WriteLine(Describe(-3));
Console.WriteLine(Describe(0));
Console.WriteLine(Describe(6));
Console.WriteLine(Describe(400));

// Property patterns: match on the shape of an object.
Console.WriteLine(Priority(quarry));
Console.WriteLine(Priority(haul));
Console.WriteLine(Priority(new Contract { Resource = "Bread", DaysRemaining = 30 }));

string Describe(int? crates) => crates switch
{
    null         => "not counted yet",
    < 0          => "impossible",
    0            => "empty",
    > 0 and < 10 => "a small load",
    _            => "a full wagon",
};

string Priority(Contract c) => c switch
{
    { DaysRemaining: 0 }    => "overdue",
    { DaysRemaining: < 3 }  => "urgent",
    { DaysRemaining: < 14 } => "normal",
    _                       => "plenty of time",
};

class Dragon
{
    public string Name { get; }
    public Dragon(string name) => Name = name;
}

class Contract
{
    public string Resource { get; init; } = "";
    public Dragon? AssignedDragon { get; init; }
    public int DaysRemaining { get; init; }
}
```

```text
unassigned
Mossback
not counted yet
impossible
empty
a small load
a full wagon
overdue
urgent
plenty of time
```

Walking the parts that are new:

**`public Dragon? AssignedDragon { get; init; }`** — the `?` is a statement to every future
reader and to the compiler: *this one can be empty, and that is not a bug.* The unassigned
contract on line 2 doesn't set it at all, and that's fine.

**`quarry.AssignedDragon?.Name ?? "unassigned"`** — read it left to right. `?.` says "if there's
a dragon, take its `Name`; if not, produce null and don't touch it." Then `??` says "if what came
out was null, use `"unassigned"` instead." Two operators, one line, no crash, no `if`.

**`crates switch { ... }`** — a switch expression. `Describe` has a `=>` body because its whole
body is one expression. Note that the arms are checked in order: `< 0` comes before `0`, and
`> 0 and < 10` before `_`. Note also that `null` is an arm — with `int?`, "not counted yet" is a
real answer, not an error case bolted on.

**`{ DaysRemaining: 0 }`** — a property pattern. It reaches into the contract and matches on the
value of one member. The order here is load-bearing in a way worth staring at: `{ DaysRemaining:
< 3 }` would also match a contract with 0 days left, so `{ DaysRemaining: 0 }` has to come first
or "overdue" could never happen.

**`_`** — the catch-all. Without it (or without arms that provably cover everything), an
unmatched value throws at runtime, and the compiler will have warned you first.

**`{ get; init; }`** — a property that can be set when the object is being created and never
again. The OOP chapter covers it; here it just means a contract's resource doesn't change.

**Try it — Lab:** Write `Dragon? FindByName(string name)` that returns a dragon for `"mossback"`
and `null` for anything else — a switch expression with two arms does it. Call it with both, and
print a line using `?.Name.ToUpper()` and `?? "no such dragon"` so the missing case prints
cleanly instead of crashing. Then deliberately call `.Name` on the null result with no check,
watch the compiler warning appear, run it anyway, and meet your first `NullReferenceException` on
purpose. It is much better to meet it here than at midnight.

**Traps**

- **Treating nullability warnings as noise.** A warning on `dragon.Name` is the compiler telling
  you it has *proved* a code path crashes. "It built with warnings" is precisely how a
  `NullReferenceException` ships.
- **Reaching for `!` instead of a check.** `dragon!.Name` still crashes at runtime if you were
  wrong. You didn't fix anything; you asked not to be told.
- **Forgetting an arm.** Without `_` or full coverage, an unmatched value throws — and again, you
  were warned at compile time.
- **Order matters.** Arms match top to bottom. Put the broad arm first and the specific one after
  it, and the specific one is unreachable. `{ DaysRemaining: < 3 }` above `{ DaysRemaining: 0 }`
  means nothing is ever overdue.

---

## 3. Methods & the C-corner

**The idea**

The guild console is going to ask the player how many crates to ship, and the player is going to
type `lots`.

That is not an error. That's Tuesday. People mistype, people press enter on an empty line, people
put a space in. A program that throws an exception every time someone fumbles a number is a
program that spends its life in a `try` block.

So C# has a convention for operations that fail *routinely*, and it's worth knowing by name.

**The Try-pattern.** A method called `TryX` returns a `bool` for whether it worked, and delivers
the actual result through an **`out` parameter** — a parameter the method is required to assign,
which flows back to the caller. The canonical example is built in:

```csharp
if (int.TryParse(text, out int crates)) { /* crates is good */ }
```

You can declare the `out` variable right inside the call, which is why that reads as one line
instead of three. Its throwing sibling `int.Parse(text)` raises a `FormatException` on bad input
— which is right when bad input means a bug, and wrong when bad input means a person.

**`ref` and `in`.** `ref` passes the caller's *variable itself*, so the method can read and write
it — including pointing a reference-type variable at a completely different object. `in` passes by
reference but read-only, a performance tool so that big structs aren't copied. Both must be
written at the call site too — `Swap(ref a, ref b)` — which is deliberate: the reader can see
where a method reaches back into their variables.

**Optional and named parameters.** A parameter with a default (`int hours = 6`) can be left out.
Any argument can be passed by name (`ShiftReport("Ironjaw", hours: 10)`), which documents the call
and lets you skip earlier optionals.

**Tuples.** To hand back two or three values you don't need a type. `(int Lightest, int Heaviest)`
is a **tuple** — an anonymous bundle with optional names. Build one with `(lo, hi)`, and receive
it into fresh variables by **deconstructing**: `var (lo, hi) = LoadRange(xs);`. Tuples are value
types, so section 1's rules apply: assignment copies them.

**Extension methods.** A `static` method whose first parameter is marked `this T x` can be
*called as though it were a method on `T`*. Instead of `CargoExtensions.ToCargoLabel("stone", 40)`
you write `"stone".ToCargoLabel(40)`. It is pure call-site sugar — no access to private state —
but it lets you add verbs to types you don't own, and it is the machinery LINQ is built on
(chapter *LINQ*). Extension methods must live in a `static class`, which is the section-4 kind
from the previous chapter.

**In practice**

```csharp
// Whatever the player typed at the guild console.
string[] typed = { "12", "lots", "" };
foreach (var input in typed)
{
    if (int.TryParse(input, out int crates))
        Console.WriteLine($"shipping {crates} crates");
    else
        Console.WriteLine($"'{input}' is not a number of crates");
}

// ref: the method reaches into the caller's own variables.
int stone = 40, timber = 12;
SwapStock(ref stone, ref timber);
Console.WriteLine($"stone={stone} timber={timber}");

// Optional and named parameters.
Console.WriteLine(ShiftReport("Mossback"));
Console.WriteLine(ShiftReport("Ironjaw", hours: 10));

// Tuples: two values back, no type declared, deconstructed at the call site.
var (lightest, heaviest) = LoadRange(new[] { 40, 12, 95 });
Console.WriteLine($"lightest={lightest} heaviest={heaviest}");

// An extension method: a new verb on a type you don't own.
Console.WriteLine("stone".ToCargoLabel(40));

void SwapStock(ref int a, ref int b) => (a, b) = (b, a);

string ShiftReport(string dragon, int hours = 6) => $"{dragon} worked {hours}h";

(int Lightest, int Heaviest) LoadRange(int[] loads)
{
    int min = loads[0], max = loads[0];
    foreach (var load in loads)
    {
        if (load < min) min = load;
        if (load > max) max = load;
    }
    return (min, max);
}

static class CargoExtensions
{
    public static string ToCargoLabel(this string resource, int units) => $"{units} x {resource}";
}
```

```text
shipping 12 crates
'lots' is not a number of crates
'' is not a number of crates
stone=12 timber=40
Mossback worked 6h
Ironjaw worked 10h
lightest=12 heaviest=95
40 x stone
```

The walkthrough:

**Lines 3–9.** Three inputs, three outcomes, no exceptions and no `try`. `out int crates` declares
`crates` inside the call, and it's in scope for the rest of the block. Note the empty string
behaves exactly like `"lots"` — both are simply "not a number", which is the point of the pattern.

**Lines 12–14.** `SwapStock(ref stone, ref timber)` changes the caller's variables. The `ref` at
the call site isn't the compiler being fussy; it's so that anyone reading line 13 knows that
`stone` and `timber` may be different afterwards. Inside, `(a, b) = (b, a)` is a tuple assignment
doing the swap without a temporary.

**Lines 17–18.** Same method, called two ways. The second names its argument, which reads better
than a bare `10` and would still work if someone added another optional parameter before it.

**Lines 21–22.** `LoadRange` returns `(int Lightest, int Heaviest)`. `var (lightest, heaviest) =`
takes it apart immediately into two ordinary `int` variables. You got two values back from one
method without declaring a type to hold them.

**Line 25 and lines 42–45.** `ToCargoLabel` is declared as a static method taking
`this string resource`, and that `this` is the whole trick: it makes the method callable *on* a
string. `"stone".ToCargoLabel(40)` and `CargoExtensions.ToCargoLabel("stone", 40)` compile to
exactly the same call.

**Line 27.** `void SwapStock(...)` declared at the bottom of a top-level-statements file is a
**local function**. In a real project these would be methods on a class; here they're the same
thing without the ceremony.

> **C corner:** `out int n` is an `int *` you're required to write through. `ref` is an `int *`
> you may read and write. `in` on a struct is a `const T *`. And the pointer-to-pointer case — a
> function that repoints the caller's pointer, `Dragon **` — is exactly `ref` on a reference-type
> parameter. That's the whole mystery, and it's why C# needs the keyword at the call site: C makes
> you write `&x`, and this is the same courtesy.

**Try it — Lab:** Write `bool TryAverageLoad(int[] loads, out double average)` returning `false`
with `average = 0` for an empty array, and `true` with the mean otherwise. Call it with
`new[] { 40, 12, 95 }` and with `new int[0]`, printing `no loads recorded` for the failure. Then
add an extension method `static string Repeat(this string s, int times = 2)` in a `static class`
and print `"ore".Repeat()` and `"ore".Repeat(times: 3)`.

**Traps**

- **Using exceptions for expected failure.** Wrapping `int.Parse` of player input in a
  `try/catch` works, and it's slower and noisier than `TryParse`. Save exceptions for section 4's
  cases.
- **Forgetting `ref` at the call site.** `SwapStock(stone, timber)` with a `ref` signature doesn't
  compile — by design, so aliasing is always visible where it happens.
- **Reading an `out` value after `false`.** `TryParse` leaves `0` in the `out` on failure. The
  value only means anything when the method returned `true`.
- **Tuples are values.** Assignment copies them; changing the copy doesn't touch the original —
  section 1's rule, because tuples are structs.
- **Extension methods can't see private state.** They're sugar over a static call, nothing more.
  If you need the innards, it wants to be a real method on the type.

---

## 4. Errors & IO

**The idea**

Two things can go wrong when the guild ships an order, and they are not the same kind of thing.

The player types `lots` when asked for a quantity. That's expected — section 3, `TryParse`, no
exception.

Something asks the guild to ship **minus five crates**. That isn't a typo; it's a rule being
broken. Some code somewhere has a bug, and the worst possible response is to quietly ship minus
five crates and carry on. This is what exceptions are for.

**Exceptions.** When a *contract is violated* — an argument that must be positive isn't, a file
that must exist doesn't — C# code **throws** an exception: an object describing the failure, which
unwinds the stack until some `catch` handles it, or the program dies with a stack trace.

Exceptions are *typed*, and the type is the useful part: `ArgumentOutOfRangeException`,
`FormatException`, `FileNotFoundException`, `InvalidOperationException` ("this object isn't in a
state where you may do that") — all descending from `Exception`.

You catch the *specific* type you can actually do something about, as near as possible to where
you can do it:

```csharp
try { ... }
catch (FileNotFoundException ex) { Console.WriteLine(ex.Message); }
finally { /* runs whether or not anything threw */ }
```

**Never write `catch (Exception) { }`.** It converts every future bug in that block into silent
wrong behaviour. You will not find it by reading; you will find it six months later by wondering
why the numbers are wrong.

The division of labour is worth memorising as a sentence: **Try-pattern for expected failure,
exceptions for broken rules.**

And when the program does fail, tell the operating system. A console program's **exit code** is 0
for success and nonzero for failure — set it with `Environment.ExitCode = 1;`. Shell scripts and
CI check that number, not your nicely worded message.

**Numbers, and one rule about money**

The integer types: `int` (32-bit signed) is the default for nearly everything, including counts
and indices. `long` (64-bit) is for file sizes and ids. The unsigned variants `uint`, `ulong`,
`byte` are for bit manipulation and binary formats — don't pick `uint` just because a count can't
be negative, because mixing signed and unsigned breeds bugs and unsigned wraparound (`0u - 1` is
4,294,967,295) is far nastier than the negative number you were avoiding.

For non-integers there are two, and picking the wrong one is a classic:

- `double` is 64-bit binary floating point, for maths and measurements. It is fast, and it
  **cannot represent most decimal fractions exactly**. `0.1 + 0.2` is not `0.3`. Never compare
  doubles with `==`; compare `Math.Abs(a - b) < 1e-9`.
- `decimal` (the `m` suffix: `19.99m`) is base-10 and exact for human-scale numbers.

**Guild gold is `decimal`. Always.** Use `double` for money and your totals drift by fractions of
a coin, the drift compounds, and the guild's books stop balancing in a way that takes a week to
find.

Narrowing conversions that can lose data (`double` → `int`) need an explicit cast `(int)d` and
truncate toward zero. Widening (`int` → `double`) is implicit.

**Files**

A file handle is a resource that must be released. Any type owning one implements `IDisposable`
(an interface — the OOP chapter covers those — whose one method `Dispose()` releases the
resource), and the `using` declaration guarantees it: `using var reader = ...;` disposes `reader`
when the scope exits, *even if an exception is on its way out*.

The tools, all in `System.IO`:

- `File.WriteAllText` / `ReadAllText` / `AppendAllText` / `ReadAllLines` / `Exists` — static
  whole-file helpers that open and close the handle for you. Perfect for small files.
- `StreamReader` / `StreamWriter` — line at a time for big files, always under `using`.
- `Path.Combine("data", "ledger.txt")` — builds paths with the right separator. Never hard-code
  `/` or `\`.

**xUnit tests**

A unit test is a method that calls your code and *asserts* what must be true; a runner finds them
all, executes them, and reports red or green. In xUnit a test is a public method marked with the
`[Fact]` **attribute** — square-bracket metadata attached to a declaration — living in a class in
a test project:

```csharp
public class StorageTests
{
    [Fact]
    public void Shipping_reduces_the_store()
    {
        var remaining = Storage.Ship(inStore: 100m, amount: 30m);
        Assert.Equal(70m, remaining);
    }

    [Fact]
    public void Shipping_a_negative_amount_is_refused() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Storage.Ship(100m, -5m));
}
```

`Assert.Equal(expected, actual)` fails with a diff. `Assert.Throws<T>(() => ...)` passes only if
the lambda (an inline function — `() => body`) throws exactly that type. A `[Theory]` with
`[InlineData(...)]` rows runs one body over many inputs. Tests run with `dotnet test` in a real
project — the Study tab can't run them, but every checkpoint from cp1 onward expects them, so
learn the shape now and write your first ones in section 5.

**In practice**

```csharp
// Expected failure and broken rules, in one program. (Input is simulated so this
// runs in the Study tab; swap the array for Console.ReadLine() in a real CLI.)
string?[] typed = { "abc", "-3", "250", null };
int i = 0;
string? ReadLine() => i < typed.Length ? typed[i++] : null;

decimal? requested = null;
while (requested is null)
{
    string? line = ReadLine();
    if (line is null)
    {
        Console.WriteLine("input ended");
        Environment.ExitCode = 1;
        break;
    }

    if (decimal.TryParse(line, out decimal quantity) && quantity > 0)
        requested = quantity;
    else
        Console.WriteLine($"'{line}' is not a positive quantity, try again");
}

if (requested is not null)
{
    try
    {
        Console.WriteLine($"remaining in store: {Ship(100m, requested.Value)}");
    }
    catch (InvalidOperationException ex)          // catch ONLY what you can handle
    {
        Console.WriteLine($"refused: {ex.Message}");
        Environment.ExitCode = 1;
    }
}

// Why guild gold is decimal and not double.
Console.WriteLine($"double:  0.1 + 0.2 == 0.3 is {0.1 + 0.2 == 0.3}");
Console.WriteLine($"decimal: 0.1 + 0.2 == 0.3 is {0.1m + 0.2m == 0.3m}");

// Files: write, append, stream back — handle released even on an exception.
string path = Path.Combine(Path.GetTempPath(), "ledger-demo.txt");
File.WriteAllText(path, "Stone;40\nTimber;12\n");
File.AppendAllText(path, "Iron Ore;7\n");

using (var reader = new StreamReader(path))
{
    string? line;
    while ((line = reader.ReadLine()) is not null)      // ReadLine(): null at end of file
        Console.WriteLine($"> {line}");
}
File.Delete(path);

decimal Ship(decimal inStore, decimal amount)
{
    if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
    if (amount > inStore) throw new InvalidOperationException("not enough in storage");
    return inStore - amount;
}
```

```text
'abc' is not a positive quantity, try again
'-3' is not a positive quantity, try again
refused: not enough in storage
double:  0.1 + 0.2 == 0.3 is False
decimal: 0.1 + 0.2 == 0.3 is True
> Stone;40
> Timber;12
> Iron Ore;7
```

The walkthrough:

**The input loop** does the two jobs separately. `"abc"` fails to parse; `"-3"` parses fine but
isn't a positive quantity. Both are *expected* and both get a polite message and another go. The
`null` case is different — that's input having ended, which in a real CLI means the pipe closed,
so it sets an exit code and stops rather than looping forever.

**`Ship(100m, 250m)`** breaks a rule: you can't ship more than you hold. That's a `throw`, not a
message, because no amount of asking the user nicely will fix it. The `catch` names one specific
type. If `Ship` ever throws something else, this code deliberately doesn't handle it — it crashes
loudly, which is what you want from a bug you haven't met yet.

**`ArgumentOutOfRangeException(nameof(amount))`** — `nameof(amount)` produces the string
`"amount"`, checked by the compiler, so the message survives a rename. Note that this throw is a
different case from the other: a negative amount means a *caller* is broken, so the exception
names the parameter rather than describing a situation.

**The two float lines** are the whole argument about money in two lines of output. Run them once
and you'll never use `double` for gold.

**The file block** writes, appends, then streams back under `using`. That `using (...)` closes the
handle at the closing brace whether the loop finishes normally or something throws inside it —
which is why the `File.Delete` on the next line works instead of failing on a locked file.

> **C corner:** exceptions replace the errno / check-every-return-code discipline — failures can't
> be silently ignored, because ignoring one unwinds you out of the function. `finally` and `using`
> replace the `goto cleanup:` idiom: `using` is "whoever opened it, `fclose` is guaranteed."
> `Environment.ExitCode` is your `return n;` from `main`, and `decimal` is the fixed-point money
> type you'd otherwise hand-roll out of `long` cents.

**Try it — Lab:** First, numbers. Print `0.1 + 0.2`, then `0.1 + 0.2 == 0.3`, then `0.1m + 0.2m`
and `0.1m + 0.2m == 0.3m` — seeing `0.30000000000000004` once beats any paragraph on the subject.
Then, files: write three ledger lines to `Path.Combine(Path.GetTempPath(), "lab.txt")`, append a
fourth, stream them back numbered (`1: Stone;40`) with a `StreamReader` under `using`, and delete
the file. Finally, feed `File.ReadAllText` a path that doesn't exist inside a
`try/catch (FileNotFoundException)` and print its `Message`.

**Traps**

- **`catch (Exception)`, or worse, `catch { }`.** You just converted every future bug in that
  block into silent wrong behaviour. Catch the specific type; let the rest crash loudly.
- **`double` for gold.** `0.1 + 0.2 != 0.3` means totals drift and the books stop balancing.
  Money is `decimal`, always.
- **Trusting `Console.ReadLine()` to return text.** It's `string?`. Piped input ends and null
  arrives. Handle it or crash.
- **Skipping `using` on a stream.** Nothing visibly breaks in a demo, but the handle stays open
  until the garbage collector gets round to it — which on Windows means the file stays *locked*.
- **Assuming the working directory.** Programs get launched from anywhere. Build paths with
  `Path.Combine` from a known base.

---

## 5. Mini-project: C→C# port

This is the one section where C appears in the open. The job is to port a real, small C program
to *idiomatic* C# — not to transliterate it. Transliterating is easy and teaches you nothing; the
value is entirely in noticing which C constructs exist only because C lacks something better.

The program is the guild's ledger reader. It reads a file of `resource;copper` lines, reports the
total and the largest single payment, and exits nonzero if it can't.

```c
/* ledger.c — report total and largest payment from a file of "resource;copper" lines */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct payment { char resource[64]; long copper; };

int main(int argc, char **argv) {
    if (argc != 2) { fprintf(stderr, "usage: ledger FILE\n"); return 2; }
    FILE *f = fopen(argv[1], "r");
    if (!f) { fprintf(stderr, "cannot open %s\n", argv[1]); return 1; }

    struct payment largest = { "", 0 };
    long total = 0; char line[128];
    while (fgets(line, sizeof line, f)) {
        char *semi = strchr(line, ';');
        if (!semi) continue;                      /* silently skip bad lines */
        *semi = '\0';
        long copper = strtol(semi + 1, NULL, 10);
        total += copper;
        if (copper > largest.copper) {
            strncpy(largest.resource, line, 63);
            largest.copper = copper;
        }
    }
    fclose(f);
    printf("total: %ld.%02ld\n", total / 100, total % 100);
    printf("largest: %s (%ld.%02ld)\n", largest.resource, largest.copper / 100, largest.copper % 100);
    return 0;
}
```

**The port strategy.** Each C construct maps to a C# idiom you now own:

1. **`struct payment` → a `record`.** A **record** is a class the compiler finishes for you:
   `record Payment(string Resource, decimal Gold);` generates a constructor, read-only
   **properties**, content-based equality (the value semantics section 1 promised), and a readable
   `ToString()`. The OOP chapter covers records properly. And note that the `long copper` hack
   exists only because C has no decimal type — C# does, so the money becomes `decimal`.
2. **Silent `continue` on bad lines → a Try-pattern parser that *reports*.** The C version throws
   away malformed lines and never tells anyone. The port counts them and says so.
3. **`fopen`/`fgets`/`fclose` → `File.ReadLines(path)`** — a lazy line-by-line enumeration that
   reads nothing until you loop and closes the file for you.
4. **`return 1;` / `return 2;` → typed exceptions at the core, exit codes at the edge.** The
   logic throws `FileNotFoundException`; only the outermost layer touches `Environment.ExitCode`.
5. **Nullable-clean.** The parser hands back `Payment?`, so the type system carries "this line
   might not parse" and the compiler makes the caller deal with it.

The port, runnable as-is — it writes its own sample file:

```csharp
string path = Path.Combine(Path.GetTempPath(), "ledger.txt");
File.WriteAllText(path, "Stone;45000\nbroken line\nDecorative Stonework;1299000\nBread;12000\n");

try
{
    var report = LedgerReport.Load(path);
    Console.WriteLine($"total: {report.Total:F2}");              // :F2 = two decimal places
    Console.WriteLine($"largest: {report.Largest}");
    if (report.SkippedLines > 0)
        Console.WriteLine($"warning: skipped {report.SkippedLines} malformed line(s)");
}
catch (FileNotFoundException ex)
{
    Console.WriteLine($"cannot open: {ex.FileName}");
    Environment.ExitCode = 1;
}
File.Delete(path);

public record Payment(string Resource, decimal Gold);       // ==, ToString, immutability: free

public record Report(decimal Total, Payment? Largest, int SkippedLines);

public static class LedgerReport
{
    public static Report Load(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("ledger missing", path);

        decimal total = 0;
        Payment? largest = null;
        int skipped = 0;

        foreach (var line in File.ReadLines(path))              // lazy, auto-closed
        {
            if (TryParseLine(line, out Payment? payment) && payment is not null)
            {
                total += payment.Gold;
                if (largest is null || payment.Gold > largest.Gold) largest = payment;
            }
            else
            {
                skipped++;
            }
        }

        return new Report(total, largest, skipped);
    }

    public static bool TryParseLine(string line, out Payment? payment)
    {
        payment = null;
        var parts = line.Split(';');                            // "a;b" -> ["a", "b"]
        if (parts.Length != 2) return false;
        if (!long.TryParse(parts[1], out long copper)) return false;
        payment = new Payment(parts[0], copper / 100m);
        return true;
    }
}
```

```text
total: 13560.00
largest: Payment { Resource = Decorative Stonework, Gold = 12990 }
warning: skipped 1 malformed line(s)
```

**Notice what disappeared** from the C version: the fixed 64-byte `resource` buffer (C# strings
size themselves), `strncpy` and its off-by-one, the manual `fclose`, the `/100` and `%02ld` cents
arithmetic, and — most importantly — the silent data loss.

**And notice what appeared:** `TryParseLine` is `public`, takes a string and produces a value,
touches no files and prints nothing. That makes it *testable*, which is not a coincidence but the
whole reason the port is shaped this way:

```csharp
public class LedgerTests
{
    [Fact]
    public void Parses_a_valid_line()
    {
        Assert.True(LedgerReport.TryParseLine("Stone;45000", out var payment));
        Assert.Equal(new Payment("Stone", 450m), payment);      // record equality: contents match
    }

    [Theory]
    [InlineData("no-semicolon")]
    [InlineData("too;many;parts")]
    [InlineData("Stone;abc")]
    public void Rejects_malformed_lines(string line) =>
        Assert.False(LedgerReport.TryParseLine(line, out _));    // _ discards the out value
}
```

Two lines of setup, one assertion each. That is what "shaped so it can be tested" buys you, and
it's the shape every checkpoint from cp1 on will be looking for.

**Try it — Lab:** Run the port and check the output matches. Then extend it: give each line an
optional category (`Stone;45000;Raw`), add `string? Category` to the record, and print a count per
category, using a switch expression to bucket the payments (small `< 100m`, medium `< 1000m`,
large). Keep it nullable-clean — a missing category is `null`, printed as `?? "uncategorised"`.
When cp1 asks for a tested project, lift `LedgerReport` and the tests into it unchanged.

**Traps**

- **Transliterating instead of porting.** If your C# has index-juggling `while` loops, mutable
  bags of public fields and integer copper, you wrote C in C# syntax. Reach for records,
  `decimal`, `TryX` and `File.ReadLines` first.
- **Records are immutable — that's the point.** `payment.Gold = 5m` doesn't compile on a
  positional record. To "change" one, make a modified copy: `payment with { Gold = 5m }`.
- **`File.ReadLines` is lazy.** It reads as you iterate, which is what you want — but iterate it
  *once*, and while the file still exists. Need the lines twice? Use `File.ReadAllLines`, which
  gives you an array.
- **Testing through `Main`.** If the logic only runs behind file IO and console output, tests
  can't reach it. The port's shape — a pure `TryParseLine`, a `Load` that returns data, printing
  only at the very edge — is exactly what makes those tests three lines each.

---

## Check yourself

One honest question per topic — answer without looking, then tick.

- Can you predict, without running it, which of two mutations is visible through another variable
  — struct copy versus class alias — and explain what boxing costs? If yes, tick *Value vs
  reference* above.
- Can you take a `Dragon?` through `?.`, `??` and an `is not null` check without a single warning,
  and replace a five-branch if-ladder with an exhaustive switch expression using relational and
  property patterns — in the right order? If yes, tick *Nullability & patterns* above.
- Can you write a `TryX` method with an `out` parameter, say when you'd reach for `ref` versus
  `in`, and add an extension method to `string`? If yes, tick *Methods & the C-corner* above.
- Can you say when to throw versus when to `TryParse`, read a file line by line under `using`,
  explain why `0.1 + 0.2 != 0.3` and why gold is `decimal`, and sketch a `[Fact]` test with
  `Assert.Equal`? If yes, tick *Errors & IO* above.
- Did your port — or its lab extension — run clean: records, `decimal`, nullable-safe, typed
  errors, and `TryParseLine` shaped so a test can reach it? If yes, tick *Mini-project: C→C#
  port* above.

All five ticked? Tick the chapter, then head to checkpoint **cp1** — the exam-style gate for this
material. What a checkpoint is, and how defenses work, is on the *Checkpoints & Defenses* page.
