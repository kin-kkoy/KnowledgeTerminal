# cp4 — LINQ Gate

**Time:** 90 min · **CLOSED BOOK — no docs, no search.** LINQ must be in your fingers. · **Start:** empty folder `attempts/cp4-attempt-N/` · Rules: `00-system/checkpoint-protocol.md`

## Setup (≤15 min of the 90)

Generate in-memory fake data: `Customer(Id, Name, Country)`, `Product(Id, Name, Category, Price)`, `Order(Id, CustomerId, Date, Lines: List<(int ProductId, int Qty)>)` — ~50 customers, 20 products, 500 orders, randomized but seeded (`new Random(42)`).

## The 12 tasks (print each result)

1. Customers from a given country, names only, alphabetical.
2. Orders in the last 30 days of the data's max date.
3. Products projected to `(Name, PriceBand)` where band is a switch expression.
4. Total revenue (sum over all order lines × price).
5. Average order value per country.
6. Count of orders per month (composite group key year+month).
7. Join: order → customer name list for the 10 largest orders.
8. **Left join:** all customers with their order count, *including zero-order customers* (must appear).
9. Per-category revenue, descending, with % of total.
10. Top spender per country (GroupBy + inner ordering).
11. Flatten: all `(CustomerName, ProductName, Qty)` triples via SelectMany.
12. **Prediction task:** write the snippet from the module (query defined → source mutated → enumerated twice with a side-effect counter); write your predicted output as a comment BEFORE running. Then run.

## Pass criteria

- [ ] ≥10/12 correct on first run (correct = matches a hand-check on the seeded data)
- [ ] Task 8's zero-order customers present
- [ ] Task 12 prediction exactly right
- [ ] Zero `foreach` where an operator exists
- [ ] Finished within 90 min

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
