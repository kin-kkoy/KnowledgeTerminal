# SQL + EF Core

Everything you have built so far forgets its data the moment the process exits. This chapter fixes
that: first you learn what a relational database *is* and how to speak its language, **SQL**, by
hand; then you learn **EF Core**, the library that maps C# classes to tables and translates the LINQ
you already know into SQL. You need both layers — EF writes the SQL, but *you* must be able to read
what it wrote.

---

## 1. SQL foundations

**The idea.** You could persist data by writing structs to a file. That works until you need any of
the following, and real programs need all of them:

- **Search without scanning everything.** Find one record among ten million without reading the file
  front to back.
- **Update in place, safely.** Change one record while another process reads — without corrupting
  the file or losing a write.
- **Integrity rules the storage itself enforces.** "Every order must belong to an existing
  customer" should be impossible to violate, not merely discouraged by comments.
- **Crash safety.** If the power dies mid-write, the data is either fully old or fully new — never
  half-written.

A **relational database** is a program (an *engine*) that owns your data files and gives you all
four. You never touch the bytes; you send it statements in **SQL** (Structured Query Language) and
it answers with rows.

The **relational model** is the shape the data takes:

- A **table** is a named set of records with a fixed, typed set of columns — declare the shape
  once, and every row conforms.
- A **row** is one record. Rows have no order and no identity beyond their column values, which is
  why every table should have a **primary key (PK)**: a column (usually `Id`) whose value is unique
  per row and never changes. It is the row's address.
- Tables link to each other by **foreign keys (FK)**: a column in one table holding the primary key
  of a row in another. That is the *entire* mechanism for relationships — no pointers, no nesting.
  An order "belongs to" a customer because `Orders.CustomerId` holds that customer's `Id`.

This is *why* it's called relational: instead of nesting orders inside a customer record (and then
struggling to answer "all orders over $50 across all customers"), you keep flat tables and
reconnect them at query time with **joins**. Each fact is stored once, in one place, and any
question can be asked later — including questions you didn't anticipate when you designed the
schema.

> **C corner:** a table is like an array of structs, except: the engine, not you, owns the memory
> layout; rows are found by value via indexes, not by offset; and where C would store a pointer to
> another struct, a table stores a foreign key — a *value* you join on, valid across processes and
> restarts.

**In practice.** We'll use **SQLite** — a complete SQL engine that lives in a single file, no
server, no install beyond one CLI tool. Everything below runs in the `sqlite3` shell (Ubuntu/Debian:
`sudo apt install sqlite3`; or use the GUI app *DB Browser for SQLite* if you prefer clicking).

```bash
sqlite3 shop.db     # opens (or creates) shop.db and drops you at a sqlite> prompt
```

Create two related tables:

```sql
CREATE TABLE Customers (
    Id    INTEGER PRIMARY KEY,       -- PK; SQLite auto-assigns 1, 2, 3, ... on insert
    Name  TEXT    NOT NULL,          -- constraint: NULL (missing value) is rejected
    Email TEXT    NOT NULL UNIQUE    -- constraint: no two rows may share an email
);

CREATE TABLE Orders (
    Id         INTEGER PRIMARY KEY,
    CustomerId INTEGER NOT NULL REFERENCES Customers(Id),  -- the foreign key
    Item       TEXT    NOT NULL,
    Amount     REAL    NOT NULL
);
```

`NOT NULL`, `UNIQUE`, and `REFERENCES` are **constraints** — rules the engine enforces on every
write, forever, no matter which program does the writing. Insert some rows (`INSERT INTO table
(columns) VALUES (values)`; strings use *single* quotes in SQL):

```sql
INSERT INTO Customers (Name, Email) VALUES ('Ada', 'ada@mail.com');
INSERT INTO Customers (Name, Email) VALUES ('Basil', 'basil@mail.com');
INSERT INTO Customers (Name, Email) VALUES ('Cora', 'cora@mail.com');

INSERT INTO Orders (CustomerId, Item, Amount) VALUES (1, 'Keyboard', 80.0);
INSERT INTO Orders (CustomerId, Item, Amount) VALUES (1, 'Mouse',    25.0);
INSERT INTO Orders (CustomerId, Item, Amount) VALUES (2, 'Monitor', 240.0);
```

Read with `SELECT`. SQL is **declarative**: you state which rows and columns you want; the engine
decides *how* to fetch them.

```sql
SELECT Item, Amount FROM Orders WHERE Amount > 30 ORDER BY Amount DESC;
```

```text
Monitor|240.0
Keyboard|80.0
```

Change and remove rows — and note that **the `WHERE` clause is the only thing standing between you
and every row in the table**:

```sql
UPDATE Orders SET Amount = 75.0 WHERE Id = 1;   -- without WHERE: updates ALL rows
DELETE FROM Orders WHERE Id = 2;                 -- without WHERE: deletes ALL rows
```

**JOIN — reconnecting tables.** A join pairs rows from two tables wherever a condition holds.
Here's `Customers` joined to `Orders` on the foreign key, drawn out:

```text
Customers                 Orders
Id | Name                 Id | CustomerId | Item     | Amount
---+------                ---+------------+----------+-------
1  | Ada       ◄────────  1  | 1          | Keyboard | 75.0
1  | Ada       ◄────────  3  | 2          | Monitor  | 240.0   ► pairs with Basil
2  | Basil
3  | Cora                 (Cora has no orders — no pair for her)
```

```sql
SELECT c.Name, o.Item, o.Amount
FROM Customers c
JOIN Orders o ON o.CustomerId = c.Id;    -- "inner" join: matched pairs only
```

```text
Ada|Keyboard|75.0
Basil|Monitor|240.0
```

`c` and `o` are aliases so you can qualify columns. Cora vanished — an **inner join** keeps only
rows that found a partner. When you want "every customer, with orders *if any*", use a **LEFT
JOIN**: every row from the left table survives, and the right side's columns are `NULL` where no
match exists:

```sql
SELECT c.Name, o.Item
FROM Customers c
LEFT JOIN Orders o ON o.CustomerId = c.Id;
```

```text
Ada|Keyboard
Basil|Monitor
Cora|
```

**GROUP BY — one row per group.** Aggregate functions (`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`)
collapse many rows into one. `GROUP BY` says what "many" means — here, per customer:

```sql
SELECT c.Name, COUNT(o.Id) AS OrderCount, COALESCE(SUM(o.Amount), 0) AS Total
FROM Customers c
LEFT JOIN Orders o ON o.CustomerId = c.Id
GROUP BY c.Id;
```

```text
Ada|1|75.0
Basil|1|240.0
Cora|0|0
```

(`COALESCE(x, 0)` means "x, or 0 if x is NULL" — `SUM` over zero rows is NULL.) To filter *groups*
rather than rows, use `HAVING` after the grouping: `... GROUP BY c.Id HAVING SUM(o.Amount) > 100`.

**Subqueries** nest one query inside another — read the inner one first:

```sql
SELECT Name FROM Customers
WHERE Id IN (SELECT CustomerId FROM Orders WHERE Amount > 100);
```

```text
Basil
```

You have now met the SQL that covers 95% of daily work — and every clause has a LINQ twin you
already know from the LINQ chapter: `WHERE`→`Where`, `ORDER BY`→`OrderBy`, `SELECT`→`Select`,
`GROUP BY`→`GroupBy`, `JOIN`→`Join`. That is not a coincidence: LINQ was designed to mirror SQL,
which is exactly why EF Core can translate one into the other in section 3.

**Try it — SQL:** in `sqlite3 practice.db`, build a `Students` table (Id, Name) and an
`Enrollments` table (Id, StudentId FK, Course TEXT, Grade REAL). Insert 3 students and 5
enrollments, leaving one student with none. Then write: (1) all enrollments for one student sorted
by grade; (2) a LEFT JOIN listing every student with their course count; (3) each student's average
grade with `GROUP BY`; (4) a subquery finding students with any grade above 90. Type `.quit` to
leave; the `.db` file persists — reopen it to prove the data survived.

**Traps.**
- `UPDATE`/`DELETE` without `WHERE` hits **every row**, silently, no confirmation. Habit: write the
  `WHERE` first, or run it as a `SELECT` first to see what it matches.
- SQL `NULL` means "unknown", and comparisons with it are never true — `WHERE Email = NULL` matches
  nothing, even rows where Email is NULL. Use `IS NULL` / `IS NOT NULL`.
- Inner join when you meant left join: rows without a partner silently disappear from results, and
  your report quietly undercounts.
- Strings in SQL take single quotes (`'Ada'`); double quotes mean an identifier (a column/table
  name). Mixing them up "works" in SQLite just often enough to bite you later.

---

## 2. EF Core modeling & migrations

**The idea.** You *could* talk to the database from C# by sending SQL strings and copying values out
of result rows by hand. That's real (the low-level `ADO.NET` API does exactly this), but it's
tedious and repetitive: every query needs string SQL, manual parameter passing, and manual
row-to-object mapping. An **ORM** (object–relational mapper) automates that mapping: C# classes ↔
tables, objects ↔ rows, LINQ ↔ SQL.

**EF Core** (Entity Framework Core) is .NET's standard ORM. The trade-off is real and worth stating
up front: you write far less plumbing and stay in typed C#, but a layer now generates your SQL —
and when it generates something slow, you must be able to lift the hood (section 4 shows how).
That's why section 1 exists: EF users who can't read SQL are helpless the first time a query is
slow.

EF Core has three moving parts:

- **Entities** — plain C# classes that represent rows. Each mapped class becomes a table.
- **`DbContext`** — your session with the database: it holds one `DbSet<T>` per table, translates
  your LINQ, and tracks changes you make to loaded objects.
- **Migrations** — versioned, generated C# files that record every schema change, so the real
  database can be rebuilt or upgraded to match your classes at any time. Your classes are the
  source of truth; migrations are the diff history ("code-first").

> ⚠ **Fast-moving area.** EF Core ships a major version yearly alongside .NET; package and tool
> versions below match .NET 10 / EF Core 10 (both LTS) and the `dotnet ef` tool's flags
> occasionally change. The concepts below are stable; verify names/versions against
> learn.microsoft.com before relying on them.

**In practice.** Set up a console project on SQLite (zero install — the provider package embeds the
whole engine):

```bash
dotnet new console -n ShopEf && cd ShopEf
dotnet add package Microsoft.EntityFrameworkCore.Sqlite   # provider + EF core libraries
dotnet add package Microsoft.EntityFrameworkCore.Design   # design-time support for migrations
dotnet tool install --global dotnet-ef                    # the migrations CLI (once per machine)
```

Define entities and a context — this models the same schema you built by hand in section 1:

```csharp
// Model.cs
using Microsoft.EntityFrameworkCore;

public class Customer
{
    public int Id { get; set; }                    // convention: "Id" => primary key
    public required string Name { get; set; }
    public required string Email { get; set; }
    public List<Order> Orders { get; set; } = [];  // navigation property (section 3)
}

public class Order
{
    public int Id { get; set; }
    public required string Item { get; set; }
    public decimal Amount { get; set; }
    public int CustomerId { get; set; }            // convention: "<Nav>Id" => foreign key
    public Customer Customer { get; set; } = null!;
}

public class ShopContext : DbContext
{
    public DbSet<Customer> Customers => Set<Customer>();   // one DbSet per table
    public DbSet<Order> Orders => Set<Order>();

    protected override void OnConfiguring(DbContextOptionsBuilder options)
        => options.UseSqlite("Data Source=shop.db");

    protected override void OnModelCreating(ModelBuilder model)   // configuration layer
    {
        model.Entity<Customer>().HasIndex(c => c.Email).IsUnique();
        model.Entity<Customer>().Property(c => c.Name).HasMaxLength(100);
    }
}
```

Two layers decide the schema. **Conventions** cover the common cases with no code at all: `Id`
becomes the primary key, `CustomerId` next to a `Customer` navigation becomes a foreign key,
`required`/non-nullable properties become `NOT NULL`, table names come from the `DbSet` names.
**Configuration** in `OnModelCreating` overrides conventions for everything else — unique indexes,
lengths, table renames, composite keys. Rule of thumb: lean on conventions, configure only what
they get wrong.

(In an ASP.NET Core app, you'd skip `OnConfiguring` and register the context in DI instead —
`builder.Services.AddDbContext<ShopContext>(o => o.UseSqlite(...))` — then take `ShopContext` as a
constructor/endpoint parameter like any service from the ASP.NET Core chapter.)

Now generate and apply the first migration:

```bash
dotnet ef migrations add InitialCreate   # compares model to (empty) snapshot, writes the diff
dotnet ef database update               # runs pending migrations against shop.db
```

Open `Migrations/..._InitialCreate.cs` — it's readable C# describing schema operations:

```csharp
migrationBuilder.CreateTable(
    name: "Customers",
    columns: table => new
    {
        Id = table.Column<int>(nullable: false)
            .Annotation("Sqlite:Autoincrement", true),
        Name = table.Column<string>(maxLength: 100, nullable: false),
        Email = table.Column<string>(nullable: false)
    },
    constraints: table => table.PrimaryKey("PK_Customers", x => x.Id));
```

When `database update` runs, each operation becomes the SQL you wrote by hand in section 1:
`CreateTable` → `CREATE TABLE`, `HasIndex(...).IsUnique()` → `CREATE UNIQUE INDEX`. To see it,
`dotnet ef migrations script` prints the full SQL. The workflow from here on is always: **edit
entities → `migrations add SomeName` → `database update`**. Each migration stacks on the last, and
the database keeps a `__EFMigrationsHistory` table recording which have been applied — that's how
`update` knows what's pending.

**Try it — Project:** run the four `bash` commands above, paste in `Model.cs`, and create/apply
`InitialCreate`. Verify with `sqlite3 shop.db ".schema Customers"` — read EF's generated DDL. Then
add `public DateTime CreatedAt { get; set; }` to `Customer`, run
`dotnet ef migrations add AddCreatedAt` and `dotnet ef database update`, and check `.schema` again:
the column appeared without touching your existing rows.

**Traps.**
- Editing the database schema by hand (or editing an already-applied migration file) desynchronizes
  EF's model snapshot from reality — migrations start failing in confusing ways. The schema changes
  through migrations, full stop.
- `dotnet ef` not found, or version-mismatch complaints: the tool is installed separately from the
  packages (`dotnet tool install --global dotnet-ef`) and its major version must match your EF
  packages — `dotnet tool update --global dotnet-ef` after upgrading.
- Forgetting `Microsoft.EntityFrameworkCore.Design` — `migrations add` fails with an error telling
  you to add exactly that package. Believe it.
- A migration that adds a `NOT NULL` column without a default fails on tables that already contain
  rows — existing rows would have no value. Add a default (`HasDefaultValue`) or make it nullable.

---

## 3. Querying & relationships

**The idea.** You query EF with the same LINQ operators from the LINQ chapter — but something
deeper is happening than "LINQ over a list". `db.Customers.Where(...)` doesn't run C# code over
in-memory objects; it builds an **expression tree** (a data structure describing your lambda), and
when you enumerate the query, EF's provider *translates* that tree into one SQL statement and sends
it to the database. **The filtering happens in the engine, not in your process** — only matching
rows ever cross the wire.

This is deferred execution (LINQ chapter) with real stakes. `IQueryable<T>` is a query
*description* still eligible for translation; the moment you materialize —
`ToListAsync`, `FirstAsync`, `CountAsync`, `foreach` — the SQL fires. Every operator you attach
*before* that point becomes SQL; everything after runs in memory on whatever you already fetched.
The performance difference is the whole table versus a few rows.

Relationships get the same object-flavored treatment: a **navigation property** (`customer.Orders`,
`order.Customer`) is the C# face of a foreign key. But EF does not populate navigations unless you
ask — a query loads rows from *one* table by default, and related lists stay empty.

**In practice.** All queries need `using Microsoft.EntityFrameworkCore;` for the async operators.
Seed and query:

```csharp
using Microsoft.EntityFrameworkCore;

using var db = new ShopContext();

if (!await db.Customers.AnyAsync())
{
    var ada = new Customer { Name = "Ada", Email = "ada@mail.com" };
    ada.Orders.Add(new Order { Item = "Keyboard", Amount = 80m });
    ada.Orders.Add(new Order { Item = "Mouse", Amount = 25m });
    db.Customers.Add(ada);                       // Add cascades to reachable Orders
    db.Customers.Add(new Customer { Name = "Basil", Email = "basil@mail.com" });
    await db.SaveChangesAsync();                 // INSERTs happen here, not at Add
}

var bigSpenders = await db.Orders                // IQueryable — nothing sent yet
    .Where(o => o.Amount > 30m)                  // becomes WHERE "Amount" > 30
    .OrderByDescending(o => o.Amount)            // becomes ORDER BY "Amount" DESC
    .ToListAsync();                              // NOW one SQL statement executes

foreach (var o in bigSpenders)
    Console.WriteLine($"{o.Item}: {o.Amount}");
```

```text
Keyboard: 80
```

(Database calls are I/O, so EF's query API is async — `ToListAsync`/`FirstOrDefaultAsync` are the
awaitable twins of the LINQ operators, exactly the pattern from the Async chapter.)

Load relationships with **`Include`** — it becomes a join, one round-trip:

```csharp
var customers = await db.Customers
    .Include(c => c.Orders)                      // LEFT JOIN Orders in the same query
    .ToListAsync();

foreach (var c in customers)
    Console.WriteLine($"{c.Name}: {c.Orders.Count} orders");
```

```text
Ada: 2 orders
Basil: 0 orders
```

For a second hop (say `Order.Lines` if orders had line items), chain
`.Include(c => c.Orders).ThenInclude(o => o.Lines)`.

**Tracking.** By default the context *tracks* every entity a query returns — it keeps a snapshot,
so that when you mutate a property and call `SaveChangesAsync`, EF diffs and writes an `UPDATE` for
exactly the changed columns:

```csharp
var ada = await db.Customers.FirstAsync(c => c.Name == "Ada");
ada.Email = "ada@newmail.com";       // just mutate the object...
await db.SaveChangesAsync();         // ...EF notices and issues the UPDATE
```

That bookkeeping costs memory and CPU. For read-only queries, switch it off:

```csharp
var report = await db.Customers.AsNoTracking().ToListAsync();  // faster; edits won't save
```

Rule: **reading to display → `AsNoTracking()`; loading to modify → default tracking.**

**The N+1 problem** — the classic ORM performance bug, demonstrated. Because navigations aren't
auto-loaded, code that "fixes" empty navigations with a query per row looks innocent:

```csharp
var customers = await db.Customers.ToListAsync();          // query 1: all customers
foreach (var c in customers)
{
    var count = await db.Orders                            // queries 2..N+1: one per customer!
        .CountAsync(o => o.CustomerId == c.Id);
    Console.WriteLine($"{c.Name}: {count}");
}
```

Two customers means 3 round-trips; 2,000 customers means 2,001 — each with network and parsing
overhead. The output is identical to the `Include` version above, which is what makes it dangerous:
it *works*, it's just quietly 1000× slower at scale. The fix is always to ask for everything in one
statement — `Include`, or better, a projection (section 4):

```csharp
var counts = await db.Customers
    .Select(c => new { c.Name, Count = c.Orders.Count })   // one query, one JOIN + GROUP BY
    .ToListAsync();
```

**Try it — Project:** in the section-2 project, write the N+1 loop and the `Select` projection
version. Add `.LogTo(Console.WriteLine)` to the options in `OnConfiguring`
(`options.UseSqlite(...).LogTo(Console.WriteLine)`) and run both: count the SQL statements printed
for each. Seeing 3 statements collapse into 1 is the point of this whole section.

**Traps.**
- Materializing early: `(await db.Orders.ToListAsync()).Where(o => o.Amount > 30)` fetches the
  entire table, then filters in memory. Keep every operator before the `ToListAsync`. Materialize
  late.
- Empty navigation ≠ no data. Forgetting `Include` gives you an empty `Orders` list, not an error —
  a silent wrong answer.
- Not everything translates to SQL. Call your own C# helper method inside a `Where` and EF throws
  ("could not be translated"). Filter on translatable expressions, or materialize first *if* the
  data is already small.
- Editing entities loaded with `AsNoTracking()` and wondering why `SaveChangesAsync` writes
  nothing — untracked means invisible to the diff.

---

## 4. Transactions & performance

**The idea.** A **transaction** makes a group of writes atomic: all of them commit, or none do.
The textbook case is a transfer — subtract from one account, add to another; a crash between the
two must not eat the money. Relational engines guarantee this (part of the "ACID" promises:
atomicity, consistency, isolation, durability).

EF builds this in via the **unit-of-work** pattern: the context accumulates your `Add`s, deletions,
and tracked edits, and `SaveChangesAsync()` writes them **as one transaction automatically**. One
call, one atomic batch — if any statement fails, the database rolls the whole batch back. You only
need an *explicit* transaction when several `SaveChangesAsync` calls (or a mix of EF and raw SQL)
must succeed or fail together.

Performance in EF mostly reduces to three questions: how many *round-trips* are you making (N+1,
section 3), how many *columns and rows* are you dragging back (projections), and can the engine
*find* rows without scanning the table (indexes)?

**In practice.** Unit of work — many changes, one atomic save:

```csharp
db.Orders.Add(new Order { CustomerId = 1, Item = "Desk", Amount = 300m });
db.Orders.Add(new Order { CustomerId = 1, Item = "Lamp", Amount = 45m });
var basil = await db.Customers.FirstAsync(c => c.Name == "Basil");
basil.Name = "Basil K.";
await db.SaveChangesAsync();   // 2 INSERTs + 1 UPDATE, one transaction, one round-trip batch
```

Explicit transaction spanning multiple saves:

```csharp
await using var tx = await db.Database.BeginTransactionAsync();
try
{
    from.Balance -= 100m;
    await db.SaveChangesAsync();
    to.Balance += 100m;
    await db.SaveChangesAsync();
    await tx.CommitAsync();          // both saves become visible together
}
catch
{
    // rollback is automatic on dispose without Commit; both saves vanish
    throw;
}
```

**Projections** — the single best everyday optimization. Loading full entities pulls every column
and pays the tracking tax; `Select` into a shape you define pulls exactly what you need and is
never tracked:

```csharp
public record CustomerSummary(string Name, int OrderCount, decimal Total);

var summaries = await db.Customers
    .Select(c => new CustomerSummary(
        c.Name,
        c.Orders.Count,
        c.Orders.Sum(o => o.Amount)))
    .ToListAsync();

foreach (var s in summaries)
    Console.WriteLine($"{s.Name}: {s.OrderCount} orders, {s.Total:0.00} total");
```

```text
Ada: 4 orders, 450.00 total
Basil K.: 0 orders, 0.00 total
```

This is one SQL statement — the counting and summing become SQL aggregates and run in the engine.
Such purpose-built shapes are called **DTOs** (data transfer objects); records fit them perfectly.
Rule: **entities when you'll modify and save; projections for everything you only read** —
projections quietly subsume `AsNoTracking` and kill most `Include`s too.

**Indexes.** By default, `WHERE Email = '...'` on a million-row table reads all million rows (a
*full table scan*). An **index** is a sorted lookup structure (a B-tree) the engine maintains on a
column, turning that scan into a few-step descent — the phone book versus reading every page. The
engine auto-indexes primary keys, and EF indexes foreign keys by convention; anything else you
declare in `OnModelCreating`:

```csharp
model.Entity<Order>().HasIndex(o => o.Amount);   // then: migrations add + database update
```

The trade-off: each index speeds reads on that column but slightly slows every write (the tree must
be maintained) and takes space. Index the columns you actually filter, join, and sort on — not
everything.

**Reading the generated SQL** — your hood-lifting tools. Per query, `ToQueryString()` on the
un-materialized `IQueryable`:

```csharp
var query = db.Orders.Where(o => o.Amount > 30m).OrderByDescending(o => o.Amount);
Console.WriteLine(query.ToQueryString());   // prints, does not execute
```

```text
SELECT "o"."Id", "o"."Amount", "o"."CustomerId", "o"."Item"
FROM "Orders" AS "o"
WHERE "o"."Amount" > 30.0
ORDER BY "o"."Amount" DESC
```

Globally, logging in the options — see everything EF actually executes, as it happens:

```csharp
options.UseSqlite("Data Source=shop.db")
       .LogTo(Console.WriteLine, LogLevel.Information)    // needs using Microsoft.Extensions.Logging;
       .EnableSensitiveDataLogging();                     // include parameter values (dev only!)
```

You can now read that output — it's the SQL from section 1. Make checking it a habit whenever a
query matters.

**Try it — Project:** (1) print `ToQueryString()` for the `CustomerSummary` projection and read the
`GROUP BY` EF produced; (2) write the transfer example with two `Balance`-carrying rows, throw an
exception between the saves, and verify after rollback that neither change persisted; (3) add the
`Amount` index via a migration, then run `sqlite3 shop.db ".schema Orders"` and find the
`CREATE INDEX` line.

**Traps.**
- `SaveChangesAsync` inside a loop: each call is its own round-trip *and* its own transaction.
  Batch the changes, save once — it's faster and atomic.
- Half-committed workflows: two `SaveChangesAsync` calls without a surrounding transaction means a
  crash between them leaves the first half permanently applied.
- `Include`-everything habit: pulling entity graphs to compute one number ships thousands of rows
  to compute what a projection computes engine-side in one.
- Trusting the LINQ, never reading the SQL. The one time EF translates something surprisingly
  (or fails to translate and you "fix" it by materializing early), only `ToQueryString`/`LogTo`
  will show you.

---

## Check yourself

- Can you sit in `sqlite3` and, unaided, create two FK-linked tables, insert rows, and write a
  LEFT JOIN + GROUP BY answering "count of X per Y" — and explain why the join must be LEFT?
  If yes, tick *SQL foundations* above.
- Can you take a new console project to a working SQLite database — packages, entities, context,
  `migrations add`, `database update` — and say which schema decisions came from convention versus
  your configuration? If yes, tick *EF Core modeling & migrations* above.
- Can you explain what actually executes when a LINQ query materializes, load a relationship with
  `Include`, choose tracking vs `AsNoTracking` deliberately, and spot an N+1 loop in code review?
  If yes, tick *Querying & relationships* above.
- Can you say what `SaveChangesAsync` guarantees, when an explicit transaction is still needed,
  why a projection beats loading entities for reads, and how you'd see the SQL a query generates?
  If yes, tick *Transactions & performance* above.

Four ticks → tick the chapter. Then take **checkpoint cp7** to certify it, and start **project p2**
— the data-backed API that puts this chapter and the ASP.NET Core chapter together (see
*Checkpoints & Defenses*).
