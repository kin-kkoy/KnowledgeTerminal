# cp1 — C# Fundamentals Gate

**Time:** 2h hard limit · **Start:** empty folder `attempts/cp1-attempt-N/`, `dotnet new console` · **Allowed:** official docs, web search · **Forbidden:** AI, your own past code · Rules: `00-system/checkpoint-protocol.md`

## Task — `logstat`

A CLI that takes a log file path. Lines look like `2026-06-01T14:03:22Z ERROR Connection refused by upstream` (`TIMESTAMP LEVEL MESSAGE`); some lines are malformed. Output: count per level; the 5 most frequent words across ERROR messages; the time span covered (first to last valid timestamp). Generate your own test file first (10 min budget).

## Pass criteria (all mandatory, no partial credit)

- [ ] Parsing via a Try-pattern method (`bool TryParseLine(string, out LogLine)`)
- [ ] `LogLine` is a record
- [ ] A switch expression used somewhere meaningful (not decorative)
- [ ] Malformed lines: counted, reported at the end, never crash the run
- [ ] `<Nullable>enable</Nullable>`, zero warnings
- [ ] 5+ passing xUnit tests, including a malformed-line case
- [ ] Missing/unreadable file → specific nonzero exit codes + message

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
