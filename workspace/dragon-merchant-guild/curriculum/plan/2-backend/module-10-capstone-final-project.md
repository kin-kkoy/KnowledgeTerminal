# Module 10 — Final Capstone Project: "Bookable"
### An Event Booking & Ticketing Platform — Formal Project Brief

**Duration:** 4 weeks (weeks structured below; ~6 sessions/week) · **Assessment:** `checkpoints/cp10.md` (the rubric in §7, self-graded, pass bar 75/100)
**Code:** `03-projects/p3-capstone/` · **Prerequisite:** cp9 passed · **Parallel duty:** applications go out from Week 1 of this module (`07-career/applications.md`).

---

## 1. Background & motivation

Booking systems (events, clinics, classes, rentals) are among the most common real commercial backends, and they contain the one problem that makes a junior portfolio memorable: **correctness under concurrency** — two users must never buy the same seat. CRUD apps don't give interviewers anything to probe; this does. The project is deliberately shaped like a real engagement: a fixed scope, stakeholders with different permissions, a state machine with money-adjacent rules, reporting, and operational requirements.

You are building this as if a small events company commissioned it. Scope discipline is part of the assessment — shipping the spec beats gold-plating half of it.

**Alternative track (only if you have a strong personal reason):** an assignment-submission & grading platform (courses, assignments, submissions, deadlines, grader role) — structurally isomorphic (FRs map 1:1; the concurrency requirement becomes deadline-instant submission races and idempotent grade publication). If in doubt, build Bookable. Decide on Day 1 and never revisit.

## 2. Stakeholders & roles

| Role | Capabilities |
|---|---|
| **Guest** (unauthenticated) | Browse/search published events, view availability |
| **Attendee** (registered user) | Everything Guest can; hold seats, book, pay (stubbed), cancel own bookings, view own history |
| **Organizer** | CRUD own venues & events, publish/unpublish, view sales reports for own events |
| **Admin** | All organizer powers globally; manage users; view platform-wide reports; access audit log |

## 3. Functional requirements

Mandatory unless marked *(optional)*. Each FR must be traceable to endpoints and tests.

**FR-1 — Accounts & access.** Registration, JWT login with refresh-token rotation, role assignment (attendee default; organizer via admin promotion). Per module 08's design.
**FR-2 — Venue & event management.** Organizers manage venues (name, address, seat map: sections × rows × seats — generated, not hand-entered) and events (title, description, category, start/end, venue, per-section pricing). Events have a lifecycle: `Draft → Published → {Cancelled, Completed}`; only valid transitions permitted (invalid → 409); only Published events are publicly visible.
**FR-3 — Search & browse.** Public listing with pagination, filtering (category, date range, venue, text search on title), sorting. Single-event view includes real-time seat availability by section.
**FR-4 — Seat holds.** An authenticated attendee can place a **hold** on up to 6 specific seats for one event. Holds expire after 10 minutes (background job releases them). A seat is holdable only if neither held (unexpired) nor booked.
**FR-5 — Booking (the concurrency core).** Converting a hold to a booking is atomic: all seats or none. **Under concurrent attempts on the same seat, exactly one wins** — enforced at the data layer (unique constraint and/or optimistic concurrency token; a serializable transaction is acceptable with justification), not by in-memory locks alone. The losing request gets 409 with a ProblemDetails explaining which seats were lost. This FR has a dedicated demonstration requirement: D-6 in §6.
**FR-6 — Payment stub.** Booking confirmation calls an `IPaymentProvider` (interface + fake implementation with configurable success/failure/latency). Payment failure releases the seats. Design so a real provider could be substituted via DI without touching booking logic.
**FR-7 — Cancellation & refunds.** Attendees cancel own bookings until 24h before event start (then 422). Cancellation releases seats and records a stubbed refund. Organizers cancelling an event cancels all bookings (background job, idempotent).
**FR-8 — Reporting.** Organizer: per-event sales (sold/held/free by section, revenue, bookings-over-time). Admin: platform totals, top events, daily revenue. At least one report endpoint must be backed by raw SQL/Dapper with the EF-vs-SQL choice documented.
**FR-9 — Audit log.** Every state-changing operation on bookings/events appends an audit record (who, what, when, before→after). Admin-queryable with pagination/filtering. Implemented cross-cuttingly (middleware, interceptor, or domain events) — not copy-pasted into every service method.
**FR-10 — Notifications.** Booking confirmation and event-cancellation notices via `IEmailSender` (fake: writes to log/table). Sent by a background job from an outbox table, not inline in the request path *(the outbox half may be downgraded to inline with a documented trade-off note — but the interface + async dispatch are mandatory)*.
**FR-11 *(optional, choose at most one)*:** waitlist with automatic offer on seat release · seat-map image rendering · organizer CSV export · minimal JS frontend for browse+book (you have the JS background; timebox 4 sessions, it counts toward the Documentation criterion's demo quality).

## 4. Non-functional requirements

**NFR-1 Stack:** .NET 10 (LTS), ASP.NET Core controllers, EF Core + PostgreSQL, Docker Compose, GitHub Actions — the p2 stack, no new framework experiments.
**NFR-2 Testing:** unit tests on all booking/hold/cancellation domain logic; integration tests (Testcontainers) covering every FR's happy path + key failure paths; **one test that proves FR-5 by firing parallel booking attempts at one seat and asserting exactly one success**. Coverage of the domain project ≥ 70% (measure with `dotnet test --collect:"XPlat Code Coverage"`; the number matters less than the booking paths being saturated).
**NFR-3 API quality:** consistent ProblemDetails errors; correct status codes (409 for conflicts/races, 422 for business-rule rejections); pagination on every list; OpenAPI complete enough to use the API without reading code.
**NFR-4 Performance:** browse/search endpoints answer in <300ms locally with seeded data (≥50k seats, ≥10k bookings — write a seeder); zero N+1 (audited via query logs; paste the audit note in the README).
**NFR-5 Security:** module 08 checklist applies in full (hashing, secrets, 401/403 discipline, no IDOR — attendees cannot read others' bookings); rate limiting on auth endpoints (built-in rate limiter middleware, .NET 8+).
**NFR-6 Operations:** deployed to public HTTPS with health checks, structured logs, CI gating merges, auto-deploy on main; fresh-clone-to-running ≤ 5 min.
**NFR-7 Code organization:** the p2 layering (Api/Core/Infrastructure); domain logic framework-free and unit-testable; no God services.

## 5. Out of scope (explicitly — discipline is graded)

Real payments, real email, microservices, message brokers, Kubernetes, CQRS/MediatR/event sourcing, multi-tenancy, mobile apps, admin SPA. Adding these is *negative* — it signals scope indiscipline (rubric: Scope & process).

## 6. Deliverables

- **D-1** GitHub repo (public), clean history, CI badge green.
- **D-2** Live deployment (public HTTPS URL) with seeded demo data + demo accounts (one per role) listed in the README.
- **D-3** README: pitch (≤5 sentences), architecture diagram, ERD, live URL + demo credentials, quickstart, API tour, ops notes.
- **D-4** `DECISIONS.md`: 5–10 short ADR-style entries (concurrency strategy chosen and rejected alternatives; outbox vs inline; raw-SQL report; etc.). This file is interview ammunition — write entries as decisions happen, not retroactively.
- **D-5** "Problems I solved" write-up (in README or linked): the concurrency race with evidence, plus two more. Feed `06-interview/story-bank.md`.
- **D-6** **Race demonstration artifact:** a script (`k6`, `bombardier`, or a small C# console) that fires N concurrent bookings at one seat against the running system, with output showing 1 success / N−1 conflicts. Committed, runnable, referenced in the README.
- **D-7** Demo script: a 5-minute walkthrough you can perform in an interview (written bullet list + practiced twice, recorded once).

## 7. Milestone schedule & grading rubric

### Milestones (each has a Friday acceptance review — treat as immovable)

**M1 (end W1) — Domain & data foundation:** schema + migrations for all entities; auth (ported from p2 patterns); venue/event CRUD with lifecycle rules; seeder; CI running tests from day 1. *Accept: FR-1/2 integration-tested; ERD drawn; deployed skeleton already live (deploy first, not last).*
**M2 (end W2) — The core:** holds with expiry job; atomic booking with the concurrency guarantee; payment stub; cancellations. *Accept: FR-4/5/6/7 tested incl. the parallel-booking test green; D-6 script shows 1-winner locally.*
**M3 (end W3) — The rest of the spec:** search/browse perf with seeded volume; reporting; audit log; notifications/outbox; rate limiting. *Accept: FR-3/8/9/10 tested; N+1 audit done; <300ms verified.*
**M4 (end W4) — Ship & polish:** prod deployment final, D-1…D-7 complete, rubric self-assessment, cp10 logged. *Accept: a stranger can go from README to booked seat on the live system in 10 minutes.*

Slipping a milestone → cut from FR-11/polish, never from FR-5/NFR-2. If M2 slips a second week, invoke the weekly-protocol catch-up rule and re-baseline once.

### Rubric (cp10 — self-graded honestly, evidence required per line)

| Dimension | Pts | Bar for full points |
|---|---|---|
| Correctness vs spec | 20 | Every mandatory FR demonstrably works on the live system |
| Concurrency core (FR-5) | 15 | Data-layer enforcement + passing parallel test + D-6 artifact |
| Tests | 15 | NFR-2 met; failure paths covered, not just happy paths |
| Data design & queries | 10 | Sound ERD, migrations clean, N+1 audit, raw-SQL report justified |
| Security | 10 | NFR-5 audit clean; IDOR attempts (write 3) all denied |
| Operations | 10 | NFR-6 met; incident drill (module 09 day 5) repeated here & written up |
| Code quality | 10 | NFR-7; a senior could navigate it; no dead code or TODO graveyards |
| Documentation & demo | 5 | D-3/4/5/7 complete; demo performed in 5 min |
| Scope & process | 5 | Out-of-scope respected; milestones logged; DECISIONS.md written in-flight |

**Pass: ≥75/100, with no dimension at 0 and Concurrency ≥10.** Below bar → the gap list becomes a 1-week remediation backlog; re-grade after.

## 8. Common mistakes (capstone-specific)

- [ ] Building the seat-map UI dream instead of the booking guarantee (the grade lives in FR-5, not pixels).
- [ ] In-memory `lock` as the concurrency answer (dies at 2 replicas — the DB must enforce it).
- [ ] Hold expiry only checked by the background job (must *also* be checked at booking time — jobs lag).
- [ ] Deploying in week 4 (deploy in week 1; integrate continuously).
- [ ] Writing DECISIONS.md the night before — it reads fake and interviews poorly.
- [ ] Re-deriving auth from scratch instead of porting p2's (one day, not five).
- [ ] Skipping the seeder, then "discovering" performance issues in the demo.

## 9. Interview relevance

This project *is* your interview: the concurrency story (with the D-6 artifact as proof), the state-machine design, the outbox pattern, the ADRs — each maps to a standard junior/mid interview thread ("tell me about something hard", "how would you handle two users buying the last ticket" — you'll answer with *evidence*). System-design screens for juniors are usually "design a booking system" — you will have built one.

## 10. Integration notes

This module integrates everything: m01–05 (the domain logic is records, generics, LINQ, async throughout), m06 (the API surface), m07 (the schema, migrations, the raw-SQL report, Testcontainers), m08 (auth ported), m09 (the ops pipeline). After cp10: pin the repo, final résumé bullets, and the system's job is done — `07-career/` takes over.
