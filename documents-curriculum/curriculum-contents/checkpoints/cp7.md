# cp7 — SQL + EF Core Gate

**Time:** 2.5h total, three timed parts · **Forbidden everywhere:** AI, own code · Rules: `00-system/checkpoint-protocol.md`

## Part A — SQL (45 min, **closed-book**, psql against your m07 seeded database)

1. Tasks per user per status (two-key aggregate).
2. Users with more than 5 open tasks (HAVING).
3. Projects with **zero** tasks (left-join idiom — the zero rows must appear).
4. The same question as 2 via a subquery instead of HAVING.
5. Page 3, size 20 of tasks ordered by created date desc.
6. Latest comment per task (any correct approach; window function = bonus).
7. Given query X (pick a non-indexed filtered query): EXPLAIN ANALYZE, decide whether an index helps, create it if so, EXPLAIN again, paste both plans with a 2-line verdict.
8. A transaction that moves a task to another project and increments a counter table, rolling back if the project is archived (CHECK or manual check + ROLLBACK shown).

## Part B — EF Core (60 min, docs allowed, fresh branch of p2)

From spec: add `Tag` entity with many-to-many to `Task`. Deliver: migration (read it before applying), `POST /api/tasks/{id}/tags`, `GET /api/tags/{id}/tasks` paginated and projected to DTOs, query log proving the list endpoint is one SQL query with WHERE/ORDER/LIMIT in SQL.

## Part C — Diagnose (30 min, closed-book)

Transcribe the three buggy snippets described in module 07 Day 5–6 (N+1 loop, post-`AsEnumerable` filter, tracked read-only bulk query). For each: name the bug, fix it, one line on the production cost.

## Pass criteria

- [ ] A: 7/8 correct (8 = the plans verdict is coherent)
- [ ] B: migration clean on fresh DB; single-query list endpoint proven by log
- [ ] C: 3/3 named + fixed + costed

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
