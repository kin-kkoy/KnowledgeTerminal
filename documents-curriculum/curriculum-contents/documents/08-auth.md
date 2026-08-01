# Auth (AuthN + AuthZ)

Two words that sound alike and do different jobs. **Authentication (AuthN)** answers *who are you?*
**Authorization (AuthZ)** answers *what may you do?* This chapter teaches both from zero, then locks
down the to-do API you built in the *ASP.NET Core* and *SQL & EF Core* chapters. Auth is where an API
stops being a toy — and where mistakes cost the most, so the rule throughout is: understand the
mechanism, then use the library.

---

## 1. Authentication & JWT

> ⚠ **Fast-moving area.** Token-issuing APIs churn: `JwtSecurityTokenHandler` is being superseded by
> `JsonWebTokenHandler`, and ASP.NET Core Identity's built-in endpoints (`MapIdentityApi`) have
> evolved every release since .NET 8. The concepts below are stable; verify names/versions against
> learn.microsoft.com before relying on them.

### The idea

HTTP is **stateless** — you saw this in the *ASP.NET Core* chapter: every request is a fresh
envelope; the server has no memory of the previous one. So if a user "logs in", how does request
#2 know it's the same person? Two classic answers:

**Sessions (the older answer).** On login, the server generates a random ID, stores
"ID → this user" in server memory or a database, and hands the ID to the client in a **cookie** (a
small value the browser automatically re-sends with every request to that site). Each request looks
the ID up. It works, but the server must *keep state* for every logged-in user, and every request
costs a lookup. With multiple servers behind a load balancer, they must all share that session store.

**Tokens (the common answer for APIs).** On login, the server hands the client a **signed statement**:
"this is user 42, they're an Admin, this expires at 15:00 — signed, the server." The client stores it
and attaches it to every request in a header:

```text
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

The server doesn't remember anything. It just **verifies the signature** — a fast cryptographic
check with its secret key. If the signature is valid, the statement inside must be genuine, because
only someone holding the key could have produced it. No session table, no shared store; any server
with the key can verify. That's why tokens scale and why APIs use them.

The standard token format is the **JWT** (JSON Web Token, said "jot"). A JWT is three base64url-encoded
chunks joined by dots — `header.payload.signature`:

```text
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9        ← header
.eyJzdWIiOiI0MiIsIm5hbWUiOiJhZGEiLCJyb2xlIjoiQWRtaW4iLCJleHAiOjE3NjkwNDAwMDB9   ← payload
.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c   ← signature
```

Decode the first two chunks (base64url is just an encoding, **not** encryption — anyone can decode
it) and you get plain JSON:

```json
{ "alg": "HS256", "typ": "JWT" }
```

```json
{ "sub": "42", "name": "ada", "role": "Admin", "exp": 1769040000 }
```

- The **header** says which signing algorithm was used (here HS256 = HMAC with SHA-256, a symmetric
  scheme: the same secret key signs and verifies).
- The **payload** is a set of **claims** — individual facts about the user. `sub` (subject) is the
  user's ID, `exp` is the expiry as a Unix timestamp; `name` and `role` are whatever the issuer chose
  to include. Claims are the currency of the whole auth system: after login, "the user" *is* their
  set of claims.
- The **signature** is computed over the first two chunks with the secret key. Change one character
  of the payload and the signature no longer matches — the server rejects the token. That's the whole
  trick: the payload is *readable by anyone* but *forgeable by no one* without the key.

Burn this in: **a JWT is tamper-proof, not secret.** Never put a password, an API key, or anything
private in the payload. And whoever *holds* a token *is* that user until it expires — which is why
tokens travel only over HTTPS (section 3) and are kept short-lived.

**The middleware handshake.** In the *ASP.NET Core* chapter you saw the middleware pipeline. Auth
adds two stations:

1. `UseAuthentication()` — reads the `Authorization` header, verifies the JWT's signature and
   expiry, and turns the claims into a `ClaimsPrincipal` object hung on `HttpContext.User`. It
   *identifies*; it never rejects.
2. `UseAuthorization()` — later in the pipeline, checks that user against whatever rules the
   endpoint declares (section 2), and short-circuits with **401 Unauthorized** (not authenticated —
   "who even are you?") or **403 Forbidden** (authenticated, but not allowed).

In current ASP.NET Core, registering the services is enough — the framework inserts both middleware
automatically in the right order. You only call `UseAuthentication()`/`UseAuthorization()` yourself
when you need to control *where* in the pipeline they sit.

### In practice

A complete minimal API that issues JWTs on login and protects an endpoint. One NuGet package on top
of the web template:

```bash
dotnet new web -o AuthDemo && cd AuthDemo
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

`Program.cs`, whole file:

```csharp
using System.IdentityModel.Tokens.Jwt;   // JwtSecurityToken — builds/serializes JWTs
using System.Security.Claims;            // Claim, ClaimTypes
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;    // SymmetricSecurityKey, SigningCredentials

var builder = WebApplication.CreateBuilder(args);

// Demo key. Real apps load this from configuration, never source code (section 3).
var key = new SymmetricSecurityKey(
    Encoding.UTF8.GetBytes("a-demo-signing-key-at-least-32-bytes-long!"));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)  // "Bearer"
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidIssuer = "authdemo",          // who mints tokens we trust
            ValidAudience = "authdemo-api",    // who the tokens are for
            IssuerSigningKey = key,            // the key to verify signatures with
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// POST /login — check credentials, mint a token. (Real password checking: section 3.)
app.MapPost("/login", (LoginDto dto) =>
{
    if (dto is not { Username: "ada", Password: "correct-horse" })
        return Results.Unauthorized();

    var token = new JwtSecurityToken(
        issuer: "authdemo",
        audience: "authdemo-api",
        claims:
        [
            new Claim(JwtRegisteredClaimNames.Sub, "42"),   // user id
            new Claim(JwtRegisteredClaimNames.Name, dto.Username),
            new Claim(ClaimTypes.Role, "Admin"),
        ],
        expires: DateTime.UtcNow.AddMinutes(30),            // short-lived on purpose
        signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

    return Results.Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token) });
});

// A protected endpoint. ClaimsPrincipal is injected from HttpContext.User.
app.MapGet("/me", (ClaimsPrincipal user) =>
        new { name = user.Identity!.Name, claims = user.Claims.Select(c => new { c.Type, c.Value }) })
   .RequireAuthorization();

app.Run();

record LoginDto(string Username, string Password);
```

Every piece here is either from earlier chapters (`MapPost`, `record`, DTO binding — *ASP.NET Core*)
or new and now explained: `SymmetricSecurityKey` wraps the raw key bytes; `SigningCredentials` pairs
the key with an algorithm; `JwtSecurityToken` assembles header + payload; the handler's
`WriteToken` serializes it to the dotted string; `TokenValidationParameters` tells the middleware
what a *valid* incoming token must contain. Issuer and audience are themselves claims (`iss`, `aud`)
that stop a token minted for some *other* API from being replayed against yours.

The flow over the wire (`curl -s` from the *ASP.NET Core* chapter):

```bash
# 1. No token → the authorization middleware stops you before your code runs:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5000/me
# 401

# 2. Log in, get a token:
curl -s -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ada","password":"correct-horse"}'
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsIm5hbWUiOiJhZGEi..."}

# 3. Present it:
curl -s http://localhost:5000/me -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs...<full token>"
# {"name":"ada","claims":[{"type":"...nameidentifier","value":"42"},...]}
```

Two footnotes you'll meet in the wild, then never be surprised by:

- **`dotnet user-jwts`** — a dev-only CLI (`dotnet user-jwts create --role admin`) that mints local
  test tokens and wires the matching validation settings into your project, so you can build the
  *protected* side before the *login* side exists.
- **`MapIdentityApi<TUser>()`** — ASP.NET Core Identity (the framework's full user system, section 3)
  can auto-map `/register`, `/login`, `/refresh` and friends. Note: those endpoints issue *opaque*
  bearer tokens by default, not JWTs — same `Authorization: Bearer` usage, but the token is a
  server-decodable blob rather than readable JSON. Concept identical; format different.

> **C corner:** the signature is the same idea as a checksum over a struct you're sending across a
> wire — except an attacker can recompute a plain checksum after tampering. An HMAC mixes a secret
> key into the hash, so recomputing it requires the key. `ClaimsPrincipal` is roughly a
> `struct user { struct claim *claims; }` the middleware builds for you per-request.

### Try it — Project

1. `dotnet new web -o AuthDemo && cd AuthDemo`, add the JwtBearer package, paste `Program.cs` above.
2. `dotnet run`, note the port it prints (substitute it below for 5000).
3. Run the three curl calls above; confirm 401 → token → claims JSON.
4. Dissect your token: copy the middle chunk (between the dots) and decode it —
   `echo '<middle-chunk>' | base64 -d` (add one or two `=` at the end if base64 complains about
   padding). Read your own claims, find `exp`.
5. Tamper: change one letter anywhere in the token and repeat step 3's call — 401. The signature no
   longer matches.

### Traps

- **"It's encrypted, right?"** No. Base64url is an encoding; anyone can read a JWT's payload. It is
  signed (tamper-proof), not encrypted (secret). Never put secrets in claims.
- **A JWT can't be revoked.** Once issued, it's valid until `exp` — the server keeps no record it
  could delete. Mitigation: short lifetimes (minutes, not days) plus a refresh mechanism. If you need
  instant "log out everywhere", tokens alone can't give it to you.
- **401 vs 403 confusion.** 401 = no/invalid credentials ("log in first"). 403 = valid credentials,
  insufficient rights ("logged in, still no"). Getting these backwards makes clients unfixable.
- **Clock skew.** `exp` is checked against the *server's* clock, with a default 5-minute grace
  window. If tokens seem to outlive their expiry in tests, that window is why.

---

## 2. Authorization

### The idea

Authentication ended with a `ClaimsPrincipal` on `HttpContext.User`. Authorization is the second
question: given *this* user, is *this* action allowed? ASP.NET Core gives you a ladder of mechanisms,
each for a different shape of rule:

1. **"Any authenticated user"** — the door is locked but any keyholder may enter.
2. **Roles** — a coarse label carried as a claim (`Admin`, `Editor`). Good for broad tiers of user.
3. **Policies** — named rules evaluated against the user's claims ("has claim X", "role Y or Z").
   Declared once, applied by name; the rule's logic lives in one place instead of sprinkled through
   endpoints.
4. **Requirements + handlers** — when a policy needs *code*, not just claim-matching: you define a
   requirement class and a handler class that decides whether it's met.
5. **Resource-based** — the rule depends on the *data*, not just the user: "you may edit this todo
   only if it's *yours*." No attribute can express that, because the middleware runs before your code
   loads the todo from the database. You check it inside the handler, after the fetch.

The first four are **declarative** — stated on the endpoint, enforced by the middleware before your
code runs. The fifth is **imperative** — your code asks. Real APIs use both: declarative for "must be
logged in / must be staff", imperative for ownership.

### In practice

The declarative ladder on minimal API endpoints (controllers use the `[Authorize]` attribute for the
same thing — `[Authorize]`, `[Authorize(Roles = "Admin")]`, `[Authorize(Policy = "CanDelete")]`):

```csharp
builder.Services.AddAuthorization(options =>
{
    // A named policy: claim-matching, no code needed.
    options.AddPolicy("CanDelete", policy => policy.RequireRole("Admin", "Moderator"));

    // A policy backed by a custom requirement (handler below).
    options.AddPolicy("Adult", policy => policy.AddRequirements(new MinimumAgeRequirement(18)));
});

app.MapGet("/todos",       GetTodos).RequireAuthorization();                // rung 1: logged in
app.MapGet("/admin/stats", GetStats).RequireAuthorization(p => p.RequireRole("Admin")); // rung 2
app.MapDelete("/todos/{id}", DeleteTodo).RequireAuthorization("CanDelete"); // rung 3: by name
```

A **requirement** is a marker class carrying the rule's parameters; a **handler** is the code that
judges it. The handler is registered in DI (the *ASP.NET Core* chapter's dependency injection) and
the framework calls it whenever the policy is evaluated:

```csharp
using Microsoft.AspNetCore.Authorization;

public class MinimumAgeRequirement(int minimumAge) : IAuthorizationRequirement
{
    public int MinimumAge { get; } = minimumAge;
}

public class MinimumAgeHandler : AuthorizationHandler<MinimumAgeRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context, MinimumAgeRequirement requirement)
    {
        var birthClaim = context.User.FindFirst("birthdate");   // claim set at token-issue time
        if (birthClaim is not null &&
            DateTime.TryParse(birthClaim.Value, out var birth) &&
            birth.AddYears(requirement.MinimumAge) <= DateTime.UtcNow)
        {
            context.Succeed(requirement);   // rule met
        }
        return Task.CompletedTask;          // saying nothing = rule not met = 403
    }
}

// registration, next to AddAuthorization:
builder.Services.AddSingleton<IAuthorizationHandler, MinimumAgeHandler>();
```

Note the shape: a handler *succeeds* or *stays silent* — it doesn't "fail" (another handler for the
same requirement might still succeed, e.g. an alternative way to prove age).

**Resource-based authorization** — the ownership check. Assume the `Todo` entity from the *SQL & EF
Core* chapter grew a `UserId` column. The straightforward, load-then-check pattern:

```csharp
app.MapPut("/todos/{id}", async (int id, TodoUpdateDto dto, ClaimsPrincipal user, TodoDb db) =>
{
    var todo = await db.Todos.FindAsync(id);
    if (todo is null) return Results.NotFound();

    // "sub" from the JWT is surfaced as NameIdentifier by default:
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
    if (todo.UserId != userId) return Results.NotFound();   // not yours → pretend it doesn't exist

    todo.Title = dto.Title;
    todo.IsDone = dto.IsDone;
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();   // declarative gate first, imperative check inside
```

Returning **404 instead of 403** for someone else's todo is deliberate: a 403 confirms "id 17 exists
but isn't yours", letting an attacker map your data by iterating ids. 404 tells them nothing. (Larger
apps centralize such checks with the injectable `IAuthorizationService` and a resource-aware handler,
so "may edit this todo" is defined once; the inline check above is the same logic in one place.)

Wire responses at each rung:

```text
GET /admin/stats   with no token            → 401 Unauthorized
GET /admin/stats   token, role "User"       → 403 Forbidden
GET /admin/stats   token, role "Admin"      → 200 OK
PUT /todos/7       token, someone else's 7  → 404 Not Found
PUT /todos/7       token, your own 7        → 204 No Content
```

### Try it — Project

1. In `AuthDemo`, add the `Adult` policy, requirement, handler, and registration above, plus an
   endpoint: `app.MapGet("/bar", () => "cheers").RequireAuthorization("Adult");`
2. In `/login`, add `new Claim("birthdate", "2010-01-01")` to the claims list. `dotnet run`.
3. Log in, call `/bar` with the token — **403** (a 16-year-old).
4. Change the claim to `"2000-01-01"`, restart, log in again (old token still has the old claim —
   note that), call `/bar` — **200**, `cheers`.
5. Add `/admin/stats` gated on `RequireRole("Admin")`; verify your token's `role` claim opens it,
   then remove the role claim from `/login` and confirm 403.

### Traps

- **Checking authorization client-side only.** Hiding a button in the UI is not security; the API
  endpoint must enforce the rule. Attackers use curl, not your frontend.
- **Roles for everything.** "Owner of todo 17" is not a role. If you find yourself minting roles like
  `Editor_Of_Project_9`, you needed resource-based checks.
- **Stale claims.** Claims are snapshotted into the token at login. Promote a user to Admin and their
  *existing* token still says otherwise until it expires and they get a new one. Same in reverse —
  demotion doesn't bite until expiry. Short lifetimes limit the damage.
- **Forgetting the gate entirely.** One unguarded `MapDelete` and nothing else matters. Habit: every
  endpoint gets `RequireAuthorization(...)` *or* an explicit, deliberate `AllowAnonymous()` — no
  silent defaults.

---

## 3. Security hardening

> ⚠ **Fast-moving area.** Hashing parameters (iteration counts), TLS versions, and secrets tooling
> are moving targets — today's "slow enough" is next year's "too fast". The concepts below are
> stable; verify names/versions against learn.microsoft.com and OWASP before relying on them.

### The idea

**Passwords: never store them.** Not encrypted, either — encryption is reversible, and the key would
sit on the same server the attacker just breached. Store a **hash**: a one-way transform. At login,
hash the attempt and compare hashes; the original is never kept, so a leaked database doesn't leak
passwords. Two refinements make it actually safe:

- **Salt** — a random value generated per user, stored alongside the hash, mixed into it. Without
  salt, two users with password `hunter2` share a hash, and attackers use *rainbow tables*
  (precomputed hash→password lookups covering billions of common passwords) to reverse them all at
  once. Salt makes every hash unique and every attack start from scratch.
- **Slowness — on purpose.** SHA-256 is a fine *integrity* hash but a terrible *password* hash,
  because it's fast: a GPU rig computes billions per second, so an 8-character password falls in
  hours. Password hashing uses deliberately expensive algorithms — **PBKDF2** (runs the hash tens of
  thousands of times), **bcrypt**, **Argon2** (also eats memory, which GPUs hate). Legitimate logins
  pay ~100 ms once; brute-forcers pay it billions of times.

ASP.NET Core **Identity** — the framework's full membership system (user store via EF Core, password
hashing, lockout, 2FA) — does this correctly out of the box: currently PBKDF2 with HMAC-SHA512,
128-bit per-user salt, 100k+ iterations, all versioned inside the stored hash so parameters can be
upgraded later. The rule: **crypto is where you use the library, not your ingenuity.** Hand-rolled
auth is the classic way a first backend ships a hole.

**Secrets: never in source.** The JWT signing key, the connection string password — anyone who gets
your git history gets them, forever (deleting the commit later doesn't help; history is history).
They belong in configuration that lives *outside* the repo: **user-secrets** in development,
**environment variables** or a secret store (Azure Key Vault, AWS Secrets Manager) in production.
Both flow into the same `builder.Configuration` you met in the *ASP.NET Core* chapter, so code
doesn't care where a value came from.

**HTTPS/TLS.** TLS wraps the whole HTTP conversation in encryption negotiated via the server's
certificate, giving you privacy (nobody on the network path reads it), integrity (nobody alters it),
and server identity (you're talking to the real host). One sentence to remember forever: **a bearer
token over plain HTTP is a password in the clear** — anyone on the same café Wi-Fi becomes you.
`app.UseHttpsRedirection();` bounces HTTP callers to HTTPS; dev certificates come free with the SDK
(`dotnet dev-certs https --trust`).

**The OWASP short list.** OWASP (Open Worldwide Application Security Project) maintains the
*Top 10* — the empirically most common web vulnerabilities. The three most relevant to your API:

- **Injection** — attacker input executed as code/SQL.
- **Broken access control** — the #1 category: authorization checks missing or bypassable (exactly
  what section 2's ownership checks and 404-not-403 prevent).
- **Mass assignment** — binding request JSON straight onto an entity, letting the client set fields
  it shouldn't.

### In practice

**Hashing with Identity's hasher** (package `Microsoft.Extensions.Identity.Core`) — usable even
without adopting all of Identity:

```csharp
using Microsoft.AspNetCore.Identity;

var hasher = new PasswordHasher<string>();          // generic arg = your user type; string for demo

string stored = hasher.HashPassword("ada", "correct-horse-battery-staple");
Console.WriteLine(stored);
// AQAAAAIAAYagAAAAE...  ← version marker + salt + PBKDF2 output, base64, ~85 chars

var ok  = hasher.VerifyHashedPassword("ada", stored, "correct-horse-battery-staple");
var bad = hasher.VerifyHashedPassword("ada", stored, "wrong-guess");
Console.WriteLine($"{ok} / {bad}");
// Success / Failed
```

Hash the same password twice and the outputs differ — that's the per-call random salt at work;
`VerifyHashedPassword` reads the salt back out of `stored` to check. (Full Identity does the same
via `UserManager.CreateAsync(user, password)` and manages the user table for you.)

**Secrets with user-secrets** (dev) and environment variables (prod):

```bash
cd AuthDemo
dotnet user-secrets init                       # adds a UserSecretsId to the .csproj
dotnet user-secrets set "Jwt:SigningKey" "s3cr3t-key-that-never-touches-git-32b!"
# in production instead:  export Jwt__SigningKey="..."   (double underscore = the colon)
```

```csharp
// replaces the hard-coded demo key from section 1:
var keyString = builder.Configuration["Jwt:SigningKey"]
    ?? throw new InvalidOperationException("Jwt:SigningKey not configured");
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(keyString));
```

Secrets land in a JSON file under your home directory, outside the repo; the config system merges
them over `appsettings.json`. Same reading code either way — that's the point.

**Injection — the unsafe and safe patterns side by side:**

```csharp
// NEVER: user input concatenated into SQL. title = "'; DROP TABLE Todos;--" ends your day.
var rows = db.Todos.FromSqlRaw($"SELECT * FROM Todos WHERE Title = '{title}'");   // vulnerable

// Safe: LINQ from the SQL & EF Core chapter — EF Core parameterizes for you:
var rows = db.Todos.Where(t => t.Title == title);
// Safe even when you *need* raw SQL — interpolation via FromSql becomes a parameter, not text:
var rows2 = db.Todos.FromSql($"SELECT * FROM Todos WHERE Title = {title}");
```

**Mass assignment — why DTOs are a security feature, not ceremony:**

```csharp
// NEVER: binding the entity itself. The client posts {"title":"hi","userId":"1"}
// and quietly reassigns the todo to user 1 — or sets IsAdmin on a User entity.
app.MapPost("/todos", (Todo todo, TodoDb db) => /* ... */);          // vulnerable

// Safe: a DTO exposes exactly the fields the client may set; the server fills the rest.
record TodoCreateDto(string Title);
app.MapPost("/todos", async (TodoCreateDto dto, ClaimsPrincipal user, TodoDb db) =>
{
    var todo = new Todo
    {
        Title  = dto.Title,
        UserId = user.FindFirstValue(ClaimTypes.NameIdentifier)!,   // from the token, never the body
    };
    db.Todos.Add(todo);
    await db.SaveChangesAsync();
    return Results.Created($"/todos/{todo.Id}", new { todo.Id, todo.Title });
}).RequireAuthorization();
```

And from section 2, **broken access control** is prevented by the habit: every endpoint declares its
gate, ownership is checked after every fetch, and errors stay vague — return a generic 400/404 and
log details server-side, because a stack trace in a response is a map of your internals handed to an
attacker.

> **C corner:** deliberately-slow hashing may feel absurd if you've spent a career shaving cycles.
> Reframe: the work factor is a *tunable price of a guess*. You pay it once per login; the attacker
> pays it 10^12 times. It's the rare case where the performance bug is the feature. And SQL injection
> is the same disease as `printf(user_input)` — data flowing into the code channel; parameterized
> queries are SQL's `printf("%s", user_input)`.

### Try it — Project

1. In `AuthDemo`: `dotnet add package Microsoft.Extensions.Identity.Core`, then add a temporary
   endpoint `app.MapGet("/hashdemo", () => { ... })` containing the hasher snippet (return the
   strings instead of `Console.WriteLine`). Call it twice; confirm the two hashes of the same
   password differ, and `Verify` still succeeds against both.
2. Move the signing key: run the `dotnet user-secrets` commands above, replace the hard-coded key
   with the `builder.Configuration["Jwt:SigningKey"]` version, restart, and confirm login still
   works. Grep your repo for `s3cr3t` — zero hits is the point.
3. Delete the secret (`dotnet user-secrets remove "Jwt:SigningKey"`), restart — confirm the app
   *fails to start* with your exception. Failing loudly beats signing tokens with a null key.
4. Remove the `/hashdemo` endpoint when done — demo surface is attack surface.

### Traps

- **"SHA-256 + salt is fine."** No — salt defeats rainbow tables but not brute force; speed is the
  problem. Password storage needs PBKDF2/bcrypt/Argon2-class slowness. Use Identity's hasher.
- **Secrets committed "just for now."** Git never forgets. If a real key ever touches a commit,
  rotate the key — deleting the file later fixes nothing.
- **Comparing secrets with `==`.** String comparison exits at the first differing byte, so response
  *timing* leaks how much of a guess matched. Verification belongs to the library
  (`VerifyHashedPassword`, the JWT middleware), which compares in constant time.
- **Validating input only in the UI.** Every request field is attacker-controlled. The DTO +
  validation you learned in the *ASP.NET Core* chapter is the server-side line of defense; the UI's
  validation is a courtesy to honest users.

---

## Check yourself

- Given a JWT, can you decode its payload by hand, name its three parts, and explain why the server
  trusts it without a database lookup — and why the payload still must not hold secrets? If yes,
  tick *Authentication & JWT* above.
- Can you say when you'd reach for a role, a policy with a custom requirement/handler, and an
  in-handler ownership check — and why the last one returns 404, not 403, for someone else's
  resource? If yes, tick *Authorization* above.
- Can you explain to a colleague why password hashes must be salted *and slow*, where the JWT
  signing key lives in dev vs prod, and how DTOs prevent mass assignment? If yes, tick *Security
  hardening* above.

All three ticked? Tick the chapter. The gate for this stretch of the Map is **checkpoint cp8** —
see *Checkpoints & Defenses* for how checkpoints are run.
