# ASP.NET Core

**ASP.NET Core** is the framework for building web services in C#: programs that sit on a network,
accept requests, and answer them — the backend behind every app and website you use. This chapter
assumes you have never done web development; it teaches HTTP itself first, then the framework. You
will use everything from the core chapters here: records and interfaces (OOP), collections, LINQ,
and above all `async`/`await` — a web server is the async chapter's killer app.

---

## 1. Hosting & minimal API

**The idea.** Strip away every framework and a web server is a loop: listen on a TCP port, accept a
connection, read some bytes, write some bytes back, repeat. The bytes follow a text protocol called
**HTTP**. A client (a browser, a phone app, the `curl` command) sends a **request**:

```text
GET /todos/7?verbose=true HTTP/1.1
Host: localhost:5000
Accept: application/json
```

Line one is the interesting part: a **method** (the verb), a **path** (which resource), and an
optional **query string** after the `?` (extra parameters as `key=value` pairs). Then come
**headers** — `key: value` metadata lines — and, for some requests, a **body** of data. The server
answers with a **response**:

```text
HTTP/1.1 200 OK
Content-Type: application/json

{"id":7,"title":"Learn HTTP","done":false}
```

That first line carries a three-digit **status code**. You need to recognize about eight:

| Code | Meaning |
|---|---|
| `200 OK` | worked; body has the result |
| `201 Created` | worked; a new resource now exists |
| `204 No Content` | worked; nothing to return |
| `400 Bad Request` | the client sent garbage |
| `401` / `403` | who are you? / you specifically may not |
| `404 Not Found` | no such resource |
| `500 Internal Server Error` | the server threw; the client did nothing wrong |

Rule of thumb: **2xx** success, **4xx** client's fault, **5xx** server's fault. The methods have
conventional meanings: `GET` reads (no body, no side effects), `POST` creates or triggers, `PUT`
replaces, `DELETE` deletes. A server that exposes resources this way — nouns in paths, verbs as
methods, results as status codes — is called a **web API**.

Request and response bodies are almost always **JSON** — a text format for structured data that
maps directly onto C# objects: `{}` is an object, `[]` is a list, plus strings, numbers, booleans,
`null`. ASP.NET Core converts between JSON text and your objects automatically
(**serialization**), so you mostly never touch it by hand.

You could write the accept-parse-respond loop yourself; ASP.NET Core exists so you don't. It gives
you **Kestrel** (the built-in production-grade server that does the sockets and HTTP parsing), a
**host** (the long-running process wrapper: config, logging, lifetime), and **routing** (matching a
request's method + path to one of your functions). Your job reduces to: *for this method and path,
run this C# function*. That style — endpoints as plain lambdas, no ceremony — is the **minimal
API**, today's default.

**In practice.** A complete, runnable web service:

```csharp
var builder = WebApplication.CreateBuilder(args);   // 1. configure services & host
var app = builder.Build();                          // 2. build the app (the pipeline)

app.MapGet("/", () => "Todo API is up");

app.MapGet("/todos/{id}", (int id, bool verbose = false) =>
    verbose ? $"todo #{id} (verbose)" : $"todo #{id}");

app.MapGet("/search", (string term) => new { term, hits = new[] { "a", "b" } });

app.Run();                                          // 3. block and serve forever
```

Every ASP.NET Core program has those three phases. `WebApplication.CreateBuilder` sets up defaults
(Kestrel, logging, configuration); between `Build()` and `Run()` you register **endpoints** with
`MapGet` / `MapPost` / `MapPut` / `MapDelete`. Routing fills the lambda's parameters:

- `{id}` in the route is a **route parameter** — matched by name, converted to `int`. A non-numeric
  `/todos/abc` never reaches your code; routing answers `404`.
- `verbose` and `term` don't appear in the route, so they bind from the **query string**
  (`?verbose=true`, `?term=milk`). A default value makes a query parameter optional; without one
  it's required and its absence is a `400`.
- Return a `string` and it goes out as plain text; return any other object (like that anonymous
  object — Atlas: *Anonymous types*) and it's serialized to JSON with `200 OK`.

When a request arrives it flows through the app's **pipeline** — an ordered chain of processing
steps with routing and your endpoint at the end. Section 2 opens that box; for now: request in one
end, your function runs, response out the other.

> **C corner:** Kestrel is the `socket`/`bind`/`listen`/`accept` loop plus an HTTP parser you never
> have to write, and an endpoint is the callback it dispatches to — function-pointer-table style,
> keyed by method + path. One process, many concurrent requests, no fork-per-connection: `async`
> handlers share a small thread pool instead.

**Try it — Project:** (web servers can't run in the Study lab — they never exit — so this chapter
uses real terminal projects)

```bash
dotnet new web -o HelloApi        # smallest template: Program.cs + config, nothing else
cd HelloApi
# replace Program.cs with the snippet above, then:
dotnet run                        # prints: Now listening on: http://localhost:5xxx
```

From a second terminal (use the port yours printed):

```bash
curl http://localhost:5000/todos/7
# todo #7
curl "http://localhost:5000/todos/7?verbose=true"
# todo #7 (verbose)
curl "http://localhost:5000/search?term=milk"
# {"term":"milk","hits":["a","b"]}
curl -i http://localhost:5000/todos/abc     # -i shows status + headers
# HTTP/1.1 404 Not Found ...
```

Add a `DELETE /todos/{id}` endpoint that returns the string `deleted {id}` and hit it with
`curl -X DELETE http://localhost:5000/todos/7` (`-X` sets the method).

**Traps.**

- **Expecting the program to exit.** `app.Run()` blocks forever serving requests — that's the
  point. Stop it with `Ctrl+C`. This is also why these exercises are terminal projects.
- **Quoting.** In a shell, `?` and `&` are special — always quote URLs with query strings:
  `curl "http://…/search?term=milk&max=5"`.
- **Route vs query confusion.** `/todos/{id}` and `/todos?id=7` are different requests. Convention:
  identity goes in the path, options go in the query.
- **`GET` with side effects.** Anything that changes state must not be a `GET` — intermediaries and
  browsers assume `GET` is safe to repeat, cache, and prefetch.

---

## 2. Middleware & DI

**The idea — middleware.** Real services need cross-cutting behavior on *every* request: logging,
error catching, authentication, HTTPS redirects. Instead of pasting that into each endpoint, the
pipeline is built from **middleware**: components arranged like an onion. A request passes inward
through each layer, reaches the endpoint at the center, and the response passes back out through
the same layers in reverse. Each layer can act before calling the next, act after it returns, or
**short-circuit** — answer immediately without calling inward (that's how auth rejects a request
before your code ever runs).

**Order is behavior.** The pipeline runs in exactly the order you register it: an exception handler
must be outermost to catch everything inside; authentication must run before anything that checks
who you are. Reordering middleware is a semantic change, not a style change.

**The idea — dependency injection.** Endpoints need collaborators: a store, a clock, a mailer. The
naive move is `new`-ing them inside each handler — which hard-wires the concrete class (can't swap
a fake in for testing), duplicates construction everywhere, and gives you no control over *how
many* instances exist. **Dependency injection (DI)** inverts it: code *declares* what it needs
(ideally as an interface — OOP chapter), and a **container** — a framework-owned factory that knows
how to build every registered service and what its dependencies are — constructs and supplies it.
You register services once at startup (`builder.Services.Add…`); the container resolves them
wherever they're asked for: endpoint parameters, other services' constructors, middleware.

Each registration picks a **lifetime**:

| Registration | One instance per… | Reach for it when |
|---|---|---|
| `AddSingleton` | the whole process | shared/stateless: caches, clocks, in-memory stores |
| `AddScoped` | one HTTP request | per-request state; database sessions live here later |
| `AddTransient` | every single resolution | cheap stateless helpers |

**In practice.** Timing middleware, an interface-backed store, and a lifetime demo in one app:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ITodoStore, InMemoryTodoStore>();
builder.Services.AddSingleton<SingletonStamp>();
builder.Services.AddScoped<ScopedStamp>();
builder.Services.AddTransient<TransientStamp>();

var app = builder.Build();

app.Use(async (context, next) =>       // custom middleware: time every request
{
    var sw = System.Diagnostics.Stopwatch.StartNew();
    await next();                      // call inward; everything after runs on the way out
    app.Logger.LogInformation("{Method} {Path} -> {Status} in {Ms}ms",
        context.Request.Method, context.Request.Path,
        context.Response.StatusCode, sw.ElapsedMilliseconds);
});

app.MapGet("/todos", (ITodoStore store) => store.All());  // container injects the store

app.MapGet("/lifetimes", (SingletonStamp si, ScopedStamp sc1, ScopedStamp sc2,
                          TransientStamp t1, TransientStamp t2) =>
    new { singleton = si.Id, scoped1 = sc1.Id, scoped2 = sc2.Id,
          transient1 = t1.Id, transient2 = t2.Id });

app.Run();

interface ITodoStore { IEnumerable<string> All(); }
class InMemoryTodoStore : ITodoStore
{
    private readonly List<string> _items = ["learn HTTP", "learn DI"];
    public IEnumerable<string> All() => _items;
}

class SingletonStamp { public Guid Id { get; } = Guid.NewGuid(); }
class ScopedStamp    { public Guid Id { get; } = Guid.NewGuid(); }
class TransientStamp { public Guid Id { get; } = Guid.NewGuid(); }
```

(`Guid.NewGuid()` makes a fresh unique id — a fingerprint per instance. Atlas: *Guid*.)

`curl http://localhost:5000/lifetimes` twice and compare: `singleton` is the **same** value across
both requests (one instance, ever); `scoped1`/`scoped2` equal *each other* within a response but
differ between requests (one per request); `transient1`/`transient2` differ even within one
response (new per resolution). And each request logs a line like:

```text
info: HelloApi[0]
      GET /lifetimes -> 200 in 3ms
```

**The lifetime bug to burn in — the captive dependency.** Suppose `ScopedStamp` were a per-request
database session, injected into a singleton's constructor. The singleton is built once — so it
*captures* the first request's scoped instance and reuses it for every later request:
cross-request data bleed, disposed-object crashes. The rule: **a service must not depend on
anything shorter-lived than itself.** The inverse bug is subtler: registering per-request state (a
"current user" holder) as a singleton means all concurrent requests share one mutable object — a
race, so it only misbehaves under load.

**Try it — Project:** build the app above (`dotnet new web -o LifetimesApi`), verify the three
lifetime behaviors with two `curl /lifetimes` calls, and watch the timing log. Then deliberately
create the captive bug — give `SingletonStamp` a constructor parameter `ScopedStamp scoped` — and
run: ASP.NET Core's container validates lifetimes at startup in Development and dies with
`Cannot consume scoped service 'ScopedStamp' from singleton 'SingletonStamp'`. Read that error
carefully; meeting it here is cheaper than in production.

**Traps.**

- **Middleware order.** Register the exception handler first (outermost), endpoint mapping last.
  Auth-before-authz. When behavior is inexplicable, read your pipeline top to bottom.
- **Forgetting `await next()`** in custom middleware short-circuits everything inside — every
  request "hangs" or returns an empty `200` and no endpoint ever runs.
- **Captive dependency** — see above. Startup validation catches direct constructor cases; it
  cannot catch you manually stashing a scoped object in a static field. Don't.
- **Registering the class, asking for the interface.** `AddSingleton<InMemoryTodoStore>()` then
  injecting `ITodoStore` fails — the container resolves by *registered* type. Register the pair:
  `AddSingleton<ITodoStore, InMemoryTodoStore>()`.

---

## 3. Binding, DTOs & validation

**The idea.** Section 1 showed parameters binding from route and query. **Model binding** is the
full version of that machinery: for each parameter of your handler, the framework picks a
**source** — route values, query string, headers, or the JSON **body** — and converts the raw text
into typed C#. The rules for minimal APIs: simple types (`int`, `string`, `bool`, `DateOnly`…)
bind from route if the name matches a route parameter, else from query; one complex type (a class
or record) binds from the JSON body; registered services bind from the DI container. You can force
a source with attributes like `[FromHeader]` when inference isn't what you want.

The complex-type-from-body rule raises a design question: *which* type? Never your internal domain
object. Define a **DTO** (data transfer object) — a type that exists solely to describe what
crosses the wire — separate from the domain type you compute with. The boundary buys you three
things:

1. **Security.** Clients can only set fields the DTO has. If your domain `Todo` had an `IsAdmin`
   or `OwnerId` field and you bound it directly, any client could POST a value for it
   (**over-posting**). A `CreateTodo` DTO without the field makes that impossible by construction.
2. **Stability.** The DTO is your public contract; the domain model is yours to refactor. Couple
   them and every internal rename breaks every client.
3. **Fit.** Input shape (`title` only) rarely equals stored shape (`Id`, `CreatedAt`, `Done`…).

`record` types (OOP chapter) are the natural DTO: concise, immutable, value-equal. One per
direction — a `CreateTodo` in, a `TodoResponse` out.

Binding checks *shape* — "is this an `int`, is the JSON well-formed". **Validation** checks
*meaning* — "is the title non-empty and under 120 chars". Since .NET 10, minimal APIs validate
automatically using **data annotation** attributes from `System.ComponentModel.DataAnnotations`
(`[Required]`, `[StringLength]`, `[Range]`, `[EmailAddress]`) on DTO properties; invalid input is
rejected with a `400` before your handler runs.

> ⚠ **Fast-moving area.** Built-in minimal-API validation (`AddValidation`) landed in .NET 10 and
> its enabling steps (a NuGet package plus a source-generator property in the `.csproj`) have
> shifted between previews. The concepts below are stable; verify names/versions against
> learn.microsoft.com before relying on them.

**In practice.** This section also upgrades our return values to **`TypedResults`** — the modern
way to produce responses. `TypedResults.Ok(todo)`, `TypedResults.Created(url, todo)`,
`TypedResults.NotFound()` each return a distinct *type*, and the handler declares
`Results<Ok<T>, NotFound>` — a union of exactly the outcomes it can produce. The compiler stops
you returning anything else, and OpenAPI (section 5) can document your responses without you
writing anything. (The older `Results.Ok(…)` returns an opaque `IResult`; prefer `TypedResults`.)

```csharp
using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddValidation();          // enable minimal-API validation (.NET 10)
builder.Services.AddSingleton<TodoStore>();
var app = builder.Build();

app.MapGet("/todos/{id}", Results<Ok<TodoResponse>, NotFound> (int id, TodoStore store) =>
    store.Find(id) is { } todo
        ? TypedResults.Ok(ToResponse(todo))
        : TypedResults.NotFound());

app.MapPost("/todos", Created<TodoResponse> (CreateTodo dto, TodoStore store) =>
{
    var todo = store.Add(dto.Title, dto.Due);
    return TypedResults.Created($"/todos/{todo.Id}", ToResponse(todo));
});

app.Run();

static TodoResponse ToResponse(Todo t) => new(t.Id, t.Title, t.Done, t.Due);

// the wire contract (DTOs):
record CreateTodo([property: Required, property: StringLength(120)] string Title, DateOnly? Due);
record TodoResponse(int Id, string Title, bool Done, DateOnly? Due);

// the domain + store (internal; clients never see these directly):
record Todo(int Id, string Title, bool Done, DateOnly? Due);
class TodoStore
{
    private readonly List<Todo> _items = [];
    private int _nextId = 1;
    public Todo? Find(int id) => _items.FirstOrDefault(t => t.Id == id);
    public Todo Add(string title, DateOnly? due)
    {
        var todo = new Todo(_nextId++, title, false, due);
        _items.Add(todo);
        return todo;
    }
}
```

(`[property: …]` targets the attribute at the record's generated property rather than the
constructor parameter — required for validation attributes on positional records. `is { }` is a
property pattern meaning "not null, and bind it" — Fundamentals chapter. The store isn't
thread-safe; fine for an exercise, and the real database arrives in a later chapter.)

Exercise the API:

```bash
curl -i -X POST http://localhost:5000/todos \
     -H "Content-Type: application/json" \
     -d '{"title":"write a DTO","due":"2026-08-01"}'
# HTTP/1.1 201 Created
# Location: /todos/1
# {"id":1,"title":"write a DTO","done":false,"due":"2026-08-01"}

curl -i -X POST http://localhost:5000/todos \
     -H "Content-Type: application/json" -d '{"title":""}'
# HTTP/1.1 400 Bad Request
# {"title":"One or more validation errors occurred.","status":400,
#  "errors":{"Title":["The field Title must be a string with a maximum length of 120."]}}
```

The `-d` flag sends a request body; `-H "Content-Type: application/json"` labels it. The `400`
body is a **ProblemDetails** shape — section 4's subject.

**Where FluentValidation fits.** Data annotations cover per-property rules. For rules that don't
fit an attribute — cross-field ("`Due` must be in the future *if* `Done` is false"), conditional,
or database-consulting checks — the community-standard **FluentValidation** package lets you write
rules as code (`RuleFor(x => x.Title).NotEmpty().MaximumLength(120)`) in a validator class,
keeping DTOs clean. Reach for it when attributes start fighting you; don't start there.

> **C corner:** a DTO is the packed struct you'd define for a wire protocol, with the framework as
> your (de)serializer — except unmet expectations become a structured `400`, not memory garbage.
> Validation-at-the-boundary is the same discipline as checking every input at a library's public
> API, enforced declaratively.

**Try it — Project:**

```bash
dotnet new webapi -o TodoApi      # webapi template: like 'web' plus OpenAPI wiring (section 5)
cd TodoApi
# replace Program.cs with the snippet above, then:
dotnet run
```

Run the two `curl` POSTs above, then `curl -i http://localhost:5000/todos/1` (expect `200`) and
`/todos/99` (expect `404`). Extend it: add `[Range(1, 5)] int Priority` to `CreateTodo`, POST a
priority of `9`, and read the `errors` object you get back.

**Traps.**

- **Binding one domain type both directions.** The moment `Todo` grows a sensitive field, every
  POST endpoint bound to it is an over-posting hole. DTO in, DTO out, always.
- **Attributes on positional records without `[property: …]`** — they land on the constructor
  parameter and (for some tooling) silently do nothing. If validation "isn't firing", check this
  first.
- **Validating only the body.** Route and query values deserve rules too (`[Range]` on an `int
  page`); .NET 10's validation covers those parameters as well.
- **Two complex parameters.** Only one parameter can bind from the body; a second complex type
  causes a startup or runtime error. Wrap them in one DTO.

---

## 4. Errors & ProblemDetails

**The idea.** Your code will throw. Without a plan, an unhandled exception becomes some default
`500` — maybe empty, maybe a stack trace you must never show real clients — and every error your
API emits has a different shape, so every client grows ad-hoc parsing per failure. The fixes:

1. **A standard error shape.** RFC 9457 (which obsoletes RFC 7807 — same design, newer number)
   defines **ProblemDetails**: a JSON object with `type` (a URI identifying the error kind),
   `title`, `status`, `detail`, `instance`, plus any extra fields. One shape for *all* failures —
   validation, not-found, crashes — means clients parse errors once. You already met it: section
   3's validation `400` was a ProblemDetails body.
2. **Exception-handling middleware, outermost.** One layer wraps the whole pipeline in a
   try/catch and converts any escaping exception into a ProblemDetails `500` — so endpoints don't
   wrap themselves in try/catch, and *expected* failures stay non-exceptional: return
   `TypedResults.NotFound()`, don't throw.

ASP.NET Core ships the pieces: `AddProblemDetails()` registers **`IProblemDetailsService`** — the
service that writes ProblemDetails responses, which built-in middleware (and you, if you write
middleware) call so the format stays consistent app-wide. `UseExceptionHandler()` is the catching
middleware; `UseStatusCodePages()` upgrades bare status-code responses (like routing's empty
`404`) to ProblemDetails bodies. For custom mapping — *this* exception type should be a `409
Conflict` — implement **`IExceptionHandler`**: the exception handler middleware runs each
registered handler in order until one returns `true` ("handled").

**In practice.**

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ConflictExceptionHandler>();
var app = builder.Build();

app.UseExceptionHandler();      // outermost: catches everything below
app.UseStatusCodePages();       // gives bare 404s/405s a ProblemDetails body

app.MapGet("/boom", () => { throw new InvalidOperationException("kaboom"); });
app.MapGet("/taken", () => { throw new DuplicateNameException("that name is taken"); });

app.Run();

class DuplicateNameException(string message) : Exception(message);

class ConflictExceptionHandler(Microsoft.AspNetCore.Diagnostics.IProblemDetailsService problems)
    : Microsoft.AspNetCore.Diagnostics.IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken ct)
    {
        if (exception is not DuplicateNameException dup) return false;  // not mine; next handler

        context.Response.StatusCode = StatusCodes.Status409Conflict;
        return await problems.TryWriteAsync(new() {
            HttpContext = context,
            ProblemDetails = new() { Title = "Conflict", Detail = dup.Message, Status = 409 }
        });
    }
}
```

(`ValueTask` is a lightweight `Task` for hot paths — Async chapter. The class-with-parameters
syntax is a primary constructor — OOP chapter.)

```bash
curl -i http://localhost:5000/taken
# HTTP/1.1 409 Conflict
# Content-Type: application/problem+json
# {"title":"Conflict","status":409,"detail":"that name is taken"}

curl -i http://localhost:5000/boom
# HTTP/1.1 500 Internal Server Error
# {"type":"https://tools.ietf.org/html/rfc9110#section-15.6.1",
#  "title":"An error occurred while processing your request.","status":500}
```

Note the `Content-Type: application/problem+json` — the format's own media type — and note what
the `500` body does *not* contain: no exception message, no stack trace. Exception details are for
your logs (section 5); the wire gets the sanitized shape. Handlers can also *return* problems
explicitly for expected failures: `TypedResults.Problem(detail: "…", statusCode: 422)` or
`TypedResults.ValidationProblem(errorsDictionary)`.

**Try it — Project:** build the app above (`dotnet new web -o ErrorsApi`), hit `/boom`, `/taken`,
and a nonexistent `/nope`, and check all three return ProblemDetails with the right status. Then
comment out `app.UseExceptionHandler()` and `AddExceptionHandler<…>()`, hit `/boom` again in
Development, and compare — you'll get the developer exception page's raw dump, which is exactly
what the handler exists to keep off the wire in production.

**Traps.**

- **Throwing for expected outcomes.** "Not found" on a lookup is a normal result — return
  `TypedResults.NotFound()`. Exceptions are for the genuinely exceptional; they're also slow.
- **Leaking internals.** Never copy `exception.Message` (let alone `.ToString()`) into a `500`
  body — messages routinely contain connection strings, paths, and table names. Log the
  exception; send the generic problem.
- **Handler order.** `UseExceptionHandler` only catches what runs *after* it — register it before
  (outside) everything else. Middleware registered above it crashes unprotected.
- **Inventing a bespoke error JSON.** `{"error":"..."}` works until your API has two kinds of
  failure and three clients. The standard shape exists; every ecosystem tool understands it.

---

## 5. Config, logging, OpenAPI, tests

**The idea.** Four habits that separate a demo from a service:

**Configuration.** Values that vary by machine or environment — ports, connection strings, feature
flags — live outside code. The host layers sources into one `IConfiguration`, later overriding
earlier: `appsettings.json` → `appsettings.{Environment}.json` (the environment is a name like
`Development` or `Production`, from the `ASPNETCORE_ENVIRONMENT` variable) → environment variables
→ command-line args. So a JSON key `Todo:MaxPerUser` (`:` separates nesting levels) can be
overridden in production by an env var `Todo__MaxPerUser` (double underscore, since `:` isn't
shell-safe) without touching a file. Rather than pulling strings out by key all over the codebase,
use the **options pattern**: define a plain class mirroring a config section, bind it once, and
inject `IOptions<T>` (a tiny wrapper; its `.Value` is your populated class) wherever it's needed —
typed, validated at startup, testable.

**Logging.** `Console.WriteLine` has no levels, no context, no off-switch. Inject `ILogger<T>`
(the `T` — usually the containing class — tags each entry with its source, called the *category*)
and log **structured** messages: `logger.LogInformation("Todo {TodoId} created by {User}", id,
user)`. The `{TodoId}` placeholder isn't string interpolation — the template and values are kept
*separately*, so a log backend can index them and you can later query "all events where
`TodoId == 7`". Levels (`Trace`/`Debug`/`Information`/`Warning`/`Error`/`Critical`) are filtered
per-category via configuration — the `Logging` section you'll see in `appsettings.json` — so
verbosity is a config change, not a code change.

**OpenAPI.**

> ⚠ **Fast-moving area.** OpenAPI tooling churns: templates before .NET 9 bundled the third-party
> Swashbuckle/Swagger packages, which current templates replaced with the built-in
> `Microsoft.AspNetCore.OpenApi` (`AddOpenApi`/`MapOpenApi`), and interactive-UI options keep
> shifting. The concepts below are stable; verify names/versions against learn.microsoft.com
> before relying on them.

An **OpenAPI document** is a machine-readable JSON description of your whole API — every path,
method, parameter, DTO schema, and response code. From it, tools generate typed client libraries,
interactive test UIs, and diff-checks that fail CI when you break the contract. ASP.NET Core
generates it from your endpoints at runtime: the `dotnet new webapi` template already contains
`builder.Services.AddOpenApi()` and (Development-only, to avoid exposing your API's map in
production) `app.MapOpenApi()`, which serves the document at `/openapi/v1.json`. This is where
section 3's `TypedResults` pays off again: declared result types flow straight into the document
as documented response codes and schemas. The document is data, not a UI; if you want a browsable
test page, packages like Swashbuckle's SwaggerUI or Scalar render one *from* it — older tutorials
mentioning "Swagger" are describing that combination.

**Integration tests.** Unit tests (test a class directly) can't tell you that routing, binding,
validation, middleware, and serialization compose correctly — that requires driving real HTTP
through the real pipeline. **`WebApplicationFactory<T>`** (from the
`Microsoft.AspNetCore.Mvc.Testing` package) boots your actual `Program` **in memory** — no port,
no network, no separate process — and hands you an `HttpClient` whose requests go straight into
the pipeline. Same `builder`/`Build()`/endpoints as production, minus the socket. It can also
override DI registrations per-test (swap the real database for a fake) — DI's testability promise,
cashed at the API level.

**In practice.** Config + options + logging in the API; then a test project against it.

`appsettings.json` (already in your project — add the `Todo` section):

```json
{
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } },
  "Todo": { "MaxPerUser": 3 }
}
```

`Program.cs`:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddOpenApi();
builder.Services.Configure<TodoOptions>(builder.Configuration.GetSection("Todo"));
var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();                        // serves /openapi/v1.json

app.MapGet("/limit",
    (Microsoft.Extensions.Options.IOptions<TodoOptions> opts,
     ILogger<Program> logger) =>
{
    logger.LogInformation("Limit requested; current limit is {Limit}", opts.Value.MaxPerUser);
    return new { maxPerUser = opts.Value.MaxPerUser };
});

app.Run();

class TodoOptions { public int MaxPerUser { get; set; } = 10; }

public partial class Program;   // exposes the app's entry point to the test project below
```

(Top-level statements compile into a generated `Program` class; that last line makes it `public`
so `WebApplicationFactory<Program>` can reference it.)

```bash
curl http://localhost:5000/limit
# {"maxPerUser":3}                          <- from appsettings.json
Todo__MaxPerUser=99 dotnet run              # env var overrides the file
curl http://localhost:5000/limit
# {"maxPerUser":99}
curl http://localhost:5000/openapi/v1.json  # the generated OpenAPI document
```

The test project (assuming the API lives in `ConfigApi/`):

```bash
dotnet new xunit -o ConfigApi.Tests
cd ConfigApi.Tests
dotnet add reference ../ConfigApi/ConfigApi.csproj
dotnet add package Microsoft.AspNetCore.Mvc.Testing
```

`UnitTest1.cs` (xUnit — the standard .NET test framework: `[Fact]` marks a test; `Assert.*`
checks outcomes; `dotnet test` discovers and runs them):

```csharp
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

public class LimitEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public LimitEndpointTests(WebApplicationFactory<Program> factory)
        => _client = factory.CreateClient();      // in-memory client into the real pipeline

    [Fact]
    public async Task Limit_returns_configured_value()
    {
        var response = await _client.GetAsync("/limit");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LimitDto>();
        Assert.Equal(3, body!.MaxPerUser);
    }

    private record LimitDto(int MaxPerUser);
}
```

(`IClassFixture<T>` is xUnit's "share one `T` across this class's tests" hook — the factory boots
your app once, not per test. `ReadFromJsonAsync<T>` deserializes a response body into a DTO.)

```bash
dotnet test
# Passed!  - Failed: 0, Passed: 1, Skipped: 0, Total: 1
```

**Try it — Project:** assemble exactly the above — `dotnet new webapi -o ConfigApi`, the `Todo`
config section, the `/limit` endpoint, the test project — until `dotnet test` is green. Then
demonstrate a contract test's value: change the endpoint to return `{ max = … }` instead of
`{ maxPerUser = … }` and watch the test fail. That failure is an integration test catching an API
contract break before a client does.

**Traps.**

- **Secrets in `appsettings.json`.** The file is committed to git. Real secrets go in environment
  variables, `dotnet user-secrets` (a per-developer local store), or a vault service — the layered
  config system means code reads them identically either way.
- **Interpolating into log templates.** `LogInformation($"todo {id}")` destroys structure — the
  backend sees one opaque string. Always placeholders + arguments: `LogInformation("todo
  {TodoId}", id)`.
- **`Program` not visible to tests.** Forget `public partial class Program;` and the test project
  fails to compile with an inaccessibility error — the fix is that one line, not `InternalsVisibleTo`
  gymnastics.
- **Testing against a run in a terminal.** `WebApplicationFactory` boots its own in-memory
  instance; `dotnet run` need not (and shouldn't) be running when you `dotnet test`.

---

## Check yourself

One honest question per topic — answer without looking, then tick.

1. Could you explain what happens between `curl` printing nothing and a JSON body appearing — the
   request line, methods, status code families — and stand up a two-endpoint minimal API with a
   route parameter and a query parameter? If yes, tick *Hosting & minimal API* above.
2. Could you say why middleware order matters (with the exception-handler example), state what the
   three service lifetimes mean per-request, and describe the captive-dependency bug from memory?
   If yes, tick *Middleware & DI* above.
3. Could you defend the DTO/domain boundary to a skeptic (over-posting, contract stability), and
   wire a validated record DTO that turns bad input into a `400` before your handler runs? If
   yes, tick *Binding, DTOs & validation* above.
4. Could you sketch a ProblemDetails body from memory and explain why the exception middleware
   sits outermost and why `exception.Message` never belongs in a `500`? If yes, tick *Errors &
   ProblemDetails* above.
5. Could you override a config value with an environment variable, explain what makes a log
   message "structured", say what an OpenAPI document is *for*, and describe what
   `WebApplicationFactory` boots and doesn't boot? If yes, tick *Config, logging, OpenAPI, tests*
   above.

All five ticked? Tick the chapter. Then take **checkpoint cp6** — see *Checkpoints & Defenses* —
where you'll build and defend a small API end to end. The next chapters give your endpoints a real
database and a place to run.
