# Module 07 — SQL + Entity Framework Core

**Days:** 8 (3 SQL, 5 EF) · **Checkpoint:** `04-checkpoints/cp7.md` · **Prefix:** `02-practice/m07-…`
**Prerequisite tooling:** Docker installed; Postgres runs as a container, never installed bare.

## Mission brief

Every backend job touches a relational database; raw SQL knowledge is what separates you from bootcamp grads who only know the ORM. SQL first, *then* EF Core — you must always be able to answer "what SQL did this LINQ generate, and is it sane?" EF Core ≈ Hibernate/JPA (Java) or Prisma (JS), but with LINQ as the query language — module 04 was secretly this module's prerequisite.

**Bridges:** JPA's persistence context = EF's change tracker; `@OneToMany` = navigation properties; Flyway/Liquibase = EF Migrations · Prisma's schema-first flips to code-first here.

---

## Day blocks

### Day 1 — SQL: schema + CRUD
- [ ] `docker run` Postgres + connect with `psql` (or a GUI; psql at least once). **Build** `m07-d1-sql/schema.sql`: design the p2 domain in raw SQL — users, projects, tasks, comments; PKs, FKs, NOT NULL, UNIQUE, CHECK constraints; seed script with realistic volume (1k+ tasks via `generate_series`).
  - **Done-when:** an invalid insert (orphan FK, bad enum value) is *rejected by the database* — constraints proven, not assumed.
- [ ] INSERT/UPDATE/DELETE/SELECT basics on it — 10 statements saved in the file.

### Day 2 — SQL: joins + aggregation (the interview day)
- [ ] **Build** `m07-d2-queries.sql`: 12 queries — INNER/LEFT JOIN (incl. "projects with zero tasks" — the LEFT JOIN…IS NULL idiom), GROUP BY + HAVING (e.g. "users with >5 open tasks"), subquery vs JOIN solving the same problem, ORDER/LIMIT/OFFSET pagination.
  - **Done-when:** each query annotated with a comment of what it returns; the LEFT JOIN zero-case verified against seed data; you can whiteboard "tasks per user per status" cold.
- [ ] ⭐ Stretch: one window function (`ROW_NUMBER() OVER (PARTITION BY …)` — "latest comment per task") — nice interview flex.

### Day 3 — SQL: indexes + transactions
- [ ] **Build** `m07-d3-perf.sql`: `EXPLAIN ANALYZE` a filtered query on your 1k+ rows; add an index; EXPLAIN again; paste both plans as comments with the numbers.
  - **Done-when:** you watched a seq-scan become an index-scan and can say when an index *doesn't* help (low selectivity, write cost).
- [ ] **Build:** a transaction transferring a task between projects with an invariant check between statements; demonstrate ROLLBACK on violation; read (don't memorize) isolation levels — hold onto "read committed is the default; know that dirty/non-repeatable/phantom reads exist".

### Day 4 — EF Core: DbContext + migrations
- [ ] **In p2:** add Npgsql EF packages; write entities + `AppDbContext` matching your Day-1 schema (code-first now); configure with Fluent API where conventions fall short (string lengths, enum-to-string, composite unique). `dotnet ef migrations add Initial` → **read the generated migration line by line** → `database update`.
  - **Done-when:** the EF-generated schema matches your hand-written one's intent (compare in psql); you can explain why migrations are committed to git and what the team workflow is (never edit an applied migration; add a new one).
- [ ] Connection string via user secrets locally; the repository swap: `EfRepository<T>` implements your `IRepository<T>`; **one DI line changes**; the API works against Postgres with controllers untouched. (This is the module-02 payoff — savor it, it's a story-bank entry.)

### Day 5 — Relationships + loading
- [ ] **In p2:** one-to-many (project→tasks, task→comments) and many-to-many (tasks↔labels) via navigation properties; CRUD through the graph.
- [ ] **The N+1 day:** write the bug on purpose — load projects, loop, touch `.Tasks` (lazy-load or per-iteration query); count queries with EF's logging (`LogTo`/Serilog). Fix with `Include`/projection; count again. Record before/after numbers — this is a guaranteed interview story.
  - **Done-when:** you have the two numbers written down (e.g. 101 queries → 2) and a one-line rule for spotting N+1 in review.

### Day 6 — Querying like production
- [ ] **In p2:** `AsNoTracking` for all read endpoints (know what tracking costs); `Select` projections straight to DTOs (no entity materialization on list endpoints); the **`IQueryable` vs `IEnumerable` moment**: put a `Where` after `AsEnumerable()` and read the SQL — the filter vanished from SQL and ran in C#. This completes module 04's deferred-execution arc and is a top-tier interview answer.
- [ ] Pagination moved into SQL (`Skip/Take` before materialization); total-count query; your m03 `Paginate` retired or adapted.
  - **Done-when:** every list endpoint's SQL (logged) contains its WHERE/ORDER/LIMIT — nothing filtered in memory.

### Day 7 — Testing the data layer + raw SQL escape hatch
- [ ] **In p2:** integration tests against real Postgres via **Testcontainers** (spin up a throwaway container per test class). Test: a service method's full path, the unique-constraint conflict path, a migration applying cleanly to an empty DB.
  - **Done-when:** `dotnet test` green with Docker running; no SQLite-in-memory pretending to be Postgres.
- [ ] One endpoint backed by `FromSqlRaw`/Dapper for a gnarly aggregate (e.g. dashboard stats) — the "EF for CRUD, SQL for hot paths" interview answer, embodied.

### Day 8 — Background job + drills cold
- [ ] **In p2:** a `BackgroundService` doing real work — e.g. marks tasks overdue every minute (scoped service resolution inside — the captive-dependency lesson applied!). Drills cold. Pipeline check: p2 still Building, now with a real database.

---

## Coding drills

1. **join-cold**: "X with zero Y" LEFT JOIN, on paper or psql, <5 min.
2. **group-having**: aggregate + HAVING filter cold, <5 min.
3. **n+1-spot**: given 10 lines of EF code (write variants yourself), say which produce N+1, <5 min.
4. **migration-cycle**: add a column via migration end-to-end, <10 min.
5. **explain-tracking**: 90-second aloud — what the change tracker does between query and SaveChanges.

## Mini-project — p2 milestone 2 (real persistence)

p2 fully on Postgres: migrations from zero, relations incl. many-to-many, no N+1 anywhere (audited via logs), projections on reads, Testcontainers integration suite, one raw-SQL endpoint, one background job, docker-compose file for app+db (foreshadowing module 09).

**Acceptance criteria:**
- [ ] Fresh clone + `docker compose up db` + `dotnet ef database update` + `dotnet run` = working API.
- [ ] Query log of any list endpoint shows: one query, filtered/paged in SQL.
- [ ] Constraint violations surface as 409/422 ProblemDetails, not 500s.
- [ ] Integration tests green against containerized Postgres.
- [ ] You can demo the N+1 before/after with numbers.

## Common mistakes checklist

- [ ] `ToList()` early then filtering in memory (m04's warning, now with production cost).
- [ ] N+1 via lazy navigation access in loops.
- [ ] No `AsNoTracking` on reads; tracking 10k entities for a GET.
- [ ] Editing an applied migration / dropping the DB instead of migrating.
- [ ] `Include` everything (cartesian explosion) instead of projecting.
- [ ] Catching `DbUpdateException` nowhere — unique violations as 500s.
- [ ] Connection strings in committed config.
- [ ] Trusting the ORM blindly — never reading the generated SQL.

## Mastery checkpoint — cp7

**Timed: 2.5 hours, three parts, docs allowed for EF only — SQL part is closed-book.**
**A — SQL (45 min, psql, your seed data):** 8 tasks: 2 joins (one left-with-zero-case), 2 aggregations w/ HAVING, 1 subquery, 1 pagination, 1 index decision justified from EXPLAIN, 1 transaction with rollback.
**B — EF (60 min):** from the cp spec, add a new entity with a many-to-many to an existing one: migration, CRUD endpoint with projection + pagination, no N+1 (prove via log).
**C — Diagnose (30 min):** the cp file describes 3 buggy EF snippets (you transcribe them): an N+1, an in-memory filter, a tracking leak. Name, fix, one-line cost explanation each.
**Pass criteria:** A: 7/8 · B: migration clean + single-query list endpoint · C: 3/3 named and fixed.

## Interview relevance

N+1 (the #1 ORM question), indexes, transactions, `IQueryable` vs `IEnumerable` (now you have the complete answer), migrations workflow, "when raw SQL". Whiteboard SQL (joins + GROUP BY) appears in most backend interviews regardless of stack. Recruiter keywords: SQL, PostgreSQL, EF Core, migrations, Dapper, Testcontainers.

## Integration notes

p2 now has the full data spine the capstone will reuse (same stack, bigger schema). Auth (m08) adds a users table *via migration* — the workflow you just learned. The background job pattern carries to the capstone's reminder/cleanup jobs. Your N+1 numbers go in `06-interview/story-bank.md` — do it now.
