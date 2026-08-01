# Roadmap

Goal: junior backend / full-stack C#/.NET role. Target: ~14–18 weeks at 15–20 hrs/week.

| Phase | Modules | Duration | Output | Gate |
|---|---|---|---|---|
| 0. Setup | — | done ✅ | Working .NET 10 (LTS) + xUnit toolchain (`02-practice/phase0-setup-HelloDotnet`) | — |
| 1. C# core | 01 Fundamentals · 02 OOP · 03 Collections+Generics · 04 LINQ · 05 Async | ~4–5 wks | p1 console tool shipped | cp1–cp5 |
| 2. Web | 06 ASP.NET Core | ~1.5 wks | p2 API skeleton (no DB) | cp6 |
| 3. Data | 07 SQL + EF Core | ~1.5 wks | p2 on Postgres w/ migrations | cp7 |
| 4. Security | 08 AuthN + AuthZ | ~1 wk | p2 fully auth'd + tested | cp8 |
| 5. Ops | 09 Deployment | ~1 wk | p2 live on public HTTPS + CI | cp9 |
| 6. Capstone | 10 Final Project | ~4 wks | p3 capstone: deployed, documented portfolio centerpiece | cp10 (rubric) |
| 7. Apply | — | from week ~10, parallel | Applications out, interview prep from `06-interview/` | offers |

## Module index

1. `plan/1-core/module-01-csharp-fundamentals.md` — 5 days
2. `plan/1-core/module-02-oop.md` — 5 days
3. `plan/1-core/module-03-collections-generics.md` — 4 days
4. `plan/1-core/module-04-linq.md` — 5 days (unlocks project p1)
5. `plan/1-core/module-05-async.md` — 4 days
6. `plan/2-backend/module-06-aspnet-core.md` — 8 days (unlocks project p2)
7. `plan/2-backend/module-07-sql-efcore.md` — 8 days
8. `plan/2-backend/module-08-auth.md` — 5 days
9. `plan/2-backend/module-09-deployment.md` — 5 days
10. `plan/2-backend/module-10-capstone-final-project.md` — 4 weeks (project p3)

## The integration thread

Modules are not islands — they assemble one real backend system:

- **01–05** build language muscle and ship **p1** (LINQ-powered console analyzer) — proves C# fluency.
- **06–09** incrementally build **p2-auth-api**: module 06 gives it routes/DI/validation, 07 gives it a real database, 08 locks it down, 09 puts it on the public internet. One codebase, four modules.
- **10** repeats the whole arc solo, bigger, against a formal spec — that's the portfolio proof.

Start applying for jobs during module 10, not after it.
