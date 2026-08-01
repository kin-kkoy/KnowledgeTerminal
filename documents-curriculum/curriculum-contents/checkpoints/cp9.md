# cp9 — Deployment Gate (the cold redeploy)

**Time:** 2h · **Allowed:** docs, search, **your own p2 repo and README/runbook** (this gate tests ops capability, not memorization) · **Forbidden:** AI · Rules: `00-system/checkpoint-protocol.md`

## Task — Recover from total environment loss

Setup (before the timer): tear down your p2 deployment — remove the containers and app artifacts from the host (keep or drop the data volume per your own runbook's decision — and notice whether your runbook *has* that decision).

On the timer, from a fresh clone in a clean directory:
1. Local: `docker compose up` to a working authenticated API; `dotnet test` green.
2. Remote: redeploy to the public HTTPS URL — auth lifecycle works from a phone off-wifi, `/health` 200, logs flowing.
3. CI: push a trivial real commit to main; it deploys itself; then break a test on a branch and show CI blocks it.

Every gap where you had to *remember* instead of *read* gets written into the README/runbook **during** the checkpoint — that's part of the work.

## Pass criteria

- [ ] Live, working, secured public URL inside 2h
- [ ] Fresh-clone local bring-up took ≤5 min of that
- [ ] CI verified both directions (deploys good, blocks bad)
- [ ] No secret entered git at any point
- [ ] Runbook updated with every gap found (zero gaps = state that explicitly)
- [ ] Spoken, 60s: your concrete rollback procedure (image tags, previous version, data considerations)

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
