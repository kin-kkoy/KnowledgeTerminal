# Module 08 — Authentication + Authorization

**Days:** 5 · **Checkpoint:** `04-checkpoints/cp8.md` · **Prefix:** `02-practice/m08-…`

## Mission brief

Nearly every backend interview contains "walk me through your auth flow" — and it's asked precisely because juniors hand-wave it. You will build JWT auth end to end, *by hand first* (so you understand it), then with the framework's machinery (so you ship it safely). Authentication = who you are (401); authorization = what you may do (403) — keep the words straight from day one; mixing them up is a screening tell.

**Bridges:** if you've done Express+JWT, the flow is identical — issue, send as `Authorization: Bearer`, validate per request; ASP.NET's contribution is doing the validation/claims plumbing for you in the pipeline slot you mapped in module 06 Day 2.

---

## Day blocks

### Day 1 — Tokens by hand (understanding day)
- [ ] **Build** `m08-d1-jwt-anatomy/`: a console app that constructs a JWT manually-ish: build header+payload JSON, base64url them, HMAC-SHA256 sign with a key, concatenate. Then verify your token at jwt.io and with your own verification code. Tamper with one payload byte; watch verification fail.
  - **Done-when:** you can say what's in each of the three segments, what the signature does and *doesn't* protect (integrity yes, secrecy no — payload is readable!), and why the server needs no session store.
- [ ] **Explain aloud:** sessions+cookies vs JWTs — one trade-off each direction (revocation vs statelessness).

### Day 2 — Identity + login in p2
- [ ] **In p2:** users table via migration; registration endpoint with **password hashing done right** — ASP.NET's `PasswordHasher<T>` or BCrypt package; never SHA-anything, and be able to say why (salt, work factor, GPU resistance).
- [ ] Login endpoint: verify password → issue JWT (`JwtSecurityToken`/`JsonWebTokenHandler`) with claims: sub, email, role, exp (15 min). Signing key from configuration (user secrets), not source.
  - **Done-when:** register→login→token decodes at jwt.io with the expected claims; wrong password = 401 with no detail leak ("invalid credentials", never "wrong password" vs "no such user").

### Day 3 — Protecting the API
- [ ] **In p2:** add `AddAuthentication().AddJwtBearer(...)` with full validation parameters (issuer, audience, lifetime, signing key); `UseAuthentication`+`UseAuthorization` **in the right pipeline order** (you predicted this slot in m06d2 — verify yourself); `[Authorize]` on everything except register/login/health.
  - **Done-when:** no token = 401, valid token = 200, expired token = 401 — all three proven in `requests.http`; current user read from `HttpContext.User` claims in one endpoint ("my tasks").
- [ ] Resource ownership: users can only modify *their own* tasks — service-layer check returning 403 otherwise. (Ownership is authorization too — not just roles.)

### Day 4 — Roles, policies, refresh
- [ ] **In p2:** seed an `admin` role; `[Authorize(Roles = "Admin")]` on an admin endpoint (delete any project); one **policy** (`RequireAssertion` or requirement class — e.g. "ProjectMember") used on a route — know when policies beat role strings (composable, testable, business-rule-shaped).
- [ ] **Refresh tokens:** short-lived access (15 min) + long-lived refresh token stored hashed in the DB, rotation on use, revocation endpoint (logout).
  - **Done-when:** the full lifecycle works in `requests.http`: login → access expires (set 30s to test) → refresh → old refresh token now rejected (rotation proven) → logout → refresh rejected.

### Day 5 — Testing auth + drills cold
- [ ] **In p2:** integration tests: anonymous→401, wrong-role→403, ownership-violation→403, happy path with a real issued token (test helper that mints tokens). Update Swagger with the Authorize button (`AddSecurityDefinition`).
- [ ] Drills cold; add "JWT flow aloud" to REVIEW-QUEUE. Pipeline: p2 → **Tested**.

---

## Coding drills

1. **flow-aloud**: 2-minute spoken walkthrough — register→login→authorized request→refresh→logout, naming what's stored where (DB: hash + refresh hash; client: tokens; server: nothing per-session).
2. **status-pick**: 10 scenarios → 401 vs 403 vs 404, <5 min, all correct (e.g. "valid token, other user's resource" → 403 or 404-by-policy, know the privacy argument).
3. **claims-read**: pull user id + role from `HttpContext.User` cold, <5 min.
4. **hash-why**: 60-second aloud — why bcrypt over SHA256, what a salt defeats.
5. **pipeline-order**: place UseAuthentication/UseAuthorization/UseRouting/exception handler in order from memory, with one sentence per position.

## Mini-project — p2 milestone 3 (locked down)

p2 with the full auth surface: register/login/refresh/logout, role + policy + ownership authorization, hashed passwords, rotating refresh tokens, auth-aware integration tests, Swagger authorize button.

**Acceptance criteria:**
- [ ] The `requests.http` lifecycle script (Day 4 done-when) runs clean top to bottom.
- [ ] No secret material in git (`git log -p | grep -i secret`-style audit); key from config/env.
- [ ] 401 vs 403 used correctly everywhere (drill 2 applied to your own API).
- [ ] Auth integration tests green; an unauthenticated test client genuinely can't reach protected routes.
- [ ] Error responses leak nothing (no user-exists oracle on register — or a documented decision about it).

## Common mistakes checklist

- [ ] Plain/SHA-hashed passwords (instantly disqualifying in a code review).
- [ ] Secrets/signing keys committed; keys shorter than the algorithm needs.
- [ ] No token expiry, or expiry without any refresh story.
- [ ] 401/403 confusion; ownership checks forgotten entirely (IDOR — the most common real junior vuln: `GET /tasks/7` returning someone else's task).
- [ ] Middleware order wrong (auth after endpoints = everything open).
- [ ] Validating tokens but not issuer/audience/lifetime (copy-pasted `TokenValidationParameters` with checks off).
- [ ] Detailed login errors enabling user enumeration.

## Mastery checkpoint — cp8

**Timed: 2.5 hours, from the cp spec, on a fresh minimal API (not p2), docs allowed, AI not.**
Build auth for a 2-role system (member/admin) from scratch: register w/ hashed passwords, login issuing JWT w/ claims, refresh w/ rotation, one member route w/ ownership enforcement, one admin route, one policy-based route; integration tests proving 401/403/200 triad + rotation.
**Pass criteria:** lifecycle script clean · all tests green · drill-1 spoken flow delivered fluently while your own code is on screen · zero secrets in source · IDOR attempt (manually crafted request for another user's resource) correctly denied.

## Interview relevance

"Walk me through auth in your project" — you now have a 2-minute rehearsed answer with code to back it. Also: where to store tokens client-side (XSS vs CSRF trade-off — have an opinion), why refresh tokens, password storage, 401 vs 403, IDOR. Security questions at junior level aren't deep — they're checking you won't be a liability; this module makes you demonstrably not one.

## Integration notes

p2 is now feature-complete and Tested in the pipeline. The capstone reuses this exact auth design (budget one day there, not five — that's the point of building it twice). Module 09 deploys what you just secured — and deployment is where secret handling becomes real (env vars, not user secrets).
