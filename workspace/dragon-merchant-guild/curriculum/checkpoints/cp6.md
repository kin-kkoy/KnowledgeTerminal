# cp6 — ASP.NET Core Gate

**Time:** 2.5h · **Start:** empty folder `attempts/cp6-attempt-N/`, `dotnet new webapi` · **Allowed:** docs, search · **Forbidden:** AI, own code **including p2** · Rules: `system/checkpoint-protocol.md`

## Task — Library lending API (in-memory storage)

Entities: `Book` (title, author, isbn), `Member` (name, email), `Loan` (book, member, borrowed/returned dates).

Endpoints:
- Books/Members CRUD (DTOs, validation: ISBN format, email format, required fields)
- `GET /api/books` — paginated, filter by author, search by title substring
- `POST /api/loans` — borrow. Rules: book already on loan → **409**; member has 3 active loans → **422**
- `POST /api/loans/{id}/return` — return; already returned → 409
- All errors as ProblemDetails via a global exception handler; no try/catch in controllers
- Serilog with structured request logging; Swagger working

## Pass criteria

- [ ] Business rules return exactly the specified codes, as ProblemDetails with useful detail
- [ ] Controllers thin: bind → service → map → return; all rules live in services
- [ ] Services injected via interfaces; correct lifetimes (justify each registration in a comment)
- [ ] Validation failures → automatic 400 with field errors
- [ ] 3 integration tests green (`WebApplicationFactory`): happy borrow, conflict borrow, validation failure
- [ ] Pagination envelope on the book list (items, page, totalCount)
- [ ] Done in time

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
