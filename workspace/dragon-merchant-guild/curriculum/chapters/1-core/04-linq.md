# LINQ

LINQ (Language-Integrated Query) is a family of methods — `Where`, `Select`, `OrderBy`, `GroupBy`,
`Join` — that let you filter, transform, sort and summarise **any** sequence of data by chaining
small operations into a pipeline. After this chapter you can take a pile of records — orders, log
lines, CSV rows — and turn "total sales per customer, top three, names attached" into five readable
lines instead of thirty lines of nested loops. To get there we first build the machinery LINQ runs
on: lambdas and delegates, which C# also uses for events, callbacks and async.

---

## 1. The core five + pipelines

**The idea.** In C# you can treat *a piece of code* as a value: store it in a variable, pass it to a
method, call it later. That value is written as a **lambda expression**:

```csharp
x => x * 2
```

Read `=>` as "goes to": *given `x`, produce `x * 2`*. It's a tiny unnamed function, defined right at
the point of use. The left side is the parameter list, the right side is the body (an expression
whose value is returned). Variants you'll see:

```csharp
n => n > 10                 // one parameter, returns bool
(a, b) => a + b             // two parameters need parentheses
() => Console.WriteLine("hi")   // no parameters
s => { var t = s.Trim(); return t.Length; }   // multi-statement body needs { } and return
```

What is the *type* of such a value? C# uses **delegate types** — types whose instances are callable
functions. You almost always use the two built-in generic families:

- `Func<A, R>` — a function taking an `A`, returning an `R`. More type arguments add parameters:
  `Func<A, B, R>` takes an `A` and a `B`. **The last type argument is always the return type.**
- `Action<A>` — a function taking an `A` and returning nothing (`void`). `Action` alone takes nothing.

(`Func` and `Action` are generic types — same machinery as `List<T>` from *Collections & Generics*.)

```csharp
Func<int, int> twice = x => x * 2;      // int in, int out
Func<int, bool> isBig = n => n > 10;    // int in, bool out — a "predicate"
Action<string> shout = s => Console.WriteLine(s.ToUpper());

Console.WriteLine(twice(21));   // call it like a method
Console.WriteLine(isBig(3));
shout("hello");
```

```text
42
False
HELLO
```

Notice `x` has no declared type in the lambda — the compiler infers it from the `Func<int, int>` on
the left (or, in LINQ, from the sequence's element type). You *can* write `(int x) => x * 2`, but
you rarely need to.

Why does this matter? Because it lets a method accept **behaviour** as an argument. `Where` doesn't
know what "keep this element" means for your data — you hand it a `Func<T, bool>` that decides.
That's the entire trick behind LINQ: generic loop skeletons (filter, transform, sort) into which
you plug tiny functions.

> **C corner:** this is `qsort`'s comparator argument, grown up. A C function pointer
> `int (*cmp)(const void*, const void*)` becomes a `Func<T, T, int>` — but type-safe, no `void*`
> casts, and definable inline instead of as a separate named function somewhere above.

**The operators.** LINQ methods live on `IEnumerable<T>` — the "anything you can `foreach` over"
interface from *Collections & Generics* — so arrays, `List<T>`, dictionaries, everything. They're
*extension methods*: static methods that syntactically attach to the sequence so you can chain them
with `.` (Atlas: **Extension Methods** — for now, just chain and enjoy). The core five to memorise:

| Operator | Meaning | Lambda it takes |
|---|---|---|
| `Where(p)` | keep elements where `p` is true | `T → bool` |
| `Select(f)` | transform each element | `T → R` |
| `OrderBy(k)` / `ThenBy(k)` | sort by key (add `Descending` for reverse) | `T → key` |
| `First(p)` / `FirstOrDefault(p)` / `Single(p)` | one element out | `T → bool` |
| `Sum` / `Count` / `Aggregate` | collapse to one value | varies |

**In practice.**

```csharp
int[] nums = { 5, 2, 8, 1, 9, 3, 7 };

// A pipeline: each stage's output feeds the next stage.
var topOdds = nums
    .Where(n => n % 2 == 1)        // 5, 1, 9, 3, 7
    .OrderByDescending(n => n)     // 9, 7, 5, 3, 1
    .Take(3)                       // 9, 7, 5   (Take(k) = first k elements)
    .ToList();                     // materialise into a List<int> — more in section 2

Console.WriteLine(string.Join(", ", topOdds));

// Select transforms — here int → string:
var labels = nums.Where(n => n > 6).Select(n => $"#{n}").ToList();
Console.WriteLine(string.Join(" ", labels));

// Aggregates collapse a sequence to a single value:
Console.WriteLine(nums.Sum());                  // add them all
Console.WriteLine(nums.Count(n => n > 4));      // how many pass the test
Console.WriteLine(nums.Max());
Console.WriteLine(nums.Aggregate((acc, n) => acc * n));   // fold: ((((5*2)*8)*1)...)
```

```text
9, 7, 5
#8 #9 #7
35
4
9
15120
```

`Aggregate` is the general fold: it carries an accumulator through the sequence, applying your
lambda at each step — `Sum` is just `Aggregate` with `(acc, n) => acc + n`. Reach for it only when
no named aggregate fits.

Getting **one element** out has three flavours, and picking the right one is a correctness decision:

```csharp
int[] nums = { 5, 2, 8, 1, 9 };

Console.WriteLine(nums.First(n => n > 6));            // first match: 8. Throws if none.
Console.WriteLine(nums.FirstOrDefault(n => n > 100)); // no match → default(int) = 0, no throw
Console.WriteLine(nums.Single(n => n == 9));          // exactly one match, else throws
```

```text
8
0
9
```

Use `First` when absence is a bug (fail fast), `FirstOrDefault` when absence is normal (then check
for the default — with reference types that's `null`, and nullable annotations will remind you),
`Single` when duplicates would mean corrupt data.

Multi-key sorting uses `ThenBy`, not a second `OrderBy` (a second `OrderBy` *re-sorts from
scratch*, discarding the first ordering):

```csharp
var people = new[] { ("Rossi", "Anna"), ("Klein", "Otto"), ("Rossi", "Aldo") };
foreach (var p in people.OrderBy(p => p.Item1).ThenBy(p => p.Item2))
    Console.WriteLine($"{p.Item1}, {p.Item2}");
```

```text
Klein, Otto
Rossi, Aldo
Rossi, Anna
```

One more thing you'll meet in other people's code: C# also has a SQL-flavoured **query syntax** —
`from n in nums where n > 4 select n * 2` — which the compiler translates into exactly these method
calls. Everything in this chapter uses method syntax; if you can read the methods, you can read
both.

**Why LINQ over a `foreach` loop?** A loop describes *how* (indexes, temporaries, mutation); a
pipeline describes *what* (filter, sort, take three). Pipelines compose — inserting a stage is one
line — and don't mutate the source. Plain loops still win for hot numeric inner loops (LINQ has
per-element delegate-call overhead) and for genuinely tangled multi-step logic. Default to LINQ for
data-shaping; drop to a loop when a profiler or readability says so.

**Try it — Lab:** in the Study tab, start from
`int[] temps = { 21, 35, 18, 40, 29, 33, 25 };`. Build one pipeline that keeps temperatures above
24, converts each to a string like `"29C"`, sorts them descending, and prints them joined by `", "`.
Then, separately, print the average of the kept temperatures using `Average()` (works like `Sum`)
and the coldest kept one using `Min()`.

**Traps**

- **`First()` on an empty/no-match sequence throws** `InvalidOperationException`. If "nothing
  found" is a legitimate outcome, use `FirstOrDefault` — and remember its default for `int` is `0`,
  which can masquerade as real data.
- **`Select` vs `Where` confusion:** `Where` keeps or drops (same element type out); `Select`
  transforms every element (possibly new type). `Select(n => n > 4)` doesn't filter — it gives you
  a sequence of `bool`s.
- **`OrderBy(...).OrderBy(...)` instead of `ThenBy`:** compiles fine, silently throws away your
  primary sort.
- **Pipelines don't modify the source.** `nums.OrderBy(n => n)` returns a *new* sorted sequence;
  `nums` is untouched. (Contrast `list.Sort()`, which sorts in place.)

---

## 2. Deferred execution

**The idea.** Here is the fact that decides whether LINQ ever surprises you: **building a query
runs no code.** A LINQ chain is a *recipe*, not a result. The recipe executes only when something
actually **enumerates** it — a `foreach`, `ToList()`, `Count()`, `First()`, `Sum()`… And it
executes **again, from scratch, every time** it's enumerated. This is called **deferred
execution**, and it is *the* LINQ interview topic because it silently produces wrong counts, double
work, and stale-vs-fresh confusion in real codebases.

**In practice.** Watch it with a lambda that prints when it runs:

```csharp
int[] nums = { 5, 2, 8, 1, 9 };

var big = nums.Where(n =>
{
    Console.WriteLine($"  testing {n}");
    return n > 4;
});

Console.WriteLine("query built — nothing has run yet");

Console.WriteLine("first enumeration:");
Console.WriteLine($"count = {big.Count()}");

Console.WriteLine("second enumeration:");
Console.WriteLine($"count = {big.Count()}");
```

```text
query built — nothing has run yet
first enumeration:
  testing 5
  testing 2
  testing 8
  testing 1
  testing 9
count = 3
second enumeration:
  testing 5
  testing 2
  testing 8
  testing 1
  testing 9
count = 3
```

Every `testing` line appears **twice** — the recipe re-ran. With five ints that's invisible; with a
million rows, a file read, or a database call inside the pipeline, enumerating twice doubles the
cost (or worse, returns *different* data the second time if the source changed in between).

Deferred also means the query sees the source **as it is at enumeration time**, not at build time:

```csharp
var nums = new List<int> { 1, 2, 3 };
var evens = nums.Where(n => n % 2 == 0);   // recipe built

nums.Add(4);                               // source changes AFTER building

Console.WriteLine(evens.Count());          // recipe runs NOW → sees the 4
```

```text
2
```

The same rule applies to **variables your lambda captures**. A lambda may use variables from the
surrounding code (it "closes over" them); it reads their *current* value each time it runs — not
the value they had when the query was written:

```csharp
int[] nums = { 5, 2, 8, 1, 9 };
int threshold = 4;
var big = nums.Where(n => n > threshold);   // captures the VARIABLE threshold

Console.WriteLine(big.Count());   // runs with threshold = 4

threshold = 7;
Console.WriteLine(big.Count());   // SAME query object, different answer
```

```text
3
2
```

That's not a bug — it's the defined behaviour — but if you didn't know it, it looks like the query
changed itself.

**The fix, when you want a fix:** `ToList()` or `ToArray()` **materialises** the query — runs it
once, right now, and snapshots the results into a real collection. Enumerating the list afterwards
is just reading memory; the recipe never re-runs.

```csharp
int[] nums = { 5, 2, 8, 1, 9 };

var big = nums.Where(n =>
{
    Console.WriteLine($"  testing {n}");
    return n > 4;
}).ToList();                     // recipe runs ONCE, here

Console.WriteLine($"count = {big.Count}");   // list property — no re-run
Console.WriteLine($"count = {big.Count}");   // still no re-run
```

```text
  testing 5
  testing 2
  testing 8
  testing 1
  testing 9
count = 3
count = 3
```

Rules to live by:

- Will you read the result **more than once**? Materialise once, reuse the list.
- Do you need a **snapshot** (source may change, or you're modifying the source while looping)?
  Materialise.
- Passing it along a **long pipeline you'll enumerate exactly once**? Stay lazy — laziness is
  *good* there: `Where(...).First(...)` stops at the first match instead of filtering everything.
- Don't sprinkle `ToList()` mid-pipeline "to be safe" — each one allocates a full intermediate
  collection and kills the short-circuiting.

One consequence worth knowing now: because a query is a recipe, libraries can *inspect or
redirect* the recipe before running it — that's how database libraries turn a C# `Where` into an
SQL `WHERE` on the server. File that away for the backend chapters.

> **C corner:** a deferred query is closer to a function pointer plus its arguments than to a
> result buffer. `nums.Where(p)` is like storing `{fn, args}` in a struct; `ToList()` is actually
> calling it and `memcpy`-ing the output somewhere the caller owns.

**Try it — Lab:** reproduce the double-enumeration bug yourself: build a `Where` whose lambda
prints each element it tests, enumerate the query twice (two `Count()` calls), and count the
prints. Then add one `.ToList()` and confirm the prints halve. Finally, redo the captured-variable
demo but with a `List<string>` of names and a captured `minLength` variable — predict both counts
before running.

**Traps**

- **Double enumeration:** enumerating a deferred query twice re-does all the work and may see
  different data. Any side effect in a lambda (printing, counting, mutating) happens per
  enumeration, not per query.
- **"Collection was modified" exception:** `foreach` over a deferred query while adding/removing
  from its source list throws `InvalidOperationException`. Snapshot with `ToList()` first, then
  loop over the snapshot.
- **Captured loop variables:** building several lambdas in a loop that all capture the same
  variable means they all see its *final* value later. (Modern `foreach` gives each iteration a
  fresh variable, so this mostly bites with `for` loops — but recognise the shape.)
- **Assuming a query variable holds results.** `var q = nums.Where(...)` holds a *question*, not
  an answer. If you hover it and see `IEnumerable<T>`, it's still lazy; `List<T>` means it's data.

---

## 3. GroupBy, Join, SelectMany

**The idea.** The core five reshape a flat sequence. Real reporting needs three more moves:
**bucket** rows by a key (`GroupBy`), **match** rows across two sequences (`Join`), and **flatten**
nested sequences into one (`SelectMany`). With those, "orders in, report out" is a single pipeline.

`GroupBy(keySelector)` turns a sequence into a sequence of **groups**. Each group has type
`IGrouping<TKey, T>`: it carries a `.Key` (the shared value) *and is itself a sequence* of the
elements that share it — so you can run any LINQ you like inside each group (`Count()`, `Sum(...)`,
`OrderBy(...)`).

`Join(inner, outerKey, innerKey, resultSelector)` pairs up elements from two sequences whose keys
match — the same operation as a SQL inner join, if you've met that; if not: for every order, find
the customer whose `Id` equals the order's `CustomerId`, and combine the pair into one result row.
Elements with no match on the other side are simply dropped.

`SelectMany(f)` is `Select` where `f` returns a *sequence* per element — and instead of giving you
a sequence of sequences, it concatenates them into one flat sequence. Customers→orders,
lines→words, folders→files: any one-to-many hop flattens with `SelectMany`.

**In practice.** A small sales report, end to end. (`record` — the one-line data class from the
*OOP* chapter. In a Study/top-level file, `record` declarations go at the bottom, after the
statements. Anonymous types `new { ... }` appear here for the first time: compiler-generated
read-only bundles of named values, ideal for query results that never leave the method.)

```csharp
var customers = new List<Customer>
{
    new(1, "Ada"), new(2, "Grace"), new(3, "Linus"),
};
var orders = new List<Order>
{
    new(1, "keyboard", 120m), new(2, "mouse", 25m), new(1, "monitor", 300m),
    new(2, "desk", 210m),     new(1, "cable", 9m),
};

// 1) GroupBy: total and count per customer id.
var perCustomer = orders
    .GroupBy(o => o.CustomerId)                 // buckets: key 1 → 3 orders, key 2 → 2 orders
    .Select(g => new                            // anonymous type: named result columns
    {
        CustomerId = g.Key,
        Count = g.Count(),
        Total = g.Sum(o => o.Amount),
    })
    .OrderByDescending(r => r.Total);

// 2) Join: attach names to those ids.
var report = perCustomer
    .Join(customers,
          r => r.CustomerId,                    // key from the left sequence
          c => c.Id,                            // key from the right sequence
          (r, c) => new { c.Name, r.Count, r.Total });   // combine each matched pair

foreach (var row in report)
    Console.WriteLine($"{row.Name}: {row.Count} orders, {row.Total:C}");

// 3) SelectMany: flatten "each customer's order items" into one list of strings.
var allItems = customers
    .SelectMany(c => orders.Where(o => o.CustomerId == c.Id)
                           .Select(o => $"{c.Name}:{o.Item}"));
Console.WriteLine(string.Join(", ", allItems));

record Customer(int Id, string Name);
record Order(int CustomerId, string Item, decimal Amount);
```

```text
Ada: 3 orders, $429.00
Grace: 2 orders, $235.00
Ada:keyboard, Ada:monitor, Ada:cable, Grace:mouse, Grace:desk
```

(`{row.Total:C}` is currency formatting from string interpolation — *Fundamentals*. Your machine's
culture decides the symbol; the shape is what matters.)

Read the report result carefully: **Linus is missing**. He has no orders, so `GroupBy` never made a
bucket for him, and `Join` drops unmatched rows. If a report must show zero-rows, start the
pipeline **from the side that must be complete** — group *customers'* orders, not orders:

```csharp
var everyone = customers.Select(c => new
{
    c.Name,
    Total = orders.Where(o => o.CustomerId == c.Id).Sum(o => o.Amount),
});
// Ada 429, Grace 235, Linus 0  — Sum of an empty sequence is 0
```

For in-memory data that nested-`Where` shape is often clearer than `Join`; `Join` earns its keep on
large data and databases (it hashes keys instead of rescanning).

**Try it — Lab:** model `record Word(string Text, char Initial, int Length);`, build a
`List<Word>` of 8–10 words (compute `Initial` and `Length` yourself with `word[0]` and
`word.Length`). Produce: (1) a `GroupBy(w => w.Initial)` report printing each initial with its
word count and longest word, sorted by initial; (2) using `SelectMany`, one flat list of every
*character* in every word (`w => w.Text`, since a string is a sequence of `char`), then `Distinct()`
and count the distinct letters used.

**Traps**

- **Inner-join drop-outs:** `Join` and `GroupBy` silently omit keyless/unmatched rows — the
  missing-Linus bug. If completeness matters, drive the query from the complete side.
- **Aggregating the group instead of the elements:** inside `Select(g => ...)`, `g.Key` is the key
  and `g` is the sequence — `g.Sum(o => o.Amount)`, not `g.Amount` (a group has no `.Amount`).
- **`Select` when you meant `SelectMany`:** `customers.Select(c => c.Orders)` is a sequence *of
  lists*; iterate it and you get lists, not orders. If your `foreach` variable is a collection you
  didn't want, switch to `SelectMany`.
- **Grouping by reference-type keys without proper equality:** keys are compared with `Equals`.
  `int`, `string` and `record` keys compare by value and just work; a plain `class` key compares
  by reference, giving one group per object. (See *OOP* on `record` equality.)

---

## 4. Delegates & events

**The idea.** Time to name the machinery properly, because it carries far more than LINQ: every
callback, event handler and async continuation in C# rides on it.

A **delegate type** is a type whose instances are callable methods — a declaration of *shape*
(parameters and return type). You can declare your own:

```csharp
delegate bool IntPredicate(int n);   // "any method taking int, returning bool"
```

In modern code you rarely do, because the built-in generic ones cover nearly every shape: `Func<...>`
(returns a value; last type argument is the return type), `Action<...>` (returns `void`), and
`Predicate<T>` (older alias for `Func<T, bool>` you'll meet in `List<T>` methods like `FindAll`).
Everything section 1 said about lambdas applies: a lambda is the *literal syntax*, a delegate type
is what it's *stored as* — and an ordinary named method with a matching signature can be assigned to
a delegate too (`Func<int, bool> p = IsPrime;` — a *method group* conversion, no lambda needed).

The part that's new: delegates are **multicast**. One delegate variable can hold a *list* of
methods; `+=` appends, `-=` removes, and invoking it calls them all, in order. One caller, many
listeners — which is exactly the publish/subscribe pattern, and C# bakes it in as **events**.

An **event** is a multicast delegate field with access control: outsiders may only `+=` / `-=`
(subscribe/unsubscribe). Only the declaring class can *invoke* it — so no stranger can fire your
"order shipped" notification or wipe your subscriber list by assigning with `=`. That restriction
is the entire difference between a public delegate field and an event, and it's why the keyword
exists.

Why care? **Decoupling in time.** The publisher announces "this happened" without knowing or caring
who listens — zero, one, or ten subscribers, added at runtime. UI frameworks (`button.Click += ...`),
timers, file watchers, and domain logic ("stock hit zero → email purchasing, update dashboard") all
speak this pattern.

**In practice.**

```csharp
// Multicast on a plain delegate:
Action<string> log = s => Console.WriteLine($"[console] {s}");
log += s => Console.WriteLine($"[audit]   {s}");
log("first event");     // invokes BOTH, in subscription order

// Publish/subscribe with an event:
var account = new BankAccount();

account.Overdrawn += amount =>
    Console.WriteLine($"ALERT: overdrawn by {amount:C}");
account.Overdrawn += amount =>
    Console.WriteLine($"(sms) balance below zero");

account.Withdraw(50m);   // fine — no event
account.Withdraw(80m);   // fires Overdrawn → both subscribers run

class BankAccount
{
    private decimal _balance = 100m;

    // The event: subscribers receive the overdraft amount.
    // "?" marks it nullable (nullable chapter of Fundamentals): with no subscribers it is null.
    public event Action<decimal>? Overdrawn;

    public void Withdraw(decimal amount)
    {
        _balance -= amount;
        if (_balance < 0)
            Overdrawn?.Invoke(-_balance);   // ?. — only fire if someone subscribed
    }
}
```

```text
[console] first event
[audit]   first event
ALERT: overdrawn by $30.00
(sms) balance below zero
```

Two idioms in that snippet are *the* standard event idioms — memorise them as a pair:

- `public event Action<decimal>? Overdrawn;` — nullable, because an event with no subscribers is
  `null`, and
- `Overdrawn?.Invoke(...)` — the null-conditional invoke (Atlas: **Null-conditional operators**),
  which fires only if the subscriber list is non-empty. Calling `Overdrawn(...)` bare on a
  subscriber-less event is a `NullReferenceException`.

(The .NET class library's own events conventionally use a delegate called
`EventHandler<TEventArgs>` — `(object? sender, TEventArgs e)` — same machinery with a standardised
signature; Atlas: **Events**. `Action<T>` events like the one above are fine for your own code.)

Now the connective tissue, so the whole chapter clicks together: a LINQ operator is a method that
takes a delegate and calls it per element — a *pull* use of callbacks. An event stores delegates
and calls them when something happens — a *push* use. And in the next chapter, async code hands the
runtime a delegate meaning "run this when the await finishes." Lambdas, `Func`/`Action`, delegates:
one mechanism, three of C#'s biggest features standing on it.

> **C corner:** a delegate instance ≈ a function pointer *plus* the object it's bound to (so
> instance methods work — no `void* user_data` smuggling), and multicast makes it a linked list of
> such pairs that invokes in order. Everywhere a C API says "register a callback," C# says `+=`.

**Try it — Lab:** build a `class Downloader` with a field `int _progress`, an event
`public event Action<int>? ProgressChanged;`, and a method `Step()` that adds 25 to `_progress`
and fires the event with the new value. Subscribe two handlers — one printing `"progress: N%"`,
one printing `"########"`-style bars (`new string('#', n / 10)` builds the bar) — then call
`Step()` four times. Bonus: unsubscribe the bar handler with `-=` after 50% (store its lambda in
an `Action<int>` variable first — you can only `-=` the same instance you `+=`d).

**Traps**

- **Bare invoke:** firing an event without `?.Invoke` when nobody subscribed throws
  `NullReferenceException`. Always `Event?.Invoke(...)`.
- **`-=` with a fresh lambda does nothing:** `x.Changed -= v => Console.WriteLine(v);` removes
  nothing — that's a *new* delegate instance, not the one you added. Keep the handler in a
  variable (or use a named method) if you'll ever unsubscribe.
- **Forgotten subscriptions keep objects alive:** the publisher's list holds a reference to each
  subscriber, so a long-lived publisher pins short-lived subscribers in memory (and keeps calling
  them). Unsubscribe when the listener is done.
- **One throwing subscriber halts the rest:** multicast invokes in order, and an exception in
  handler #1 stops #2 and #3 from running. Keep handlers small and non-throwing.

---

## Check yourself

One honest question per topic — answer without looking, then tick:

1. Given `string[] names`, can you write — right now — a pipeline that keeps names longer than 3
   characters, sorts them by length then alphabetically, and prints the first one safely even if
   nothing matches? If yes, tick *The core five + pipelines* above.
2. Can you explain why `q.Count()` called twice printed every "testing" line twice, what
   `ToList()` changes about that, and what a query does with a captured variable that changed
   after the query was built? If yes, tick *Deferred execution* above.
3. In a `GroupBy(...).Select(g => ...)`, can you say what `g.Key` is, what `g` itself is, and why
   a customer with zero orders vanished from the joined report? If yes, tick *GroupBy, Join,
   SelectMany* above.
4. Can you declare an event on a class, fire it safely with no subscribers, and explain why
   `-=` with a freshly written lambda fails to unsubscribe? If yes, tick *Delegates & events*
   above.

All four ticked? Tick the **LINQ** chapter itself. Then take checkpoint **cp4** — the exam-style
gate for this chapter — described on the *Checkpoints & Defenses* page. It will hand you raw
records and expect a working report pipeline plus a correct explanation of a deferred-execution
bug, so do the labs first if you skipped them.
