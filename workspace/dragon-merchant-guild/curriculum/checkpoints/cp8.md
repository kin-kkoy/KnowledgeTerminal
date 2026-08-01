# cp8 — Auth Gate

**Time:** 2.5h · **Start:** empty folder `attempts/cp8-attempt-N/`, fresh `dotnet new webapi` (NOT p2) · **Allowed:** docs, search · **Forbidden:** AI, own code · Rules: `system/checkpoint-protocol.md`

## Task — Auth for a two-role notes API

A minimal notes API (notes have an owner; in-memory or EF, your call — auth is what's graded) with:
- Register (hashed passwords — `PasswordHasher<T>` or BCrypt) + login issuing a JWT (sub, email, role, 15-min expiry; key from config, not source)
- Refresh tokens: stored hashed, rotated on use, revoked on logout
- `GET/POST/DELETE /api/notes` — members manage **only their own** notes (cross-user access denied)
- `GET /api/admin/users` — Admin role only
- One policy-based authorization (e.g. "CanPurge": admin AND a claim) on one route
- JWT bearer validation with issuer/audience/lifetime/key all enforced

## Pass criteria

- [ ] `requests.http` lifecycle runs clean: register → login → authed call → expire (set 30s) → 401 → refresh → old refresh rejected → logout → refresh rejected
- [ ] IDOR attempt (hand-crafted request for another user's note) denied — demonstrate with two registered users
- [ ] 401 vs 403 correct everywhere (no-token vs wrong-role/not-owner)
- [ ] Integration tests: 401 anonymous, 403 wrong role, 200 happy, rotation proven
- [ ] Zero secrets in source; login errors don't reveal which credential was wrong
- [ ] Spoken: 2-minute auth-flow walkthrough over your own code, recorded, fluent

## Attempt log

| # | Date | Time used | Result | Failed criteria → exact reason | Remediation plan |
|---|---|---|---|---|---|
| | | | | | |
