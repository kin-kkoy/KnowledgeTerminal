# C# Fundamentals

This chapter teaches the core of C#: how values and objects actually live in memory, how the
compiler helps you handle "might be missing" data, how methods pass and return things, and how a
real program deals with bad input, errors, files, and numbers. By the end you'll port a complete
C program to idiomatic C# — with tests — and you'll be able to write small, robust console tools
without leaving the app.

---

## 1. Value vs reference

**The idea**

Every type in C# falls into one of two camps, and the camp decides what *assignment* means.

- A **value type** variable *is* the data. Assigning it — or passing it to a method — **copies
  the whole thing**. The copy and the original are independent forever after. Value types are
  declared with the keyword `struct` (plus the built-in numbers, `bool`, `char`, and `enum`s),
  and they typically live directly where their variable lives: a local variable's value sits in
  the current stack frame.
- A **reference type** variable holds a **reference** — a managed, garbage-collected pointer —
  to an object that lives on the **heap**. Assigning copies only the reference, so two variables
  end up pointing at **one shared object**. Reference types are declared with the keyword
  `class` (and also include arrays, `string`, interfaces, and delegates — all covered later;
  Atlas: *Types*).

Why two camps? Small, self-contained data (a coordinate, a date, a money amount) is cheapest and
safest as a plain copyable value — no allocation, no sharing, no mutation at a distance. Anything
with *identity* — a player, a bank account, an open file — must be shared, not copied: two
references to the same account should see the same balance. C# bakes the choice into the type
itself: the person *defining* the type decides once, and every `Point` behaves like a value
everywhere while every `Player` behaves like a shared object everywhere.

The camps also decide what `==` means by default:

- For built-in value types, `==` compares the **data** (`3 == 3` is true).
- For classes, `==` compares the **references**: two distinct objects with identical contents
  are *not* equal, because they are two different objects. (`string` is the big exception — it's
  a class, but `==` is defined to compare characters, because that's what anyone ever means.)
- A plain `struct` you define doesn't get `==` at all unless you write it; `record` types
  (section 5) get content-based `==` generated for you.

One more consequence: **boxing**. C# has a universal base type called `object` — every value of
every type can be treated as one. But a reference must point at the heap, so putting a value
type *into* an `object` variable makes the runtime copy it onto the heap and hand you a
reference to the copy. That copy-to-heap step is boxing: correct, just costly in a hot loop —
a big reason generic collections like `List<int>` (chapter *Collections & LINQ*) store `int`s
directly, unboxed.

**In practice**

```csharp
var p1 = new Point { X = 1, Y = 1 };     // 'new T { ... }' constructs and sets fields
var p2 = p1;                             // COPY — p2 is an independent Point
p2.X = 99;

var a = new Player { Hp = 100 };
var b = a;                               // ALIAS — a and b are the same object
b.Hp = 50;

Console.WriteLine($"p1.X = {p1.X}, p2.X = {p2.X}");
Console.WriteLine($"a.Hp = {a.Hp}, b.Hp = {b.Hp}");

Player c = new Player { Hp = 100 };
Console.WriteLine(a == c);               // reference comparison: different objects

object boxed = p1;                       // BOXING: p1 copied to the heap

// In a top-level-statements file, type declarations come AFTER the statements:
struct Point { public int X, Y; }        // value type: assignment copies
class  Player { public int Hp; }         // reference type: assignment aliases
```

```text
p1.X = 1, p2.X = 99
a.Hp = 50, b.Hp = 50
False
```

Two bits of syntax used above: `var` declares a variable whose type the compiler *infers* from
the right-hand side — `var p2 = p1;` makes `p2` a `Point`, permanently; still fully static
typing, just without repeating the name. And `$"..."` is an **interpolated string**: inside the
quotes, `{expression}` is evaluated and spliced into the text.

When should *you* pick `struct`? Default to `class`. Choose `struct` only when the type is small
(a few fields), logically one indivisible value, and ideally immutable — a coordinate, an RGB
color, a range. Everything with identity or mutable lifetime is a `class`.

> **C corner:** a C# `struct` variable is a C struct by value; a `class` variable is a
> `Player*` that you never `malloc`/`free` yourself — `new` allocates, the garbage collector
> frees when nothing references the object anymore. There is no `*` or `->`: the dot does
> the dereference for you. `Player** ` (repointing the caller's pointer) exists too — that's
> `ref` on a reference-type parameter, in section 3.

**Try it — Lab:** In the Study tab, define `struct Vec { public int X; }` and
`class Box { public int X; }` (type declarations go *after* your statements in a
top-level-statements file). Create one of each, copy it to a second variable, mutate the copy,
and print both originals. Predict both outputs before running. Then try
`var list = new List<Vec> { new Vec { X = 1 } }; list[0].X = 5;` and read the compiler error —
indexing a list of structs returns a *copy*, so writing to its field would change nothing, and
the compiler refuses.

**Traps**

- **Mutating a struct copy and expecting the original to change** — or the reverse: mutating a
  shared class object from one variable and being surprised every other variable "changed" too.
  Every aliasing bug you'll ever write in C# is one of these two.
- **`list[0].Field = x` on a `List<struct>` doesn't compile** (you'd be writing to a temporary
  copy). Replace the whole element: `list[0] = new Vec { X = 5 };` — or make it a class.
- **Comparing two class instances with `==` and expecting content equality.** Different objects,
  same data, `==` says `False`. If you want content equality, use a `record` (section 5) or the
  `Equals` method the type defines.
- **Large structs are slow to copy.** A struct is passed by copy every time; keep them small
  (roughly ≤ 16 bytes) or make them classes.

---

## 2. Nullability & patterns

**The idea**

In C#, "no value" is spelled `null` — a reference that points at nothing. Historically, *any*
reference variable could be `null`, and you found out at runtime with a
`NullReferenceException` (the crash you get for dereferencing null). Modern C# turns that into a
**compile-time** concern: with nullable reference types on (they're on in this book and in the
Study lab), the type says whether null is allowed.

- `string name` — **never null**. The compiler warns if you assign `null` to it.
- `string? note` — **may be null**. The compiler warns if you use it (`note.Length`) without
  checking first. The `?` is part of the type.

Value types get the same treatment with real teeth: `int?` is genuinely a different type
(`Nullable<int>`), an `int` plus a has-value flag, and you *cannot* use it as a plain `int`
without unwrapping it.

The operators that make nullable code short:

- `x?.M()` — **null-conditional**: if `x` is null, skip the call and produce null; otherwise
  call `M`.
- `x ?? fallback` — **null-coalescing**: `x` if it isn't null, else `fallback`.
- `x ??= v` — assign `v` to `x` only if `x` is currently null.
- `x!` — **null-forgiveness**: "compiler, trust me, this isn't null here." It checks nothing at
  runtime; it just silences the warning. Every `!` is you overriding the safety net — use it
  almost never.

The second half of this section is **patterns** — C#'s way of asking "does this value have this
shape?" and binding pieces of it in one step. The entry point is the `is` operator:
`if (obj is Player p)` tests the type *and* declares `p` in one move; `if (s is not null)` is
the idiomatic null check. Patterns get their full power in the **switch expression**: unlike the
statement `switch` you know, it's an *expression* — it produces a value, each arm is
`pattern => result`, arms are tried top to bottom, `_` is the catch-all, and the compiler warns
if the arms don't cover every possible input. Patterns compose: `< 0` and `>= 10` are
**relational patterns**, `and`/`or`/`not` combine them, and `{ Prop: pattern }` — a **property
pattern** — reaches into an object's members. Where you'd write an `if/else if` ladder, a switch
expression says the same thing as a table, and the compiler audits the table for gaps.

**In practice**

```csharp
string? note = null;

int len = note?.Length ?? 0;             // null-safe: 0 when note is null
Console.WriteLine(len);

note ??= "n/a";
Console.WriteLine(note);

string Describe(int? n) => n switch      // '=>' body: a one-expression method (Atlas: Methods)
{
    null            => "nothing",
    < 0             => "negative",
    0               => "zero",
    > 0 and < 10    => "small",
    _               => "big",
};

Console.WriteLine(Describe(null));
Console.WriteLine(Describe(-5));
Console.WriteLine(Describe(7));
Console.WriteLine(Describe(400));

// Property patterns: match on an object's shape.
string Rate(Reading r) => r switch
{
    { Celsius: < -20 }              => "sensor error?",
    { Celsius: < 0 }                => "freezing",
    { Celsius: >= 0 and < 30 }      => "fine",
    _                               => "hot",
};

Console.WriteLine(Rate(new Reading { Celsius = -3 }));
Console.WriteLine(Rate(new Reading { Celsius = 21 }));

class Reading { public int Celsius; }
```

```text
0
n/a
nothing
negative
small
big
freezing
fine
```

**Try it — Lab:** Write `string? Find(string key)` that returns `"Ada"` for `"admin"` and `null`
for anything else (a switch expression with two arms works). Call it with both keys and print a
greeting using `?.ToUpper()` and `?? "guest"` so the null case prints `HELLO, GUEST` without
crashing. Then deliberately call `.Length` on the null result with no check, watch the compiler
warning appear, run it anyway, and meet your first `NullReferenceException` on purpose.

**Traps**

- **Treating nullability warnings as noise.** A warning on `note.Length` is the compiler proving
  a code path crashes. "It built with warnings" is how `NullReferenceException` ships.
- **Reaching for `!` instead of a check.** `note!.Length` still crashes at runtime if you were
  wrong — you just told the compiler not to warn you about it.
- **Forgetting a switch-expression arm.** Without `_` (or full coverage), an unmatched value
  throws at runtime — and the compiler warned you. Read those warnings.
- **Order matters.** Arms match top to bottom: put `{ Celsius: < -20 }` *after* the broader
  `{ Celsius: < 0 }` and it can never match.

---

## 3. Methods & the C-corner

**The idea**

C# method calls pass value types by copy and reference types by reference-copy (section 1). This
section is everything *around* that default: how to return failure without exceptions, how to
give a method access to the caller's variable, and how to make call sites readable.

**The Try-pattern.** Operations that fail *routinely* — parsing user input, looking up a key —
shouldn't throw. The convention: a method named `TryX` returns a `bool` for success and delivers
the result through an **`out` parameter** — a parameter the method must assign, which flows back
to the caller. `int.TryParse(text, out int n)` is the canonical example (you can declare the
`out` variable right inside the call). Its throwing sibling `int.Parse(text)` throws a
`FormatException` on bad input — fine when bad input is a bug, wrong when it's a Tuesday.

**`ref` and `in`.** `ref` passes the caller's *variable itself*, so the method can read and
write it — including repointing a reference-type variable at a different object. `in` passes by
reference but read-only: a performance tool for big structs, so they aren't copied. Both must be
written at the call site too (`Swap(ref a, ref b)`), so the reader sees the aliasing.

**Optional and named parameters.** A parameter with a default value (`int retries = 3`) may be
omitted by the caller. Any argument can be passed by name (`Connect(host, retries: 5)`), which
both documents the call and lets you skip earlier optionals.

**Tuples.** To return two or three values, you don't need a type: `(int Min, int Max)` is a
**tuple** — an anonymous bundle of values with optional names. Construct with `(lo, hi)`,
receive into fresh variables by **deconstructing**: `var (lo, hi) = Bounds(xs);`. Tuples are
value types: assignment copies them.

**Extension methods.** A `static` method (one belonging to the type itself, not to an instance —
Atlas: *Methods*) whose first parameter is marked `this T x` can be *called as if it were a
method on `T`*: `text.Shout()` instead of `Helpers.Shout(text)`. Pure call-site sugar — no
access to private state — but it lets you extend types you don't own, and it's the mechanism
behind LINQ (chapter *Collections & LINQ*). Extension methods must live in a `static class`
(a class holding only static members, never instantiated).

**In practice**

```csharp
// Try-pattern: expected failure without exceptions.
string[] inputs = { "42", "abc", "" };
foreach (var s in inputs)
{
    if (int.TryParse(s, out int n))
        Console.WriteLine($"parsed {n}");
    else
        Console.WriteLine($"not a number: '{s}'");
}

// ref: the method touches the caller's variables.
int x = 1, y = 2;
Swap(ref x, ref y);
Console.WriteLine($"x={x} y={y}");

// Optional + named parameters.
Console.WriteLine(Describe("disk"));
Console.WriteLine(Describe("disk", retries: 5));

// Tuples: multi-value return, deconstructed at the call site.
var (lo, hi) = Bounds(new[] { 5, 2, 9 });   // new[] {...}: array with inferred element type
Console.WriteLine($"lo={lo} hi={hi}");

// Extension method in action:
Console.WriteLine("hello".Shout());

void Swap(ref int a, ref int b) => (a, b) = (b, a);

string Describe(string device, int retries = 3) => $"{device}: {retries} retries";

(int Min, int Max) Bounds(int[] xs)
{
    int min = xs[0], max = xs[0];
    foreach (var v in xs) { if (v < min) min = v; if (v > max) max = v; }
    return (min, max);
}

static class StringExtensions
{
    public static string Shout(this string s) => s.ToUpper() + "!";
}
```

```text
parsed 42
not a number: 'abc'
not a number: ''
x=2 y=1
disk: 3 retries
disk: 5 retries
lo=2 hi=9
HELLO!
```

(`ToUpper()` is `string`'s built-in uppercase method; `foreach (var v in xs)` iterates a
collection without index bookkeeping.)

> **C corner:** `out int n` is `int*` you must write through; `ref` is `int*` you may read and
> write; `in` on a struct is `const T*`. And the pointer-to-pointer case — a function that
> repoints the caller's pointer, `Player**` — is exactly `ref` on a reference-type parameter.
> That's the whole mystery.

**Try it — Lab:** Write `bool TryAverage(int[] xs, out double avg)` that returns `false` (with
`avg = 0`) for an empty array and `true` with the mean otherwise. Call it with `new[] {2, 4, 9}`
and `new int[0]`, printing `no data` for the failure case. Then add an extension method
`static string Repeat(this string s, int times = 2)` in a `static class` and print
`"ab".Repeat()` and `"ab".Repeat(times: 3)`.

**Traps**

- **Using exceptions for expected failure.** Wrapping `int.Parse` of user input in `try/catch`
  works but is slower and noisier than `TryParse`; save exceptions for section 4's cases.
- **Forgetting `ref` at the call site.** `Swap(x, y)` with a `ref` signature doesn't compile —
  by design, so aliasing is always visible where the call happens.
- **Reading an `out` value after `false`.** `TryParse` leaves `0` in the `out` on failure — the
  value only means something when the method returned `true`.
- **Tuples are values.** Assignment copies them; mutating the copy doesn't touch the original —
  same rule as section 1, because tuples are structs.

---

## 4. Errors & IO

**The idea**

**Exceptions.** When a *contract is violated* — an argument that must not be negative is, a
file that must exist doesn't — C# code **throws** an exception: an object describing the
failure, which unwinds the stack until a `catch` block handles it (or the program dies with a
stack trace). Exceptions are *typed* — `ArgumentOutOfRangeException`, `FormatException`,
`FileNotFoundException`, `InvalidOperationException` ("this object isn't in a state where you
may do that") — all subclasses of the root type `Exception`. You catch the *specific* type you
can actually handle, near where you can handle it: `try { ... } catch (FileNotFoundException
ex) { ... }` (`ex.Message` is the human-readable description); a `finally { ... }` block runs
whether or not something threw. **Never** write `catch (Exception) { }` swallowing everything —
that silences bugs you needed to see. Division of labor with section 3: **Try-pattern for
expected failure** (user typed garbage), **exceptions for broken contracts** (caller passed a
negative price). And when your program does fail, tell the operating system: a console
program's **exit code** is 0 for success, nonzero for failure — set it with
`Environment.ExitCode = 1;` (the `Environment` class is the standard library's window onto the
process and OS). Scripts and CI check that number, not your prose.

**Robust CLI input.** `Console.ReadLine()` reads one line of input and returns `string?` — null
when input has ended (end-of-file). Real input handling is: read, check for null, `TryParse`,
loop until valid. (The Study lab has no interactive stdin, so examples here simulate input with
an array — same logic, testable.)

**Numbers.** The integer types are `int` (32-bit signed — the default for nearly everything,
including counts and indices; `list.Count` is `int`), `long` (64-bit, for file sizes and IDs),
and unsigned variants `uint`/`ulong`/`byte` — reserve those for bit manipulation and binary
formats. Don't pick `uint` "because it can't be negative": mixing signed and unsigned breeds
bugs, and unsigned wraparound (`0u - 1` is 4,294,967,295) is nastier than the negative number
you feared. For non-integers: `double` (64-bit binary floating point) is for math and
measurements — fast, but it *cannot represent most decimal fractions exactly*, so
`0.1 + 0.2 != 0.3`; never compare doubles with `==`, compare `Math.Abs(a-b) < 1e-9`. `decimal`
(the `m` suffix: `19.99m`) is base-10 and exact for human-scale numbers — always use it for
money. `float` is a half-precision `double` for graphics and bulk data. Narrowing conversions
(possible data loss, `double` → `int`) require an explicit cast `(int)d` and truncate toward
zero; widening (`int` → `double`) is implicit.

**Files.** A file handle is a resource that must be released. Any type owning such a resource
implements `IDisposable` (an interface — a capability contract, fully covered in the OOP
chapter — whose one method `Dispose()` releases the resource), and the `using` declaration
guarantees the release: `using var reader = ...;` disposes `reader` when the enclosing scope
exits, *even via an exception*. The tools, all in the `System.IO` namespace (auto-imported here
by implicit usings): `File.WriteAllText` / `ReadAllText` / `AppendAllText` / `ReadAllLines` /
`Exists` are static whole-file helpers, perfect for small files — they open and close the
handle for you; `StreamReader`/`StreamWriter` stream line-at-a-time for big files, always under
`using`; and `Path.Combine("data", "q1.txt")` builds paths with the correct separator — never
hard-code `/` or `\`.

**xUnit tests.** A unit test is a method that calls your code and *asserts* what must be true;
a test runner finds and executes them all and reports red/green. In the xUnit framework, a test
is a public method marked with the `[Fact]` **attribute** (square-bracket metadata attached to a
declaration), living in a class in a test project, and it asserts with the `Assert` class:

```csharp
public class MoneyTests
{
    [Fact]
    public void Withdraw_reduces_balance()
    {
        var result = Bank.Withdraw(balance: 100m, amount: 30m);
        Assert.Equal(70m, result);
    }

    [Fact]
    public void Withdraw_rejects_negative_amount() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => Bank.Withdraw(100m, -5m));
}
```

`Assert.Equal(expected, actual)` fails with a diff if they differ; `Assert.Throws<T>(() => ...)`
passes only if the lambda (an inline function — `() => body`; Atlas: *Lambdas*) throws exactly
that exception type. A `[Theory]` with `[InlineData(...)]` rows runs one test body over many
inputs. Tests run with `dotnet test` in a real project — the Study lab can't run them, but every
checkpoint from cp1 on expects them, so read the shape now and write your first ones in
section 5.

**In practice**

```csharp
// Robust input loop (input simulated; swap the array for Console.ReadLine() in a real CLI).
string?[] fakeInput = { "abc", "-3", "250", null };
int i = 0;
string? ReadLine() => i < fakeInput.Length ? fakeInput[i++] : null;

decimal? request = null;
while (request is null)
{
    string? line = ReadLine();
    if (line is null) { Console.WriteLine("no more input"); Environment.ExitCode = 1; break; }
    if (decimal.TryParse(line, out decimal d) && d > 0) request = d;
    else Console.WriteLine($"'{line}' is not a positive amount, try again");
}

if (request is not null)
{
    try
    {
        Console.WriteLine($"balance: {Withdraw(100m, request.Value)}"); // .Value unwraps decimal?
    }
    catch (InvalidOperationException ex)          // catch ONLY what you can handle
    {
        Console.WriteLine($"declined: {ex.Message}");
        Environment.ExitCode = 1;
    }
}

// Files: write, append, stream back — handle released even on exceptions.
string path = Path.Combine(Path.GetTempPath(), "facet-demo.txt");  // writable temp dir
File.WriteAllText(path, "alpha\nbeta\n");
File.AppendAllText(path, "gamma\n");

using (var reader = new StreamReader(path))
{
    string? line;
    while ((line = reader.ReadLine()) is not null)   // ReadLine(): null at end of file
        Console.WriteLine($"> {line}");
}
File.Delete(path);

decimal Withdraw(decimal balance, decimal amount)
{
    if (amount <= 0) throw new ArgumentOutOfRangeException(nameof(amount));
    if (amount > balance) throw new InvalidOperationException("insufficient funds");
    return balance - amount;
}
```

```text
'abc' is not a positive amount, try again
'-3' is not a positive amount, try again
declined: insufficient funds
> alpha
> beta
> gamma
```

(`nameof(amount)` yields the string `"amount"` — checked by the compiler, so it survives
renames.)

> **C corner:** exceptions replace the errno / check-every-return-code discipline: failures
> can't be silently ignored, and `finally`/`using` replace the `goto cleanup:` idiom — `using`
> is "whoever opens it, `fclose` is guaranteed." `Environment.ExitCode` is your `return n;`
> from `main`.

**Try it — Lab:** First, numbers: print `0.1 + 0.2`, `0.1 + 0.2 == 0.3`, then `0.1m + 0.2m` and
`0.1m + 0.2m == 0.3m` — seeing `0.30000000000000004` once beats any paragraph. Then, files:
write three lines to `Path.Combine(Path.GetTempPath(), "lab.txt")`, append a fourth, stream
them back numbered (`1: alpha` ...) with a `StreamReader` under `using`, and delete the file.
Feed `File.ReadAllText` a path that doesn't exist inside a `try/catch (FileNotFoundException)`
and print its `Message`.

**Traps**

- **`catch (Exception)` — or worse, `catch { }`.** You just converted every future bug into
  silent wrong behavior. Catch the specific type; let the rest crash loudly.
- **`double` for money.** `0.1 + 0.2 != 0.3` means sums drift by cents and audits fail. Money is
  `decimal`, always.
- **Trusting `Console.ReadLine()` to return text.** It's `string?` — piped input ends, and null
  arrives. Handle it or crash.
- **Skipping `using` on a stream.** Nothing visibly breaks in a demo — but the handle stays open
  until the garbage collector gets around to it, which on Windows means the file stays *locked*.
- **Assuming the working directory.** Programs get launched from anywhere; build absolute paths
  with `Path.Combine` from a known base.

---

## 5. Mini-project: C→C# port

This section is the one place C appears openly: the job is to port a real (small) C program to
*idiomatic* C# — not transliterate it. Here is the C program: it reads an expense file, prints a
report, and exits nonzero on failure.

```c
/* expenses.c — report total and biggest expense from a file of "name;cents" lines */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

struct expense { char name[64]; long cents; };

int main(int argc, char **argv) {
    if (argc != 2) { fprintf(stderr, "usage: expenses FILE\n"); return 2; }
    FILE *f = fopen(argv[1], "r");
    if (!f) { fprintf(stderr, "cannot open %s\n", argv[1]); return 1; }

    struct expense biggest = { "", 0 };
    long total = 0; char line[128];
    while (fgets(line, sizeof line, f)) {
        char *semi = strchr(line, ';');
        if (!semi) continue;                      /* silently skip bad lines */
        *semi = '\0';
        long cents = strtol(semi + 1, NULL, 10);
        total += cents;
        if (cents > biggest.cents) {
            strncpy(biggest.name, line, 63);
            biggest.cents = cents;
        }
    }
    fclose(f);
    printf("total: %ld.%02ld\n", total / 100, total % 100);
    printf("biggest: %s (%ld.%02ld)\n", biggest.name, biggest.cents / 100, biggest.cents % 100);
    return 0;
}
```

**Port strategy** — each C construct maps to a C# idiom you now own:

1. **`struct expense` → a `record`.** A **record** is a class (or struct) the compiler finishes
   for you: `record Expense(string Name, decimal Amount);` generates a constructor, read-only
   **properties** `Name` and `Amount`, content-based equality (`==` compares the data — the
   value-semantics `==` section 1 promised), and a readable `ToString()`. A **property** is a
   field behind accessor methods (`get`/`set`) — the C# norm for exposing data; record
   positional properties are get-only, so an `Expense` is immutable. And the `long cents` hack
   exists because C lacks a decimal type; C# doesn't — the money becomes `decimal`.
2. **Silent `continue` on bad lines → a Try-pattern parser** that *reports*: the caller counts
   and warns about skipped lines instead of hiding them.
3. **`fopen`/`fgets`/`fclose` → `File.ReadLines(path)`** — a lazy line-by-line enumeration
   (reads nothing until you loop) that closes the file for you.
4. **`return 1;`/`return 2;` → typed exceptions at the core, exit codes at the edge.** The logic
   throws `FileNotFoundException`; only the program's edge sets `Environment.ExitCode`.
5. **Nullable-clean:** the parser hands back `Expense?` — the type system carries "this line
   might not parse," and the compiler makes the caller deal with it.

The port (runnable in the lab as-is — it writes its own sample file):

```csharp
string path = Path.Combine(Path.GetTempPath(), "expenses.txt");
File.WriteAllText(path, "coffee;450\nbroken line\nlaptop;129900\nlunch;1200\n");

try
{
    var report = ExpenseReport.Load(path);
    Console.WriteLine($"total: {report.Total:F2}");            // :F2 = two decimal places
    Console.WriteLine($"biggest: {report.Biggest}");
    if (report.SkippedLines > 0)
        Console.WriteLine($"warning: skipped {report.SkippedLines} malformed line(s)");
}
catch (FileNotFoundException ex)
{
    Console.WriteLine($"cannot open: {ex.FileName}");
    Environment.ExitCode = 1;
}
File.Delete(path);

public record Expense(string Name, decimal Amount);           // ==, ToString, immutability: free

public record Report(decimal Total, Expense? Biggest, int SkippedLines);

public static class ExpenseReport
{
    public static Report Load(string path)
    {
        if (!File.Exists(path)) throw new FileNotFoundException("expense file missing", path);

        decimal total = 0; Expense? biggest = null; int skipped = 0;
        foreach (var line in File.ReadLines(path))            // lazy, auto-closed
        {
            if (TryParseLine(line, out Expense? e) && e is not null)
            {
                total += e.Amount;
                if (biggest is null || e.Amount > biggest.Amount) biggest = e;
            }
            else skipped++;
        }
        return new Report(total, biggest, skipped);
    }

    public static bool TryParseLine(string line, out Expense? expense)
    {
        expense = null;
        var parts = line.Split(';');                          // "a;b" -> ["a", "b"]
        if (parts.Length != 2) return false;
        if (!long.TryParse(parts[1], out long cents)) return false;
        expense = new Expense(parts[0], cents / 100m);
        return true;
    }
}
```

```text
total: 1315.50
biggest: Expense { Name = laptop, Amount = 1299 }
warning: skipped 1 malformed line(s)
```

Note what disappeared: the fixed 64-byte name buffer (strings size themselves), `strncpy`, the
manual `fclose`, the `/100` `%02ld` cents formatting, and the silent data loss. And note what
*appeared*: `TryParseLine` is `public` and pure — which makes it testable:

```csharp
public class ExpenseTests
{
    [Fact]
    public void Parses_a_valid_line()
    {
        Assert.True(ExpenseReport.TryParseLine("coffee;450", out var e));
        Assert.Equal(new Expense("coffee", 4.50m), e);   // record equality: contents match
    }

    [Theory]
    [InlineData("no-semicolon")]
    [InlineData("too;many;parts")]
    [InlineData("coffee;abc")]
    public void Rejects_malformed_lines(string line) =>
        Assert.False(ExpenseReport.TryParseLine(line, out _));   // _ discards the out value
}
```

**Try it — Lab:** Run the port and check the output matches. Then extend it: give each line an
optional category (`coffee;450;food`), add `string? Category` to the record, and print a
warning count per category using a switch expression to bucket amounts (small `< 10m`, medium
`< 100m`, large). Keep it nullable-clean: a missing category is `null`, printed as
`?? "uncategorized"`. When cp1 asks for a tested project, lift `ExpenseReport` and the tests
into it unchanged.

**Traps**

- **Transliterating instead of porting.** If your C# has index-juggling `while` loops, mutable
  bags of public fields, and integer cents, you wrote C in C# syntax. Reach for records,
  `decimal`, `TryX`, and `File.ReadLines` first.
- **Records are immutable — that's the point.** `e.Amount = 5m` doesn't compile on a positional
  record. To "change" one, make a modified copy: `e with { Amount = 5m }` (the `with`
  expression).
- **`File.ReadLines` is lazy.** It reads as you iterate — great; but iterate it *once* and while
  the file still exists. Need the lines twice? `File.ReadAllLines` (an array) instead.
- **Testing through `Main`.** If logic only runs behind file I/O and console output, tests can't
  reach it. The port's shape — pure `TryParseLine`, `Load` returning data, printing only at the
  edge — is what makes the tests three lines each.

---

## Check yourself

One honest question per topic — answer without looking, then tick.

- Can you predict, without running it, which of two mutations is visible through another
  variable — struct copy vs class alias — and explain what boxing costs? If yes, tick
  *Value vs reference* above.
- Can you take a `string?` through `?.`, `??`, and an `is not null` check without warnings, and
  replace a five-branch if-ladder with an exhaustive switch expression using relational and
  property patterns? If yes, tick *Nullability & patterns* above.
- Can you write a `TryX` method with an `out` parameter, explain when you'd reach for `ref` vs
  `in`, and add an extension method to `string`? If yes, tick *Methods & the C-corner* above.
- Can you say when to throw vs when to `TryParse`, read a file line-by-line under `using`,
  explain why `0.1 + 0.2 != 0.3` and why money is `decimal`, and sketch a `[Fact]` test with
  `Assert.Equal`? If yes, tick *Errors & IO* above.
- Did your port (or its lab extension) run clean — records, `decimal`, nullable-safe, typed
  errors, with `TryParseLine` shaped so a test can hit it? If yes, tick *Mini-project: C→C#
  port* above.

All five ticked? Tick the chapter, then head to checkpoint **cp1** — the exam-style gate for
this material. What a checkpoint is and how defenses work is on the *Checkpoints & Defenses*
page.
