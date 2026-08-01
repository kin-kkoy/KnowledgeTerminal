# Module 06 — ASP.NET Core

**Days:** 8 · **Checkpoint:** `checkpoints/cp6.md` · **Prefix:** `02-practice/m06-…`
**Unlocks:** project **p2-auth-api** (Day 3 onward — `03-projects/p2-auth-api/`). This is the job.

## Mission brief

"ASP.NET Core Web API" is the single most common phrase in junior .NET postings — this module *is* the job description. Everything you've built converges: interfaces+DI (m02) become registered services, generics (m03) become your repository, LINQ (m04) becomes your queries, async (m05) becomes every action. New ideas are only: the hosting model, the middleware pipeline (≈ Express middleware), and the DI container's lifetimes.

**Bridges:** Express: `app.MapGet("/x", handler)` is literally the same shape; middleware with `next()` identical · Spring: controllers/`[Route]`≈`@RestController`/`@RequestMapping`, built-in DI ≈ `@Autowired` without the framework bolt-on.

p2's domain (decide now, no shopping): **a task/project tracker API** — users, projects, tasks with states, comments. Rich enough for auth roles (m08) and relations (m07), boring enough to never distract.

---

## Day blocks

### Day 1 — Hosting model + minimal API
- [ ] **Build** `m06-d1-minimal/`: `dotnet new web` — read `Program.cs` until every line is explainable. Add 5 minimal-API endpoints (GET/POST/PUT/DELETE + one with route params and query strings) over an in-memory list. Hit every one with `curl`; save the commands in a `requests.http` file.
  - **Done-when:** correct verbs + status codes (201 w/ Location on create, 404, 204 on delete) — not 200-for-everything.
- [ ] **Read-then-explain:** Kestrel, the request path from socket to handler — 2-minute aloud version.

### Day 2 — Middleware pipeline
- [ ] **Build** `m06-d2-middleware/`: write three middlewares by hand — request logging (method, path, status, elapsed ms), a request-ID injector (response header), and a *deliberately misordered* exception-catcher to watch order break things; then fix the order.
  - **Done-when:** you can draw the pipeline for your app and state where auth would slot in and why before-routing vs after matters.
- [ ] **Drill:** module 02's pipeline mini-project was this pattern — say aloud the mapping (ITextProcessor → middleware, ordered list → pipeline).

### Day 3 — DI lifetimes + p2 kickoff
- [ ] **Build** `m06-d3-lifetimes/`: a service registered three ways (Singleton/Scoped/Transient), each instance carrying a Guid; an endpoint that injects it twice (constructor + per-request) and prints the Guids across requests.
  - **Done-when:** the Guid table you print *demonstrates* all three lifetimes; you can state the captive-dependency bug (Scoped inside Singleton) and what breaks.
- [ ] **Start p2** in `03-projects/p2-auth-api/`: `dotnet new webapi`, controllers (not minimal — enterprise codebases use controllers), solution layout: `Api/` (controllers, middleware), `Core/` (services, interfaces, domain), `Infrastructure/` (repositories). Wire your m03 `InMemoryRepository<T>` behind `IRepository<T>` in DI. First endpoints: `GET/POST /api/projects`.
  - Pipeline: p2 → Building.

### Day 4 — Model binding, DTOs, validation
- [ ] **Build in p2:** request/response DTOs as records — never expose domain entities. Create/Update DTOs with DataAnnotations (`[Required]`, `[MaxLength]`, `[Range]`); automatic 400s via `[ApiController]`; manual mapping methods (no AutoMapper — mapping by hand teaches what mappers hide).
  - **Done-when:** invalid POST returns 400 with field-level errors; domain entity never appears in any response; `[FromBody]`/`[FromQuery]`/`[FromRoute]` each used deliberately somewhere.
- [ ] ⭐ Stretch: one FluentValidation validator (job postings name it) for a rule annotations can't do (cross-field).

### Day 5 — Error handling + ProblemDetails
- [ ] **Build in p2:** global exception handler (`IExceptionHandler`, .NET 8+) returning RFC-7807 ProblemDetails; typed domain exceptions (`NotFoundException`, `ConflictException`) mapped to 404/409; dev vs prod detail levels.
  - **Done-when:** no endpoint contains try/catch; a thrown `NotFoundException` anywhere becomes a clean 404 ProblemDetails; stack traces appear in Development env only.

### Day 6 — Configuration, logging, OpenAPI
- [ ] **Build in p2:** Options pattern (`IOptions<AppSettings>`) from `appsettings.json` + env-var override (prove the override works); Serilog with structured logging (`log.Information("Task {TaskId} moved to {State}", …)`) and request logging; Swagger annotated (XML comments or attributes) so every endpoint reads like documentation.
  - **Done-when:** `ASPNETCORE_ENVIRONMENT` + an env var visibly change behavior; logs are structured (JSON console), not string-mashed; Swagger UI is presentable to a stranger.
- [ ] User secrets for anything secret-shaped; nothing secret in appsettings.json (the classic junior disaster — pre-empt it now).

### Day 7 — Pagination, filtering, integration tests
- [ ] **Build in p2:** `GET /api/tasks?status=open&page=2&pageSize=20&sort=-createdAt` — your m03 `Paginate<T>`, filter object binding, paged response envelope (items, page, totalCount).
- [ ] **Build:** integration tests with `WebApplicationFactory` — full HTTP tests: create→fetch→assert roundtrip, validation failure, 404 path. This is the junior-differentiator skill; most applicants have never done it.
  - **Done-when:** `dotnet test` runs unit + integration suites green; tests hit real HTTP, not controller methods directly.

### Day 8 — Mini-project completion + drills cold
- [ ] Finish p2 acceptance criteria (below); drills cold; background service stretch if ahead: an `IHostedService` that logs a heartbeat (m07 will give it real work).

---

## Coding drills

1. **crud-60**: minimal API CRUD over an in-memory list, correct verbs/status codes, <15 min.
2. **middleware-cold**: request-timing middleware from memory, <10 min.
3. **lifetime-predict**: given 6 registration/injection combos, predict instance counts on paper, then verify, <10 min.
4. **dto-map**: entity→DTO record + mapping + a validation attribute set, <10 min.
5. **explain-pipeline**: 2-minute aloud walk of a request from Kestrel to your handler and back.

## Mini-project — p2 milestone 1 (the API skeleton)

p2 with: projects+tasks CRUD, DTO/validation layer, global ProblemDetails errors, Serilog, Options config, Swagger, pagination/filtering/sorting, in-memory repository behind `IRepository<T>`, unit tests for services + integration tests for endpoints.

**Acceptance criteria:**
- [ ] A stranger with the README and Swagger can exercise the full API in 5 min.
- [ ] Controllers are thin: bind → call service → map → return. All logic in `Core/`.
- [ ] Service layer fully unit-tested with fake repositories; endpoints integration-tested.
- [ ] No entity types in any response; no try/catch in controllers; no secrets in committed files.
- [ ] Swappable storage proven: the *only* file that knows storage is in-memory is the DI registration (m07 will swap one line).

## Common mistakes checklist

- [ ] Fat controllers (business logic inline) — the #1 junior API smell.
- [ ] Returning entities (later: EF entities → serialization cycles + over-exposure).
- [ ] Wrong DI lifetime; captive dependency; `new`-ing services.
- [ ] 200 for everything; 500s with stack traces in prod.
- [ ] Secrets in appsettings.json in git.
- [ ] Sync-over-async in actions (`.Result` — m05 said never).
- [ ] No pagination on list endpoints ("works in dev, dies on 100k rows").

## Mastery checkpoint — cp6

**Timed: 2.5 hours, from `dotnet new webapi`, docs allowed, AI/own-code (including p2!) not.**
Build a "library lending" API from the cp file's spec: books + loans, CRUD, borrow/return endpoints with business rules (can't borrow a borrowed book → 409; max 3 loans per member → 422), DTOs+validation, global ProblemDetails handler, pagination on book list, Serilog, 3 integration tests (happy borrow, conflict borrow, validation failure).
**Pass criteria:** business rules return the specified status codes · zero logic in controllers · integration tests green · structured logs visible · Swagger functional · done in time.

## Interview relevance

DI lifetimes (top-3 .NET question), middleware order, model binding, ProblemDetails, REST semantics, "how do you structure an API" — this module answers the entire backend-design section of a junior interview. Recruiters scan for: REST API, ASP.NET Core, DI, Swagger/OpenAPI, integration testing — all now on your résumé truthfully.

## Integration notes

p2 is now a real API with a fake database. Module 07 swaps the in-memory repository for EF Core+Postgres (one DI line — the seam you built on Day 3). Module 08 bolts auth onto the same pipeline slot you identified on Day 2. Module 09 ships it. Nothing built this module is throwaway.
