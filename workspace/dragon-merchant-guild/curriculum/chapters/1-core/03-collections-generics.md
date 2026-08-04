# Collections & Generics

Nearly every real program is data flowing through containers, and picking the right container is
mostly Big-O reasoning — except C# hands you the containers ready-made, type-safe, and growable.
After this chapter you can build things like a word-frequency counter, a task queue, a dedup pass,
or a cache — choosing the right structure on purpose, writing your own reusable generic code, and
even authoring your own lazily-produced sequences.

> **Worked solution:** [[03-collections-generics-worked]] — the roster, the warehouse and the
> contract board as finished source.
> Section numbers match this page, so the two read side by side in a split pane.

---

## 1. The core collections

**The idea**

The guild starts with two dragons. By the end of the month it has nine, and one of them is on
loan. You don't know how many contracts will be on the board tomorrow. You don't know how many
resource types the warehouse will end up holding.

An array in C# (`int[]`, `string[]`) is what you expect: a fixed-length block of elements, indexed
from 0, length known up front. It's exactly right when the size genuinely is fixed — and useless
for a roster. Hand-rolling growth (allocate bigger, copy across, drop the old one) is precisely
the error-prone plumbing the standard library exists to kill.

So the real question is never "which container do I know?" It's **what am I going to ask this data
to do?** The guild asks different questions of different data, and each question has a container
that answers it cheaply:

- *"What did we produce each day, in order?"* — a growable list.
- *"How many crates of Stone are in the warehouse?"* — a lookup by name.
- *"Is Ironjaw already on shift?"* — a membership test, no value attached.
- *"Which contract came in first?"* — a queue.
- *"What was the last thing I did?"* — a stack.

Pick the container that makes your commonest question cheap, and the rest of the code writes
itself. Pick the wrong one and you'll be writing loops inside loops to compensate.

C#'s collections live in `System.Collections.Generic` (already imported for you — implicit
`using`s are on). The five you'll actually use, with the mental model and the costs:

| Type | Reach for it when… | Key ops (average) | Mental model |
|---|---|---|---|
| `List<T>` | ordered, growable sequence | index O(1), add-at-end O(1)†, search O(n) | a growable array |
| `Dictionary<TKey,TValue>` | look up a value by a key | get / add / remove O(1) | a hash table |
| `HashSet<T>` | uniqueness, "have I seen this?" | add / contains O(1) | a set |
| `Queue<T>` | first-in, first-out | enqueue / dequeue O(1) | a pipe (work queues, BFS) |
| `Stack<T>` | last-in, first-out | push / pop O(1) | a spring (undo, DFS) |

† *amortised* — the list occasionally doubles its internal backing array and copies, but averaged
over many adds each add is O(1).

The `<T>` (or `<TKey,TValue>`) is a **type parameter**: `List<int>` holds only `int`s,
`Dictionary<string,int>` maps `string` keys to `int` values. You pick the element type when you
create the collection, and the compiler enforces it everywhere — no casts, no "hope it's the right
type." Section 2 shows how this mechanism works and how you write your own; for now just use it.

How to choose, in one paragraph: need order and indexing? `List<T>`. Need "find the value for this
key" fast? `Dictionary<TKey,TValue>`. Only need "is it present?" — no value attached? `HashSet<T>`.
Processing items in arrival order? `Queue<T>`. Most-recent-first (undo, matching brackets,
depth-first traversal)? `Stack<T>`. Fixed, known size that never changes? A plain array.

**In practice**

A complete program touching all five, one guild question each — paste it into the Study tab and
run it:

```csharp
// --- List<T>: ordered, growable, indexable ---
// "What did we produce each day, in order?"
var dayOutput = new List<int> { 90, 72 };   // collection initializer: create + fill in one go
dayOutput.Add(85);                          // grows automatically
dayOutput[0] = 95;                          // indexer: read/write by position, O(1)
Console.WriteLine($"days={dayOutput.Count}, first={dayOutput[0]}");

// Collection expression — newer, shorter syntax for the same thing:
List<int> lastWeek = [1, 2, 3];                  // [...] builds the collection on the left
List<int> everything = [.. dayOutput, .. lastWeek];  // ".." (spread) splices a sequence in
Console.WriteLine(string.Join(", ", everything));    // string.Join glues items with a separator

// --- Dictionary<TKey,TValue>: key -> value ---
// "How many crates of Stone are in the warehouse?"
var inStore = new Dictionary<string, int>
{
    ["Stone"] = 36,        // indexer with a key, not a position
    ["Timber"] = 55,
};
inStore["Stone"] = 37;                     // assign: adds the key or overwrites it
Console.WriteLine(inStore["Timber"]);      // read: throws KeyNotFoundException if absent!

// TryGetValue: the safe read. Returns bool; the value comes back via `out`,
// which declares the variable right in the call and lets the method fill it.
if (inStore.TryGetValue("Silk", out int crates))
    Console.WriteLine($"Silk: {crates}");
else
    Console.WriteLine("no Silk in store");

// --- HashSet<T>: membership, no duplicates ---
// "Is Ironjaw already on shift?"
var onShift = new HashSet<string>();
Console.WriteLine(onShift.Add("Ironjaw"));       // True  — newly added
Console.WriteLine(onShift.Add("Ironjaw"));       // False — already there; refused, not an error
Console.WriteLine(onShift.Contains("Ironjaw"));  // True

// --- Queue<T> and Stack<T> ---
// "Which contract came in first?" and "what was the last thing I did?"
var board = new Queue<string>();
board.Enqueue("Stone x40"); board.Enqueue("Timber x12");
Console.WriteLine(board.Dequeue());        // Stone x40 — first in, first out

var undo = new Stack<string>();
undo.Push("assigned Ironjaw"); undo.Push("assigned Mossback");
Console.WriteLine(undo.Pop());             // assigned Mossback — last in, first out
```

```text
days=3, first=95
95, 72, 85, 1, 2, 3
55
no Silk in store
True
False
True
Stone x40
assigned Mossback
```

Two patterns worth memorising because you'll write them weekly:

```csharp
// Tallying — the canonical Dictionary idiom. Here: today's deliveries by resource.
var tally = new Dictionary<string, int>();
foreach (var resource in new[] { "Stone", "Timber", "Stone", "Coal", "Stone" })  // inline array
    tally[resource] = tally.TryGetValue(resource, out var n) ? n + 1 : 1;
foreach (var (resource, count) in tally)                     // deconstruct each key/value pair
    Console.Write($"{resource}:{count} ");
Console.WriteLine();
// prints: Stone:3 Timber:1 Coal:1

// Dedup — one line, O(n). Which resources did we touch at all today?
List<int> withDupes = [3, 1, 3, 2, 1];
List<int> unique = [.. new HashSet<int>(withDupes)];         // set eats the duplicates
Console.WriteLine(unique.Count);
// prints: 3
```

(`var` — from Fundamentals — just means "compiler, infer the type"; `tally` is still a plain
`Dictionary<string,int>`. The `foreach (var (resource, count) in tally)` form deconstructs each
entry into two locals; a dictionary enumerates as key/value pairs. Note this one is shown with
`// prints` rather than a checked output block, because dictionary enumeration order is an
implementation detail you should never write code that depends on.)

**Arrays vs `List<T>`:** an array is leaner (one fixed allocation, no growth bookkeeping) and
signals "this size is final." `List<T>` costs a little more but grows for you. Default to
`List<T>` for anything you build up; use arrays for fixed-shape data (a chessboard, a buffer,
`args`). Converting is easy: `list.ToArray()` and `new List<int>(array)` — or `[.. anything]`.

> **C corner:** `List<T>` is the `malloc`/`realloc` growable-array pattern you've hand-rolled —
> pointer, length, capacity — with doubling growth built in, so `Add` is amortised O(1).
> `Dictionary` is the hash table you'd otherwise build from an array of buckets and chains.
> None of it needs freeing: the garbage collector reclaims collections when nothing references them.

**Try it — Lab:** in the Study tab, build a `List<int>` of 20,000 random values in `0..99`
(`var rng = new Random(); rng.Next(100)` gives one). Remove duplicates two ways: (a) a nested
loop that checks "already in my output list?" with `output.Contains(x)` before adding, and
(b) `[.. new HashSet<int>(input)]`. Wrap each in
`var sw = System.Diagnostics.Stopwatch.StartNew(); ... Console.WriteLine(sw.ElapsedMilliseconds);`
and print both timings. Feel the O(n²) vs O(n) difference in real milliseconds.

**Traps**

- **`list.Contains(x)` inside a loop.** `Contains` on a `List` scans — O(n). In a loop, that's
  O(n²). The moment you catch yourself doing membership tests in a loop, switch to a `HashSet`.
- **`dict[key]` on a missing key throws** (`KeyNotFoundException`). Reading is not like writing:
  assignment adds the key, but reading demands it exists. Use `TryGetValue` when absence is normal.
- **`Insert(0, x)` and `Remove(item)` on a `List` are O(n)** — everything after the slot shifts.
  If you're constantly adding/removing at the front, you wanted a `Queue<T>`.
- **Mutating a collection while `foreach`-ing it throws** `InvalidOperationException`
  ("Collection was modified"). Collect items to remove into a second list and remove after the
  loop, or use `list.RemoveAll(x => x < 0)` — more on why in section 3.

*(Atlas: **Arrays**, **List\<T\>**, **Dictionary\<TKey,TValue\>**, **HashSet\<T\>**, **Queue\<T\>**, **Stack\<T\>**.)*

---

## 2. Generics & constraints

**The idea**

The guild needs a "keep the best one" helper. Best-paying contract, so you write `MaxDecimal`.
Then the most productive dragon, so you write `MaxInt`. Then the alphabetically first resource
name, so you write `MaxString`. Three methods, one idea, and a fourth one waiting the moment
someone adds a new kind of thing to compare.

You've now *used* `List<T>` all through section 1 without ever writing a `ListOfInt` and a
`ListOfString`. That's the machinery you want, and this section is how to get at it.

A **generic** type or method is parameterised by a type the caller fills in later. Instead of
`MaxInt`, `MaxDouble`, `MaxString`, you write `Max<T>` once and the compiler stamps out a correct,
fully typed version for each `T` it's used with.

The mental model: a generic is a **blueprint for blueprints**. A class is a blueprint for
warehouses; `List<T>` is a blueprint for *warehouse blueprints*, and filling in `T` is what hands
you a real one — a warehouse for crates, a warehouse for ledgers. The stamping-out is done by the
compiler, once per `T`, and every stamped copy is fully type-checked.

Why does this beat the obvious alternative — writing the code once against the universal base
type `object` (every C# type derives from `object`; see the OOP chapter)? Three reasons:

1. **Type safety.** An `object`-based container accepts anything, so nothing stops you putting a
   `string` into your "stack of ints"; you find out at runtime, at the cast, possibly in
   production. With `Stack<int>`, the wrong type is a *compile* error.
2. **No casts.** Everything coming out of an `object` container must be cast back
   (`(int)stack.Pop()`). Generics return the real type.
3. **No boxing.** Storing a value type (`int`, `struct`) in an `object` wraps it in a heap
   allocation ("boxing") and unwraps it on the way out. `List<int>` genuinely stores raw `int`s —
   C# generics are real at runtime, not compile-time sugar.

**In practice**

A generic method — `<T>` after the name declares the type parameter:

```csharp
// Swap works for ANY type; `ref` (from Fundamentals) passes by reference.
void Swap<T>(ref T a, ref T b)
{
    T tmp = a; a = b; b = tmp;
}

int x = 1, y = 2;
Swap(ref x, ref y);              // note: no <int> needed — inferred from the arguments
Console.WriteLine($"{x} {y}");   // prints: 2 1

string s1 = "left", s2 = "right";
Swap(ref s1, ref s2);            // same code, T = string
Console.WriteLine($"{s1} {s2}"); // prints: right left
```

That inference — the compiler deducing `T` from the arguments — is why calling generic methods
usually looks like calling normal ones. You *can* write `Swap<int>(ref x, ref y)` explicitly, and
sometimes must, when there's no argument to infer from (e.g. `Empty<string>()` below).

A generic **type** — the whole type is parameterised, `T` usable in every member:

```csharp
var crateStack = new MiniStack<int>(4);
crateStack.Push(10);
crateStack.Push(20);
Console.WriteLine(crateStack.Pop());       // prints: 20

var dragonStack = new MiniStack<string>(4); // same class, different T — zero casts anywhere
dragonStack.Push("Ironjaw");
Console.WriteLine(dragonStack.Pop());       // prints: Ironjaw

// A tiny growable stack — List<T>'s trick, hand-rolled so you see it.
class MiniStack<T>(int capacity)          // primary constructor (OOP chapter)
{
    private T[] _items = new T[capacity];
    private int _count = 0;

    public void Push(T item)
    {
        if (_count == _items.Length)                    // full? double the backing array
        {
            var bigger = new T[_items.Length * 2];
            Array.Copy(_items, bigger, _count);
            _items = bigger;
        }
        _items[_count++] = item;
    }

    public T Pop() => _count > 0
        ? _items[--_count]
        : throw new InvalidOperationException("empty");
}
```

(In the Study tab, top-level statements come first and type declarations go after them, as above.)

**Constraints.** Inside `Swap<T>`, the code treats `T` as an opaque blob — it only copies values,
so that's fine. But suppose you want `Max<T>`: now you need to *compare* two `T`s, and the
compiler rightly refuses `a > b` for an arbitrary `T`. A `where` clause **constrains** `T`,
telling the compiler what any `T` is guaranteed to be able to do — which unlocks those abilities
inside the method:

```csharp
Console.WriteLine(Max(12, 9));              // prints: 12    — the more productive dragon
Console.WriteLine(Max("Stone", "Timber"));  // prints: Timber — later in the alphabet

T Max<T>(T a, T b) where T : IComparable<T>   // T must know how to compare itself to a T
    => a.CompareTo(b) >= 0 ? a : b;           // ...so CompareTo is now legal to call
```

That one method now covers all three cases from the top of the section, and the fourth one you
haven't thought of yet — as long as the type can compare itself.

`IComparable<T>` is an interface (OOP chapter) with one method, `CompareTo`, returning negative /
zero / positive for less / equal / greater. `int`, `double`, `string` and most built-ins implement
it, so `Max` works on all of them — and on any type of yours that implements it.

The constraint forms you'll actually meet:

```csharp
where T : IComparable<T>  // T implements that interface (any interface works here)
where T : Dragon          // T is Dragon or derived from it
where T : class           // T is a reference type (classes, interfaces, strings)
where T : struct          // T is a value type (int, bool, your structs)
where T : new()           // T has a public parameterless constructor -> you may write new T()
where T : class, new()    // combined: comma-separated, new() goes last
```

Two small companions:

```csharp
// default(T): the zero value for T — 0 for numbers, false for bool, null for
// reference types. Useful when you must produce "a T" before you have a real one.
T[] Empty<T>(int n)
{
    var arr = new T[n];              // array slots start at default(T) automatically
    arr[0] = default;                // written explicitly; plain `default` infers T
    return arr;
}
Console.WriteLine(Empty<int>(3)[0]);     // prints: 0

// new T(): only legal under the new() constraint.
T Make<T>() where T : new() => new T();
```

Why this matters beyond toy methods: it's the **write-once, reuse-forever** mechanism. You write a
`Cache<TKey,TValue>` or a `Repository<T>` once and it works, fully type-checked, for every type in
your program. The entire collections library from section 1 is exactly this — someone wrote
`List<T>` once, and you got `List<int>`, `List<string>`, and `List<YourType>` for free.

> **C corner:** the C route to "a stack of anything" is `void*` plus casts at every boundary —
> the compiler can't help when you cast wrong — or macro tricks that stamp out per-type copies
> with no shared contract. Generics are the macro approach done right: real per-type code, but
> type-checked once, written once, with `where` as an enforceable contract instead of a comment.

**Try it — Lab:** in the Study tab, write `T[] Repeat<T>(T value, int n)` returning an array of
`n` copies of `value`; call it as `Repeat(7, 3)` and `Repeat("ha", 3)` (no explicit `<T>` —
let inference work) and print each with `string.Join(",", ...)`. Then write
`T MinOf<T>(List<T> items) where T : IComparable<T>` that walks the list keeping the smallest,
and test it on a `List<int>` and a `List<string>`. Bonus: make `MinOf` throw
`InvalidOperationException` on an empty list, and check it does.

**Traps**

- **Constraining more than you use.** Add `where` clauses only for what the method actually
  calls. Extra constraints shrink the set of types your code accepts for no benefit.
- **`default(T)` is `null` for reference types.** With nullable reference types on, a method
  returning `default` for a `class` T hands back `null` — type it `T?` and make callers check,
  or you've just built a `NullReferenceException` factory.
- **Comparing `T` values with `==`.** For an unconstrained `T`, `a == b` won't compile (the
  compiler doesn't know if `T` supports it). Use `EqualityComparer<T>.Default.Equals(a, b)` —
  section 3 explains the machinery behind that class.
- **Reaching for `object` "to keep it simple."** Every `object`-typed container is a deferred
  runtime error plus boxing overhead. If you're writing a cast, ask whether a `T` should be there.

*(Atlas: **Generics**.)*

---

## 3. Iterators & equality

**The idea**

Two questions you can't answer yet, both of which have already bitten you in this chapter.

*Why did modifying a list inside a `foreach` throw?* And *why, if you put a `Point` in a
`HashSet` and then ask whether it contains an identical `Point`, does it sometimes say no?*

Both answers are the same shape: there is a contract underneath, you've been relying on it all
chapter without seeing it, and the moment you write your own type you become responsible for
upholding it. Here's what's actually happening.

**Part A — how `foreach` really works.** The mental model is a **cursor**: not the collection
itself, but a finger pointing at one item, with a "move to the next one" button that eventually
says there are no more. Anything that can hand out such a finger can be `foreach`ed — which is
why the same loop syntax works on an array, a dictionary, and a sequence of numbers that doesn't
exist yet.

Concretely: anything you can `foreach` implements `IEnumerable<T>` — an interface with a single
job, handing out an **enumerator** (`IEnumerator<T>`). That's the cursor: `MoveNext()` advances it
and returns `false` when there's nothing left, and `Current` is the item it's pointing at.
`foreach (var x in seq)` is compiler shorthand for:

```csharp
// what the compiler generates for: foreach (var x in seq) { ...use x... }
using var e = seq.GetEnumerator();   // `using`: dispose the cursor when done (Fundamentals)
while (e.MoveNext())
{
    var x = e.Current;
    // ...use x...
}
```

Arrays, `List<T>`, `Dictionary<K,V>`, `HashSet<T>` — all implement `IEnumerable<T>`, which is why
`foreach` works uniformly on them.

**And there's the answer to the first question.** The cursor walks the collection's internal
structure. Mutate the collection mid-walk and the cursor's view of that structure goes stale — it
is a finger pointing into a book while someone tears pages out. `MoveNext` throws rather than hand
you garbage, which is the kindest thing it could do.

Writing an enumerator class by hand is tedious — so C# writes it for you. A method containing
**`yield return`** becomes an **iterator**: the compiler transforms it into a state machine that
produces values *on demand*, one per `MoveNext()`, pausing between them:

**In practice**

```csharp
foreach (var n in Evens(10))
    Console.Write($"{n} ");
Console.WriteLine();
// prints: 0 2 4 6 8 10

IEnumerable<int> Evens(int upTo)
{
    Console.WriteLine("(starting)");   // proof of laziness: runs at first MoveNext,
    for (int i = 0; i <= upTo; i += 2) //   not when Evens(10) is called
        yield return i;                // emit a value, pause here until asked again
}
```

```text
(starting)
0 2 4 6 8 10
```

Calling `Evens(10)` runs *none* of the body — it just builds the sequence object. Each
`MoveNext()` resumes the method until the next `yield return`. This **laziness** means you can
express infinite sequences and only pay for what you consume:

```csharp
using var e = Naturals().GetEnumerator();   // driving the cursor manually this time
for (int i = 0; i < 5; i++)
{
    e.MoveNext();
    Console.Write($"{e.Current} ");
}
Console.WriteLine();
// prints: 0 1 2 3 4      — the while(true) never hangs; we only pulled 5 values

IEnumerable<int> Naturals()
{
    int n = 0;
    while (true)          // genuinely infinite — and fine, because it's lazy
        yield return n++;
}
```

Use iterators when a sequence is *computed* or *streamed* — generated numbers, lines filtered
from a file, tree traversals — and there's no point materialising a full `List<T>` first. This is
also the foundation the next chapter (LINQ) stands on: every LINQ operator consumes and produces
`IEnumerable<T>` exactly like this. (`yield break` inside an iterator ends the sequence early,
like a `return` for iterators.)

**Part B — the equality contract.** Now the second question. How does `HashSet<T>.Contains` manage
O(1) — how does it avoid looking at every item?

Picture the guild's mail room: a wall of pigeonholes, each labelled. To file something you compute
which pigeonhole it belongs in from the item itself, walk straight to that one hole, and look only
at the two or three things already in it. You never search the wall.

That computation is the **hash code** — `GetHashCode()`, a method every type has, returning an
`int` digest of the value. `HashSet` and `Dictionary` both work exactly this way: hash to find the
pigeonhole, then use `Equals` to pick from the few items inside it.

Which means the whole scheme rests on one contract:

> **If two values are `Equals`-equal, they MUST return the same hash code.**

Break it and you get the symptom from the top of the section. Two identical `Point`s that report
different hash codes get filed in *different pigeonholes*; `Contains` walks to one hole, doesn't
find it, and reports `false` about an item the set is definitely holding. Nothing crashes. The
data is just quietly wrong, which is worse.

Where the defaults leave you:

- **Value types and `record`s** compare by *content* — two equal `int`s, or two `record`
  instances with equal fields, are equal, with matching hash codes. Correct out of the box.
- **Classes** compare by *reference* — two distinct objects with identical fields are **not**
  equal by default. Right when objects have identity (two customers named "Kim" are different
  people); wrong for value-like classes (two points at the same coordinates *are* the same point).

To give a class value equality, implement **`IEquatable<T>`** — the interface declaring
`bool Equals(T other)` — *and* override `GetHashCode` to match. Never one without the other:

```csharp
var visited = new HashSet<Point> { new(1, 2), new(3, 4) };
Console.WriteLine(visited.Contains(new Point(1, 2)));   // prints: True
Console.WriteLine(visited.Count);                       // prints: 2

visited.Add(new Point(1, 2));                           // duplicate by value — refused
Console.WriteLine(visited.Count);                       // prints: 2

class Point(int x, int y) : IEquatable<Point>
{
    public int X { get; } = x;
    public int Y { get; } = y;

    public bool Equals(Point? other)                     // Point? — may be null (nullable is on)
        => other is not null && other.X == X && other.Y == Y;

    public override bool Equals(object? obj)             // the object-level overload must agree
        => obj is Point p && Equals(p);

    public override int GetHashCode()
        => HashCode.Combine(X, Y);   // helper that mixes fields into one well-spread int
}
```

The honest shortcut: if a type exists mainly to *be* its data, declare it a `record`
(`record Point(int X, int Y);` — OOP chapter) and all of the above is generated correctly for
you. Write it by hand when you need custom rules — or to actually understand the contract.

**Part C — equality as a plug-in.** Sometimes the *type* is fine but you want a different rule
for one particular collection — the classic case: a dictionary with case-insensitive string keys.
That's what **`IEqualityComparer<T>`** is for: an object bundling an `Equals(T, T)` and a
`GetHashCode(T)` that a collection uses *instead of* the items' own. Every hash-based collection
accepts one in its constructor:

```csharp
var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
headers["Content-Type"] = "text/html";
Console.WriteLine(headers["content-type"]);        // prints: text/html
Console.WriteLine(headers.ContainsKey("CONTENT-TYPE"));   // prints: True
```

`StringComparer.OrdinalIgnoreCase` is a ready-made comparer that hashes and compares strings
ignoring case ("ordinal" = by raw character values, no locale rules). Writing your own is just a
class implementing both methods — same contract as always, equal things must hash alike:

```csharp
var byLength = new HashSet<string>(new LengthComparer()) { "cat", "dog", "horse" };
Console.WriteLine(byLength.Count);   // prints: 2 — "dog" was refused: same length as "cat"

class LengthComparer : IEqualityComparer<string>
{
    public bool Equals(string? a, string? b) => a?.Length == b?.Length;
    public int GetHashCode(string s) => s.Length;
}
```

And the loose end from section 2: `EqualityComparer<T>.Default` is the comparer wrapping a type's
own `Equals`/`GetHashCode` — which is how generic code compares `T` values without knowing `T`.

**Try it — Lab:** in the Study tab, (1) write an iterator
`IEnumerable<long> Fibonacci()` with `while (true)` inside, and pull exactly the first 10 values
with a manually driven enumerator (as in the `Naturals` example), printing each — proving the
infinite loop can't hang you. (2) Build a case-insensitive word counter: count the words in
`"The the THE quick Quick fox"` (split with `.Split(' ')`) into a
`Dictionary<string,int>` created with `StringComparer.OrdinalIgnoreCase`, and print each
key/count pair. Expected: exactly three entries — `The:3`, `quick:2`, `fox:1` (the *first*
casing seen becomes the stored key).

**Traps**

- **Overriding `Equals` without `GetHashCode`** (or vice versa). Equal items land in different
  hash buckets; `Contains` returns `false` for items the set holds. The compiler warns — heed it.
- **Mutable keys.** If an object's hash-relevant fields change *after* it's in a `HashSet` or is
  a `Dictionary` key, its hash no longer matches its bucket — it's effectively lost (lookups
  miss it; it still counts toward `Count`). Keys should be immutable: get-only properties or records.
- **Iterators defer everything — including argument checks.** `throw` statements inside an
  iterator body don't fire at the call, only at first `MoveNext()`. If you need eager validation,
  put it in a normal method that validates, then returns a call to a private iterator.
- **Enumerating twice runs it twice.** An `IEnumerable<T>` from an iterator is a *recipe*, not a
  result — two `foreach` loops re-execute the body from the top. If the work is expensive or the
  source changes, materialise once: `List<int> snapshot = [.. Evens(1000)];`.

*(Atlas: **Iterators**, **Equality**, **Interfaces**.)*

---

## Check yourself

One honest question per topic — answer without looking back up the page:

1. Given "count how often each word appears, ignoring words in a stop-list," can you name the
   right collection for each role, the Big-O of the operations involved, and the safe way to read
   a possibly-missing key? If yes, tick *The core collections* above.
2. Can you write a `MinOf<T>` method that compiles for both `int` and `string` with no casts, and
   explain what the `where T : IComparable<T>` clause is *for* — what it unlocks inside the
   method and why plain `object` would be worse? If yes, tick *Generics & constraints* above.
3. Can you explain what `foreach` desugars to, why a `yield return` method runs nothing until
   iterated, and what contract binds `Equals` and `GetHashCode` together (and what breaks in a
   `HashSet` when you violate it)? If yes, tick *Iterators & equality* above.

All three ticked? Tick the chapter — and take **checkpoint cp3** to make it official (see the
*Checkpoints & Defenses* page for how checkpoints work).
