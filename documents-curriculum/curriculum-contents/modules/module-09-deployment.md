# Module 09 — Deployment

**Days:** 5 · **Checkpoint:** `04-checkpoints/cp9.md` · **Prefix:** work happens in p2's repo
**Cost note:** budget ~$5/mo for a small VPS (Hetzner/DigitalOcean) — the most transferable option. Railway/Fly/Render free tiers are acceptable substitutes; the day blocks note the differences.

## Mission brief

"Deployed to production" is the résumé line that separates you from every classmate whose projects run only on localhost — and interviewers click links. This module takes p2 from `dotnet run` to a public HTTPS URL that redeploys itself on every push. Docker and CI/CD appear in nearly every job posting including junior ones; this is also where configuration, secrets, and logging stop being theory.

**Bridges:** from C you understand processes, ports, and signals — Docker is namespaced processes, not magic VMs. `docker compose` ≈ `npm run dev` for infrastructure.

---

## Day blocks

### Day 1 — Containerize the API
- [ ] **Build:** a multi-stage Dockerfile for p2 (sdk image builds → aspnet runtime image runs); `.dockerignore`; build and run locally, API answering on a mapped port against your existing dockerized Postgres.
  - **Done-when:** you can explain every Dockerfile line aloud, including *why* multi-stage (final image has no SDK/source — size + attack surface) and what layer caching is doing for your rebuild time.
- [ ] ⭐ Stretch: run the container as non-root user; note image size before/after using the alpine/chiseled runtime variant.

### Day 2 — Compose the system
- [ ] **Build:** `docker-compose.yml` — api + postgres + named volume (data survives `compose down`), healthcheck on both services, api `depends_on` db health, **all config via environment variables** (connection string, JWT key) with an `.env.example` committed and `.env` git-ignored.
- [ ] Migrations-on-deploy decision: apply migrations via an entrypoint step or a one-shot compose service (pick one; document why in a comment).
  - **Done-when:** **fresh-clone test**: clone p2 to `/tmp`, `cp .env.example .env` (fill 2 values), `docker compose up` → working authenticated API. Time it; this is your demo.
- [ ] **In p2:** add `AddHealthChecks().AddNpgSql(...)` → `/health` endpoint returning real DB status (compose healthcheck consumes it).

### Day 3 — Ship it
- [ ] Provision the host (VPS: install docker, copy compose file, `docker compose up -d`; PaaS: connect repo, set env vars in dashboard). Domain or provided subdomain + **HTTPS** (VPS: Caddy as reverse proxy — two lines of Caddyfile buy you auto-TLS; PaaS: included).
  - **Done-when:** your phone, off wifi, can register a user and complete the auth lifecycle against the public URL. `/health` returns 200. Swagger reachable (decide: open or dev-only — document the decision).
- [ ] Set `ASPNETCORE_ENVIRONMENT=Production` and verify ProblemDetails hides details and logs still flow (`docker logs` / platform logs — find a real request in them).

### Day 4 — CI/CD
- [ ] **Build:** GitHub Actions workflow (p2 must be on GitHub by now — if not, today): on PR → `dotnet build` + `dotnet test` (unit; integration if runner has Docker — it does); on push to main → build image → deploy (VPS: SSH action or registry pull+restart; PaaS: native integration).
  - **Done-when:** a failing test demonstrably blocks the pipeline (break one on a branch, watch it go red, fix it); a trivial change to main is live on the public URL within minutes, hands-off.
- [ ] Repo secrets for deploy credentials (Settings→Secrets — never in the workflow file).

### Day 5 — Operate it + drills + pipeline
- [ ] **Run the incident drill:** stop the database container in prod. What does the API do? What does `/health` say? What's in the logs? Bring it back. Write 5 lines in the README's "operations" section about what you saw. (This 30-minute exercise generates a better interview answer than most juniors' entire deployment knowledge.)
- [ ] README final form: pitch, architecture sketch, live URL, badge from CI, quickstart, ops notes, "problems I solved".
- [ ] Drills cold. Pipeline: p2 → **Dockerized → Deployed → Documented**. Harvest résumé bullets (cp9 row in `07-career/resume-bullets.md`) and a story-bank entry.

---

## Coding drills

1. **dockerfile-cold**: multi-stage Dockerfile for a webapi from memory, <10 min.
2. **compose-cold**: api+db compose with env vars, volume, healthcheck from memory, <12 min.
3. **explain-deploy**: 2-minute aloud — push-to-main to live-on-URL, every hop named.
4. **env-audit**: list every config value your app needs and where each lives in dev vs prod, <5 min, from memory.
5. **rollback-plan**: say aloud how you'd roll back a bad deploy with your setup (image tags!), 60s.

## Mini-project — p2 milestone 4 (final): live and self-deploying

Covered by the day blocks; the mini-project *is* p2 reaching the end of the pipeline.

**Acceptance criteria:**
- [ ] Public HTTPS URL; auth lifecycle works from a network you don't control.
- [ ] Fresh-clone test ≤ 5 minutes to running local system.
- [ ] CI: tests gate merges; main auto-deploys; secrets only in repo/platform secret stores.
- [ ] `/health` is real (checks DB); logs are findable and structured in prod.
- [ ] README would let a hiring manager evaluate the project in 5 minutes without cloning it.

## Common mistakes checklist

- [ ] Secrets baked into images or committed in compose/env files.
- [ ] No volume on Postgres (data vanishes on recreate) — or testing this in prod.
- [ ] Image contains the SDK/source (single-stage build).
- [ ] `latest` tags everywhere = no rollback story.
- [ ] CI that doesn't run tests, or deploys even when red.
- [ ] No health endpoint; "is it up?" answered by opening Swagger manually.
- [ ] HTTP only, or TLS terminated nowhere.
- [ ] Works-on-my-machine: never running the fresh-clone test.

## Mastery checkpoint — cp9

**Timed: 2 hours. The cold redeploy.** Docs allowed, AI not, your own p2 repo allowed (this cp tests ops skill, not memory of code).
Simulate total environment loss: from a **fresh clone on a clean directory** and a blank host target (delete the deployment — containers, volumes kept only if your runbook says so), get back to: local stack running, tests green, deployed to public HTTPS URL with working auth and health, CI verified by pushing a real commit.
**Pass criteria:** live URL inside 2 hours · no step required "remembering" (everything from README/runbook — gaps you hit get written in *during* the cp) · secrets never touched git · you can answer drill 5 (rollback) concretely.

## Interview relevance

"How do you deploy your projects?" — you now answer with a pipeline, not a shrug. Dockerfile walkthrough, env-based config, what CI runs, health checks, rollback — these exact questions appear in junior interviews because they predict day-1 usefulness on a team. Recruiter keywords now truthfully on your résumé: Docker, docker-compose, GitHub Actions, CI/CD, Linux, nginx/Caddy, PostgreSQL ops basics.

## Integration notes

p2 is **done** — pipeline column "Documented", your second portfolio item and the template for the capstone's infrastructure (copy the Dockerfile/compose/workflow shapes, budget a day there, not a week). Passing cp9 unlocks module 10. Start drafting applications now (`07-career/applications.md`) — the capstone happens *in parallel* with applying.
