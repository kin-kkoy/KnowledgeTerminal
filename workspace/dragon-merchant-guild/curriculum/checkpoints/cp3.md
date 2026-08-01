# cp3 — Collections + Generics Gate

**Time:** 2h · **Start:** empty folder `attempts/cp3-attempt-N/` · **Allowed:** docs, search · **Forbidden:** AI, own code, `System.Collections.Generic.PriorityQueue` · Rules: `system/checkpoint-protocol.md`

## Task — `PriorityTaskQueue<T>`

A generic queue: `Enqueue(T item, int priority)`, `T Dequeue()` returning highest priority first, **FIFO within equal priority**, `bool TryDequeue(out T)`, `Count`. Constraint: `where T : IDescribable` (your interface, `string Describe()`), used by a `string DumpQueue()` diagnostic.

Plus a written complexity note (comment block): the complexity of your Enqueue/Dequeue and why, given your underlying structure choice.

## Pass criteria (all mandatory)

- [ ] Dequeue order correct: priority first, FIFO within priority — proven by a dedicated test with interleaved enqueues
- [ ] `TryDequeue` correct on empty (no throw, returns false)
- [ ] Complexity note present and *correct for the structure you actually used* (O(log n) heap or justified alternative)
- [ ] Works with two unrelated `T` types in tests
- [ ] 8+ passing tests
- [ ] Post-test (after timer): read .NET's `PriorityQueue<TElement,TPriority>` docs; write 3 sentences on how yours differs

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
